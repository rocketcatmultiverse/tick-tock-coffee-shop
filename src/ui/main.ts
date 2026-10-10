import './style.css';
import { counterIndex, feederSlot, isPresent, itemName, slotOf, structureToken, tileIndex } from '../sim';
import { MILK_TICK } from '../sim/tuning';
import type { Layout, Roast } from '../sim/types';
import { ALL_PIECES } from '../game/pieces';
import { applyOffline } from '../game/offline';
import { Shop } from '../game/shop';
import { type StripCell, counterStrip } from '../game/strip';
import { REGULARS } from '../levels/regulars';
import { catSpot } from './cat';
import { CatCard } from './catCard';
import { RegularsPanel } from './regularsPanel';
import { StripView } from './strip';
import { SpriteBank } from './art/raster';
import { Editor } from './editor';
import { canvasSize, type Spot } from './geometry';
import { bindInput } from './input';
import { Panel, el } from './panel';
import { showMorningReport } from './morningReport';
import { draw, type View } from './render';
import { clearSave, readSave, writeSave } from './storage';

/** How often the shop is saved while open, in milliseconds. */
const AUTOSAVE_MS = 2000;

class App {
  readonly shop: Shop;
  readonly editor: Editor;
  hover: Spot | null = null;
  running = true;
  speed = 1;
  private timer: number | undefined;
  private readouts = new Map<number, { tick: number; roast: Roast | null }>();
  private canvas = el('canvas', { className: 'floor' });
  /** Sprites are rasterised once and redrawn when they arrive. */
  private sprites = new SpriteBank(() => this.render());
  private ctx: CanvasRenderingContext2D;
  private panel: Panel;
  private stripView = new StripView();
  private regularsPanel = new RegularsPanel();
  private notes: string[] = [];
  private catCard = new CatCard({
    getName: () => this.shop.catName,
    setName: (n) => {
      this.shop.catName = n;
    },
    isMad: () => this.catMad(),
    render: () => this.render(),
  });
  /** Steady state is recomputed only when the layout or the seats change. */
  private stripCache: { layout: Layout; seats: number; strip: StripCell[] | null } | null = null;

  private resetting = false;

