// The workbench (docs/QUESTIONS.md, Q77): one puzzle on a bench of its own,
// opened from a shop's Workbench tab. It builds and runs as the shop does,
// with the puzzle's pieces for free, and the tray's order where the till and
// the newest regular would be. The shop is not open meanwhile: its save is
// left as it was, lastSeen and all, so time here is time away and the shop
// greets the player with the morning report when they go back. Only the
// shop's workbench progress is written: puzzles solved, and each bench's
// pieces.

import { tileIndex } from '../sim';
import type { PuzzleDef, SimEvent } from '../sim/types';
import {
  type BenchProgress,
  TIER_NAME,
  Workbench,
  isWanted,
  ladderName,
  puzzleOpen,
  wantItem,
  wantName,
} from '../game/bench';
import { ALL_PIECES } from '../game/pieces';
import { BENCH_SOLVE_LOOPS } from '../game/tuning';
import { PUZZLES } from '../levels/puzzles';
import { REGULARS } from '../levels/regulars';
import { spriteImg } from './art/dom';
import { itemKey } from './art/svg';
import { touchFirst } from './device';
import { el } from './el';
import { FloorApp } from './floorApp';
import { BENCH_MARKS } from './guide';
import { Shell } from './layout';
import type { PaletteModel } from './palette';
import { Tabs, helpPane } from './panel';
import type { View } from './render';
import { routeUrl } from './route';
import { AUTOSAVE_MS, openSlot, writeBench } from './storage';
import { orderTipKey } from './tips';

/** The line under the palette when nothing on the bench is hovered or tapped. */
const TAKE_UP_HINT = {
  mouse: 'Z takes up the piece under the cursor. Every piece here is free.',
  touch: 'Tap a piece on the bench to see it, then Delete to take it up. Every piece here is free.',
};

/**
 * Open a workbench puzzle in a slot's shop. Returns null once it is open, or
 * why it could not be: no shop in the slot, no such puzzle, or one the shop
 * has not opened yet.
 */
export function openBench(root: HTMLElement, debug: boolean, slot: number, id: string): string | null {
  const def = PUZZLES.find((p) => p.id === id);
  if (!def) return 'That workbench puzzle could not be found, so here are your shops.';
  const loaded = openSlot(REGULARS, debug, slot);
  if (!loaded) return `There is no shop in slot ${slot} to take to the workbench.`;
  const shop = loaded.shop;
  if (!puzzleOpen(PUZZLES, id, shop.rights().unlocked, new Set(shop.bench.solved))) return `${def.name} is not open in that shop yet.`;
  const app = new BenchApp(root, debug, slot, def, shop.bench);
  // Dev builds only: lets the console inspect the bench.
  if (import.meta.env.DEV) (window as unknown as { ticktock: BenchApp }).ticktock = app;
  return null;
}

class BenchApp extends FloorApp<Workbench> {
  private readonly order: OrderCard;
  private leaving = false;

