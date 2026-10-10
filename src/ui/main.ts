import './style.css';
import { counterIndex, feederSlot, isPresent, itemName, slotOf, structureToken, tileIndex } from '../sim';
import { MILK_TICK } from '../sim/tuning';
import type { Layout, Roast } from '../sim/types';
import { ALL_PIECES } from '../game/pieces';
import { applyOffline } from '../game/offline';
import { Shop } from '../game/shop';
import { type StripCell, counterStrip } from '../game/strip';
import { HAPPY_LOOPS } from '../game/tuning';
import { REGULARS } from '../levels/regulars';
import { catSpot } from './cat';
import { CatCard } from './catCard';
import { RegularsPanel } from './regularsPanel';
import { SpriteBank } from './art/raster';
import { Editor } from './editor';
import { Geometry, type Spot } from './geometry';
import { bindInput } from './input';
import { Panel, Tabs, el, keysPane } from './panel';
import { showMorningReport } from './morningReport';
import { type StoolView, type View, draw } from './render';
import { clearSave, readSave, writeSave } from './storage';

/** How often the shop is saved while open, in milliseconds. */
const AUTOSAVE_MS = 2000;
/** Happenings kept in the log. */
const NOTES_KEPT = 30;

const WORD = { justInTime: 'Just in Time', served: 'served', miss: 'missed' } as const;

