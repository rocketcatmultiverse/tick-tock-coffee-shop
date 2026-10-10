// Counter belt (docs/ADDENDUM-01.md, replacing the Spec 6 test): a cup that
// steps onto column 0 on tick e is in front of column s on tick e + s.
// Untaken, it runs off the end on tick e + 12 and spills.

import { describe, expect, it } from 'vitest';
import { counterIndex, tileIndex } from '../../src/sim/grid';
import { allOf, floor, runTo, start } from '../helpers';

const FEEDER = ['F . . . . . . . . . . .'];

describe('Counter belt', () => {
  for (const e of [1, 5, 12]) {
    it(`a cup stepping onto column 0 on tick ${e} is in front of column s on tick ${e} + s, and runs off on tick ${e + 12}`, () => {
      const run = start(FEEDER);
      const cup = { kind: 'coffee', roast: 'medium' } as const;
      runTo(run, e);
      run.state.belts[tileIndex(0, 0)] = cup; // on the feeder: tick e moves it onto column 0
      for (let s = 0; s < 12; s++) {
        runTo(run, e + s + 1); // after tick e + s
        const where = run.state.belts.flatMap((it, i) => (it ? [i] : []));
        expect(where, floor(run)).toEqual([counterIndex(run.layout, s)]);
      }
      runTo(run, e + 14);
      const ends = allOf(run, 'end');
      expect(ends.map((x) => x.T), floor(run)).toEqual([e + 12]);
      expect(ends[0].item, floor(run)).toEqual(cup);
    });
  }

  it('spills anything that is not a drink at the end of the belt', () => {
    const run = start(FEEDER);
    run.state.belts[counterIndex(run.layout, 11)] = { kind: 'beans' };
    runTo(run, 1);
    expect(allOf(run, 'end'), floor(run)).toEqual([]);
    expect(allOf(run, 'spill').map((x) => x.item), floor(run)).toEqual([{ kind: 'beans' }]);
  });
});
