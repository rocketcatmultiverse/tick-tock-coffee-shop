// Counter intake (docs/ADDENDUM-01.md): the counter takes an item on column 0
// only, from the feeder tile in row 0 only. Anything else aimed at a counter
// tile spills, as it would at a wall.

import { describe, expect, it } from 'vitest';
import { counterIndex, tileIndex } from '../../src/sim/grid';
import type { Item } from '../../src/sim/types';
import { EMPTY, eventsOf, floor, start, tick } from '../helpers';

const CUP: Item = { kind: 'coffee', roast: 'dark' };

/** A row 0 with `token` at column `col` and the feeder in column 0. */
function row0(col: number, token: string): string {
  const toks = EMPTY.split(' ');
  toks[0] = 'F';
  toks[col] = token;
  return toks.join(' ');
}

describe('Counter intake', () => {
  for (let col = 0; col < 12; col++) {
    it(`a belt aimed down at counter column ${col} spills its item`, () => {
      const run = start([row0(col, 'v')]);
      run.state.belts[tileIndex(0, col)] = CUP;
      const spills = eventsOf(tick(run), 'spill');
      expect(spills.map((e) => e.item), floor(run)).toEqual([CUP]);
      expect(run.state.belts.every((i) => i === null), floor(run)).toBe(true);
    });
  }

  for (const col of [1, 5, 11]) {
    it(`a machine putting out onto counter column ${col} spills its item`, () => {
      const run = start([row0(col, 'Kv')]);
      run.state.pending[tileIndex(0, col)] = { item: CUP, readyAt: 0 };
      const spills = eventsOf(tick(run), 'spill');
      expect(spills.map((e) => e.item), floor(run)).toEqual([CUP]);
      expect(run.state.belts.every((i) => i === null), floor(run)).toBe(true);
    });
  }

  it('a chute launched onto the counter spills its item', () => {
    const run = start(['F . . . Lv . . . . . . .', 'F . . . . . . . . . . .']);
    run.state.belts[tileIndex(1, 4)] = CUP;
    const spills = eventsOf(tick(run), 'spill');
    expect(spills.map((e) => e.item), floor(run)).toEqual([CUP]);
    expect(run.state.belts.every((i) => i === null), floor(run)).toBe(true);
  });

  it('a plain belt in column 0 is not the feeder: its item spills', () => {
    const run = start(['v . . . . . . . . . . .']);
    run.state.belts[tileIndex(0, 0)] = CUP;
    expect(eventsOf(tick(run), 'spill').map((e) => e.item), floor(run)).toEqual([CUP]);
  });

  it('a cup aimed at the counter from above spills, and the cup passing along it carries on', () => {
    const passing: Item = { kind: 'coffee', roast: 'light' };
    const run = start([row0(5, 'v')]);
    run.state.belts[tileIndex(0, 5)] = CUP;
    run.state.belts[counterIndex(run.layout, 4)] = passing;
    const spills = eventsOf(tick(run), 'spill');
    expect(run.state.belts[counterIndex(run.layout, 5)], floor(run)).toEqual(passing);
    expect(spills.map((e) => e.item), floor(run)).toEqual([CUP]);
  });

  it('a machine aimed at the counter spills, and the cup passing along it carries on', () => {
    const passing: Item = { kind: 'coffee', roast: 'light' };
    const run = start([row0(5, 'Kv')]);
    run.state.pending[tileIndex(0, 5)] = { item: CUP, readyAt: 0 };
    run.state.belts[counterIndex(run.layout, 4)] = passing;
    const spills = eventsOf(tick(run), 'spill');
    expect(run.state.belts[counterIndex(run.layout, 5)], floor(run)).toEqual(passing);
    expect(spills.map((e) => e.item), floor(run)).toEqual([CUP]);
  });

  it('the feeder in row 0 puts its item on column 0', () => {
    const run = start([row0(0, 'F')]);
    run.state.belts[tileIndex(0, 0)] = CUP;
    expect(eventsOf(tick(run), 'spill'), floor(run)).toEqual([]);
    expect(run.state.belts[counterIndex(run.layout, 0)], floor(run)).toEqual(CUP);
  });
});
