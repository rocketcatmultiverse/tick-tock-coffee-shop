import { describe, expect, it } from 'vitest';
import { tileIndex } from '../../src/sim/grid';
import type { Item, Seat } from '../../src/sim/types';
import { EMPTY, allOf, floor, runTo, start } from '../helpers';

const BOWL = tileIndex(1, 11);
const FEED = tileIndex(1, 10);
const CAT: Seat = { col: 11, drink: 'warmMilk', roast: 'any', tick: 10, bowl: BOWL };
const WARM: Item = { kind: 'warmMilk' };
const MILK: Item = { kind: 'milk' };

/** Each item is put on the feed belt so it lands in the bowl on the given T. */
function feed(items: [number, Item][], seats: Seat[] = [CAT]) {
  const run = start([EMPTY, '. . . . . . . . . . > B', EMPTY], seats);
  for (const [T, item] of items) {
    runTo(run, T);
    run.state.belts[FEED] = item;
  }
  runTo(run, 40);
  return run;
}

describe('Bowl', () => {
  // No grace (docs/QUESTIONS.md Q61): the cat is at the bowl on tick 10 only.
  for (const T of [10, 22, 34]) {
    it(`warm milk landing while the cat is there (T=${T}) is drunk`, () => {
      const run = feed([[T, WARM]]);
      expect(allOf(run, 'serve').map((e) => [e.T, e.seat, e.at, e.justInTime]), floor(run)).toEqual([
        [T, 0, BOWL, T % 12 === 10],
      ]);
      expect(allOf(run, 'spill'), floor(run)).toEqual([]);
    });
  }

  for (const T of [2, 9, 11, 12, 13, 14, 21]) {
    it(`warm milk landing when the cat is not there (T=${T}) spills`, () => {
      const run = feed([[T, WARM]]);
      expect(allOf(run, 'serve'), floor(run)).toEqual([]);
      expect(allOf(run, 'spill').map((e) => [e.T, e.at]), floor(run)).toEqual([[T, BOWL]]);
    });
  }

  it('the cat drinks once a loop', () => {
    const run = feed([
      [10, WARM],
      [11, WARM],
      [22, WARM],
    ]);
    expect(allOf(run, 'serve').map((e) => e.T), floor(run)).toEqual([10, 22]);
    expect(allOf(run, 'spill').map((e) => e.T), floor(run)).toEqual([11]);
  });

  it('plain milk makes the cat bolt: warm milk landing with it on the same tick is refused', () => {
    // Plain milk from the north beats warm milk from the west, so the cat sees the plain milk first.
    const run = start(['. . . . . . . . . . . v', '. . . . . . . . . . > B', EMPTY], [CAT]);
    for (const T of [10, 22]) {
      runTo(run, T);
      if (T === 10) run.state.belts[tileIndex(2, 11)] = MILK;
      run.state.belts[FEED] = WARM;
    }
    runTo(run, 30);
    expect(allOf(run, 'bolt').map((e) => e.T), floor(run)).toEqual([10]);
    expect(allOf(run, 'spill').map((e) => [e.T, e.item.kind]), floor(run)).toEqual([
      [10, 'milk'],
      [10, 'warmMilk'],
    ]);
    expect(allOf(run, 'serve').map((e) => e.T), floor(run)).toEqual([22]);
  });

  it('with no cat asking, the bowl is inert and everything spills', () => {
    const run = feed([[10, WARM]], []);
    expect(allOf(run, 'serve'), floor(run)).toEqual([]);
    expect(allOf(run, 'spill').map((e) => e.at), floor(run)).toEqual([BOWL]);
  });
});
