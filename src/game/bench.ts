// Workbench puzzles (docs/QUESTIONS.md, Q77): isolated puzzles, each on a
// bench of its own fixed size, with some pieces already on it and a few to
// place. A tray wants the same things every loop: one item or a sequence, on
// set ticks or any. Building costs nothing. A puzzle is solved once
// BENCH_SOLVE_LOOPS loops in a row fill the tray's order and the headless
// simulator agrees that the floor settles into filling it, so items still in
// flight from a floor taken apart cannot fool it.
//
// Each ladder of puzzles opens with a piece: the basics from the start, and
// one more ladder for each piece a regular brings. A rung opens once the one
// below it is solved. The puzzles themselves are data, in src/levels/.

import { findCycle } from '../sim/steady';
import { adaptState, emptyState } from '../sim/state';
import { step } from '../sim/step';
import { clockTick, emptyLayout, stepFrom, tileIndex } from '../sim/grid';
import { itemName, roastOf } from '../sim/items';
import { parseToken } from '../sim/text';
import { COLS, LOOP } from '../sim/tuning';
import type { Item, Layout, PieceKind, PuzzleDef, SimEvent, SimState, Structure, TrayWant } from '../sim/types';
import { type BuildPlan, type BuildRights, type BuildTarget, type TileChange, placedCount, planBuild } from './build';
import { ALL_PIECES, PIECE_LABEL } from './pieces';
import { BENCH_SOLVE_LOOPS, START_PIECES } from './tuning';

export type Ladder = PuzzleDef['ladder'];
export type Tier = PuzzleDef['tier'];

/** The ladders, in order: the basics, then one for each piece unlocked after the start. */
export const LADDERS: readonly Ladder[] = ['basics', ...ALL_PIECES.filter((p) => !START_PIECES.includes(p))];

const LADDER_NAMES: Partial<Record<Ladder, string>> = {
  basics: 'The basics',
  spring: 'Springs',
  chute: 'Chutes',
  roaster: 'Roasters',
  door: 'The side door',
  mixer: 'Mixers',
  splitter: 'Splitters',
};

export const ladderName = (l: Ladder): string => LADDER_NAMES[l] ?? PIECE_LABEL[l as PieceKind];

export const TIER_NAME: Record<Tier, string> = { tutorial: 'Hands-on', teaser: 'Brain teaser', mastery: 'Mastery' };

/** The ladders open with these pieces unlocked: the basics always, and each other once its piece is. */
export function laddersOpen(unlocked: ReadonlySet<PieceKind>): Ladder[] {
  return LADDERS.filter((l) => l === 'basics' || unlocked.has(l));
}

/** Whether a puzzle may be opened: its ladder is open, and every rung below it is solved. */
export function puzzleOpen(puzzles: readonly PuzzleDef[], id: string, unlocked: ReadonlySet<PieceKind>, solved: ReadonlySet<string>): boolean {
  const def = puzzles.find((p) => p.id === id);
  if (!def || !laddersOpen(unlocked).includes(def.ladder)) return false;
  const rungs = puzzles.filter((p) => p.ladder === def.ladder);
  return rungs.slice(0, rungs.indexOf(def)).every((p) => solved.has(p.id));
}

/** A shop's workbench progress, kept in its save: the puzzles solved, and the pieces placed on each bench opened. */
export interface BenchProgress {
  solved: string[];
  floors: Record<string, [number, Structure][]>;
}

export const noBenchProgress = (): BenchProgress => ({ solved: [], floors: {} });

// ---- The bench ----------------------------------------------------------------------

/** A bench read from a puzzle's text: the floor with its pieces, and where building may go. */
export interface Bench {
  /** The shop's twelve columns wide, as the simulator wants; only the first `cols` are bench. */
  layout: Layout;
  cols: number;
  /** Tiles inside the bench's columns that are not bench. */
  holes: Set<number>;
  /** Tiles whose pieces came with the puzzle. */
  fixed: Set<number>;
  tray: number;
}

/**
 * Read a bench: back row first, one token a tile as in src/sim/text.ts, with
 * T for the tray and # for a tile that is not bench. Every line has the same
 * width, at most the shop's twelve, and there is exactly one tray. Columns
 * past the bench, and its holes, are bare floor to the simulator: an item
 * carried there spills, as at a wall.
 */
