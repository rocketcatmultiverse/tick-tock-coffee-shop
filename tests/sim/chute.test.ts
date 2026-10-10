import { describe, expect, it } from 'vitest';
import { tileIndex } from '../../src/sim/grid';
import { EMPTY, eventsOf, floor, start, tick } from '../helpers';

const LAUNCH = tileIndex(1, 2);
const MIDDLE = tileIndex(1, 3);
const CATCH = tileIndex(1, 4);

describe('Chute', () => {
  const middles: [string, string][] = [
    ['a belt', '^'],
    ['a machine', 'K^'],
    ['nothing', '.'],
  ];
  for (const [name, token] of middles) {
    it(`puts an item from the launch on the catch one tick later, over ${name}`, () => {
      const run = start([
        '. . . > > > > > > > > .',
        `. . L> ${token} C> > > > > > > .`,
        EMPTY,
      ]);
      run.state.belts[LAUNCH] = { kind: 'water' };
      tick(run);
      expect(run.state.belts[CATCH], floor(run)).toEqual({ kind: 'water' });
      expect(run.state.belts[LAUNCH], floor(run)).toBeNull();
      // The catch carries on like a belt.
      tick(run);
      expect(run.state.belts[tileIndex(1, 5)], floor(run)).toEqual({ kind: 'water' });
    });
  }

  it("leaves the item on the tile between untouched", () => {
    const run = start([
      '. . . > > > > > > > > .',
      '. . L> ^ C> > > > > > > .',
      EMPTY,
    ]);
    run.state.belts[LAUNCH] = { kind: 'water' };
    run.state.belts[MIDDLE] = { kind: 'beans' };
    const spills = eventsOf(tick(run), 'spill');
    expect(spills, floor(run)).toEqual([]);
    expect(run.state.belts[CATCH], floor(run)).toEqual({ kind: 'water' });
    expect(run.state.belts[tileIndex(2, 3)], floor(run)).toEqual({ kind: 'beans' });
  });

  it("counts as a belt item from the launch's side: from the north it beats belts from east and west", () => {
    const run = start([
      '. . . . Lv . . . . . . .',
      EMPTY,
      '. . . > Cv < . . . . . .',
      EMPTY,
    ]);
    run.state.belts[tileIndex(3, 4)] = { kind: 'water' };
    run.state.belts[tileIndex(1, 3)] = { kind: 'beans' };
    run.state.belts[tileIndex(1, 5)] = { kind: 'milk' };
    const spills = eventsOf(tick(run), 'spill');
    expect(run.state.belts[CATCH], floor(run)).toEqual({ kind: 'water' });
    expect(spills.map((e) => e.item), floor(run)).toEqual([{ kind: 'milk' }, { kind: 'beans' }]);
  });

  it('from the west it loses to a belt from the north', () => {
    const run = start([
      '. . . . v . . . . . . .',
      '. . L> . C> > . . . . . .',
      EMPTY,
    ]);
    run.state.belts[LAUNCH] = { kind: 'water' };
    run.state.belts[tileIndex(2, 4)] = { kind: 'beans' };
    const spills = eventsOf(tick(run), 'spill');
    expect(run.state.belts[CATCH], floor(run)).toEqual({ kind: 'beans' });
    expect(spills.map((e) => e.item), floor(run)).toEqual([{ kind: 'water' }]);
  });

  it('from the east it beats a machine putting out from the north', () => {
    const run = start([
      '. . . . Kv . . . . . . .',
      '. . . . C< . L< . . . . .',
      EMPTY,
    ]);
    run.state.belts[tileIndex(1, 6)] = { kind: 'water' };
    run.state.pending[tileIndex(2, 4)] = { item: { kind: 'coffee', roast: 'dark' }, readyAt: 0 };
    const spills = eventsOf(tick(run), 'spill');
    expect(run.state.belts[CATCH], floor(run)).toEqual({ kind: 'water' });
    expect(spills.map((e) => e.item), floor(run)).toEqual([{ kind: 'coffee', roast: 'dark' }]);
  });

  it('wins a tie with a belt item from the same side (assumption, docs/QUESTIONS.md)', () => {
    const run = start([EMPTY, '. . L> > C> > . . . . . .', EMPTY]);
    run.state.belts[LAUNCH] = { kind: 'water' };
    run.state.belts[MIDDLE] = { kind: 'beans' };
    const spills = eventsOf(tick(run), 'spill');
    expect(run.state.belts[CATCH], floor(run)).toEqual({ kind: 'water' });
    expect(spills.map((e) => e.item), floor(run)).toEqual([{ kind: 'beans' }]);
  });
});
