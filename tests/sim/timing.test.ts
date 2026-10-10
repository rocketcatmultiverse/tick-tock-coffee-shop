// The timing equations as a property test (Spec 6, as amended by
// docs/ADDENDUM-01.md): the join column is always 0, b3 counts the feeder
// tiles ridden, and each spring counts as SPRING_TICKS belt tiles.
//   t_kettle = b1 + G + b2
//   slot     = (t_kettle + 1 + b3) mod 12
//   t_serve  = slot + s

import { describe, expect, it } from 'vitest';
import { counterIndex, feederSlot, slotOf, tileIndex } from '../../src/sim/grid';
import { roastForTick } from '../../src/sim/items';
import { GROWTH, SPRING_TICKS } from '../../src/sim/tuning';
import type { Seat } from '../../src/sim/types';
import { layoutToText } from '../../src/sim/text';
import { allOf, floor, runTo, start } from '../helpers';
import { type Run, buildLine, seeded } from './layoutBuilder';

const ticksOf = (run: Run) => run.belts + SPRING_TICKS * run.springs;

describe('Timing equations', () => {
  it('matches the worked example with the join moved to the feeder: b1 = 2, G = 4, b2 = 2, two belts to row 0, s = 10', () => {
    const rand = seeded(1);
    const plain = (belts: number): Run => ({ belts, springs: 0 });
    const layout = buildLine({ b1: plain(2), b2: plain(2), b3: plain(2), row: 0 }, rand);
    // b3 = 2 belts + 1 feeder tile = 3, so the slot is (8 + 1 + 3) mod 12 = 0 and the stool on column 10 sees it on tick 10.
    const seat: Seat = { col: 10, drink: 'coffee', roast: 'dark', tick: 10 };
    const run = start(layout, [seat]);
    runTo(run, 36);
    expect(allOf(run, 'water').map((e) => e.T), floor(run)).toEqual([2, 14, 26]);
    expect(allOf(run, 'harvest').map((e) => e.T), floor(run)).toEqual([6, 18, 30]);
    expect(allOf(run, 'brew')[0], floor(run)).toMatchObject({ T: 8, tick: 8, item: { kind: 'coffee', roast: 'dark' } });
    expect(allOf(run, 'serve').map((e) => [e.T, e.justInTime]), floor(run)).toEqual([
      [22, true],
      [34, true],
    ]);
  });

  it('holds for random b1, b2, b3, join row and s, with springs, built as real layouts', () => {
    const rand = seeded(20261010);
    const pick = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
    const runOf = (max: number): Run => ({ belts: pick(0, max), springs: pick(0, 2) });
    for (let trial = 0; trial < 400; trial++) {
      const spec = { b1: runOf(10), b2: runOf(10), b3: runOf(8), row: pick(0, 5) };
      const s = pick(0, 11);
      const layout = buildLine(spec, rand);
      const b3 = ticksOf(spec.b3) + spec.row + 1;
      const tKettle = ticksOf(spec.b1) + GROWTH + ticksOf(spec.b2);
      const tJoin = tKettle + 1 + b3; // the T on which the cup steps onto column 0
      const slot = tJoin % 12;
      const tServe = tJoin + s;
      const roast = roastForTick(tKettle % 12);
      const seat: Seat = { col: s, drink: 'coffee', roast, tick: (slot + s) % 12 };
      const run = start(layout, [seat]);
      const label = `${JSON.stringify(spec)} s=${s}\n${layoutToText(layout).join('\n')}`;

      // On the feeder row it joins, the cup already rides in its slot.
      const onFeeder = tJoin - (spec.row + 1);
      runTo(run, onFeeder + 1);
      expect(run.state.belts[tileIndex(spec.row, 0)], `${label}\nfeeder${floor(run)}`).toEqual({ kind: 'coffee', roast });
      expect(feederSlot(onFeeder, spec.row), label).toBe(slot);
      if (s > 0) {
        // When s = 0 the regular takes the cup on the tick it steps onto column 0.
        runTo(run, tJoin + 1);
        expect(run.state.belts[counterIndex(layout, 0)], `${label}\njoin${floor(run)}`).toEqual({ kind: 'coffee', roast });
      }
      runTo(run, tServe + 13);
      const brew = allOf(run, 'brew')[0];
      expect([brew?.T, brew?.tick, brew?.item], `${label}${floor(run)}`).toEqual([tKettle, tKettle % 12, { kind: 'coffee', roast }]);
      const serves = allOf(run, 'serve');
      expect(serves.map((e) => [e.T, e.justInTime]).slice(0, 2), `${label}${floor(run)}`).toEqual([
        [tServe, true],
        [tServe + 12, true],
      ]);
      expect(slotOf(tServe, s), label).toBe(slot);
      expect(allOf(run, 'spill').filter((e) => e.item.kind !== 'water'), `${label}${floor(run)}`).toEqual([]);
    }
  });
});
