// The paste buffer: entries of one or more pieces, relative to their own
// top-left corner, plus pure rotate and flip (docs/SPEC.md, Spec 4).

import type { Dir, Layout, Structure } from '../sim/types';
import { colOf, flipDir, rowOf, tileIndex, turnClockwise } from '../sim/grid';
import { COLS } from '../sim/tuning';
import type { TileChange } from '../game/build';

/** `dc` grows east, `dr` grows north, both from 0. */
export interface Cell {
  dc: number;
  dr: number;
  s: Structure;
}

export interface Entry {
  cells: Cell[];
}

function mapDir(s: Structure, f: (d: Dir) => Dir): Structure {
  switch (s.kind) {
    case 'belt':
    case 'launch':
    case 'catch':
    case 'spring':
      return { ...s, dir: f(s.dir) };
    case 'plot':
    case 'kettle':
    case 'roaster':
    case 'mixer':
      return { ...s, out: f(s.out) };
    default:
      return s;
  }
}

/** Shift so the smallest dc and dr are 0, and sort, so equal groups compare equal. */
export function normalize(entry: Entry): Entry {
  if (entry.cells.length === 0) return { cells: [] };
  const minC = Math.min(...entry.cells.map((c) => c.dc));
  const minR = Math.min(...entry.cells.map((c) => c.dr));
  const cells = entry.cells
    .map((c) => ({ dc: c.dc - minC, dr: c.dr - minR, s: c.s }))
    .sort((a, b) => a.dr - b.dr || a.dc - b.dc);
  return { cells };
}

/** A quarter turn clockwise, as seen with north at the top: north becomes east. */
export function rotate(entry: Entry): Entry {
  return normalize({ cells: entry.cells.map((c) => ({ dc: c.dr, dr: -c.dc, s: mapDir(c.s, turnClockwise) })) });
}

/** Mirror left to right. */
export function flip(entry: Entry): Entry {
  return normalize({ cells: entry.cells.map((c) => ({ dc: -c.dc, dr: c.dr, s: mapDir(c.s, flipDir) })) });
}

export function width(entry: Entry): number {
  return entry.cells.length ? Math.max(...entry.cells.map((c) => c.dc)) + 1 : 0;
}

export function height(entry: Entry): number {
  return entry.cells.length ? Math.max(...entry.cells.map((c) => c.dr)) + 1 : 0;
}

/** Copy the given back-room tiles into an entry. Empty tiles are left out. */
export function entryFromTiles(layout: Layout, indices: Iterable<number>): Entry {
  const cells: Cell[] = [];
  for (const i of new Set(indices)) {
    const s = layout.tiles[i];
    if (s) cells.push({ dc: colOf(i), dr: rowOf(i), s });
  }
  return normalize({ cells });
}

/**
 * The edit that pastes `entry` with its top-left corner on (row, col), or the
 * reason it cannot go there. A paste never overwrites anything.
 */
export function pasteChanges(layout: Layout, entry: Entry, row: number, col: number): TileChange[] | string {
  const top = height(entry) - 1;
  const out: TileChange[] = [];
  for (const c of entry.cells) {
    const r = row - top + c.dr;
    const k = col + c.dc;
    if (r < 0 || r >= layout.rows || k < 0 || k >= COLS) return 'Off the floor';
    const index = tileIndex(r, k);
    if (layout.tiles[index]?.kind === 'feeder') return 'The feeder is fixed';
    if (layout.tiles[index]) return 'Overlaps something';
    out.push({ index, to: c.s });
  }
  return out;
}

/** The paste buffer: newest first, at most `limit` entries. */
export interface BufferHistory {
  entries: Entry[];
  /** Which entry Ctrl+V and the wheel pick up. */
  current: number;
}

export function pushEntry(buf: BufferHistory, entry: Entry, limit: number): BufferHistory {
  if (entry.cells.length === 0) return buf;
  return { entries: [entry, ...buf.entries].slice(0, limit), current: 0 };
}

export function stepBuffer(buf: BufferHistory, by: number): BufferHistory {
  const n = buf.entries.length;
  if (n === 0) return buf;
  return { entries: buf.entries, current: (((buf.current + by) % n) + n) % n };
}
