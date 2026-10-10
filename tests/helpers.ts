// Shared helpers for simulator tests. Every assertion that reads the floor
// passes `floor(...)` as its message, so a failure prints the tick and tiles.

import { expect } from 'vitest';
import { emptyState } from '../src/sim/state';
import { step } from '../src/sim/step';
import { parseLayout, renderFloor } from '../src/sim/text';
import type { Layout, Seat, SimEvent, SimState, StepOpts } from '../src/sim/types';

export interface Run {
  layout: Layout;
  state: SimState;
  /** Events of every tick so far, by the T they happened on. */
  log: SimEvent[][];
  opts: StepOpts;
}

export function start(lines: readonly string[] | Layout, seats: Seat[] = [], canPayMilk: StepOpts['canPayMilk'] = true): Run {
  const layout = Array.isArray(lines) ? parseLayout(lines as string[]) : (lines as Layout);
  return { layout, state: emptyState(layout, seats.length), log: [], opts: { seats, canPayMilk } };
}

/** Run one tick and return its events. */
export function tick(run: Run): SimEvent[] {
  const { next, events } = step(run.layout, run.state, run.opts);
  run.log[run.state.T] = events;
  run.state = next;
  return events;
}

/** Run ticks until `T` reaches `T` (exclusive of further ticks). */
export function runTo(run: Run, T: number): void {
  while (run.state.T < T) tick(run);
}

export function floor(run: Run): string {
  return '\n' + renderFloor(run.layout, run.state);
}

export function eventsOf<K extends SimEvent['type']>(events: SimEvent[], type: K): Extract<SimEvent, { type: K }>[] {
  return events.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);
}

/** All events of a type with the T they happened on. */
export function allOf<K extends SimEvent['type']>(run: Run, type: K): (Extract<SimEvent, { type: K }> & { T: number })[] {
  const out: (Extract<SimEvent, { type: K }> & { T: number })[] = [];
  run.log.forEach((evs, T) => {
    for (const e of evs ?? []) if (e.type === type) out.push({ ...(e as Extract<SimEvent, { type: K }>), T });
  });
  return out;
}

export function expectFloor(run: Run, actual: unknown, expected: unknown): void {
  expect(actual, floor(run)).toEqual(expected);
}

/** A row of 12 empty tiles. */
export const EMPTY = '. . . . . . . . . . . .';
