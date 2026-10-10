import { describe, expect, it } from 'vitest';
import { counterIndex, emptyLayout } from '../../src/sim/grid';
import type { Item, Seat } from '../../src/sim/types';
import { allOf, floor, runTo, start } from '../helpers';

const SEAT: Seat = { col: 6, drink: 'coffee', roast: 'medium', tick: 5 };
const RIGHT: Item = { kind: 'coffee', roast: 'medium' };
/**
 * Each cup is put on the counter one column short of the stool, so it is in
 * front of the stool on the given T. Only the feeder can put a cup on the
 * counter (docs/ADDENDUM-01.md), so the test places it there directly.
 */
function serveAt(cups: [number, Item][], seat: Seat = SEAT) {
  const run = start(emptyLayout(1), [seat]);
  for (const [T, item] of cups) {
    runTo(run, T);
    run.state.belts[counterIndex(run.layout, seat.col - 1)] = item;
  }
  runTo(run, 40);
  return run;
}

describe('Stool', () => {
  it('takes the right drink on their tick: Just in Time', () => {
    const run = serveAt([[5, RIGHT]]);
    expect(allOf(run, 'serve'), floor(run)).toEqual([
      { type: 'serve', seat: 0, at: counterIndex(run.layout, 6), item: RIGHT, justInTime: true, T: 5 },
    ]);
    expect(allOf(run, 'end'), floor(run)).toEqual([]);
  });

  it('takes it on their tick in every loop', () => {
    const run = serveAt([
      [5, RIGHT],
      [17, RIGHT],
      [29, RIGHT],
    ]);
    expect(allOf(run, 'serve').map((e) => [e.T, e.justInTime]), floor(run)).toEqual([
      [5, true],
      [17, true],
      [29, true],
    ]);
  });

  // No grace (a design decision, docs/QUESTIONS.md Q61): a cup even one tick late is not theirs.
  for (const T of [4, 6, 7, 8, 11, 12, 18]) {
    it(`lets the right drink go by outside their window (T=${T}), and it runs off the end`, () => {
      const run = serveAt([[T, RIGHT]]);
      expect(allOf(run, 'serve'), floor(run)).toEqual([]);
      expect(allOf(run, 'end').map((e) => [e.T, e.item]), floor(run)).toEqual([[T + 6, RIGHT]]);
    });
  }

  it('lets a wrong drink go by untouched', () => {
    const run = serveAt([[5, { kind: 'coffee', roast: 'dark' }]]);
    expect(allOf(run, 'serve'), floor(run)).toEqual([]);
    expect(allOf(run, 'end').map((e) => e.item), floor(run)).toEqual([{ kind: 'coffee', roast: 'dark' }]);
  });

  it('takes one cup per visit, and again on the next visit', () => {
    const run = serveAt([
      [5, RIGHT],
      [6, RIGHT],
      [17, RIGHT],
    ]);
    expect(allOf(run, 'serve').map((e) => e.T), floor(run)).toEqual([5, 17]);
    expect(allOf(run, 'end').map((e) => e.T), floor(run)).toEqual([12]);
  });

  // Any-tick regulars follow their own rule now (docs/ADDENDUM-01.md): see anyTick.test.ts.

  it('a regular whose roast is any takes every roast', () => {
    const anyRoast: Seat = { ...SEAT, roast: 'any' };
    const run = serveAt([[5, { kind: 'coffee', roast: 'light' }]], anyRoast);
    expect(allOf(run, 'serve').length, floor(run)).toBe(1);
  });
});
