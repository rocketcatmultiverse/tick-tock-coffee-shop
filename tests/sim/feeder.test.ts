// The feeder (docs/ADDENDUM-01.md): a fixed belt down column 0 that carries
// items onto counter column 0. For the belt rules it is an ordinary belt tile.

import { describe, expect, it } from 'vitest';
import { counterIndex, tileIndex } from '../../src/sim/grid';
import type { Item } from '../../src/sim/types';
import { eventsOf, floor, start, tick } from '../helpers';

const CUP: Item = { kind: 'coffee', roast: 'medium' };

describe('Feeder', () => {
  it('an item on the feeder in row 0 is on counter column 0 one tick later', () => {
    const run = start(['F . . . . . . . . . . .', 'F . . . . . . . . . . .']);
    run.state.belts[tileIndex(0, 0)] = CUP;
    tick(run);
    expect(run.state.belts[counterIndex(run.layout, 0)], floor(run)).toEqual(CUP);
    expect(run.state.belts[tileIndex(0, 0)], floor(run)).toBeNull();
  });

  it('carries an item one row toward the counter each tick', () => {
    const run = start(['F . . . . . . . . . . .', 'F . . . . . . . . . . .', 'F . . . . . . . . . . .']);
    run.state.belts[tileIndex(2, 0)] = CUP;
    for (const at of [tileIndex(1, 0), tileIndex(0, 0), counterIndex(run.layout, 0), counterIndex(run.layout, 1)]) {
      tick(run);
      const where = run.state.belts.flatMap((it, i) => (it ? [i] : []));
      expect(where, floor(run)).toEqual([at]);
    }
  });

  it('an item joins from the east, off a belt or straight from a machine', () => {
    const belt = start(['F . . . . . . . . . . .', 'F < . . . . . . . . . .']);
    belt.state.belts[tileIndex(0, 1)] = CUP;
    tick(belt);
    expect(belt.state.belts[tileIndex(0, 0)], floor(belt)).toEqual(CUP);

    const machine = start(['F . . . . . . . . . . .', 'F K< . . . . . . . . . .']);
    machine.state.pending[tileIndex(0, 1)] = { item: CUP, readyAt: 0 };
    tick(machine);
    expect(machine.state.belts[tileIndex(0, 0)], floor(machine)).toEqual(CUP);
  });

  it('carries any item, not only drinks', () => {
    const run = start(['F . . . . . . . . . . .']);
    run.state.belts[tileIndex(0, 0)] = { kind: 'water' };
    tick(run);
    expect(run.state.belts[counterIndex(run.layout, 0)], floor(run)).toEqual({ kind: 'water' });
  });

  for (const [name, row] of [
    ['a belt', 'F < . . . . . . . . . .'],
    ['a machine', 'F K< . . . . . . . . . .'],
  ]) {
    it(`an item coming down the feeder beats one joining from the east off ${name}, which spills`, () => {
      const run = start(['F . . . . . . . . . . .', row, 'F . . . . . . . . . . .']);
      const down: Item = { kind: 'coffee', roast: 'dark' };
      run.state.belts[tileIndex(2, 0)] = down;
      if (name === 'a belt') run.state.belts[tileIndex(1, 1)] = CUP;
      else run.state.pending[tileIndex(1, 1)] = { item: CUP, readyAt: 0 };
      const spills = eventsOf(tick(run), 'spill');
      expect(run.state.belts[tileIndex(1, 0)], floor(run)).toEqual(down);
      expect(spills.map((e) => e.item), floor(run)).toEqual([CUP]);
    });
  }
});