  constructor(root: HTMLElement, debug: boolean) {
    const loaded = readSave(REGULARS, debug);
    this.shop = loaded?.shop ?? new Shop({ defs: REGULARS, debug });
    this.notes.push(loaded ? 'Welcome back. The floor starts empty and fills again within a loop or two.' : `${REGULARS[0].name} walks in: "${REGULARS[0].intro}"`);
    const report = loaded ? applyOffline(this.shop, loaded.lastSeen, Date.now()) : null;
    this.editor = new Editor(this.shop);
    this.ctx = this.canvas.getContext('2d')!;
    this.panel = new Panel(
      {
        togglePause: () => this.togglePause(),
        stepOnce: () => this.stepOnce(),
        setSpeed: (n) => {
          this.speed = n;
          this.schedule();
          this.render();
        },
        pick: (p) => {
          this.editor.pick(p);
          this.render();
        },
        buyRow: () => {
          this.editor.message = this.shop.buyRow() ?? 'Bought a floor row';
          this.render();
        },
        undo: () => {
          this.editor.undo();
          this.render();
        },
        redo: () => {
          this.editor.redo();
          this.render();
        },
      },
      debug,
    );
    const fresh = el('button', { textContent: 'Start a new shop' });
    fresh.onclick = () => this.startOver();
    this.panel.extra.append(this.catCard.root, this.regularsPanel.root, el('div', { className: 'row' }, fresh));
    root.append(el('main', { className: 'floor-wrap' }, this.canvas, this.stripView.root), this.panel.root);
    bindInput(this.canvas, this);
    this.save();
    window.setInterval(() => this.save(), AUTOSAVE_MS);
    window.addEventListener('pagehide', () => this.save());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.save();
    });
    if (report) {
      // The clock waits while the morning report is read.
      this.running = false;
      const loyalty = new Map(this.shop.regulars.map((r) => [r.id, r.loyalty]));
      showMorningReport(report, loyalty, () => this.togglePause());
    }
    this.schedule();
    this.render();
    // The canvas draws text in the canvas's own fonts; redraw once they have loaded.
    document.fonts?.ready.then(() => this.render());
  }

  private save(): void {
    if (!this.resetting) writeSave(this.shop);
  }

  private startOver(): void {
    if (!window.confirm('Start a new shop? This clears the saved one.')) return;
    this.resetting = true;
    clearSave(this.shop.debug);
    location.reload();
  }

  /** The cat's seat, once it has started asking for milk. */
  private catSeat(): number {
    return this.shop.regulars.findIndex((_, i) => this.shop.defs[i].bowl);
  }

  private catMad(): boolean {
    const i = this.catSeat();
    return i >= 0 && this.shop.sim.blocked[i] === true;
  }

  private catAt(): Spot {
    return catSpot(Math.max(0, this.shop.T - 1), this.catSeat() >= 0);
  }

  clickFloor(spot: Spot): void {
    const cat = this.catAt();
    if (spot.row === cat.row && spot.col === cat.col) this.catCard.open();
  }

  rows(): number {
    return this.shop.layout.rows;
  }

  togglePause(): void {
    this.running = !this.running;
    this.schedule();
    this.render();
  }

  stepOnce(): void {
    if (this.running) return;
    this.advance();
  }

  private schedule(): void {
    window.clearInterval(this.timer);
    if (this.running) this.timer = window.setInterval(() => this.advance(), 1000 / this.speed);
  }

  private advance(): void {
    const report = this.shop.tick();
    for (const e of report.events) {
      if (e.type === 'brew') this.readouts.set(e.at, { tick: e.tick, roast: 'roast' in e.item ? e.item.roast : null });
    }
    this.notes = [...report.notes.map((n) => `${report.T % 12}: ${n}`).reverse(), ...this.notes].slice(0, 8);
    this.render();
  }

  private hoverInfo(): string {
    const h = this.hover;
    if (!h) return '';
    const { layout, sim } = this.shop;
    if (h.row === -1) {
      const item = sim.belts[counterIndex(layout, h.col)];
      const ticks = this.strip()?.[h.col].cupTicks ?? [];
      const steady = ticks.length ? `in steady state a cup sits here on ticks ${ticks.join(', ')}` : 'no cup here in steady state';
      return `Counter, column ${h.col}, slot ${slotOf(this.shop.T - 1, h.col)} passing${item ? ': ' + itemName(item) : ''} · ${steady}`;
    }
    const i = tileIndex(h.row, h.col);
    const s = layout.tiles[i];
    const item = sim.belts[i];
    const parts = [`Row ${h.row}, column ${h.col}`];
    if (s) parts.push(`${s.kind} (${structureToken(s)})`);
    if (item) parts.push(`holding ${itemName(item)}`);
    if (s?.kind === 'bowl') parts.push(this.catSeat() >= 0 ? 'the cat wants warm milk here on ticks 10 to 1' : 'the cat is not asking yet');
    if (s?.kind === 'feeder') parts.push(`the only way onto the counter; slot ${feederSlot(this.shop.T - 1, h.row)} is passing`);
    const cat = this.catAt();
    if (cat.row === h.row && cat.col === h.col) parts.push(`${this.shop.catName || 'your cat'} (click to name or pet)`);
    const ro = this.readouts.get(i);
    if (s?.kind === 'kettle' && ro) parts.push(`last input landed on tick ${ro.tick}${ro.roast ? `: ${ro.roast}` : ''}`);
    return parts.join(' · ');
  }

  /** The slot a stool wants; an any-tick stool shows "any", then the slot it last took a cup from. */
  private stoolSlot(i: number): string {
    const seat = this.shop.seats()[i];
    if (seat.tick !== 'any') return `slot ${slotOf(seat.tick, seat.col)}`;
    const last = this.shop.sim.lastServedAt[i];
    return last === null ? 'any' : `any·${slotOf(last, seat.col)}`;
  }

  /** How many of the regulars who have walked in are seated. */
  private seatedInfo(): string {
    const regs = this.shop.regulars;
    const seated = regs.filter((r) => r.status === 'seated').length;
    if (seated === this.shop.defs.length) return 'all seated';
    return `${seated} seated${regs.length > seated ? ` · ${regs.length - seated} not` : ''}`;
  }

  /** The milk order: how many pails, and from which tick. */
  private milkInfo(): string {
    const n = this.shop.milkOrder();
    if (n === 0) return 'Milk order: none yet';
    const ticks = n === 1 ? `tick ${MILK_TICK}` : `ticks ${MILK_TICK} to ${MILK_TICK + n - 1}`;
    return `Milk order: ${n} pail${n === 1 ? '' : 's'} a loop through the side door, on ${ticks}`;
  }

  private strip(): StripCell[] | null {
    const seats = this.shop.seats();
    const c = this.stripCache;
    if (c && c.layout === this.shop.layout && c.seats === seats.length) return c.strip;
    const strip = counterStrip(this.shop.layout, seats, this.shop.defs);
    this.stripCache = { layout: this.shop.layout, seats: seats.length, strip };
    return strip;
  }

  render(): void {
    const size = canvasSize(this.shop.layout.rows);
    // Draw at the screen's own pixel density so the hand-drawn lines stay crisp.
    const dpr = window.devicePixelRatio || 1;
    if (this.canvas.width !== Math.round(size.w * dpr) || this.canvas.height !== Math.round(size.h * dpr)) {
      this.canvas.width = Math.round(size.w * dpr);
      this.canvas.height = Math.round(size.h * dpr);
      this.canvas.style.width = `${size.w}px`;
      this.canvas.style.height = `${size.h}px`;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const view: View = {
      shop: this.shop,
      editor: this.editor,
      hover: this.hover,
      readouts: this.readouts,
      stools: this.shop
        .seats()
        .map((seat, i) => ({ seat, i }))
        .filter(({ seat }) => seat.bowl === undefined)
        .map(({ seat, i }) => ({
          col: seat.col,
          id: this.shop.defs[i].id,
          slot: this.stoolSlot(i),
          // The floor shows the tick just run, so presence is read for that tick.
          present: this.shop.T > 0 && isPresent(seat, this.shop.T - 1),
          servedNow: this.shop.lastEvents.some((e) => e.type === 'serve' && e.seat === i),
          status: this.shop.regulars[i].status,
        })),
      cat: { spot: this.catAt(), heart: this.catCard.heart, mad: this.catMad() },
      sprites: this.sprites,
      dpr,
    };
    draw(this.ctx, view);
    const rights = this.shop.rights();
    const wells = this.shop.layout.tiles.filter((s) => s?.kind === 'well').length;
    const hand = this.editor.hand;
    this.panel.update({
      T: this.shop.T,
      running: this.running,
      speed: this.speed,
      till: this.shop.till,
      gears: this.shop.gears,
      debug: this.shop.debug,
      spillsThisLoop: this.shop.spillsThisLoop,
      spillsLastLoop: this.shop.spillsLastLoop,
      milk: this.milkInfo(),
      seated: this.seatedInfo(),
      palette: ALL_PIECES.map((piece) => ({
        piece,
        locked: !rights.unlocked.has(piece),
        note: piece === 'well' && Number.isFinite(rights.wellLimit) ? `${wells}/${rights.wellLimit}` : '',
      })),
      inHand: hand ? (hand.type === 'piece' ? hand.piece : 'group') : null,
      message: this.editor.message,
      hoverInfo: this.hoverInfo(),
      bufferInfo: this.editor.buffer.entries.length
        ? `Paste buffer: ${this.editor.buffer.entries.length} entr${this.editor.buffer.entries.length === 1 ? 'y' : 'ies'}`
        : '',
      canUndo: this.editor.canUndo,
      canRedo: this.editor.canRedo,
    });
    this.stripView.update(this.strip());
    this.regularsPanel.update(this.shop.defs, this.shop.regulars, this.shop.newcomer(), this.notes);
  }
}

const debug = new URLSearchParams(location.search).has('debug');
const app = new App(document.getElementById('app')!, debug);
// Dev builds only: lets the console inspect the shop.
if (import.meta.env.DEV) (window as unknown as { ticktock: App }).ticktock = app;
