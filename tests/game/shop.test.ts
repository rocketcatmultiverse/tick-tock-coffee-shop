import { describe, expect, it } from 'vitest';
import { Shop, walkInNote } from '../../src/game/shop';
import { REGULARS } from '../../src/levels/regulars';
import { REFERENCE_LAYOUTS } from '../../src/levels/layouts';
import { parseLayout, renderFloor } from '../../src/sim/text';
import { tileIndex } from '../../src/sim/grid';
import type { TileChange } from '../../src/game/build';
import { START_COINS } from '../../src/game/tuning';

function layoutChanges(id: string): TileChange[] {
  const ref = REFERENCE_LAYOUTS.find((r) => r.id === id)!;
  const layout = parseLayout(ref.rows);
  return layout.tiles.flatMap((to, index) => (to && to.kind !== 'bowl' && to.kind !== 'feeder' ? [{ index, to }] : []));
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
    expect(shop.layout.tiles[tileIndex(3, 9)]).toEqual({ kind: 'bowl' });
  });

  it('regulars 1 to 4 arrive strictly in order, each once everyone before them is happy', () => {
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
    // One at a time.
    for (let k = 1; k < arrivals.length; k++) expect(arrivals[k][0]).toBeGreaterThan(arrivals[k - 1][0]);
  });

  it('the tick a regular walks in, its report says who, and what they bring to the palette', () => {
    // A player's shop, not a debug one, which has every piece from the start. The layout needs only
    // the first pieces and one well, but more coins than a new shop has.
    const shop = new Shop({ defs: REGULARS.slice(0, 4) });
    shop.till = 1000;
    expect(shop.build(layoutChanges('all-four')).ok).toBe(true);
    const walkIns: { at: number; id: string; unlocked: string[]; wellLimit: number | null; ladders: string[]; note: string }[] = [];
    for (let k = 0; k < 120; k++) {
      const before = shop.regulars.length;
      const report = shop.tick();
      // A report names a walk-in exactly when the regulars grow.
      expect(report.walkedIn !== null, `tick ${report.T}`).toBe(shop.regulars.length > before);
      const w = report.walkedIn;
      if (w) walkIns.push({ at: report.T, id: w.def.id, unlocked: w.unlocked, wellLimit: w.wellLimit, ladders: w.ladders, note: walkInNote(w) });
    }
    expect(walkIns.map((w) => w.id)).toEqual(['sweep', 'clockmaker', 'gargoyle']);
    expect(walkIns.find((w) => w.id === 'clockmaker')!.unlocked).toEqual(['spring']);
    expect(walkIns.find((w) => w.id === 'sweep')!.unlocked).toEqual([]);
    expect(walkIns.every((w) => w.wellLimit === null)).toBe(true);
    // The spring opens a ladder of workbench puzzles too, and the happenings say so (Q77).
    expect(walkIns.map((w) => w.ladders)).toEqual([[], ['spring'], []]);
    expect(walkIns.find((w) => w.id === 'clockmaker')!.note).toContain('New at the workbench: spring puzzles.');
    expect(walkIns.find((w) => w.id === 'sweep')!.note).not.toContain('workbench');
  });

  it('pays the plain price, the Just in Time bonus, and the clockmaker in gears', () => {
    const shop = new Shop({ defs: REGULARS, debug: true });
    shop.build(layoutChanges('all-four'));
    run(shop, 120); // everyone seated
    const till = shop.till;
    const gears = shop.gears;
    run(shop, 12 * 5);
    // Per loop, all Just in Time: lamplighter, sweep and gargoyle 5 + 3 each; the clockmaker 2 gears.
    expect(shop.till - till).toBe(5 * (8 + 8 + 8));
    expect(shop.gears - gears).toBe(5 * 2);
  });

  it('a seated regular whose line is broken goes to waiting, and the next correct cup seats them again', () => {
    const shop = new Shop({ defs: REGULARS.slice(0, 1), debug: true });
    for (const ch of layoutChanges('all-four')) expect(shop.build([ch]).ok).toBe(true);
    run(shop, 24);
    expect(shop.regulars[0].status).toBe('seated');
    // Take the well away: every line stops.
    shop.build([{ index: tileIndex(1, 3), to: null }]);
    const notes = run(shop, 48);
    expect(shop.regulars[0].status).toBe('waiting');
    expect(notes).toContain('The lamplighter is waiting.');
    const till = shop.till;
    run(shop, 12);
    expect(shop.till).toBe(till); // waiting regulars pay nothing
    shop.build([{ index: tileIndex(1, 3), to: { kind: 'well' } }]);
    run(shop, 24);
    expect(shop.regulars[0].status).toBe('seated');
  });

  it('an any-tick regular counts as waiting once 24 ticks have passed since their last cup', () => {
    // No regular on the ladder takes any tick now (Q64), but the rule still stands: an any-tick lamplighter.
    const anyTick = { ...REGULARS[0], order: { ...REGULARS[0].order, tick: 'any' as const } };
    const shop = new Shop({ defs: [anyTick], debug: true });
    shop.build(layoutChanges('all-four'));
    run(shop, 36);
    expect(shop.regulars[0].status).toBe('seated');
    const last = shop.sim.lastServedAt[0]!;
    shop.build(layoutChanges('all-four').map((ch) => ({ index: ch.index, to: null })));
    // Cups already on the belt may still arrive, so step until the regular stops being served.
    const statusAt = new Map<number, string>();
    for (let k = 0; k < 48; k++) {
      shop.tick();
      statusAt.set(shop.T - 1, shop.regulars[0].status);
    }
    const lastCup = shop.sim.lastServedAt[0]!;
    expect(lastCup).toBeGreaterThanOrEqual(last);
    expect(statusAt.get(lastCup + 23)).toBe('seated');
    expect(statusAt.get(lastCup + 24)).toBe('waiting');
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

  it('has no shelf: a cup nobody takes spills at the end of the counter and counts as a spill', () => {
    const shop = new Shop({ defs: [] });
    shop.sim.belts[shop.layout.rows * 12 + 11] = { kind: 'coffee', roast: 'light' };
    const till = shop.till;
    const { events } = shop.tick();
    expect(events.filter((e) => e.type === 'end')).toHaveLength(1);
    expect(shop.spillsThisLoop).toBe(1);
    expect(shop.till).toBe(till);
    expect('shelf' in shop).toBe(false);
  });

  it('charges for milk pails, and none arrive when the till cannot pay', () => {
    const cat = REGULARS.find((d) => d.bowl)!;
    const shop = new Shop({ defs: [cat], debug: true });
    expect(shop.milkOrder()).toBe(1);
    shop.build([{ index: tileIndex(2, 11), to: { kind: 'door' } }]);
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

  it('the order is one pail per milk drinker, and a pail the till cannot cover stops the rest of that loop', () => {
    const milk = REGULARS.filter((d) => d.order.drink !== 'coffee' && d.order.drink !== 'espresso');
    expect(milk.map((d) => d.id)).toEqual(['cat', 'innkeeper', 'mayor']);
    const shop = new Shop({ defs: milk, debug: true });
    // Walk the other two in by hand; in play each follows a serve.
    shop.regulars.push({ id: 'innkeeper', status: 'seated', loyalty: 0 }, { id: 'mayor', status: 'seated', loyalty: 0 });
    expect(shop.milkOrder()).toBe(3);
    shop.build([{ index: tileIndex(2, 11), to: { kind: 'door' } }]);
    const milkTicks = (ticks: number) => {
      const out: number[] = [];
      for (let k = 0; k < ticks; k++) {
        const { T, events } = shop.tick();
        for (const e of events) if (e.type === 'milk') out.push(T % 12);
      }
      return out;
    };
    expect(milkTicks(12)).toEqual([7, 8, 9]);
    shop.till = 3; // covers one pail
    expect(milkTicks(12)).toEqual([7]);
    expect(shop.till).toBe(1);
    shop.till = 100;
    expect(milkTicks(12)).toEqual([7, 8, 9]);
  });
});
