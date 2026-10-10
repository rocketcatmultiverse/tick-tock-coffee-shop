import { describe, expect, it } from 'vitest';
import { tileIndex } from '../../src/sim/grid';
import type { Item, Roast } from '../../src/sim/types';
import { EMPTY, allOf, floor, runTo, start } from '../helpers';

const LINE = [EMPTY, '. . . > K> > > > > > > .', EMPTY];
const FEED = tileIndex(1, 3);
const OUT = tileIndex(1, 5);

/** Put `input` on the feed belt so it lands in the kettle on tick T. */
function brewAt(T: number, input: Item) {
  const run = start(LINE);
  runTo(run, T);
  run.state.belts[FEED] = input;
  runTo(run, T + 1);
  const landed = run.state.belts[OUT];
  runTo(run, T + 2);
  return { run, landed, out: run.state.belts[OUT] };
}

describe('Kettle', () => {
  const edges: [number, Roast][] = [
    [3, 'light'],
    [4, 'medium'],
    [7, 'medium'],
    [8, 'dark'],
    [11, 'dark'],
    [12, 'light'], // tick 0
  ];
  for (const [T, roast] of edges) {
    it(`beans landing on tick ${T % 12} make ${roast} coffee one tick later`, () => {
      const { run, landed, out } = brewAt(T, { kind: 'beans' });
      expect(landed, floor(run)).toBeNull();
      expect(out, floor(run)).toEqual({ kind: 'coffee', roast });
      expect(allOf(run, 'brew'), floor(run)).toEqual([
        { type: 'brew', at: tileIndex(1, 4), item: { kind: 'coffee', roast }, tick: T % 12, T },
      ]);
    });
  }

  for (const roast of ['light', 'medium', 'dark'] as Roast[]) {
    for (const T of [0, 5, 9]) {
      it(`${roast} espresso beans give ${roast} espresso on tick ${T}`, () => {
        const { run, out } = brewAt(T, { kind: 'espressoBeans', roast });
        expect(out, floor(run)).toEqual({ kind: 'espresso', roast });
      });
    }
  }

  for (let T = 0; T < 12; T++) {
    it(`milk gives warm milk on tick ${T}`, () => {
      const { run, out } = brewAt(T, { kind: 'milk' });
      expect(out, floor(run)).toEqual({ kind: 'warmMilk' });
    });
  }

  it('takes one of two inputs by the clockwise rule and spills the other', () => {
    const run = start([
      '. . . . v . . . . . . .',
      '. . . > K> > > > > > > .',
      EMPTY,
    ]);
    run.state.belts[FEED] = { kind: 'milk' };
    run.state.belts[tileIndex(2, 4)] = { kind: 'beans' };
    runTo(run, 2);
    expect(run.state.belts[tileIndex(1, 5)], floor(run)).toEqual({ kind: 'coffee', roast: 'light' });
    expect(allOf(run, 'spill').map((e) => e.item), floor(run)).toEqual([{ kind: 'milk' }]);
  });

  it('spills water and finished drinks', () => {
    const run = start(LINE);
    run.state.belts[FEED] = { kind: 'water' };
    runTo(run, 1);
    run.state.belts[FEED] = { kind: 'coffee', roast: 'dark' };
    runTo(run, 3);
    expect(allOf(run, 'spill').map((e) => e.item.kind), floor(run)).toEqual(['water', 'coffee']);
  });
});
