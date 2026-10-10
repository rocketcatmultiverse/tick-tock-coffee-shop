// Rules 6: loyalty, gears and offline progress.

import { describe, expect, it } from 'vitest';
import { Shop } from '../../src/game/shop';
import { applyOffline, loopsAway } from '../../src/game/offline';
import { REGULARS } from '../../src/levels/regulars';
import { REFERENCE_LAYOUTS } from '../../src/levels/layouts';
import { parseLayout } from '../../src/sim/text';

const SECOND = 1000;

function allFourShop(): Shop {
  const shop = new Shop({ defs: REGULARS.slice(0, 4), debug: true });
  const layout = parseLayout(REFERENCE_LAYOUTS.find((r) => r.id === 'all-four')!.rows);
  shop.build(layout.tiles.flatMap((to, index) => (to && to.kind !== 'bowl' ? [{ index, to }] : [])));
  for (let k = 0; k < 12 * 12; k++) shop.tick();
  return shop;
}

describe('Offline', () => {
  it('counts loops away as seconds over 12, rounded down, capped at 3 days', () => {
    expect(loopsAway(0, 11 * SECOND)).toBe(0);
    expect(loopsAway(0, 12 * SECOND)).toBe(1);
    expect(loopsAway(0, 125 * SECOND)).toBe(10);
    expect(loopsAway(0, 3 * 86400 * SECOND)).toBe(21600);
    expect(loopsAway(0, 30 * 86400 * SECOND)).toBe(21600);
    expect(loopsAway(5000, 1000)).toBe(0); // a clock that went backwards
  });

  it('raises each regular\'s loyalty by loops away times serves per loop, and leaves the till alone', () => {
    const shop = allFourShop();
    const before = shop.regulars.map((r) => r.loyalty);
    const till = shop.till;
    const report = applyOffline(shop, 0, 120 * SECOND)!;
    expect(report.loops).toBe(10);
    expect(shop.regulars.map((r) => r.loyalty)).toEqual(before.map((n) => n + 10));
    expect(report.regulars.map((r) => [r.id, r.served])).toEqual([
      ['lamplighter', 10],
      ['sweep', 10],
      ['clockmaker', 10],
      ['gargoyle', 10],
    ]);
    expect(shop.till).toBe(till);
  });

  it('counts the clockmaker\'s gears offline: two a loop when his cup is Just in Time', () => {
    const shop = allFourShop();
    const gears = shop.gears;
    const report = applyOffline(shop, 0, 120 * SECOND)!;
    expect(shop.gears - gears).toBe(20);
    expect(report.gearsEarned).toBe(20);
    expect(report.gears).toBe(shop.gears);
  });

  it('a regular the layout does not serve gains nothing', () => {
    const shop = new Shop({ defs: REGULARS, debug: true });
    const report = applyOffline(shop, 0, 600 * SECOND)!;
    expect(report.regulars).toEqual([{ id: 'lamplighter', name: 'The lamplighter', served: 0 }]);
    expect(shop.regulars[0].loyalty).toBe(0);
  });

  it('no report for less than one loop away', () => {
    expect(applyOffline(allFourShop(), 0, 5 * SECOND)).toBeNull();
  });
});

describe('Loyalty', () => {
  it('goes up by one for every loop a regular is served while open', () => {
    const shop = allFourShop();
    const before = shop.regulars.map((r) => r.loyalty);
    for (let k = 0; k < 12 * 5; k++) shop.tick();
    expect(shop.regulars.map((r, i) => r.loyalty - before[i])).toEqual([5, 5, 5, 5]);
  });
});