  constructor(
    root: HTMLElement,
    private readonly debug: boolean,
    private readonly slot: number,
    private readonly def: PuzzleDef,
    private readonly progress: BenchProgress,
  ) {
    const bench = new Workbench(def, progress.floors[def.id] ?? [], progress.solved.includes(def.id));
    super(bench, { cols: bench.cols, counter: false }, touchFirst() ? TAKE_UP_HINT.touch : TAKE_UP_HINT.mouse);
    const rungs = PUZZLES.filter((p) => p.ladder === def.ladder);
    const next = rungs[rungs.indexOf(def) + 1] ?? null;
    this.order = new OrderCard(def, next, (id) => this.leave(id));
    this.tabs = new Tabs(
      [
        { id: 'guide', label: 'Guide', content: [this.guide.root] },
        { id: 'help', label: 'Help', content: helpPane(null, this.touch) },
      ],
      () => this.tooltip.refresh(),
    );
    this.floorArea.append(this.canvas);
    this.shell = new Shell(
      root,
      {
        title: el('h1', {}, 'The workbench', debug ? el('span', { className: 'badge' }, 'debug') : ''),
        visit: this.puzzleCard(),
        clock: this.panel.clock,
        coins: this.panel.coins,
        next: this.order.root,
        till: el('div', { hidden: true }),
        tabs: this.tabs.root,
        floor: this.floorArea,
        tools: this.tools.root,
        palette: this.palette.root,
        info: this.panel.info,
        stick: this.stick.root,
      },
      () => this.render(),
    );
    window.setInterval(() => this.save(), AUTOSAVE_MS);
    window.addEventListener('pagehide', () => this.save());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.save();
    });
    // In a narrow window the puzzle and its order are in the drawer: open it on arrival, to be read first.
    this.shell.openDrawer();
    this.start();
  }

  /** The puzzle this screen runs. */
  get bench(): Workbench {
    return this.floor;
  }

  /** The puzzle's name, ladder and tier, what it asks, and the ways out. */
  private puzzleCard(): HTMLElement {
    const back = el('button', { className: 'primary', textContent: 'Back to the shop' });
    back.onclick = () => this.leave(null);
    const restart = el('button', { textContent: 'Start over' });
    restart.title = 'Clear the bench of items and start the clock again from tick 0. Your pieces stay.';
    restart.onclick = () => {
      this.bench.restart();
      this.readouts.clear();
      this.editor.message = 'Started over from tick 0';
      this.render();
    };
    return el(
      'div',
      { className: 'card visit puzzle-card' },
      el('div', { className: 'visit-top' }, el('div', { className: 'card-name' }, this.def.name), back),
      el('div', { className: 'muted' }, `${ladderName(this.def.ladder)} · ${TIER_NAME[this.def.tier]}`),
      el('div', { className: 'intro puzzle-brief' }, this.def.brief),
      el('div', { className: 'row' }, restart),
    );
  }

  /** Keep this bench's pieces, and whether it is solved, in the shop's save. Nothing else in it changes. */
  private save(): void {
    if (this.leaving) return;
    const placed = this.bench.placed();
    if (placed.length) this.progress.floors[this.def.id] = placed;
    else delete this.progress.floors[this.def.id];
    if (this.bench.solved && !this.progress.solved.includes(this.def.id)) this.progress.solved.push(this.def.id);
    writeBench(REGULARS, this.debug, this.slot, this.progress);
  }

  /** Save, and go back to the shop (to its morning report), or on to another puzzle. */
  private leave(bench: string | null): void {
    this.save();
    this.leaving = true;
    this.stop();
    location.assign(routeUrl(location.pathname, { debug: this.debug, slot: this.slot, bench }));
  }

  protected tickFloor(): SimEvent[] {
    const report = this.bench.tick();
    if (report.solvedNow) {
      this.editor.message = `Solved! The tray had its order ${BENCH_SOLVE_LOOPS} loops in a row.`;
      this.save();
    }
    return report.events;
  }

  protected floorParts(): Pick<View, 'forSale' | 'stools' | 'cat' | 'bench'> {
    const took = new Map<number, boolean>();
    for (const e of this.bench.lastEvents) if (e.type === 'deliver') took.set(e.at, isWanted(this.def.wants, e.item));
    return { forSale: null, stools: [], cat: null, bench: { holes: this.bench.holes, fixed: this.bench.fixed, took } };
  }

  protected paletteModel(): PaletteModel {
    const hand = this.editor.hand;
    return {
      palette: ALL_PIECES.filter((p) => p in this.def.pieces).map((piece) => {
        const left = this.bench.left(piece);
        return { piece, locked: false, note: left === null ? '' : `${left} left` };
      }),
      inHand: hand ? (hand.type === 'piece' ? hand.piece : 'group') : null,
      keys: !this.touch,
      free: true,
    };
  }

  protected hoverInfo(): string {
    const h = this.hover ?? (this.editor.hand ? this.cursor : this.inspect);
    if (!h || h.row < 0) return '';
    const i = tileIndex(h.row, h.col);
    if (this.bench.holes.has(i)) return `Row ${h.row}, column ${h.col}: not bench. Anything carried here spills.`;
    const parts = this.tileInfo(h);
    if (i === this.bench.tray) parts.push('takes one item a tick, from any side');
    return parts.join(' · ');
  }

  protected updatePanels(): void {
    const b = this.bench;
    this.panel.update({
      T: b.sim.T,
      running: this.running,
      speed: this.speed,
      till: 0,
      gears: 0,
      spillsThisLoop: b.spillsThisLoop,
      spillsLastLoop: b.spillsLastLoop,
      milk: '',
      seated: '',
      message: this.editor.message,
      hoverInfo: this.hoverInfo(),
      bufferInfo: this.bufferInfo(),
      coinsText: `${this.def.wants.length === 1 ? wantName(this.def.wants[0]) : `${this.def.wants.length} in order`} · ${b.solved ? 'solved ✓' : `${b.streak}/${BENCH_SOLVE_LOOPS} loops`}`,
    });
    const offered = ALL_PIECES.filter((p) => p in this.def.pieces);
    this.guide.update({
      unlocked: new Set(offered),
      pieces: offered,
      rowsLocked: null,
      drinks: this.def.wants.map((w) => {
        const want = { kind: w.kind, roast: w.roast ?? null };
        return { want, key: `drink:${w.kind}:${w.roast ?? 'any'}`, who: ['the tray'] };
      }).filter((d, k, all) => all.findIndex((x) => x.key === d.key) === k),
      marks: BENCH_MARKS,
      free: true,
    });
    this.order.update(b);
  }
}

