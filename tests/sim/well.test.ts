import { describe, expect, it } from 'vitest';
import { tileIndex } from '../../src/sim/grid';
import { EMPTY, allOf, floor, start, tick } from '../helpers';

describe('Well', () => {
  it('puts four buckets out on tick 0 and on no other tick', () => {
    const run = start([
      '. . . . . ^ . . . . . .',
      '. . . . < W > . . . . .',
      '. . . . . v . . . . . .',
    ]);
    const sides = [tileIndex(2, 5), tileIndex(1, 6), tileIndex(0, 5), tileIndex(1, 4)];
    for (let T = 0; T < 36; T++) {
      tick(run);
      const loaded = sides.filter((i) => run.state.belts[i]?.kind === 'water');
      expect(loaded.length, floor(run)).toBe(T % 12 === 0 ? 4 : 0);
    }
  });

  it('spills the bucket of a side with no neighbour', () => {
    // North and south are bare floor, west is the wall, east has a belt
    // that runs into a second belt so nothing else spills.
    const run = start([EMPTY, 'W > > . . . . . . . . .', EMPTY]);
    for (let T = 0; T < 24; T++) tick(run);
    const spills = allOf(run, 'spill').filter((e) => e.item.kind === 'water');
    const atTick0 = spills.filter((e) => e.T % 12 === 0).map((e) => e.at);
    expect(atTick0.filter((_, i) => i < 3).sort((a, b) => a - b), floor(run)).toEqual(
      [tileIndex(0, 0), tileIndex(1, 0), tileIndex(2, 0)],
    );
    // The east bucket rides two belts and runs onto bare floor two ticks later.
    expect(spills.map((e) => e.T % 12).sort((a, b) => a - b), floor(run)).toEqual([0, 0, 0, 0, 0, 0, 2, 2]);
  });
});
