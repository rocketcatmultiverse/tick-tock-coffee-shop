// The cat as a plain marker. Purely cosmetic: it steps over everything and
// touches nothing. Before it asks for milk it walks a fixed 12-tick loop
// whose corner is its bowl, reaching the bowl on tick 10; once it asks, it
// waits at the bowl from tick 10 for 3 ticks and pads out and back along the
// bowl's row the rest of the loop.

import { BOWL_COL, BOWL_ROW } from '../game/tuning';
import { LOOP } from '../sim/tuning';
import type { Spot } from './geometry';

// The edge of a 4 by 4 square whose top-right corner is the bowl, clockwise
// from its top-left corner; the bowl is index 3.
const ROUTE: Spot[] = [
  ...[3, 2, 1, 0].map((dc) => ({ row: BOWL_ROW, col: BOWL_COL - dc })),
  ...[1, 2, 3].map((dr) => ({ row: BOWL_ROW - dr, col: BOWL_COL })),
  ...[1, 2, 3].map((dc) => ({ row: BOWL_ROW - 3, col: BOWL_COL - dc })),
  ...[2, 1].map((dr) => ({ row: BOWL_ROW - dr, col: BOWL_COL - 3 })),
];
const BOWL_STEP = 3;
const BOWL_TICK = 10;

// While asking: ticks 2 to 9, out four tiles along the bowl's row and back (one pause to sniff).
const ERRAND: Spot[] = [1, 2, 3, 4, 4, 3, 2, 1].map((dc) => ({ row: BOWL_ROW, col: BOWL_COL - dc }));
const BOWL: Spot = { row: BOWL_ROW, col: BOWL_COL };

export function catSpot(T: number, asking: boolean): Spot {
  const t = ((T % LOOP) + LOOP) % LOOP;
  if (!asking) return ROUTE[(t - BOWL_TICK + BOWL_STEP + LOOP) % LOOP];
  if (t >= 2 && t <= 9) return ERRAND[t - 2];
  return BOWL;
}
