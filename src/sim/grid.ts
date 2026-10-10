import type { Dir, Layout, Structure } from './types';
import { COLS, LOOP } from './tuning';

export const DIRS: readonly Dir[] = ['N', 'E', 'S', 'W'];

/** Clockwise from the top: lower ranks win ties. */
export const DIR_RANK: Record<Dir, number> = { N: 0, E: 1, S: 2, W: 3 };

export function opposite(d: Dir): Dir {
  return d === 'N' ? 'S' : d === 'S' ? 'N' : d === 'E' ? 'W' : 'E';
}

/** A quarter turn clockwise, as seen with north at the top. */
export function turnClockwise(d: Dir): Dir {
  return DIRS[(DIR_RANK[d] + 1) % 4];
}

/** Mirror left to right. */
export function flipDir(d: Dir): Dir {
  return d === 'E' ? 'W' : d === 'W' ? 'E' : d;
}

/** North is away from the counter, so it adds a row. */
export function delta(d: Dir): { dr: number; dc: number } {
  switch (d) {
    case 'N':
      return { dr: 1, dc: 0 };
    case 'S':
      return { dr: -1, dc: 0 };
    case 'E':
      return { dr: 0, dc: 1 };
    case 'W':
      return { dr: 0, dc: -1 };
  }
}

export function clockTick(T: number): number {
  return ((T % LOOP) + LOOP) % LOOP;
}

/**
 * The slot a cup rides in: the clock tick on which it steps onto counter
 * column 0 (docs/ADDENDUM-01.md, "Slots"). A cup in front of counter column
 * `col` on tick `tick` rides in slot (tick - col) mod 12. Derived, never stored.
 */
export function slotOf(tick: number, col: number): number {
  return clockTick(tick - col);
}

/** The slot of a cup on the feeder in back-room row `row` on tick `tick`. */
export function feederSlot(tick: number, row: number): number {
  return clockTick(tick + row + 1);
}

export function tileIndex(row: number, col: number): number {
  return row * COLS + col;
}

export function rowOf(index: number): number {
  return Math.floor(index / COLS);
}

export function colOf(index: number): number {
  return index % COLS;
}

export function backRoomSize(layout: Layout): number {
  return layout.rows * COLS;
}

/** Index of counter tile `col` in `SimState.belts`. */
export function counterIndex(layout: Layout, col: number): number {
  return layout.rows * COLS + col;
}

export function isCounter(layout: Layout, index: number): boolean {
  return index >= backRoomSize(layout) && index < backRoomSize(layout) + COLS;
}

/** Total length of `SimState.belts`: back room then the counter. */
export function beltSlots(layout: Layout): number {
  return layout.rows * COLS + COLS;
}

/**
 * Where a step of `n` tiles in direction `d` from back-room tile `from` lands.
 * Returns a back-room or counter index, or null for a wall or anywhere below
 * the counter.
 */
export function stepFrom(layout: Layout, from: number, d: Dir, n = 1): number | null {
  const { dr, dc } = delta(d);
  const r = rowOf(from) + dr * n;
  const c = colOf(from) + dc * n;
  if (c < 0 || c >= COLS) return null;
  if (r >= layout.rows) return null;
  if (r >= 0) return tileIndex(r, c);
  // Only the row directly below row 0 exists: the counter.
  if (r === -1) return counterIndex(layout, c);
  return null;
}

export function structureAt(layout: Layout, index: number): Structure | null {
  if (index < 0 || index >= backRoomSize(layout)) return null;
  return layout.tiles[index] ?? null;
}

export function emptyLayout(rows: number): Layout {
  return { cols: 12, rows, tiles: new Array<Structure | null>(rows * COLS).fill(null) };
}
