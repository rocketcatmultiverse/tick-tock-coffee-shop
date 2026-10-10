import { describe, expect, it } from 'vitest';
import { tileIndex } from '../../src/sim/grid';
import { GROWTH } from '../../src/sim/tuning';
import { EMPTY, allOf, floor, runTo, start, tick } from '../helpers';

// A belt feeds the plot from the west; it puts its beans out east.
const LINE = [EMPTY, '. . . > P> > > > > > > .', EMPTY];
const FEED = tileIndex(1, 3);
const PLOT = tileIndex(1, 4);
const OUT = tileIndex(1, 5);

describe('Plot', () => {
  it(`harvests G = ${GROWTH} ticks after the bucket lands`, () => {
    const run = start(LINE);
    run.state.belts[FEED] = { kind: 'water' };
    runTo(run, 20);
    expect(allOf(run, 'water').map((e) => e.T), floor(run)).toEqual([0]);
    expect(allOf(run, 'harvest').map((e) => e.T), floor(run)).toEqual([GROWTH]);
  });

  it('puts the beans on its output tile on the harvest tick', () => {
    const run = start(LINE);
    run.state.belts[FEED] = { kind: 'water' };
    runTo(run, GROWTH + 1);
    expect(run.state.belts[OUT], floor(run)).toEqual({ kind: 'beans' });
  });

  it('spills a bucket landing on a growing plot', () => {
    const run = start(LINE);
    run.state.belts[FEED] = { kind: 'water' };
    runTo(run, 2);
    run.state.belts[FEED] = { kind: 'water' };
    tick(run);
    expect(allOf(run, 'spill'), floor(run)).toEqual([{ type: 'spill', at: PLOT, item: { kind: 'water' }, T: 2 }]);
    runTo(run, 20);
    expect(allOf(run, 'harvest').map((e) => e.T), floor(run)).toEqual([GROWTH]);
  });

  it('starts the next cycle with a bucket landing on the harvest tick (same-tick handoff)', () => {
    const run = start(LINE);
    run.state.belts[FEED] = { kind: 'water' };
    runTo(run, GROWTH);
    run.state.belts[FEED] = { kind: 'water' };
    runTo(run, 20);
    expect(allOf(run, 'spill').filter((e) => e.at === PLOT), floor(run)).toEqual([]);
    expect(allOf(run, 'harvest').map((e) => e.T), floor(run)).toEqual([GROWTH, 2 * GROWTH]);
  });

  it('spills anything that is not water', () => {
    const run = start(LINE);
    run.state.belts[FEED] = { kind: 'beans' };
    tick(run);
    expect(allOf(run, 'spill'), floor(run)).toEqual([{ type: 'spill', at: PLOT, item: { kind: 'beans' }, T: 0 }]);
  });
});
