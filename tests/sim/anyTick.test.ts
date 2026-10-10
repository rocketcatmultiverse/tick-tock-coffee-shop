// Any-tick regulars (docs/ADDENDUM-01.md): they take the first matching cup,
// then let every cup pass for ANY_TICK_WAIT ticks. A cup exactly that many
// ticks later is taken.

import { describe, expect, it } from 'vitest';
import { counterIndex, emptyLayout } from '../../src/sim/grid';
import type { Item, Seat } from '../../src/sim/types';
import { allOf, floor, runTo, start } from '../helpers';

const ANY: Seat = { col: 6, drink: 'coffee', roast: 'medium', tick: 'any' };
const RIGHT: Item = { kind: 'coffee', roast: 'medium' };

/** Each cup is in front of the stool on the given T. */
function cupsAt(Ts: number[], seat: Seat = ANY) {
  const run = start(emptyLayout(1), [seat]);
  for (const T of Ts) {
    runTo(run, T);
    run.state.belts[counterIndex(run.layout, seat.col - 1)] = RIGHT;
  }
  runTo(run, Math.max(...Ts) + 14);
  return run;
}

const served = (run: ReturnType<typeof cupsAt>) => allOf(run, 'serve').map((e) => e.T);

describe('Any-tick', () => {
  for (const T of [0, 3, 11]) {
    it(`takes the first matching cup, on any tick (T=${T}), at the plain price`, () => {
      const run = cupsAt([T]);
      expect(allOf(run, 'serve').map((e) => [e.T, e.justInTime]), floor(run)).toEqual([[T, false]]);
      expect(run.state.lastServedAt, floor(run)).toEqual([T]);
    });
  }

  for (let gap = 1; gap <= 11; gap++) {
    it(`lets a matching cup ${gap} tick(s) later pass, and it runs off the end`, () => {
      const run = cupsAt([2, 2 + gap]);
      expect(served(run), floor(run)).toEqual([2]);
      expect(allOf(run, 'end').map((e) => e.T), floor(run)).toEqual([2 + gap + 6]);
    });
  }

  it('takes a matching cup exactly 12 ticks later', () => {
    const run = cupsAt([2, 14, 26]);
    expect(served(run), floor(run)).toEqual([2, 14, 26]);
  });

  it('does not start afresh on tick 0: a cup on tick 11 and another on tick 12 give one serve', () => {
    const run = cupsAt([11, 12]);
    expect(served(run), floor(run)).toEqual([11]);
  });

  it('after a gap, takes the next matching cup on any tick', () => {
    const run = cupsAt([2, 9, 20, 27, 40]);
    // 9 is 7 after 2: passes. 20 is 18 after: taken. 27 is 7 after 20: passes. 40 is 20 after: taken.
    expect(served(run), floor(run)).toEqual([2, 20, 40]);
  });

  it('locks onto one slot of a steady belt, and moves to the next cup when that one stops', () => {
    // Cups in front of the stool on ticks 1 and 5 of every loop: the regular takes the tick 1 cup.
    const loops = [0, 1, 2, 3].flatMap((L) => [12 * L + 1, 12 * L + 5]);
    const run = cupsAt(loops);
    expect(served(run), floor(run)).toEqual([1, 13, 25, 37]);
    // Without the tick 1 cup after the second loop, it takes the tick 5 cup instead.
    const run2 = cupsAt([1, 5, 13, 17, 29, 41]);
    expect(served(run2), floor(run2)).toEqual([1, 13, 29, 41]);
  });

  it('lets a wrong drink pass without starting the wait', () => {
    const run = start(emptyLayout(1), [ANY]);
    runTo(run, 2);
    run.state.belts[counterIndex(run.layout, 5)] = { kind: 'coffee', roast: 'dark' };
    runTo(run, 4);
    run.state.belts[counterIndex(run.layout, 5)] = RIGHT;
    runTo(run, 10);
    expect(served(run), floor(run)).toEqual([4]);
  });
});
