import { describe, expect, it } from 'vitest';
import { tileIndex } from '../../src/sim/grid';
import type { Item, Roast } from '../../src/sim/types';
import { EMPTY, allOf, floor, runTo, start } from '../helpers';

// Ingredients arrive from the west and the north; the mixer puts out east.
const LINE = ['. . . . . v . . . . . .', '. . . . > M> > > > > > .', EMPTY];
const WEST = tileIndex(1, 4);
const NORTH = tileIndex(2, 5);
const MIXER = tileIndex(1, 5);
const OUT = tileIndex(1, 6);

function mix(west: Item | null, north: Item | null, T = 0) {
  const run = start(LINE);
  runTo(run, T);
  run.state.belts[WEST] = west;
  run.state.belts[NORTH] = north;
  runTo(run, T + 1);
  const landed = run.state.belts[OUT];
  runTo(run, T + 2);
  return { run, landed, out: run.state.belts[OUT], spills: allOf(run, 'spill').filter((e) => e.at === MIXER) };
}

describe('Mixer', () => {
  for (const roast of ['light', 'medium', 'dark'] as Roast[]) {
    it(`${roast} espresso and milk give a ${roast} latte one tick later`, () => {
      const { run, landed, out, spills } = mix({ kind: 'espresso', roast }, { kind: 'milk' }, 5);
      expect(landed, floor(run)).toBeNull();
      expect(out, floor(run)).toEqual({ kind: 'latte', roast });
      expect(spills, floor(run)).toEqual([]);
    });
    it(`${roast} coffee and milk give a ${roast} café au lait`, () => {
      const { run, out, spills } = mix({ kind: 'milk' }, { kind: 'coffee', roast }, 9);
      expect(out, floor(run)).toEqual({ kind: 'auLait', roast });
      expect(spills, floor(run)).toEqual([]);
    });
  }

  const alone: Item[] = [{ kind: 'milk' }, { kind: 'espresso', roast: 'dark' }, { kind: 'coffee', roast: 'light' }];
  for (const item of alone) {
    it(`spills ${item.kind} arriving alone`, () => {
      const { run, out, spills } = mix(item, null);
      expect(out, floor(run)).toBeNull();
      expect(spills.map((e) => e.item), floor(run)).toEqual([item]);
    });
  }

  const wrongPairs: [Item, Item][] = [
    [{ kind: 'espresso', roast: 'dark' }, { kind: 'coffee', roast: 'dark' }],
    [{ kind: 'milk' }, { kind: 'milk' }],
    [{ kind: 'warmMilk' }, { kind: 'espresso', roast: 'light' }],
    [{ kind: 'beans' }, { kind: 'milk' }],
  ];
  for (const [a, b] of wrongPairs) {
    it(`spills the pair ${a.kind} + ${b.kind}`, () => {
      const { run, out, spills } = mix(a, b);
      expect(out, floor(run)).toBeNull();
      expect(spills.length, floor(run)).toBe(2);
    });
  }

  it('spills ingredients that arrive on different ticks', () => {
    const run = start(LINE);
    run.state.belts[WEST] = { kind: 'milk' };
    runTo(run, 1);
    run.state.belts[NORTH] = { kind: 'espresso', roast: 'medium' };
    runTo(run, 3);
    expect(allOf(run, 'spill').filter((e) => e.at === MIXER).length, floor(run)).toBe(2);
    expect(allOf(run, 'mix'), floor(run)).toEqual([]);
  });
});