export function parseBoard(lines: readonly string[]): Bench {
  const grid = lines.map((l) => l.trim().split(/\s+/));
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (rows === 0 || cols === 0 || cols > COLS) throw new Error(`A bench is 1 to ${COLS} tiles wide: "${lines[0] ?? ''}"`);
  const ragged = grid.findIndex((t) => t.length !== cols);
  if (ragged >= 0) throw new Error(`Bench line ${ragged} is not ${cols} tiles wide: "${lines[ragged]}"`);
  const layout = emptyLayout(rows);
  const holes = new Set<number>();
  const fixed = new Set<number>();
  const trays: number[] = [];
  grid.forEach((tokens, k) => {
    const row = rows - 1 - k;
    tokens.forEach((tok, col) => {
      const i = tileIndex(row, col);
      if (tok === '#') {
        holes.add(i);
        return;
      }
      const s = parseToken(tok);
      if (!s) return;
      layout.tiles[i] = s;
      fixed.add(i);
      if (s.kind === 'tray') trays.push(i);
    });
  });
  if (trays.length !== 1) throw new Error(`A bench has one tray, not ${trays.length}`);
  return { layout, cols, holes, fixed, tray: trays[0] };
}

// ---- Judging the tray ----------------------------------------------------------------

/** An item that landed in the tray, and the clock tick it landed on. */
export interface Delivery {
  tick: number;
  item: Item;
}

/** How a loop did at the tray. `rotations` are the places in the order the loop could have started from. */
export interface LoopVerdict {
  ok: boolean;
  why: string;
  rotations: number[];
}

const asItem = (w: TrayWant) => (w.roast ? { kind: w.kind, roast: w.roast } : { kind: w.kind }) as Item;
const fitsItem = (w: TrayWant, item: Item) => item.kind === w.kind && (w.roast === undefined || roastOf(item) === w.roast);
const fits = (w: TrayWant, d: Delivery) => fitsItem(w, d.item) && (w.tick === undefined || w.tick === d.tick);

/** Whether the order wants an item at all, whatever tick it came on. */
export function isWanted(wants: readonly TrayWant[], item: Item): boolean {
  return wants.some((w) => fitsItem(w, item));
}

/** "a medium coffee", "beans", "an espresso": an item as the words say it. */
export function anItem(item: Item): string {
  if (item.kind === 'beans' || item.kind === 'espressoBeans') return itemName(item);
  if (item.kind === 'warmMilk') return 'a cup of warm milk';
  const name = itemName(item);
  return `${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}`;
}

const capital = (s: string) => s[0].toUpperCase() + s.slice(1);

/** "Medium coffee on tick 9", "Bucket of water": one thing the tray wants. */
export function wantName(w: TrayWant): string {
  return capital(itemName(asItem(w))) + (w.tick === undefined ? '' : ` on tick ${w.tick}`);
}

/** The item a want names, any roast drawn as medium: for its picture. */
export function wantItem(w: TrayWant): Item {
  const roasted = w.kind === 'coffee' || w.kind === 'espresso' || w.kind === 'espressoBeans' || w.kind === 'latte' || w.kind === 'auLait';
  return (roasted ? { kind: w.kind, roast: w.roast ?? 'medium' } : { kind: w.kind }) as Item;
}

/**
 * Judge one loop at the tray: it passes when the tray got exactly what the
 * order wants, in its order read round the loop from any start, with every
 * want that names a tick on that tick. Otherwise `why` says what was wrong.
 */
