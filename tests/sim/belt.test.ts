import { describe, expect, it } from 'vitest';
import { tileIndex } from '../../src/sim/grid';
import { EMPTY, eventsOf, floor, start, tick } from '../helpers';

describe('Belt', () => {
  it('moves an item exactly one tile per tick, through turns', () => {
    const run = start([
      '. . . > > v . . . . . .',
      '. . . ^ . v . . . . . .',
      '> > > ^ . > > > > > > .',
    ]);
    const path = [
      tileIndex(0, 0), tileIndex(0, 1), tileIndex(0, 2), tileIndex(0, 3), tileIndex(1, 3), tileIndex(2, 3),
      tileIndex(2, 4), tileIndex(2, 5), tileIndex(1, 5), tileIndex(0, 5), tileIndex(0, 6), tileIndex(0, 7),
    ];
    run.state.belts[path[0]] = { kind: 'beans' };
    for (let k = 1; k < path.length; k++) {
      tick(run);
      const where = run.state.belts.flatMap((it, i) => (it ? [i] : []));
      expect(where, floor(run)).toEqual([path[k]]);
    }
  });

  it('spills an item run onto bare floor', () => {
    const run = start([EMPTY, '. . . . . > . . . . . .']);
    run.state.belts[tileIndex(0, 5)] = { kind: 'beans' };
    const spills = eventsOf(tick(run), 'spill');
    expect(spills, floor(run)).toEqual([{ type: 'spill', at: tileIndex(0, 6), item: { kind: 'beans' } }]);
    expect(run.state.belts.every((i) => i === null), floor(run)).toBe(true);
  });

  it('spills an item run into a wall', () => {
    const run = start(['. . . . . . . . . . . >']);
    run.state.belts[tileIndex(0, 11)] = { kind: 'water' };
    const spills = eventsOf(tick(run), 'spill');
    expect(spills, floor(run)).toEqual([{ type: 'spill', at: tileIndex(0, 11), item: { kind: 'water' } }]);
  });
});
