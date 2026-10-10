import { describe, expect, it } from 'vitest';
import { counterIndex, emptyLayout, tileIndex } from '../../src/sim/grid';
import type { Item, Seat } from '../../src/sim/types';
import { allOf, floor, runTo, start } from '../helpers';

const SEAT: Seat = { col: 6, drink: 'coffee', roast: 'medium', tick: 5, grace: 2 };
const RIGHT: Item = { kind: 'coffee', roast: 'medium' };
const KETTLE = tileIndex(0, 6);

/** A kettle straight above the stool puts each cup in front of it on the given T. */
function serveAt(cups: [number, Item][], seat: Seat = SEAT) {
  const layout = emptyLayout(1);
  layout.tiles[KETTLE] = { kind: 'kettle', out: 'S' };
  const run = start(layout, [seat]);
  for (const [T, item] of cups) {
    runTo(run, T);
    run.state.pending[KETTLE] = { item, readyAt: T };
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

  for (const T of [6, 7, 18, 19]) {
    it(`takes the right drink within grace on T=${T}: plain price`, () => {
      const run = serveAt([[T, RIGHT]]);
      expect(allOf(run, 'serve').map((e) => [e.T, e.justInTime]), floor(run)).toEqual([[T, false]]);
    });
  }

  for (const T of [4, 8, 11, 12]) {
    it(`lets the right drink go by outside their window (T=${T}), and it reaches the shelf`, () => {
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

  it('an any-tick regular takes the first matching cup each loop, at the plain price', () => {
    const any: Seat = { col: 6, drink: 'coffee', roast: 'medium', tick: 'any', grace: 0 };
    const run = serveAt(
      [
        [2, RIGHT],
        [9, RIGHT],
        [13, RIGHT],
      ],
      any,
    );
    expect(allOf(run, 'serve').map((e) => [e.T, e.justInTime]), floor(run)).toEqual([
      [2, false],
      [13, false],
    ]);
    expect(allOf(run, 'end').map((e) => e.T), floor(run)).toEqual([15]);
  });

  it('a regular whose roast is any takes every roast', () => {
    const anyRoast: Seat = { ...SEAT, roast: 'any' };
    const run = serveAt([[5, { kind: 'coffee', roast: 'light' }]], anyRoast);
    expect(allOf(run, 'serve').length, floor(run)).toBe(1);
  });
});
