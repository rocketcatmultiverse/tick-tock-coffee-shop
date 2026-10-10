import { describe, expect, it } from 'vitest';
import { tileIndex } from '../../src/sim/grid';
import { EMPTY, allOf, floor, runTo, start, tick } from '../helpers';

describe('Back door', () => {
  it('delivers a pail on tick 7 and on no other tick', () => {
    const run = start([EMPTY, 'D > > > > > > > > > > >', EMPTY]);
    for (let T = 0; T < 36; T++) {
      tick(run);
      const pail = run.state.belts[tileIndex(1, 1)];
      expect(pail, floor(run)).toEqual(T % 12 === 7 ? { kind: 'milk' } : null);
    }
    expect(allOf(run, 'milk').map((e) => e.T), floor(run)).toEqual([7, 19, 31]);
  });

  it('delivers nothing when canPayMilk is false', () => {
    const run = start([EMPTY, 'D > > > > > > > > > > >', EMPTY], [], false);
    runTo(run, 36);
    expect(allOf(run, 'milk'), floor(run)).toEqual([]);
    expect(run.state.belts.every((i) => i === null), floor(run)).toBe(true);
  });

  it('pays doors in tile order when the till covers only some pails (assumption, docs/QUESTIONS.md)', () => {
    const run = start(['D > . . . . . . . . . .', EMPTY, 'D > . . . . . . . . . .'], [], 1);
    runTo(run, 8);
    expect(allOf(run, 'milk').map((e) => e.at), floor(run)).toEqual([tileIndex(0, 0)]);
  });
});
