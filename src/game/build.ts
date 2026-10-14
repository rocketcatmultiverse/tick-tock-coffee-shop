// Unlocks, the well limit and paying for pieces (docs/SPEC.md, Rules 4
// "Unlocks", Rules 6 and Spec 4 "Money"). Every edit to the floor, whether a
// placement, a paste, a cut, a delete, an undo or a redo, goes through
// planBuild, which accepts or refuses the whole edit at once.

import type { Layout, RegularDef, Structure } from '../sim/types';
import { COLS } from '../sim/tuning';
import { colOf, emptyLayout, stepFrom, tileIndex } from '../sim/grid';
import { ALL_PIECES, PIECE_LABEL, type PieceKind, isFixed, pieceOf } from './pieces';
import { BOWL_COL, BOWL_ROW, PIECE_PRICE, START_PIECES, START_ROWS, START_WELL_COL, START_WELL_LIMIT, START_WELL_ROW } from './tuning';

/** A fresh back room: the feeder down column 0 of every row and the cat's bowl in place. */
export function startLayout(rows: number): Layout {
  const layout = emptyLayout(rows);
  for (let r = 0; r < rows; r++) layout.tiles[tileIndex(r, 0)] = { kind: 'feeder' };
  layout.tiles[tileIndex(BOWL_ROW, BOWL_COL)] = { kind: 'bowl' };
  return layout;
}

/**
 * A new shop's floor: a fresh back room with the first well already down, so a
 * new player has something to build from. It is not fixed (docs/QUESTIONS.md, Q79).
 */
export function newShopLayout(): Layout {
  const layout = startLayout(START_ROWS);
  layout.tiles[tileIndex(START_WELL_ROW, START_WELL_COL)] = { kind: 'well' };
  return layout;
}

export interface BuildRights {
  unlocked: ReadonlySet<PieceKind>;
  wellLimit: number;
  /** A workbench puzzle's bench, with its own rules; the shop has none. */
  board?: BoardRules;
}

/**
 * What a workbench puzzle's bench allows (docs/QUESTIONS.md, Q77): building
 * only on its own tiles, around the pieces it came with, and no more of each
 * piece than the puzzle offers. There is no feeder and no bowl to keep clear.
 */
export interface BoardRules {
  /** Columns of the bench, from the left wall; tiles in later columns are not bench. */
  cols: number;
  /** Tiles inside those columns that are not bench either. */
  holes: ReadonlySet<number>;
  /** Tiles whose pieces came with the puzzle: they stay where they are. */
  fixed: ReadonlySet<number>;
  /** How many of each piece may be placed; a piece not named has no limit. */
  limits: Partial<Record<PieceKind, number>>;
}

/** What may be built on and with: the shop, or a workbench puzzle. */
export interface BuildTarget {
  readonly layout: Layout;
  readonly till: number;
  /** Building costs nothing here, so nothing says what it cost. */
  readonly free?: boolean;
  rights(): BuildRights;
  build(changes: readonly TileChange[]): BuildPlan;
}

/** Whether the piece on a tile stays where it is: the feeder, the bowl, a tray, or a piece a puzzle came with. */
export function fixedAt(layout: Layout, rights: BuildRights, index: number): boolean {
  return isFixed(layout.tiles[index] ?? null) || !!rights.board?.fixed.has(index);
}

/** Pieces of a kind on a floor that were placed, not fixed: a chute counts once, by its launch. */
export function placedCount(layout: Layout, piece: PieceKind, fixed: ReadonlySet<number> = new Set()): number {
  return layout.tiles.filter((s, i) => s && s.kind !== 'catch' && pieceOf(s.kind) === piece && !fixed.has(i)).length;
}

/** What you may build once the first `walkedIn` regulars have walked in. */
export function rightsAfter(defs: readonly RegularDef[], walkedIn: number, debug = false): BuildRights {
  if (debug) return { unlocked: new Set(ALL_PIECES), wellLimit: Infinity };
  const unlocked = new Set<PieceKind>(START_PIECES);
  let wellLimit = START_WELL_LIMIT;
  for (const def of defs.slice(0, walkedIn)) {
    for (const kind of def.unlocks ?? []) {
      const p = pieceOf(kind);
      if (p) unlocked.add(p);
    }
    if (def.wellLimit !== undefined) wellLimit = Math.max(wellLimit, def.wellLimit);
  }
  return { unlocked, wellLimit };
}

export interface TileChange {
  index: number;
  to: Structure | null;
}

export type BuildPlan =
  | { ok: true; cost: number; layout: Layout; changes: TileChange[]; before: (Structure | null)[] }
  | { ok: false; reason: string };

/** What a tile's structure is worth: its price when placed, its refund when removed. */
export function tileValue(s: Structure | null): number {
  if (!s) return 0;
  if (s.kind === 'launch') return PIECE_PRICE.chute;
  if (s.kind === 'catch') return 0; // paid for with its launch
  const p = pieceOf(s.kind);
  return p ? PIECE_PRICE[p] : 0;
}

