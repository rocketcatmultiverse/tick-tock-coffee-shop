import { describe, expect, it } from 'vitest';
import { Shop } from '../../src/game/shop';
import { REGULARS } from '../../src/levels/regulars';
import { REFERENCE_LAYOUTS } from '../../src/levels/layouts';
import { parseLayout, renderFloor } from '../../src/sim/text';
import { tileIndex } from '../../src/sim/grid';
import type { TileChange } from '../../src/game/build';
import { START_COINS, SHELF_SIZE } from '../../src/game/tuning';

function layoutChanges(id: string): TileChange[] {
  const ref = REFERENCE_LAYOUTS.find((r) => r.id === id)!;
  const layout = parseLayout(ref.rows);
  return layout.tiles.flatMap((to, index) => (to && to.kind !== 'bowl' ? [{ index, to }] : []));
}

function run(shop: Shop, ticks: number): string[] {
  const notes: string[] = [];
  for (let k = 0; k < ticks; k++) notes.push(...shop.tick().notes);
  return notes;
}

describe('Shop', () => {
  it('starts with 80 coins, regular 1 at the counter and the bowl in place', () => {
    const shop = new Shop({ defs: REGULARS });
    expect(shop.till).toBe(START_COINS);
    expect(shop.regulars).toEqual([{ id: 'lamplighter', status: 'new', loyalty: 0 }]);
    expect(shop.layout.tiles[tileIndex(5, 11)]).toEqual({ kind: 'bowl' });
  });

  it('regulars 1 to 4 arrive strictly in order, each once the one before is served', () => {
    const shop = new Shop({ defs: REGULARS.slice(0, 4), debug: true });
    expect(shop.build(layoutChanges('all-four')).ok).toBe(true);
    const arrivals: [number, number][] = [];
    for (let k = 0; k < 120; k++) {
      const before = shop.regulars.length;
      shop.tick();
      if (shop.regulars.length > before) arrivals.push([shop.T - 1, shop.regulars.length]);
    }
    expect(arrivals.map(([, n]) => n), renderFloor(shop.layout, shop.sim)).toEqual([2, 3, 4]);
    expect(shop.regulars.map((r) => r.status)).toEqual(['seated', 'seated', 'seated', 'seated']);
    // Each arrival follows a serve of the regular before.
    for (let k = 1; k < arrivals.length; k++) expect(arrivals[k][0]).toBeGreaterThan(arrivals[k - 1][0]);
  });

  it('pays the plain price, the Just in Time bonus, and the clockmaker in gears', () => {
    const shop = new Shop({ defs: REGULARS, debug: true });
    shop.build(layoutChanges('all-four'));
    run(shop, 120); // everyone seated
    const till = shop.till;
    const gears = shop.gears;
    run(shop, 12 * 5);
    // Per loop: lamplighter 5, sweep 5, gargoyle 5 + 3; the clockmaker 2 gears.
    expect(shop.till - till).toBe(5 * (5 + 5 + 8));
    expect(shop.gears - gears).toBe(5 * 2);
  });

  it('a seated regular whose line is broken goes to waiting, and the next correct cup seats them again', () => {
    const shop = new Shop({ defs: REGULARS.slice(0, 1) });
    for (const ch of layoutChanges('lamplighter')) expect(shop.build([ch]).ok).toBe(true);
    run(shop, 24);
    expect(shop.regulars[0].status).toBe('seated');
    // Take the plot away: the line stops.
    shop.build([{ index: tileIndex(2, 4), to: null }]);
    const notes = run(shop, 24);
    expect(shop.regulars[0].status).toBe('waiting');
    expect(notes).toContain('The lamplighter is waiting.');
    const till = shop.till;
    run(shop, 12);
    expect(shop.till).toBe(till); // waiting regulars pay nothing
    shop.build([{ index: tileIndex(2, 4), to: { kind: 'plot', out: 'W' } }]);
    run(shop, 24);
    expect(shop.regulars[0].status).toBe('seated');
  });

  it('refunds a removed piece in full', () => {
    const shop = new Shop({ defs: REGULARS });
    shop.build([{ index: tileIndex(2, 2), to: { kind: 'kettle', out: 'S' } }]);
    expect(shop.till).toBe(START_COINS - 15);
    shop.build([{ index: tileIndex(2, 2), to: null }]);
    expect(shop.till).toBe(START_COINS);
  });

  it('refuses a piece the till cannot cover', () => {
    const shop = new Shop({ defs: REGULARS });
    shop.build([{ index: tileIndex(2, 2), to: { kind: 'well' } }]); // 55 left
    for (const col of [3, 4, 5]) expect(shop.build([{ index: tileIndex(3, col), to: { kind: 'kettle', out: 'S' } }]).ok).toBe(true);
    expect(shop.till).toBe(10);
    const plan = shop.build([{ index: tileIndex(3, 6), to: { kind: 'kettle', out: 'S' } }]);
    expect(plan).toEqual({ ok: false, reason: 'Costs 15, the till holds 10' });
    expect(shop.till).toBe(10);
  });

  it('shelves untaken drinks, holds 3, spills stale cups, and walk-ins buy the oldest at half price', () => {
    // Nobody wants dark coffee before the sweep arrives, so it all goes to the shelf.
    const shop = new Shop({ defs: REGULARS.slice(0, 1), debug: true, seed: 3 });
    shop.build(layoutChanges('sweep'));
    let maxShelf = 0;
    let sales = 0;
    let tillBefore = shop.till;
    for (let k = 0; k < 12 * 50; k++) {
      const { notes } = shop.tick();
      maxShelf = Math.max(maxShelf, shop.shelf.length);
      for (const n of notes) {
        if (n.startsWith('A walk-in buys')) {
          sales++;
          expect(n).toContain('dark coffee');
          expect(shop.till - tillBefore).toBe(2); // half of 5, rounded down
        }
      }
      for (const cup of shop.shelf) expect(cup.age).toBeLessThanOrEqual(6);
      tillBefore = shop.till;
    }
    expect(maxShelf).toBeLessThanOrEqual(SHELF_SIZE);
    expect(sales).toBeGreaterThan(0);
  });

  it('a full shelf spills the next drink', () => {
    const shop = new Shop({ defs: [], seed: 1 });
    shop.shelf = [0, 1, 2].map(() => ({ item: { kind: 'coffee', roast: 'dark' } as const, age: 0 }));
    shop.rng.state = 0; // whatever happens, check the count stays at most 3
    shop.sim.belts[shop.layout.rows * 12 + 11] = { kind: 'coffee', roast: 'light' };
    const spillsBefore = shop.spillsThisLoop;
    shop.tick();
    expect(shop.shelf.length).toBeLessThanOrEqual(SHELF_SIZE);
    expect(shop.shelf.some((c) => c.item.kind === 'coffee' && 'roast' in c.item && c.item.roast === 'light')).toBe(false);
    expect(shop.spillsThisLoop).toBeGreaterThan(spillsBefore);
  });

  it('charges for milk pails, and none arrive when the till cannot pay', () => {
    const shop = new Shop({ defs: [], debug: true });
    shop.build([{ index: tileIndex(2, 0), to: { kind: 'door' } }]);
    const till = shop.till;
    const pails = (ticks: number) => {
      let n = 0;
      for (let k = 0; k < ticks; k++) n += shop.tick().events.filter((e) => e.type === 'milk').length;
      return n;
    };
    expect(pails(12)).toBe(1);
    expect(shop.till).toBe(till - 2);
    shop.till = 1;
    expect(pails(12)).toBe(0);
    expect(shop.till).toBe(1);
  });
});
