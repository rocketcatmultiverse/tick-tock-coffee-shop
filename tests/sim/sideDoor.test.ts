// The side door and the milk order (docs/ADDENDUM-01.md): one door on the
// right-hand wall, facing left, drops one pail a tick from MILK_TICK.

import { describe, expect, it } from 'vitest';
import { tileIndex, emptyLayout } from '../../src/sim/grid';
import { planBuild, rightsAfter } from '../../src/game/build';
import { EMPTY, allOf, floor, start, tick } from '../helpers';

const DOOR_ROW = '. . . . . . . . < < < D';

describe('Side door', () => {
  for (const n of [1, 2, 3]) {
    it(`with an order of ${n}, pails land on ticks 7 to ${7 + n - 1} and on no others`, () => {
      const run = start([EMPTY, DOOR_ROW, EMPTY], [], n);
      const want = Array.from({ length: n }, (_, k) => 7 + k);
      for (let T = 0; T < 36; T++) {
        tick(run);
        const pail = run.state.belts[tileIndex(1, 10)];
        expect(pail, floor(run)).toEqual(want.includes(T % 12) ? { kind: 'milk' } : null);
      }
      expect(allOf(run, 'milk').map((e) => e.T), floor(run)).toEqual([0, 12, 24].flatMap((L) => want.map((t) => L + t)));
      expect(allOf(run, 'milk').every((e) => e.at === tileIndex(1, 11)), floor(run)).toBe(true);
    });
  }

  it('delivers only as many pails as milkPails allows, and none at 0', () => {
    const one = start([EMPTY, DOOR_ROW, EMPTY], [], 1);
    for (let T = 0; T < 12; T++) tick(one);
    expect(allOf(one, 'milk').map((e) => e.T), floor(one)).toEqual([7]);
    const none = start([EMPTY, DOOR_ROW, EMPTY], [], 0);
    for (let T = 0; T < 36; T++) tick(none);
    expect(allOf(none, 'milk'), floor(none)).toEqual([]);
    expect(none.state.belts.every((i) => i === null), floor(none)).toBe(true);
  });

  it('puts its pail on the tile to its west', () => {
    const run = start([EMPTY, '. . . . . . . . . . Kv D', '. . . . . . . . . . v .'], [], 1);
    for (let T = 0; T < 9; T++) tick(run);
    expect(allOf(run, 'brew').map((e) => [e.T, e.item]), floor(run)).toEqual([[7, { kind: 'warmMilk' }]]);
  });

  it('is refused outside column 11, and a second door is refused', () => {
    const rights = rightsAfter([], 0, true);
    const layout = emptyLayout(6);
    expect(planBuild(layout, [{ index: tileIndex(2, 5), to: { kind: 'door' } }], rights, 1000)).toEqual({
      ok: false,
      reason: 'The side door goes against the right-hand wall',
    });
    const first = planBuild(layout, [{ index: tileIndex(2, 11), to: { kind: 'door' } }], rights, 1000);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(planBuild(first.layout, [{ index: tileIndex(4, 11), to: { kind: 'door' } }], rights, 1000)).toEqual({
      ok: false,
      reason: 'There is only one side door',
    });
    // Two in one paste are refused too.
    const both = [2, 4].map((row) => ({ index: tileIndex(row, 11), to: { kind: 'door' } as const }));
    expect(planBuild(layout, both, rights, 1000).ok).toBe(false);
  });
});
