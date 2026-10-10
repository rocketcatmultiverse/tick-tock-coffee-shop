import { describe, expect, it } from 'vitest';
import { counterIndex, tileIndex } from '../../src/sim/grid';
import { emptyLayout } from '../../src/sim/grid';
import { allOf, floor, runTo, start } from '../helpers';

describe('Counter belt', () => {
  for (let c = 0; c < 12; c++) {
    it(`a cup joining at column ${c} is in front of every later column s exactly s - c ticks later`, () => {
      const layout = emptyLayout(2);
      layout.tiles[tileIndex(0, c)] = { kind: 'kettle', out: 'S' };
      const run = start(layout);
      const cup = { kind: 'coffee', roast: 'medium' } as const;
      run.state.pending[tileIndex(0, c)] = { item: cup, readyAt: 0 };
      for (let s = c; s < 12; s++) {
        runTo(run, s - c + 1); // after tick s - c
        const where = run.state.belts.flatMap((it, i) => (it ? [i] : []));
        expect(where, floor(run)).toEqual([counterIndex(layout, s)]);
      }
      runTo(run, 13);
      const ends = allOf(run, 'end');
      expect(ends.map((e) => e.T), floor(run)).toEqual([12 - c]);
      expect(ends[0].item, floor(run)).toEqual(cup);
    });
  }

  it('spills anything that is not a drink at the end of the belt', () => {
    const run = start(emptyLayout(1));
    run.state.belts[counterIndex(run.layout, 11)] = { kind: 'beans' };
    runTo(run, 1);
    expect(allOf(run, 'end'), floor(run)).toEqual([]);
    expect(allOf(run, 'spill').map((e) => e.item), floor(run)).toEqual([{ kind: 'beans' }]);
  });
});
