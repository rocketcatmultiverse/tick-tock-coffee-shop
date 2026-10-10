// Steady-state detection (docs/SPEC.md, Rules 6, "Steady state"): run the
// layout headless from an empty floor until the state at tick 0 repeats.

import type { Layout, SimEvent, SimState, StepOpts } from './types';
import { emptyState } from './state';
import { step } from './step';
import { ANY_TICK_WAIT, LOOP } from './tuning';

export interface CycleTick {
  T: number;
  /** The state at the end of this tick: what the floor shows on tick T. */
  after: SimState;
  events: SimEvent[];
}

export interface Cycle {
  /** T on which the cycle starts; always on clock tick 0. */
  start: number;
  /** Ticks in the cycle, a whole number of loops. */
  length: number;
  loops: number;
  ticks: CycleTick[];
  /** Per seat: serves in the cycle divided by loops in the cycle. */
  servesPerLoop: number[];
}

/** A state with every absolute time made relative to T, so equal floors compare equal. */
export function stateKey(s: SimState): string {
  const rel = <V>(rec: Record<number, V | null>, f: (v: V) => unknown) =>
    Object.keys(rec)
      .map(Number)
      .filter((k) => rec[k])
      .sort((a, b) => a - b)
      .map((k) => [k, f(rec[k] as V)]);
  return JSON.stringify([
    s.belts,
    rel(s.plots, (p) => p.harvestAt - s.T),
    rel(s.pending, (p) => [p.item, p.readyAt - s.T]),
    rel(s.roasting, (r) => r.since - s.T),
    s.servedThisVisit,
    s.blocked,
    // Only whether the any-tick wait is over matters, so ages are capped there.
    s.lastServedAt.map((at) => (at === null ? ANY_TICK_WAIT : Math.min(ANY_TICK_WAIT, s.T - at))),
    rel(s.springs, (items) => items),
    // Splitter counts restart on tick 0, the only tick states are compared on, so they are left out.
  ]);
}

export function findCycle(
  layout: Layout,
  opts: StepOpts,
  options: { maxLoops?: number; from?: SimState } = {},
): Cycle | null {
  const maxLoops = options.maxLoops ?? 120;
  let state = options.from ?? emptyState(layout, opts.seats.length);
  while (state.T % LOOP !== 0) state = step(layout, state, opts).next;

  const seen = new Map<string, number>(); // key -> T
  const history: CycleTick[] = [];
  const firstT = state.T;
  for (let loop = 0; loop <= maxLoops; loop++) {
    const key = stateKey(state);
    const earlier = seen.get(key);
    if (earlier !== undefined) {
      const ticks = history.slice(earlier - firstT);
      const length = state.T - earlier;
      const loops = length / LOOP;
      const servesPerLoop = opts.seats.map(
        (_, i) => ticks.reduce((n, tk) => n + tk.events.filter((e) => e.type === 'serve' && e.seat === i).length, 0) / loops,
      );
      return { start: earlier, length, loops, ticks, servesPerLoop };
    }
    seen.set(key, state.T);
    for (let k = 0; k < LOOP; k++) {
      const { next, events } = step(layout, state, opts);
      history.push({ T: state.T, after: next, events });
      state = next;
    }
  }
  return null;
}
