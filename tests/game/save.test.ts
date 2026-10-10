import { describe, expect, it } from 'vitest';
import { Shop } from '../../src/game/shop';
import { loadShop, saveShop } from '../../src/game/save';
import { REGULARS } from '../../src/levels/regulars';
import { REFERENCE_LAYOUTS } from '../../src/levels/layouts';
import { parseLayout } from '../../src/sim/text';

function playedShop(): Shop {
  const shop = new Shop({ defs: REGULARS, debug: true });
  const layout = parseLayout(REFERENCE_LAYOUTS.find((r) => r.id === 'all-four')!.rows);
  shop.build(layout.tiles.flatMap((to, index) => (to && to.kind !== 'bowl' ? [{ index, to }] : [])));
  for (let k = 0; k < 12 * 12; k++) shop.tick();
  shop.catName = 'Pendulum';
  return shop;
}

describe('Save and load', () => {
  it('round-trips the layout, the books and the regulars through JSON', () => {
    const shop = playedShop();
    const json = JSON.stringify(saveShop(shop, 1_000_000));
    const back = loadShop(JSON.parse(json), REGULARS, true);
    expect(back).not.toBeNull();
    const { shop: loaded, lastSeen } = back!;
    expect(lastSeen).toBe(1_000_000);
    expect(loaded.layout).toEqual(shop.layout);
    expect(loaded.till).toBe(shop.till);
    expect(loaded.gears).toBe(shop.gears);
    expect(loaded.catName).toBe('Pendulum');
    expect(loaded.regulars).toEqual(shop.regulars);
    expect(loaded.T).toBe(0);
  });

  it('keeps serving after a load', () => {
    const shop = playedShop();
    const { shop: loaded } = loadShop(saveShop(shop, 0), REGULARS, true)!;
    const till = loaded.till;
    for (let k = 0; k < 36; k++) loaded.tick();
    expect(loaded.till).toBeGreaterThan(till);
  });

  it('refuses a save it does not understand', () => {
    expect(loadShop(null, REGULARS)).toBeNull();
    expect(loadShop({ version: 2 }, REGULARS)).toBeNull();
    expect(loadShop({ version: 1, layout: { cols: 12, rows: 6, tiles: [] } }, REGULARS)).toBeNull();
    const good = saveShop(playedShop(), 0);
    expect(loadShop({ ...good, regulars: [{ id: 'nobody', status: 'new', loyalty: 0 }] }, REGULARS)).toBeNull();
  });
});
