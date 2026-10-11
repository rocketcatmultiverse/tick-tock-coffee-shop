// How each drink is made, one machine at a time, for the regulars' order
// tooltips (docs/QUESTIONS.md, Q67). The roast windows are read off the same
// functions step() uses (docs/SPEC.md, Rules 4), so the two cannot drift apart.

import type { Item, Roast } from '../sim/types';
import { roastForTick, roastForTime, timeInRoaster } from '../sim/items';
import { LOOP, ROASTER_TICK } from '../sim/tuning';

/** An item as a recipe names it: `roast` is null for items without one, or when any roast will do. */
export interface Ingredient {
  kind: Item['kind'];
  roast: Roast | null;
}

/** The machines a drink passes through. Water, beans and milk are where every recipe starts. */
export type RecipeMachine = 'kettle' | 'roaster' | 'mixer';

export type Term =
  | { type: 'item'; item: Ingredient }
  /** The clock ticks the input must land on the machine on to come out at this roast. */
  | { type: 'clock'; machine: 'kettle' | 'roaster'; ticks: number[]; roast: Roast };

/** One machine's part: these inputs, at this machine, give `out`. */
export interface RecipeStep {
  inputs: Term[];
  machine: RecipeMachine;
  out: Ingredient;
}

const TICKS = Array.from({ length: LOOP }, (_, t) => t);

/** Clock ticks on which plain beans landing in a kettle brew coffee of `roast`. */
export function kettleTicks(roast: Roast): number[] {
  return TICKS.filter((t) => roastForTick(t) === roast);
}

/** Clock ticks on which beans landing in a roaster come out on the release tick as espresso beans of `roast`. */
export function roasterTicks(roast: Roast): number[] {
  return TICKS.filter((t) => roastForTime(timeInRoaster(t, ROASTER_TICK)) === roast);
}

/**
 * The ticks as runs round the clock, each [first, last]. A run may wrap past
 * tick 0, as [10, 1] does for 10, 11, 0 and 1.
 */
export function tickRuns(ticks: readonly number[]): [number, number][] {
  const on = new Set(ticks);
  if (on.size === 0) return [];
  if (on.size === LOOP) return [[0, LOOP - 1]];
  const runs: [number, number][] = [];
  // Start just after a gap, so no run is cut in two at tick 0.
  const from = TICKS.find((t) => on.has(t) && !on.has((t + LOOP - 1) % LOOP))!;
  for (let k = 0; k < LOOP; k++) {
    const t = (from + k) % LOOP;
    if (!on.has(t)) continue;
    const last = runs[runs.length - 1];
    if (last && (last[1] + 1) % LOOP === t) last[1] = t;
    else runs.push([t, t]);
  }
  return runs;
}

/**
 * The steps that make `want`: its own machine first, then the steps for any
 * ingredient that is itself made from something else. Water, beans and milk
 * have no steps.
 */
export function recipeFor(want: Ingredient): RecipeStep[] {
  const r = want.roast;
  const item = (kind: Item['kind'], roast: Roast | null): Term => ({ type: 'item', item: { kind, roast } });
  const clock = (machine: 'kettle' | 'roaster'): Term[] =>
    r ? [{ type: 'clock', machine, roast: r, ticks: machine === 'kettle' ? kettleTicks(r) : roasterTicks(r) }] : [];
  switch (want.kind) {
    case 'coffee':
      return [{ inputs: [item('beans', null), ...clock('kettle')], machine: 'kettle', out: want }];
    case 'espressoBeans':
      return [{ inputs: [item('beans', null), ...clock('roaster')], machine: 'roaster', out: want }];
    case 'espresso':
      return [{ inputs: [item('espressoBeans', r)], machine: 'kettle', out: want }, ...recipeFor({ kind: 'espressoBeans', roast: r })];
    case 'warmMilk':
      return [{ inputs: [item('milk', null)], machine: 'kettle', out: want }];
    case 'auLait':
      return [{ inputs: [item('coffee', r), item('milk', null)], machine: 'mixer', out: want }, ...recipeFor({ kind: 'coffee', roast: r })];
    case 'latte':
      return [{ inputs: [item('espresso', r), item('milk', null)], machine: 'mixer', out: want }, ...recipeFor({ kind: 'espresso', roast: r })];
    case 'water':
    case 'beans':
    case 'milk':
      return [];
  }
}
