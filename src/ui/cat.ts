// The cat as a plain marker: a fixed 12-tick walk around the back corner,
// one tile a tick, reaching the bowl (row 5, column 11) on tick 10. Purely
// cosmetic; it steps over everything and touches nothing.

import { LOOP } from '../sim/tuning';
import type { Spot } from './geometry';

// A 4 by 4 square's edge, clockwise from its top-left corner.
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

const BOWL_STEP = 3; // index of the bowl tile in ROUTE
const BOWL_TICK = 10;

export function catSpot(T: number): Spot {
  const t = ((T % LOOP) + LOOP) % LOOP;
  return ROUTE[(t - BOWL_TICK + BOWL_STEP + LOOP) % LOOP];
}
