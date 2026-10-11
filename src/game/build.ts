// Unlocks, the well limit and paying for pieces (docs/SPEC.md, Rules 4
// "Unlocks", Rules 6 and Spec 4 "Money"). Every edit to the floor, whether a
// placement, a paste, a cut, a delete, an undo or a redo, goes through
// planBuild, which accepts or refuses the whole edit at once.

import type { Layout, RegularDef, Structure } from '../sim/types';
import { COLS } from '../sim/tuning';
import { colOf, emptyLayout, stepFrom, tileIndex } from '../sim/grid';
import { ALL_PIECES, PIECE_LABEL, type PieceKind, pieceOf } from './pieces';
import { BOWL_COL, BOWL_ROW, PIECE_PRICE, START_PIECES, START_WELL_LIMIT } from './tuning';

/** A fresh back room: the feeder down column 0 of every row and the cat's bowl in place. */
export function startLayout(rows: number): Layout {
  const layout = emptyLayout(rows);
  for (let r = 0; r < rows; r++) layout.tiles[tileIndex(r, 0)] = { kind: 'feeder' };
  layout.tiles[tileIndex(BOWL_ROW, BOWL_COL)] = { kind: 'bowl' };
  return layout;
}

export interface BuildRights {
  unlocked: ReadonlySet<PieceKind>;
  wellLimit: number;
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
  let cost = 0;
  for (const ch of changes) {
    if (ch.index < 0 || ch.index >= size) return { ok: false, reason: 'Off the floor' };
    const was = tiles[ch.index];
    before.push(was);
    if (same(was, ch.to)) continue;
    if (was?.kind === 'bowl' || ch.to?.kind === 'bowl') return { ok: false, reason: "The cat's bowl is fixed" };
    if (was?.kind === 'feeder' || ch.to?.kind === 'feeder' || colOf(ch.index) === 0) {
      return { ok: false, reason: 'The feeder is fixed' };
    }
    if (ch.to) {
      const piece = pieceOf(ch.to.kind);
      if (!piece || !rights.unlocked.has(piece)) return { ok: false, reason: `${piece ? PIECE_LABEL[piece] : ch.to.kind} is locked` };
      if (ch.to.kind === 'door' && colOf(ch.index) !== COLS - 1) {
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
