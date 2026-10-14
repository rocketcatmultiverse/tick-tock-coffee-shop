// The workbench (docs/QUESTIONS.md, Q77): one puzzle on a bench of its own,
// opened from a shop's Workbench tab. It builds and runs as the shop does,
// with the puzzle's pieces for free, and the tray's order where the till and
// the newest regular would be. The shop is not open meanwhile: its save is
// left as it was, lastSeen and all, so time here is time away and the shop
// greets the player with the morning report when they go back. Only the
// shop's workbench progress is written: puzzles solved, and each bench's
// pieces.
//
// A new shop's keys wait for its lessons, the hands-on basics (Q80). While
// they do, the bench is where the player is: each lesson leads on to the
// next, the way out is to the save slots, and the last one hands over the
// keys and opens the shop. The first lesson opens with the keys dialog and
// the offer of the bench tour. A lesson solved is cheered on the bench, and
// then the next opens by itself, or after the last, the shop (Q81).

import { tileIndex } from '../sim';
import type { PieceKind, PuzzleDef, SimEvent } from '../sim/types';
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
import { afterLesson, lessons, nextLesson } from '../game/keys';
import { ALL_PIECES } from '../game/pieces';
import { BENCH_SOLVE_LOOPS } from '../game/tuning';
import { PUZZLES } from '../levels/puzzles';
import { REGULARS } from '../levels/regulars';
import { spriteImg } from './art/dom';
import { itemKey } from './art/svg';
import { touchFirst } from './device';
import { el } from './el';
import { CHEER_MS } from './celebrate';
import { FloorApp } from './floorApp';
import { PAD } from './geometry';
import { BENCH_MARKS } from './guide';
import { Shell } from './layout';
import type { PaletteModel } from './palette';
import { Tabs, helpPane } from './panel';
import type { View } from './render';
import { routeUrl } from './route';
import { AUTOSAVE_MS, openSlot, writeBench } from './storage';
import { orderTipKey } from './tips';
import { type BenchStepId, type Box, Tour, benchTour, keysText, offerTour } from './tutorial';

/** The line under the palette when nothing on the bench is hovered or tapped. */
const TAKE_UP_HINT = {
  mouse: 'Z takes up the piece under the cursor. Every piece here is free.',
  touch: 'Tap a piece on the bench to see it, then Delete to take it up. Every piece here is free.',
};

/**
 * Open a workbench puzzle in a slot's shop. Returns null once it is open, or
 * why it could not be: no shop in the slot, no such puzzle, or one the shop
 * has not opened yet. `welcome` greets a new shop's first lesson with the
 * keys dialog (Q80).
 */
export function openBench(root: HTMLElement, debug: boolean, slot: number, id: string, welcome = false): string | null {
  const def = PUZZLES.find((p) => p.id === id);
  if (!def) return 'That workbench puzzle could not be found, so here are your shops.';
  const loaded = openSlot(REGULARS, debug, slot);
  if (!loaded) return `There is no shop in slot ${slot} to take to the workbench.`;
  const shop = loaded.shop;
  if (!puzzleOpen(PUZZLES, id, shop.rights().unlocked, new Set(shop.bench.solved))) return `${def.name} is not open in that shop yet.`;
  const app = new BenchApp(root, debug, slot, def, shop.bench, shop.apprentice ? lessons(PUZZLES) : null);
  if (welcome) app.welcome();
  // Dev builds only: lets the console inspect the bench.
  if (import.meta.env.DEV) (window as unknown as { ticktock: BenchApp }).ticktock = app;
  return null;
}

class BenchApp extends FloorApp<Workbench> {
  private readonly order: OrderCard;
  private readonly card: HTMLElement;
  /** The puzzle card's way out: back to the shop, or while the keys wait, to the save slots or on into the shop. */
  private readonly back = el('button', { className: 'primary' });
  private leaving = false;
  private tour: Tour<BenchStepId> | null = null;
  /** A solved lesson being cheered on the bench (Q81). */
  private cheer: NonNullable<View['bench']>['cheer'] = null;

