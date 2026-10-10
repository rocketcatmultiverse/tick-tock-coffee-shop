// The ladder of regulars 1 to 12 (Spec 5) and the unlock schedule (Rules 4).

import { describe, expect, it } from 'vitest';
import { rightsAfter } from '../../src/game/build';
import { Shop } from '../../src/game/shop';
import { REGULARS } from '../../src/levels/regulars';
import { REFERENCE_LAYOUTS } from '../../src/levels/layouts';
import { parseLayout, renderFloor } from '../../src/sim/text';

describe('Ladder', () => {
  it('has eleven regulars and the cat in slot 10, each at their own stool', () => {
    expect(REGULARS.length).toBe(12);
    expect(REGULARS[9].bowl).toBe(true);
    const stools = REGULARS.filter((d) => !d.bowl).map((d) => d.col);
    expect(new Set(stools).size).toBe(11);
  });

  it('unlocks pieces and wells as the schedule says', () => {
    const at = (n: number) => {
      const r = rightsAfter(REGULARS, n);
      return { pieces: [...r.unlocked].sort().join(','), wells: r.wellLimit };
    };
    const start = { pieces: 'belt,kettle,plot,well', wells: 1 };
    for (const n of [1, 2, 3, 4]) expect(at(n)).toEqual(start);
    expect(at(5)).toEqual({ ...start, wells: 2 }); // postwoman: a second well
    expect(at(6)).toEqual({ pieces: 'belt,chute,kettle,plot,well', wells: 2 }); // baker: chute
    expect(at(7)).toEqual({ pieces: 'belt,chute,kettle,plot,well', wells: 2 });
    expect(at(8)).toEqual({ pieces: 'belt,chute,kettle,plot,roaster,well', wells: 2 }); // witch: roaster
    expect(at(9)).toEqual({ pieces: 'belt,chute,kettle,plot,roaster,well', wells: 3 }); // alchemist: a third well
    expect(at(10)).toEqual({ pieces: 'belt,chute,door,kettle,plot,roaster,well', wells: 3 }); // the cat: back door
    expect(at(11)).toEqual({ pieces: 'belt,chute,door,kettle,mixer,plot,roaster,well', wells: 3 }); // innkeeper: mixer
    expect(at(12)).toEqual(at(11));
  });

  it('the all-twelve layout seats every regular and the cat, strictly in order', () => {
    const shop = new Shop({ defs: REGULARS, debug: true });
    const ref = REFERENCE_LAYOUTS.find((r) => r.id === 'all-twelve')!;
    const layout = parseLayout(ref.rows);
    for (let k = 0; k < ref.boughtRows; k++) expect(shop.buyRow()).toBeNull();
    const changes = layout.tiles.flatMap((to, index) => (to && to.kind !== 'bowl' ? [{ index, to }] : []));
    const plan = shop.build(changes);
    expect(plan.ok ? 'ok' : plan.reason).toBe('ok');

    const order: string[] = [];
    let catTookMilk = false;
    for (let k = 0; k < 12 * 40 && order.length < 12; k++) {
      const before = shop.regulars.map((r) => r.status);
      const { events } = shop.tick();
      shop.regulars.forEach((r, i) => {
        if (before[i] === 'new' && r.status === 'seated') order.push(r.id);
      });
      if (events.some((e) => e.type === 'serve' && e.seat === 9)) catTookMilk = true;
    }
    expect(order, renderFloor(shop.layout, shop.sim)).toEqual(REGULARS.map((d) => d.id));
    expect(catTookMilk).toBe(true);

    // Once everyone is seated, a full loop pays every regular but the cat.
    const till = shop.till;
    const gears = shop.gears;
    for (let k = 0; k < 24; k++) shop.tick();
    expect(shop.regulars.every((r) => r.status === 'seated'), renderFloor(shop.layout, shop.sim)).toBe(true);
    expect(shop.gears).toBeGreaterThan(gears);
    expect(shop.till).toBeGreaterThan(till);
  });
});