/**
 * The tray's order: what it wants every loop, what it has taken so far this
 * loop, how the last loop went, the loops in a row so far, and once solved,
 * the way on to the next rung.
 */
class OrderCard {
  readonly root = el('div', { className: 'card order-card' });
  private got = el('div', { className: 'got-row' });
  private verdict = el('div', { className: 'verdict' });
  private pips = el('span', { className: 'pips' });
  private spills = el('div', { className: 'muted' });
  private solved = el('div', { className: 'solved' });
  private shown = '';

  constructor(
    private readonly def: PuzzleDef,
    next: PuzzleDef | null,
    go: (id: string) => void,
  ) {
    const wants = el(
      'div',
      { className: 'wants' },
      ...def.wants.map((w) => {
        const name = el('span', { className: 'tip', textContent: wantName(w) });
        name.dataset.tip = orderTipKey(w.kind, w.roast ?? 'any');
        return el('div', { className: 'want' }, spriteImg(itemKey(wantItem(w)), 30), name, el('span', { className: 'muted' }, w.tick === undefined ? 'any tick' : ''));
      }),
    );
    const nextBtn = next ? el('button', { className: 'primary', textContent: `Next: ${next.name}` }) : null;
    if (nextBtn && next) nextBtn.onclick = () => go(next.id);
    this.solved.append(el('span', { className: 'card-name' }, 'Solved ✓'), ...(nextBtn ? [nextBtn] : []));
    this.root.append(
      el('div', { className: 'muted' }, def.wants.length === 1 ? 'The tray wants, every loop:' : 'The tray wants, every loop, in this order:'),
      wants,
      el('div', { className: 'muted got-label' }, 'This loop:'),
      this.got,
      this.verdict,
      el('div', { className: 'muted streak' }, this.pips, ` ${BENCH_SOLVE_LOOPS} loops in a row and it is solved.`),
      this.spills,
      this.solved,
    );
  }

  update(b: Workbench): void {
    const key = JSON.stringify([b.delivered, b.lastVerdict, b.streak, b.solved, b.spillsThisLoop, b.spillsLastLoop]);
    if (key === this.shown) return;
    this.shown = key;
    this.got.replaceChildren(
      ...(b.delivered.length
        ? b.delivered.map((d) =>
            el('span', { className: `got ${isWanted(this.def.wants, d.item) ? 'ok' : 'bad'}` }, spriteImg(itemKey(d.item), 24), `t${d.tick}`),
          )
        : [el('span', { className: 'muted' }, 'nothing yet')]),
    );
    const v = b.lastVerdict;
    this.verdict.className = `verdict${v ? (v.ok ? ' ok' : ' bad') : ''}`;
    this.verdict.textContent = v ? `Last loop: ${v.ok ? '✓' : '✕'} ${v.why}` : 'Last loop: not a whole loop yet.';
    this.pips.replaceChildren(...Array.from({ length: BENCH_SOLVE_LOOPS }, (_, k) => el('span', { className: k < b.streak ? 'pip on' : 'pip' })));
    this.pips.classList.toggle('happy', b.solved);
    this.spills.textContent = `Spills: ${b.spillsThisLoop} this loop, ${b.spillsLastLoop} last loop`;
    this.solved.hidden = !b.solved;
  }
}
