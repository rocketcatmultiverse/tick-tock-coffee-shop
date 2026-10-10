// The cat as a plain marker. Purely cosmetic: it steps over everything and
// touches nothing. Before it asks for milk it walks a fixed 12-tick loop
// around the back corner; once it asks, it waits at the bowl from tick 10 for
// 3 ticks and pads out and back along row 5 the rest of the loop.

import { LOOP } from '../sim/tuning';
import type { Spot } from './geometry';

// A 4 by 4 square's edge, clockwise from its top-left corner; the bowl is index 3.
const ROUTE: Spot[] = [
  { row: 5, col: 8 },
  { row: 5, col: 9 },
  { row: 5, col: 10 },
  { row: 5, col: 11 },
  { row: 4, col: 11 },
  { row: 3, col: 11 },
  { row: 2, col: 11 },
  { row: 2, col: 10 },
  { row: 2, col: 9 },
  { row: 2, col: 8 },
  { row: 3, col: 8 },
  { row: 4, col: 8 },
];
const BOWL_STEP = 3;
const BOWL_TICK = 10;

// While asking: ticks 2 to 9, out four tiles along row 5 and back (one pause to sniff).
const ERRAND: Spot[] = [10, 9, 8, 7, 7, 8, 9, 10].map((col) => ({ row: 5, col }));
const BOWL: Spot = { row: 5, col: 11 };

export function catSpot(T: number, asking: boolean): Spot {
  const t = ((T % LOOP) + LOOP) % LOOP;
  if (!asking) return ROUTE[(t - BOWL_TICK + BOWL_STEP + LOOP) % LOOP];
  if (t >= 2 && t <= 9) return ERRAND[t - 2];
  return BOWL;
}
