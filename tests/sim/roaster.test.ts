import { describe, expect, it } from 'vitest';
import { tileIndex } from '../../src/sim/grid';
import type { Roast } from '../../src/sim/types';
import { EMPTY, allOf, floor, runTo, start } from '../helpers';

const LINE = [EMPTY, '. . . > R> > > > > > > .', EMPTY];
const FEED = tileIndex(1, 3);
const ROASTER = tileIndex(1, 4);
const OUT = tileIndex(1, 5);

/** Beans land in the roaster on `landT`; run long enough for one release. */
function roastFrom(landT: number) {
  const run = start(LINE);
  runTo(run, landT);
  run.state.belts[FEED] = { kind: 'beans' };
  runTo(run, landT + 30);
  return run;
}

describe('Roaster', () => {
  it('puts out on tick 6 only', () => {
    for (let landT = 0; landT < 24; landT++) {
      const run = roastFrom(landT);
      const releases = allOf(run, 'release');
      expect(releases.length, floor(run)).toBe(1);
      expect(releases[0].T % 12, floor(run)).toBe(6);
      expect(releases[0].T > landT, floor(run)).toBe(true);
      expect(releases[0].T - landT <= 12, floor(run)).toBe(true);
    }
  });

  const edges: [number, number, Roast][] = [
    // [landing T, ticks inside, roast]
    [2, 4, 'light'],
    [1, 5, 'medium'],
    [10, 8, 'medium'],
    [9, 9, 'dark'],
    [6, 12, 'dark'],
  ];
  for (const [landT, inside, roast] of edges) {
    it(`${inside} ticks inside gives ${roast} espresso beans`, () => {
      const run = roastFrom(landT);
      const [rel] = allOf(run, 'release');
      expect(rel.T - landT, floor(run)).toBe(inside);
      expect(rel.item, floor(run)).toEqual({ kind: 'espressoBeans', roast });
    });
  }

  it('roasts beans landing on tick 6 for a full 12 ticks', () => {
    const run = start(LINE);
    runTo(run, 6);
    run.state.belts[FEED] = { kind: 'beans' };
    runTo(run, 18);
    expect(allOf(run, 'release'), floor(run)).toEqual([]);
    runTo(run, 19);
    expect(allOf(run, 'release').map((e) => e.T), floor(run)).toEqual([18]);
    expect(run.state.belts[OUT], floor(run)).toEqual({ kind: 'espressoBeans', roast: 'dark' });
  });

  it('takes a new batch on the release tick, after letting the old one out', () => {
    const run = start(LINE);
    run.state.belts[FEED] = { kind: 'beans' };
    runTo(run, 6);
    run.state.belts[FEED] = { kind: 'beans' };
    runTo(run, 30);
    expect(allOf(run, 'spill').filter((e) => e.at === ROASTER), floor(run)).toEqual([]);
    expect(allOf(run, 'release').map((e) => e.T), floor(run)).toEqual([6, 18]);
  });

  it('spills beans landing on a roaster that already holds a batch', () => {
    const run = start(LINE);
    run.state.belts[FEED] = { kind: 'beans' };
    runTo(run, 3);
    run.state.belts[FEED] = { kind: 'beans' };
    runTo(run, 4);
    expect(allOf(run, 'spill'), floor(run)).toEqual([{ type: 'spill', at: ROASTER, item: { kind: 'beans' }, T: 3 }]);
  });

  it('spills anything that is not plain beans', () => {
    const run = start(LINE);
    run.state.belts[FEED] = { kind: 'espressoBeans', roast: 'light' };
    runTo(run, 1);
    expect(allOf(run, 'spill').map((e) => e.at), floor(run)).toEqual([ROASTER]);
  });
});