export function judgeLoop(wants: readonly TrayWant[], got: readonly Delivery[]): LoopVerdict {
  const n = wants.length;
  const m = got.length;
  const no = (why: string): LoopVerdict => ({ ok: false, why, rotations: [] });
  if (m === 0 && n > 0) return no('Nothing reached the tray.');
  const unwanted = got.find((d) => !wants.some((w) => fitsItem(w, d.item)));
  if (unwanted) return no(`On tick ${unwanted.tick} the tray got ${anItem(unwanted.item)}, which the order does not want.`);
  if (m < n) return no(`Only ${m} of the ${n} came.`);
  if (m > n) return no(`${m} came, and the order wants ${n}.`);
  const rotations = [...Array(n).keys()].filter((r) => got.every((d, j) => fits(wants[(j + r) % n], d)));
  if (rotations.length || n === 0) return { ok: true, why: 'Just what the order wants.', rotations: n ? rotations : [0] };
  // A want held to a tick that nothing filled: say what came instead.
  for (const w of wants) {
    if (w.tick === undefined || got.some((d) => fits(w, d))) continue;
    const stray = got.find((d) => fitsItem(w, d.item) && !wants.some((x) => x.tick === d.tick && fitsItem(x, d.item)));
    return no(
      stray
        ? `${capital(anItem(stray.item))} came on tick ${stray.tick}; the order wants it on tick ${w.tick}.`
        : `The order wants ${anItem(asItem(w))} on tick ${w.tick}, and none came then.`,
    );
  }
  return no('Everything came, but not in the order wanted.');
}

/**
 * Whether a floor fills the order every loop once it settles: run headless
 * from an empty floor to steady state, and judge each loop of the cycle, in
 * one unbroken order from loop to loop.
 */
export function steadyVerdict(layout: Layout, def: PuzzleDef): { ok: boolean; why: string } {
  const cycle = findCycle(layout, { seats: [], milkPails: def.milkPails ?? 0 });
  if (!cycle) return { ok: false, why: 'The floor never settles into a loop.' };
  let rotations: number[] | null = null;
  for (let k = 0; k < cycle.loops; k++) {
    const got = cycle.ticks
      .slice(k * LOOP, (k + 1) * LOOP)
      .flatMap((tk) => tk.events.flatMap((e) => (e.type === 'deliver' ? [{ tick: clockTick(tk.T), item: e.item }] : [])));
    const v = judgeLoop(def.wants, got);
    if (!v.ok) return { ok: false, why: v.why };
    const r: number[] = rotations === null ? v.rotations : rotations.filter((x) => v.rotations.includes(x));
    if (r.length === 0) return { ok: false, why: 'Everything comes, but not in the order wanted.' };
    rotations = r;
  }
  return { ok: true, why: 'Just what the order wants.' };
}

// ---- A puzzle being played -----------------------------------------------------------

export interface BenchReport {
  T: number;
  events: SimEvent[];
  /** At the end of a loop: how it did at the tray. */
  verdict: LoopVerdict | null;
  /** Solved on this tick, for the first time. */
  solvedNow: boolean;
}

/** A workbench puzzle being played: its bench, the clock, and the tray's loops. */
export class Workbench implements BuildTarget {
  readonly def: PuzzleDef;
  readonly cols: number;
  readonly holes: ReadonlySet<number>;
  readonly fixed: ReadonlySet<number>;
  readonly tray: number;
  /** Puzzles cost nothing. */
  readonly till = Infinity;
  readonly free = true;
  layout: Layout;
  sim: SimState;
  /** Events of the most recent tick, for the renderer. */
  lastEvents: SimEvent[] = [];
  /** What the tray has taken so far this loop. */
  delivered: Delivery[] = [];
  /** How the last full loop did. */
  lastVerdict: LoopVerdict | null = null;
  /** Loops in a row that filled the order, in one unbroken order. */
  streak = 0;
  solved: boolean;
  spillsThisLoop = 0;
  spillsLastLoop = 0;
  private rotations: number[] = [];
  private readonly rules: BuildRights;
  private steady: { layout: Layout; verdict: { ok: boolean; why: string } } | null = null;

  /** Open a puzzle, with the pieces a save kept for it put back where they still fit. */
  constructor(def: PuzzleDef, placed: readonly [number, Structure][] = [], solved = false) {
    this.def = def;
    const bench = parseBoard(def.board);
    this.cols = bench.cols;
    this.holes = bench.holes;
    this.fixed = bench.fixed;
    this.tray = bench.tray;
    this.solved = solved;
    const offered = Object.entries(def.pieces) as [PieceKind, number | null][];
    this.rules = {
      unlocked: new Set(offered.map(([p]) => p)),
      wellLimit: Infinity,
      board: {
        cols: bench.cols,
        holes: bench.holes,
        fixed: bench.fixed,
        limits: Object.fromEntries(offered.filter(([, n]) => n !== null)),
      },
    };
    this.layout = bench.layout;
    for (const group of pieceGroups(this.layout, placed)) {
      const plan = planBuild(this.layout, group, this.rules, this.till);
      if (plan.ok) this.layout = plan.layout;
    }
    this.sim = emptyState(this.layout, 0);
  }

