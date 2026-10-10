import './style.css';
import { counterIndex, isPresent, itemName, structureToken, tileIndex } from '../sim';
import type { Layout, Roast } from '../sim/types';
import { ALL_PIECES } from '../game/pieces';
import { Shop } from '../game/shop';
import { type StripCell, counterStrip } from '../game/strip';
import { REGULARS } from '../levels/regulars';
import { catSpot } from './cat';
import { RegularsPanel } from './regularsPanel';
import { StripView, shortName } from './strip';
import { Editor } from './editor';
import { canvasSize, type Spot } from './geometry';
import { bindInput } from './input';
import { Panel, el } from './panel';
import { draw, type View } from './render';

class App {
  readonly shop: Shop;
  readonly editor: Editor;
  hover: Spot | null = null;
  running = true;
  speed = 1;
  private timer: number | undefined;
  private readouts = new Map<number, { tick: number; roast: Roast | null }>();
  private canvas = el('canvas', { className: 'floor' });
  private ctx: CanvasRenderingContext2D;
  private panel: Panel;
  private stripView = new StripView();
  private regularsPanel = new RegularsPanel();
  private notes: string[] = [];
  /** Steady state is recomputed only when the layout or the seats change. */
  private stripCache: { layout: Layout; seats: number; strip: StripCell[] | null } | null = null;

  constructor(root: HTMLElement, debug: boolean) {
    this.shop = new Shop({ defs: REGULARS, debug });
    this.notes.push(`${REGULARS[0].name} walks in: "${REGULARS[0].intro}"`);
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
    this.panel.extra.append(this.regularsPanel.root);
    root.append(el('main', { className: 'floor-wrap' }, this.canvas, this.stripView.root), this.panel.root);
    bindInput(this.canvas, this);
    this.schedule();
    this.render();
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
      return `Counter, column ${h.col}${item ? ': ' + itemName(item) : ''} · ${steady}`;
    }
    const i = tileIndex(h.row, h.col);
    const s = layout.tiles[i];
    const item = sim.belts[i];
    const parts = [`Row ${h.row}, column ${h.col}`];
    if (s) parts.push(`${s.kind} (${structureToken(s)})`);
    if (item) parts.push(`holding ${itemName(item)}`);
    const ro = this.readouts.get(i);
    if (s?.kind === 'kettle' && ro) parts.push(`last input landed on tick ${ro.tick}${ro.roast ? `: ${ro.roast}` : ''}`);
    return parts.join(' · ');
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
    if (this.canvas.width !== size.w || this.canvas.height !== size.h) {
      this.canvas.width = size.w;
      this.canvas.height = size.h;
    }
    const view: View = {
      shop: this.shop,
      editor: this.editor,
      hover: this.hover,
      readouts: this.readouts,
      stools: this.shop.seats().map((seat, i) => ({
        col: seat.col,
        label: shortName(this.shop.defs[i].name).slice(0, 2),
        // The floor shows the tick just run, so presence is read for that tick.
        present: this.shop.T > 0 && isPresent(seat, this.shop.T - 1),
        servedNow: this.shop.lastEvents.some((e) => e.type === 'serve' && e.seat === i),
        status: this.shop.regulars[i].status,
      })),
      shelf: this.shop.shelf,
      cat: catSpot(Math.max(0, this.shop.T - 1)),
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