class App {
  readonly shop: Shop;
  readonly editor: Editor;
  readonly geo = new Geometry();
  hover: Spot | null = null;
  running = true;
  speed = 1;
  private timer: number | undefined;
  private readouts = new Map<number, { tick: number; roast: Roast | null }>();
  private floorArea = el('div', { className: 'floor-area' });
  private canvas = el('canvas', { className: 'floor' });
  /** Sprites are rasterised once and redrawn when they arrive. */
  private sprites = new SpriteBank(() => this.render());
  private ctx: CanvasRenderingContext2D;
  private panel: Panel;
  private tabs: Tabs;
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
    this.panel = new Panel({
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
    });
    const fresh = el('button', { textContent: 'Start a new shop' });
    fresh.onclick = () => this.startOver();
    this.tabs = new Tabs([
      { id: 'regulars', label: 'Regulars', content: [this.regularsPanel.list] },
      { id: 'log', label: 'Happenings', content: [this.regularsPanel.log] },
      { id: 'keys', label: 'Keys', content: keysPane() },
      {
        id: 'shop',
        label: 'Shop',
        content: [this.catCard.root, el('p', { className: 'muted' }, 'Click your cat on the floor to name it or pet it.'), fresh],
      },
    ]);
    this.floorArea.append(this.canvas);
    root.append(
      this.floorArea,
      el('div', { className: 'bottom' }, this.panel.tillCard, this.panel.build),
      el(
        'aside',
        { className: 'side' },
        el('h1', {}, 'Tick Tock Coffee Shop', debug ? el('span', { className: 'badge' }, 'debug') : ''),
        this.panel.clock,
        this.regularsPanel.next,
        this.tabs.root,
      ),
    );
    bindInput(this.canvas, this);
    // The floor fills whatever room the panels leave it, and is redrawn when that changes.
    new ResizeObserver(() => this.render()).observe(this.floorArea);
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
    if (spot.row === cat.row && spot.col === cat.col) {
      this.tabs.select('shop');
      this.catCard.open();
    }
  }

  rows(): number {
    return this.shop.layout.rows;
  }

  /** Move the camera over the back room. */
  pan(dx: number, dy: number): void {
    this.geo.pan(dx, dy);
    this.render();
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
    this.notes = [...report.notes.map((n) => `${report.T % 12}: ${n}`).reverse(), ...this.notes].slice(0, NOTES_KEPT);
    this.render();
  }

  private hoverInfo(): string {
    const h = this.hover;
    if (!h) return '';
    const { layout, sim } = this.shop;
    if (h.row === -2) return this.stoolInfo(h.col);
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
    if (s?.kind === 'bowl') parts.push(this.catSeat() >= 0 ? 'the cat wants warm milk here on tick 10' : 'the cat is not asking yet');
    if (s?.kind === 'feeder') parts.push(`the only way onto the counter; slot ${feederSlot(this.shop.T - 1, h.row)} is passing`);
    const cat = this.catAt();
    if (cat.row === h.row && cat.col === h.col) parts.push(`${this.shop.catName || 'your cat'} (click to name or pet)`);
    const ro = this.readouts.get(i);
    if (s?.kind === 'kettle' && ro) parts.push(`last input landed on tick ${ro.tick}${ro.roast ? `: ${ro.roast}` : ''}`);
    return parts.join(' · ');
  }

  /** What the counter strip says about the stool in column `col`. */
  private stoolInfo(col: number): string {
    const cell = this.strip()?.[col];
    const ticks = cell?.cupTicks.length ? `cup in front of it on ticks ${cell.cupTicks.join(', ')}` : 'no cup here in steady state';
    const s = cell?.stool;
    if (!s) return `Column ${col}: no stool · ${ticks}`;
    const on = s.tick !== null ? ` on tick ${s.tick}` : '';
    const slot = s.slot !== null ? ` · slot ${s.slot}` : '';
    const happy = this.shop.happiness(s.seat);
    const mood = happy >= HAPPY_LOOPS ? 'happy' : `${happy} of ${HAPPY_LOOPS} loops in a row`;
    return `${s.def.name}: ${WORD[s.result]}${on}${s.item ? `, ${itemName(s.item)}` : ''}${slot} · ${mood} · ${ticks}`;
  }

  /** "t9 · s9" for a timed stool; "any · s7" for an any-tick one, with the slot it last took a cup from. */
  private stoolLabel(i: number): string {
    const seat = this.shop.seats()[i];
    if (seat.tick !== 'any') return `t${seat.tick} · s${slotOf(seat.tick, seat.col)}`;
    const last = this.shop.sim.lastServedAt[i];
    return last === null ? 'any' : `any · s${slotOf(last, seat.col)}`;
  }

  /** How the regulars are doing: how many are happy, and how many are in. */
  private seatedInfo(): string {
    const n = this.shop.regulars.length;
    const happy = this.shop.regulars.filter((_, i) => this.shop.isHappy(i)).length;
    return `${happy} of ${n} regular${n === 1 ? '' : 's'} happy${n < this.shop.defs.length ? '' : ' · everyone is in'}`;
  }

  /** The milk order: how many pails, and from which tick. */
  private milkInfo(): string {
    const n = this.shop.milkOrder();
    if (n === 0) return 'Milk order: none yet';
    const ticks = n === 1 ? `tick ${MILK_TICK}` : `ticks ${MILK_TICK}–${MILK_TICK + n - 1}`;
    return `Milk: ${n} pail${n === 1 ? '' : 's'} a loop, ${ticks}`;
  }

  private strip(): StripCell[] | null {
    const seats = this.shop.seats();
    const c = this.stripCache;
    if (c && c.layout === this.shop.layout && c.seats === seats.length) return c.strip;
    const strip = counterStrip(this.shop.layout, seats, this.shop.defs);
    this.stripCache = { layout: this.shop.layout, seats: seats.length, strip };
    return strip;
  }

  private stools(): StoolView[] {
    const strip = this.strip();
    return this.shop
      .seats()
      .map((seat, i) => ({ seat, i }))
      .filter(({ seat }) => seat.bowl === undefined)
      .map(({ seat, i }) => {
        const cell = strip?.[seat.col].stool;
        return {
          col: seat.col,
          id: this.shop.defs[i].id,
          label: this.stoolLabel(i),
          // The floor shows the tick just run, so presence is read for that tick.
          present: this.shop.T > 0 && isPresent(seat, this.shop.T - 1),
          servedNow: this.shop.lastEvents.some((e) => e.type === 'serve' && e.seat === i),
          status: this.shop.regulars[i].status,
          happy: this.shop.happiness(i),
          result: cell?.result ?? null,
          cup: cell?.item ?? null,
        };
      });
  }

  render(): void {
    // The canvas fills the floor area, at the screen's own pixel density so the lines stay crisp.
    const w = this.floorArea.clientWidth;
    const h = this.floorArea.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;
    }
    this.geo.fit(w, h, this.shop.layout.rows);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const view: View = {
      shop: this.shop,
      editor: this.editor,
      geo: this.geo,
      hover: this.hover,
      readouts: this.readouts,
      stools: this.stools(),
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
    this.regularsPanel.update(
      this.shop.defs,
      this.shop.regulars,
      this.shop.regulars.map((_, i) => this.shop.happiness(i)),
      this.shop.newcomer(),
      this.notes,
    );
  }
}

const debug = new URLSearchParams(location.search).has('debug');
const app = new App(document.getElementById('app')!, debug);
// Dev builds only: lets the console inspect the shop.
if (import.meta.env.DEV) (window as unknown as { ticktock: App }).ticktock = app;
