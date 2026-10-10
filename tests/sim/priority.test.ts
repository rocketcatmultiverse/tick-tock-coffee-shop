import { describe, expect, it } from 'vitest';
import { tileIndex } from '../../src/sim/grid';
import type { Item } from '../../src/sim/types';
import { EMPTY, eventsOf, floor, start, tick } from '../helpers';

describe('Priority', () => {
  it('belt beats machine, even when the machine is to the north', () => {
    // The kettle north of X puts out coffee; a belt from the west carries beans into X.
    const run = start([
      '. . . . . Kv . . . . . .',
      '. . . . > > . . . . . .',
      EMPTY,
    ]);
    const X = tileIndex(1, 5);
    run.state.pending[tileIndex(2, 5)] = { item: { kind: 'coffee', roast: 'dark' }, readyAt: 0 };
    run.state.belts[tileIndex(1, 4)] = { kind: 'beans' };
    const spills = eventsOf(tick(run), 'spill');
    expect(run.state.belts[X], floor(run)).toEqual({ kind: 'beans' });
    expect(spills, floor(run)).toEqual([{ type: 'spill', at: X, item: { kind: 'coffee', roast: 'dark' } }]);
  });

  const sides: { name: string; from: number; item: Item }[] = [
    { name: 'north', from: tileIndex(2, 5), item: { kind: 'water' } },
    { name: 'east', from: tileIndex(1, 6), item: { kind: 'beans' } },
    { name: 'south', from: tileIndex(0, 5), item: { kind: 'milk' } },
    { name: 'west', from: tileIndex(1, 4), item: { kind: 'coffee', roast: 'light' } },
  ];

  // Every subset of at least two sides: the first side in clockwise order wins.
  for (let mask = 1; mask < 16; mask++) {
    const chosen = sides.filter((_, i) => mask & (1 << i));
    if (chosen.length < 2) continue;
    it(`clockwise from the top: ${chosen.map((s) => s.name).join(', ')} -> ${chosen[0].name} wins`, () => {
      const run = start([
        '. . . . . v . . . . . .',
        '. . . . > ^ < . . . . .',
        '. . . . . ^ . . . . . .',
      ]);
      for (const s of chosen) run.state.belts[s.from] = s.item;
      const spills = eventsOf(tick(run), 'spill');
      expect(run.state.belts[tileIndex(1, 5)], floor(run)).toEqual(chosen[0].item);
      expect(spills.map((e) => e.item), floor(run)).toEqual(chosen.slice(1).map((s) => s.item));
    });
  }
  // The two counter cases that were here (a cup joining from above, a machine
  // putting out onto the counter) no longer apply: docs/ADDENDUM-01.md makes
  // the feeder the only way in. They live on in counterIntake.test.ts.
});
