// Happiness and the newcomer gate (a design decision from play-testing,
// docs/QUESTIONS.md Q62): a regular is happy after HAPPY_LOOPS full loops in
// a row with their cup, and the next regular walks in only at the end of a
// loop in which every regular already in the shop is happy.

import { describe, expect, it } from 'vitest';
import { Shop } from '../../src/game/shop';
import { HAPPY_LOOPS } from '../../src/game/tuning';
import { REGULARS } from '../../src/levels/regulars';
import { REFERENCE_LAYOUTS } from '../../src/levels/layouts';
import { parseLayout, renderFloor } from '../../src/sim/text';
import { tileIndex } from '../../src/sim/grid';
import type { TileChange } from '../../src/game/build';

function changes(id: string): TileChange[] {
  const layout = parseLayout(REFERENCE_LAYOUTS.find((r) => r.id === id)!.rows);
  return layout.tiles.flatMap((to, index) => (to && to.kind !== 'bowl' && to.kind !== 'feeder' ? [{ index, to }] : []));
}

/** Run until T reaches `until`, recording the T on which each regular walked in. */
function arrivals(shop: Shop, until: number): number[] {
  const out: number[] = [];
  while (shop.T < until) {
    const before = shop.regulars.length;
    const { T } = shop.tick();
    if (shop.regulars.length > before) out.push(T);
  }
  return out;
}

const LOOP = 12;

describe('Happiness', () => {
  it('is three full loops in a row', () => {
    expect(HAPPY_LOOPS).toBe(3);
  });

  it('a regular is happy after HAPPY_LOOPS loops in a row with a cup, and only then does the next walk in', () => {
    const shop = new Shop({ defs: REGULARS.slice(0, 4), debug: true });
    expect(shop.build(changes('all-four')).ok).toBe(true);
    const happyAt: number[] = [];
    while (shop.T < LOOP * HAPPY_LOOPS) {
      shop.tick();
      happyAt.push(shop.happiness(0));
    }
    // The lamplighter's cup comes every loop from the first: one more loop of happiness at each loop's end.
    expect(happyAt.filter((_, T) => T % LOOP === LOOP - 1), renderFloor(shop.layout, shop.sim)).toEqual([1, 2, 3]);
    expect(shop.isHappy(0)).toBe(true);
    // The sweep walked in at the end of the third loop, not on the lamplighter's first cup.
    expect(shop.regulars.map((r) => r.id)).toEqual(['lamplighter', 'sweep']);
  });

  it('newcomers arrive one at a time, each at a loop end once everyone already in is happy', () => {
    const shop = new Shop({ defs: REGULARS.slice(0, 4), debug: true });
    shop.build(changes('all-four'));
    const at = arrivals(shop, LOOP * HAPPY_LOOPS * 4);
    // Every cup in the all-four layout arrives in each regular's first full loop.
    expect(at, renderFloor(shop.layout, shop.sim)).toEqual([1, 2, 3].map((k) => k * LOOP * HAPPY_LOOPS - 1));
    expect(shop.regulars.every((_, i) => shop.isHappy(i))).toBe(true);
  });

  it('a loop without a cup starts the count again', () => {
    const shop = new Shop({ defs: REGULARS.slice(0, 2), debug: true });
    shop.build(changes('all-four'));
    arrivals(shop, LOOP * 2);
    expect(shop.happiness(0)).toBe(2);
    // Take the well away for a loop: no cups, so the count goes back to 0, and no newcomer.
    shop.build([{ index: tileIndex(1, 3), to: null }]);
    arrivals(shop, LOOP * 3);
    expect(shop.happiness(0)).toBe(0);
    shop.build([{ index: tileIndex(1, 3), to: { kind: 'well' } }]);
    arrivals(shop, LOOP * 5);
    expect(shop.regulars.length).toBe(1);
    expect(shop.happiness(0)).toBeLessThan(HAPPY_LOOPS);
  });

  it('a lucky cup for the newest regular brings nobody while an earlier regular is unhappy', () => {
    const shop = new Shop({ defs: REGULARS.slice(0, 4), debug: true });
    shop.build(changes('all-four'));
    arrivals(shop, LOOP * HAPPY_LOOPS * 2); // the lamplighter and the sweep are in and happy
    expect(shop.regulars.map((r) => r.id)).toEqual(['lamplighter', 'sweep', 'clockmaker']);
    // Starve the lamplighter: remove the south plot. The clockmaker is served every loop from now on.
    shop.build([{ index: tileIndex(0, 3), to: null }]);
    arrivals(shop, LOOP * HAPPY_LOOPS * 4);
    expect(shop.isHappy(2)).toBe(true);
    expect(shop.isHappy(0)).toBe(false);
    expect(shop.regulars.length).toBe(3);
  });

  it('the newest unhappy regular is the newcomer the panel shows', () => {
    const shop = new Shop({ defs: REGULARS.slice(0, 2), debug: true });
    expect(shop.newcomer()?.id).toBe('lamplighter');
    shop.build(changes('all-four'));
    arrivals(shop, LOOP * HAPPY_LOOPS);
    expect(shop.newcomer()?.id).toBe('sweep');
    arrivals(shop, LOOP * HAPPY_LOOPS * 2);
    expect(shop.newcomer()).toBeNull();
  });
});