/** What every piece on a floor is worth: what deleting them all would refund. */
export function floorValue(layout: Layout): number {
  return layout.tiles.reduce((n, s) => n + tileValue(s), 0);
}

function same(a: Structure | null, b: Structure | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function planBuild(layout: Layout, changes: readonly TileChange[], rights: BuildRights, till: number): BuildPlan {
  const size = layout.rows * COLS;
  const tiles = layout.tiles.slice();
  const before: (Structure | null)[] = [];
  const board = rights.board;
  let cost = 0;
  for (const ch of changes) {
    if (ch.index < 0 || ch.index >= size) return { ok: false, reason: 'Off the floor' };
    const was = tiles[ch.index];
    before.push(was);
    if (same(was, ch.to)) continue;
    if (board) {
      if (colOf(ch.index) >= board.cols || board.holes.has(ch.index)) return { ok: false, reason: 'Off the bench' };
      if (board.fixed.has(ch.index)) return { ok: false, reason: was?.kind === 'tray' ? 'The tray is fixed' : 'Fixed to the bench' };
    } else {
      if (was?.kind === 'bowl' || ch.to?.kind === 'bowl') return { ok: false, reason: "The cat's bowl is fixed" };
      if (was?.kind === 'feeder' || ch.to?.kind === 'feeder' || colOf(ch.index) === 0) {
        return { ok: false, reason: 'The feeder is fixed' };
      }
    }
    if (ch.to) {
      const piece = pieceOf(ch.to.kind);
      const name = piece ? PIECE_LABEL[piece] : ch.to.kind;
      if (!piece || !rights.unlocked.has(piece)) return { ok: false, reason: board ? `${name} is not in this puzzle` : `${name} is locked` };
      if (ch.to.kind === 'door' && colOf(ch.index) !== (board?.cols ?? COLS) - 1) {
        return { ok: false, reason: 'The side door goes against the right-hand wall' };
      }
    }
    cost += tileValue(ch.to) - tileValue(was);
    tiles[ch.index] = ch.to;
  }
  const next: Layout = { cols: 12, rows: layout.rows, tiles };

  const wells = tiles.filter((s) => s?.kind === 'well').length;
  const wellsBefore = layout.tiles.filter((s) => s?.kind === 'well').length;
  if (wells > rights.wellLimit && wells > wellsBefore) {
    return { ok: false, reason: `Well limit reached (${rights.wellLimit})` };
  }
  // A puzzle's limits: more than it offers is refused, though a floor already over keeps what it has.
  for (const [piece, limit] of Object.entries(board?.limits ?? {}) as [PieceKind, number][]) {
    const n = placedCount(next, piece, board!.fixed);
    if (n > limit && n > placedCount(layout, piece, board!.fixed)) {
      const name = PIECE_LABEL[piece].toLowerCase();
      return { ok: false, reason: limit === 0 ? `No ${name} in this puzzle` : `Only ${limit} ${name}${limit === 1 ? '' : 's'} in this puzzle` };
    }
  }
  if (tiles.filter((s) => s?.kind === 'door').length > 1) return { ok: false, reason: 'There is only one side door' };
  const broken = brokenChute(next);
  if (broken !== null) return { ok: false, reason: 'A chute needs its launch and its catch' };
  if (cost > till) return { ok: false, reason: `Costs ${cost}, the till holds ${till}` };
  return { ok: true, cost, layout: next, changes: [...changes], before };
}

/** The first chute end without its partner two tiles along, or null. */
export function brokenChute(layout: Layout): number | null {
  for (let i = 0; i < layout.tiles.length; i++) {
    const s = layout.tiles[i];
    if (s?.kind === 'launch') {
      const j = stepFrom(layout, i, s.dir, 2);
      const c = j !== null ? layout.tiles[j] : null;
      if (!c || c.kind !== 'catch' || c.dir !== s.dir) return i;
    }
    if (s?.kind === 'catch') {
      const back = { N: 'S', S: 'N', E: 'W', W: 'E' } as const;
      const j = stepFrom(layout, i, back[s.dir], 2);
      const l = j !== null ? layout.tiles[j] : null;
      if (!l || l.kind !== 'launch' || l.dir !== s.dir) return i;
    }
  }
  return null;
}

/** The other end of the chute at `index`, if it is one. */
export function chutePartner(layout: Layout, index: number): number | null {
  const s = layout.tiles[index];
  if (s?.kind === 'launch') return stepFrom(layout, index, s.dir, 2);
  if (s?.kind === 'catch') {
    const back = { N: 'S', S: 'N', E: 'W', W: 'E' } as const;
    return stepFrom(layout, index, back[s.dir], 2);
  }
  return null;
}
