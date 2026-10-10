import { describe, expect, it } from 'vitest';
import { counterIndex, emptyLayout } from '../../src/sim/grid';
import type { Item, Seat } from '../../src/sim/types';
import { allOf, floor, runTo, start } from '../helpers';

const ALCHEMIST: Seat = { col: 6, drink: 'espresso', roast: 'dark', tick: 6, grace: 0, fussy: true };
const RIGHT: Item = { kind: 'espresso', roast: 'dark' };
/** Only the feeder puts cups on the counter, so tests place them there directly. */
function setup() {
  return start(emptyLayout(1), [ALCHEMIST]);
}

/** Put `item` on the counter so it is in front of the alchemist (column 6) on the next tick. */
function sendIn(run: ReturnType<typeof setup>, item: Item) {
  run.state.belts[counterIndex(run.layout, 5)] = item;
}

describe('Fussy', () => {
  it('with grace 0, takes the cup only on the exact tick', () => {
    for (const T of [5, 6, 7, 18]) {
      const run = setup();
      runTo(run, T);
      sendIn(run, RIGHT);
      runTo(run, 30);
      const serves = allOf(run, 'serve').map((e) => [e.T, e.justInTime]);
      expect(serves, floor(run)).toEqual(T % 12 === 6 ? [[T, true]] : []);
    }
  });

  it('refuses the right cup if anything was on their tile the tick before, and it carries on untouched', () => {
    const run = setup();
    runTo(run, 5);
    // A bucket rides the counter through column 6 on tick 5.
    sendIn(run, { kind: 'water' });
    runTo(run, 6);
    sendIn(run, RIGHT);
    expect(run.state.belts[counterIndex(run.layout, 6)], floor(run)).toEqual({ kind: 'water' });
    runTo(run, 7);
    expect(allOf(run, 'serve'), floor(run)).toEqual([]);
    expect(allOf(run, 'refuse').map((e) => [e.T, e.item]), floor(run)).toEqual([[6, RIGHT]]);
    expect(run.state.belts[counterIndex(run.layout, 6)], floor(run)).toEqual(RIGHT);
    runTo(run, 8);
    expect(run.state.belts[counterIndex(run.layout, 7)], floor(run)).toEqual(RIGHT);
  });

  it('takes the cup when the tile was empty the tick before', () => {
    const run = setup();
    runTo(run, 4);
    // The bucket passes column 6 on tick 4, two ticks early: no harm done.
    sendIn(run, { kind: 'water' });
    runTo(run, 6);
    sendIn(run, RIGHT);
    runTo(run, 7);
    expect(allOf(run, 'serve').map((e) => e.T), floor(run)).toEqual([6]);
  });
});
