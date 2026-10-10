// The timing equations as a property test (Spec 6, whole-system tests):
//   t_kettle = b1 + G + b2
//   t_serve  = t_kettle + 1 + b3 + (s - c)

import { describe, expect, it } from 'vitest';
import { counterIndex } from '../../src/sim/grid';
import { roastForTick } from '../../src/sim/items';
import { GROWTH } from '../../src/sim/tuning';
import type { Seat } from '../../src/sim/types';
import { allOf, floor, runTo, start } from '../helpers';
import { buildLine, seeded } from './layoutBuilder';
import { layoutToText } from '../../src/sim/text';

describe('Timing equations', () => {
  it('matches the worked example: b1 = 2, G = 4, b2 = 2, b3 = 3, c = 8, s = 10', () => {
    const rand = seeded(1);
    const layout = buildLine({ b1: 2, b2: 2, b3: 3, c: 8 }, rand);
    const seat: Seat = { col: 10, drink: 'coffee', roast: 'dark', tick: 2, grace: 0 };
    const run = start(layout, [seat]);
    runTo(run, 30);
    expect(allOf(run, 'water').map((e) => e.T), floor(run)).toEqual([2, 14, 26]);
    expect(allOf(run, 'harvest').map((e) => e.T), floor(run)).toEqual([6, 18]);
    expect(allOf(run, 'brew')[0], floor(run)).toMatchObject({ T: 8, tick: 8, item: { kind: 'coffee', roast: 'dark' } });
    expect(allOf(run, 'serve')[0], floor(run)).toMatchObject({ T: 14, justInTime: true });
  });

  it('holds for random b1, b2, b3, c and s built as real layouts', () => {
    const rand = seeded(20261009);
    const pick = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
    for (let trial = 0; trial < 400; trial++) {
      const b1 = pick(0, 12);
      const b2 = pick(0, 12);
      const b3 = pick(0, 12);
      const c = pick(0, 11);
      const s = pick(c, 11);
      const layout = buildLine({ b1, b2, b3, c }, rand);
      const tKettle = b1 + GROWTH + b2;
      const tJoin = tKettle + 1 + b3;
      const tServe = tJoin + (s - c);
      const roast = roastForTick(tKettle % 12);
      const seat: Seat = { col: s, drink: 'coffee', roast, tick: tServe % 12, grace: 0 };
      const run = start(layout, [seat]);
      const label = `b1=${b1} b2=${b2} b3=${b3} c=${c} s=${s}\n${layoutToText(layout).join('\n')}`;
      runTo(run, tJoin + 1);
      if (s > c) {
        // When s = c the regular takes the cup on the tick it joins.
        expect(run.state.belts[counterIndex(layout, c)], `${label}\njoin${floor(run)}`).toEqual({ kind: 'coffee', roast });
      }
      runTo(run, tServe + 13);
      const brew = allOf(run, 'brew')[0];
      expect([brew?.T, brew?.tick, brew?.item], `${label}${floor(run)}`).toEqual([
        tKettle,
        tKettle % 12,
        { kind: 'coffee', roast },
      ]);
      const serves = allOf(run, 'serve');
      expect(serves.map((e) => [e.T, e.justInTime]).slice(0, 2), `${label}${floor(run)}`).toEqual([
        [tServe, true],
        [tServe + 12, true],
      ]);
      expect(allOf(run, 'spill').filter((e) => e.item.kind !== 'water'), `${label}${floor(run)}`).toEqual([]);
    }
  });
});