  rights(): BuildRights {
    return this.rules;
  }

  /** How many more of a piece may be placed, or null when there is no limit. */
  left(piece: PieceKind): number | null {
    if (!(piece in this.def.pieces)) return 0;
    const limit = this.def.pieces[piece];
    if (limit === null || limit === undefined) return null;
    return Math.max(0, limit - placedCount(this.layout, piece, this.fixed));
  }

  /** The pieces the player has placed, by tile: what a save keeps. */
  placed(): [number, Structure][] {
    return this.layout.tiles.flatMap((s, i): [number, Structure][] => (s && !this.fixed.has(i) ? [[i, s]] : []));
  }

  /** Check an edit; if it is allowed, apply it to the live bench. It costs nothing. */
  build(changes: readonly TileChange[]): BuildPlan {
    const plan = planBuild(this.layout, changes, this.rules, this.till);
    if (!plan.ok) return plan;
    this.sim = adaptState(this.layout, plan.layout, this.sim, 0);
    this.layout = plan.layout;
    return plan;
  }

  /** Clear the floor of items and start the clock again from tick 0. The pieces stay. */
  restart(): void {
    this.sim = emptyState(this.layout, 0);
    this.lastEvents = [];
    this.delivered = [];
    this.lastVerdict = null;
    this.streak = 0;
    this.rotations = [];
    this.spillsThisLoop = 0;
    this.spillsLastLoop = 0;
  }

  tick(): BenchReport {
    const T = this.sim.T;
    const t = clockTick(T);
    if (t === 0) {
      this.spillsLastLoop = this.spillsThisLoop;
      this.spillsThisLoop = 0;
    }
    const { next, events } = step(this.layout, this.sim, { seats: [], milkPails: this.def.milkPails ?? 0 });
    this.sim = next;
    this.lastEvents = events;
    for (const e of events) {
      if (e.type === 'spill') this.spillsThisLoop++;
      if (e.type === 'deliver') this.delivered.push({ tick: t, item: e.item });
    }
    let verdict: LoopVerdict | null = null;
    let solvedNow = false;
    if (t === LOOP - 1) {
      verdict = judgeLoop(this.def.wants, this.delivered);
      this.count(verdict);
      this.lastVerdict = verdict;
      this.delivered = [];
      if (!this.solved && this.streak >= BENCH_SOLVE_LOOPS && this.settled().ok) {
        this.solved = true;
        solvedNow = true;
      }
    }
    return { T, events, verdict, solvedNow };
  }

  /** Whether this floor, run from empty, settles into filling the order. Worked out once per layout. */
  settled(): { ok: boolean; why: string } {
    if (this.steady?.layout !== this.layout) this.steady = { layout: this.layout, verdict: steadyVerdict(this.layout, this.def) };
    return this.steady.verdict;
  }

  /** A good loop adds to the streak if it carries on the order from the loop before; a bad one ends it. */
  private count(v: LoopVerdict): void {
    if (!v.ok) {
      this.streak = 0;
      this.rotations = [];
      return;
    }
    const kept = this.streak > 0 ? v.rotations.filter((r) => this.rotations.includes(r)) : [];
    this.streak = kept.length ? this.streak + 1 : 1;
    this.rotations = kept.length ? kept : v.rotations;
  }
}

/** Saved pieces as edits to put back one piece at a time: a chute's launch with its catch. */
function pieceGroups(layout: Layout, placed: readonly [number, Structure][]): TileChange[][] {
  const at = new Map(placed);
  return placed.flatMap(([index, s]): TileChange[][] => {
    if (s.kind === 'catch') return [];
    if (s.kind !== 'launch') return [[{ index, to: s }]];
    const far = stepFrom(layout, index, s.dir, 2);
    const c = far === null ? undefined : at.get(far);
    return [[{ index, to: s }, ...(far !== null && c?.kind === 'catch' ? [{ index: far, to: c }] : [])]];
  });
}