  /** `lessons` are the lessons before the keys while the shop's keys wait for them (Q80), else null. */
  constructor(
    root: HTMLElement,
    private readonly debug: boolean,
    private readonly slot: number,
    private readonly def: PuzzleDef,
    private readonly progress: BenchProgress,
    private readonly lessons: PuzzleDef[] | null,
  ) {
    const bench = new Workbench(def, progress.floors[def.id] ?? [], progress.solved.includes(def.id));
    super(bench, { cols: bench.cols, counter: false }, touchFirst() ? TAKE_UP_HINT.touch : TAKE_UP_HINT.mouse);
    const rungs = PUZZLES.filter((p) => p.ladder === def.ladder);
    const rung = rungs[rungs.indexOf(def) + 1] ?? null;
    // The last lesson leads into the shop, with its keys; the rungs after it wait in the shop's Workbench tab.
    const next: NextStep | null =
      lessons?.at(-1) === def
        ? { label: 'Open the shop', note: 'That was the last lesson: the keys to the shop are yours.', go: () => this.leave(null) }
        : rung && { label: `Next: ${rung.name}`, go: () => this.leave(rung.id) };
    this.order = new OrderCard(def, next);
    this.tabs = new Tabs(
      [
        { id: 'guide', label: 'Guide', content: [this.guide.root] },
        { id: 'help', label: 'Help', content: helpPane(() => this.startTour(), this.touch, true) },
      ],
      () => this.tooltip.refresh(),
    );
    this.floorArea.append(this.canvas);
    this.card = this.puzzleCard();
    this.shell = new Shell(
      root,
      {
        title: el('h1', {}, 'The workbench', debug ? el('span', { className: 'badge' }, 'debug') : ''),
        visit: this.card,
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

  /** The puzzle's name, ladder and tier (or which lesson it is), what it asks, and the ways out. */
  private puzzleCard(): HTMLElement {
    const lesson = this.lessons?.indexOf(this.def) ?? -1;
    const where = lesson >= 0 ? `Lesson ${lesson + 1} of ${this.lessons!.length} · then the keys` : `${ladderName(this.def.ladder)} · ${TIER_NAME[this.def.tier]}`;
    this.back.onclick = () => (this.lessons && !this.keysReady() ? this.leave(null, true) : this.leave(null));
    this.updateBack();
    const restart = el('button', { textContent: 'Start over' });
    restart.title = 'Clear the bench of items and start the clock again from tick 0. Your pieces stay.';
    restart.onclick = () => {
      this.bench.restart();
      this.readouts.clear();
      this.editor.message = 'Started over from tick 0';
      this.render();
    };
    // Debug shops may skip the lessons, as if solved, to try the shop's first opening.
    const skip = this.lessons && this.debug ? [el('button', { textContent: 'Skip the lessons (debug)' })] : [];
    for (const b of skip) b.onclick = () => this.skipLessons();
    return el(
      'div',
      { className: 'card visit puzzle-card' },
      el('div', { className: 'visit-top' }, el('div', { className: 'card-name' }, this.def.name), this.back),
      el('div', { className: 'muted' }, where),
      el('div', { className: 'intro puzzle-brief' }, this.def.brief),
      el('div', { className: 'row' }, restart, ...skip),
    );
  }

  /** While the keys wait: every lesson is solved, so the way out is into the shop. */
  private keysReady(): boolean {
    return this.lessons !== null && nextLesson(this.lessons, this.progress.solved) === null;
  }

  private updateBack(): void {
    const label = !this.lessons ? 'Back to the shop' : this.keysReady() ? 'Open the shop' : 'Back to save slots';
    if (this.back.textContent !== label) this.back.textContent = label;
  }

  private skipLessons(): void {
    for (const p of this.lessons ?? []) if (!this.progress.solved.includes(p.id)) this.progress.solved.push(p.id);
    this.leave(null);
  }

  /** A new shop's first lesson: the keys wait for the lessons, and the bench tour is offered (Q80). */
  welcome(): void {
    offerTour(keysText(this.lessons?.length ?? 0, this.shell.compact), { take: () => this.startTour(), skip: () => {} }, 'Show me the workbench');
  }

  startTour(): void {
    this.tour?.end();
    const lesson = this.lessons?.indexOf(this.def) ?? -1;
    const offered = ALL_PIECES.filter((p): p is PieceKind => p in this.def.pieces);
    const steps = benchTour(
      {
        card: this.card,
        order: this.order.root,
        floor: () => this.benchBox(),
        pieces: () => this.palette.pieceButtons(offered),
        clock: this.panel.clock,
        help: () => (this.shell.compact ? this.shell.menu : this.tabs.button('help')),
      },
      this.def,
      { touch: this.touch, menu: this.shell.compact, lesson: lesson >= 0 ? { n: lesson + 1, of: this.lessons!.length } : undefined },
    );
    this.tour = new Tour(steps, (step) => this.prepareTour(step), () => {
      this.tour = null;
    });
    this.tour.start();
  }

  /** In a narrow window the puzzle's card and its order are in the drawer: open it for those steps, and close it for the rest. */
  private prepareTour(step: BenchStepId | null): void {
    if (step === 'lesson' || step === 'order') this.shell.openDrawer();
    else if (step !== null) this.shell.closeDrawer();
  }

  /** The bench on the floor canvas, in page pixels, cut to what is in view. */
  private benchBox(): Box | null {
    const c = this.canvas.getBoundingClientRect();
    const g = this.geo;
    if (c.width === 0) return null;
    const left = Math.max(g.x0, 0);
    const right = Math.min(g.x0 + g.floorW, g.width);
    const top = Math.max(PAD, g.counterY - g.rows * g.tile + g.camY);
    const bottom = Math.min(g.counterY + g.camY, g.height - PAD);
    if (right <= left || bottom <= top) return null;
    return { left: c.left + left, top: c.top + top, width: right - left, height: bottom - top };
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

  /** Save, and go back to the shop (to its morning report), on to another puzzle, or to the save slots. */
  private leave(bench: string | null, slots = false): void {
    this.save();
    this.leaving = true;
    this.stop();
    this.tour?.end();
    location.assign(routeUrl(location.pathname, { debug: this.debug, slot: slots ? null : this.slot, bench }));
  }

  protected tickFloor(): SimEvent[] {
    const report = this.bench.tick();
    if (report.solvedNow) {
      this.editor.message = `Solved! The tray had its order ${BENCH_SOLVE_LOOPS} loops in a row.`;
      this.save();
      this.cheerLesson();
    }
    return report.events;
  }

  /**
   * In the lessons before the keys only: cheer the solve on the bench, then go
   * straight on to the next lesson, or into the shop after the last (Q81).
   */
  private cheerLesson(): void {
    const after = this.lessons ? afterLesson(PUZZLES, this.def.id, this.progress.solved) : null;
    if (!after || this.cheer) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const line = after.to === 'lesson' ? `Next: ${after.lesson.name}` : 'The keys are yours';
    const cheer = { ms: 0, line, reduced };
    this.cheer = cheer;
    this.tour?.end();
    const start = performance.now();
    const frame = () => {
      if (this.leaving) return;
      cheer.ms = performance.now() - start;
      this.render();
      if (cheer.ms < CHEER_MS) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    // A timer moves on, not the last frame: frames stop where the page is not being drawn, and the lessons must not.
    window.setTimeout(() => {
      if (!this.leaving) this.leave(after.to === 'lesson' ? after.lesson.id : null);
    }, CHEER_MS);
  }

  protected floorParts(): Pick<View, 'forSale' | 'stools' | 'cat' | 'bench'> {
    const took = new Map<number, boolean>();
    for (const e of this.bench.lastEvents) if (e.type === 'deliver') took.set(e.at, isWanted(this.def.wants, e.item));
    return { forSale: null, stools: [], cat: null, bench: { holes: this.bench.holes, fixed: this.bench.fixed, took, tray: this.bench.tray, cheer: this.cheer } };
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
    this.updateBack();
  }
}

/** What follows a solved puzzle: the next rung, or after the last lesson, the shop. */
interface NextStep {
  label: string;
  note?: string;
  go(): void;
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
    next: NextStep | null,
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
    const nextBtn = next ? el('button', { className: 'primary', textContent: next.label }) : null;
    if (nextBtn && next) nextBtn.onclick = () => next.go();
    const note = next?.note ? [el('span', { className: 'muted' }, next.note)] : [];
    this.solved.append(el('span', { className: 'card-name' }, 'Solved ✓'), ...note, ...(nextBtn ? [nextBtn] : []));
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
