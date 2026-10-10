import type { Layout, Seat, SimState, Structure } from './types';
import { beltSlots, clockTick, counterIndex } from './grid';
import { COLS, LOOP } from './tuning';

export function emptyState(layout: Layout, seatCount = 0): SimState {
  return {
    T: 0,
    belts: new Array(beltSlots(layout)).fill(null),
    plots: {},
    pending: {},
    roasting: {},
    servedThisVisit: new Array(seatCount).fill(false),
    blocked: new Array(seatCount).fill(false),
  };
}

/**
 * How far into their visit a seat is on tick `T`, or null when they are not
 * at the counter. A visit runs from their tick to their tick plus grace.
 * Regulars with tick 'any' stay all loop, from clock tick 0 to 11.
 */
export function visitOffset(seat: Seat, T: number): number | null {
  const t = clockTick(T);
  if (seat.tick === 'any') return t;
  const off = (((t - seat.tick) % LOOP) + LOOP) % LOOP;
  return off <= seat.grace ? off : null;
}

/** The last offset of a visit: the tick they leave after. */
export function visitLength(seat: Seat): number {
  return seat.tick === 'any' ? LOOP - 1 : seat.grace;
}

export function isPresent(seat: Seat, T: number): boolean {
  return visitOffset(seat, T) !== null;
}

function beltLike(s: Structure | null | undefined): boolean {
  return !!s && (s.kind === 'belt' || s.kind === 'launch' || s.kind === 'catch');
}

/**
 * Carry a state across a live edit of the layout (or a change in seats). Items
 * on tiles that are no longer belts vanish, machine state survives only where
 * the same kind of machine still stands, and the counter keeps its cups even
 * when buying rows moves its indices. Pure: returns a new state.
 */
export function adaptState(before: Layout, after: Layout, state: SimState, seatCount: number): SimState {
  const belts = new Array(beltSlots(after)).fill(null);
  const plots: SimState['plots'] = {};
  const pending: SimState['pending'] = {};
  const roasting: SimState['roasting'] = {};
  const shared = Math.min(before.rows, after.rows) * COLS;
  for (let i = 0; i < shared; i++) {
    const a = before.tiles[i];
    const b = after.tiles[i];
    if (beltLike(a) && beltLike(b)) belts[i] = state.belts[i];
    if (a && b && a.kind === b.kind) {
      if (state.plots[i]) plots[i] = state.plots[i];
      if (state.pending[i]) pending[i] = state.pending[i];
      if (state.roasting[i]) roasting[i] = state.roasting[i];
    }
  }
  for (let c = 0; c < COLS; c++) belts[counterIndex(after, c)] = state.belts[counterIndex(before, c)];
  const pad = (xs: boolean[]) => Array.from({ length: seatCount }, (_, i) => xs[i] ?? false);
  return {
    T: state.T,
    belts,
    plots,
    pending,
    roasting,
    servedThisVisit: pad(state.servedThisVisit),
    blocked: pad(state.blocked),
  };
}
