// Where things are on the floor canvas. North is up, so back-room row 0 is
// drawn just above the counter and higher rows further up.

import { COLS } from '../sim/tuning';

export const TILE = 48;
export const PAD = 8;
export const STOOL_H = 54;

export function canvasSize(rows: number): { w: number; h: number } {
  return { w: PAD * 2 + COLS * TILE, h: PAD * 2 + (rows + 1) * TILE + STOOL_H };
}

/** Top-left pixel of a tile. Row -1 is the counter. */
export function tileXY(rows: number, row: number, col: number): { x: number; y: number } {
  const fromTop = row === -1 ? rows : rows - 1 - row;
  return { x: PAD + col * TILE, y: PAD + fromTop * TILE };
}

export type Spot = { row: number; col: number };

/** The tile under a pixel: back room, the counter (row -1), or null. */
export function hitTest(rows: number, x: number, y: number): Spot | null {
  const col = Math.floor((x - PAD) / TILE);
  const fromTop = Math.floor((y - PAD) / TILE);
  if (col < 0 || col >= COLS || fromTop < 0) return null;
  if (fromTop < rows) return { row: rows - 1 - fromTop, col };
  if (fromTop === rows) return { row: -1, col };
  return null;
}
