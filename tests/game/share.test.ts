import { describe, expect, it } from 'vitest';
import { planBuild, rightsAfter, startLayout } from '../../src/game/build';
import { loadShop, saveShop } from '../../src/game/save';
import {
  SHOP_NAME_MAX,
  decodeShare,
  encodeShare,
  isBehind,
  progressOf,
  shareOf,
  shareText,
  shopStats,
  visitShop,
} from '../../src/game/share';
import { Shop } from '../../src/game/shop';
import { FLOOR_ROW_PRICE, START_ROWS } from '../../src/game/tuning';
import { REFERENCE_LAYOUTS } from '../../src/levels/layouts';
import { REGULARS } from '../../src/levels/regulars';
import { tileIndex } from '../../src/sim/grid';
import { parseLayout } from '../../src/sim/text';
import type { Dir, Layout, Structure } from '../../src/sim/types';

const ref = (id: string) => REFERENCE_LAYOUTS.find((r) => r.id === id)!;
const refLayout = (id: string) => parseLayout(ref(id).rows);

/** A shop with everyone up to `walkedIn` in, built to a reference layout. */
function shopOn(id: string, walkedIn: number): Shop {
  const shop = new Shop({ defs: REGULARS, debug: true });
  const layout = refLayout(id);
  while (shop.layout.rows < layout.rows) shop.buyRow();
  shop.build(layout.tiles.flatMap((to, index) => (to && to.kind !== 'bowl' && to.kind !== 'feeder' ? [{ index, to }] : [])));
  const save = saveShop(shop, 0);
  save.regulars = REGULARS.slice(0, walkedIn).map((d) => ({ id: d.id, status: 'seated', loyalty: 3 }));
  return loadShop(save, REGULARS, true)!.shop;
}

/** Piece prices of a reference layout, as the shop charged them. */
function piecesCost(layout: Layout): number {
  const changes = layout.tiles.flatMap((to, index) => (to && to.kind !== 'bowl' && to.kind !== 'feeder' ? [{ index, to }] : []));
  const plan = planBuild(startLayout(layout.rows), changes, rightsAfter(REGULARS, REGULARS.length, true), Infinity);
  if (!plan.ok) throw new Error(plan.reason);
  return plan.cost;
}

describe('Share links', () => {
  it('round-trip the layout, the names and the books', () => {
    const shop = shopOn('all-twelve', 12);
    shop.catName = 'Pendulum';
    shop.till = 1234;
    shop.gears = 17;
    shop.shopName = "RocketCat's coffee shop & bakery #1 = 100% ☕";
    const data = shareOf(shop);
    const back = decodeShare(encodeShare(data), REGULARS);
    expect(back).toEqual(data);
    expect(back!.layout).toEqual(shop.layout);
  });

  it('give every piece, every way round, one character of its own', () => {
    const dirs: Dir[] = ['N', 'E', 'S', 'W'];
    const pieces: Structure[] = [
      ...dirs.flatMap((dir) => (['belt', 'launch', 'catch', 'spring'] as const).map((kind) => ({ kind, dir }) as Structure)),
      ...dirs.flatMap((out) => (['plot', 'roaster', 'kettle', 'mixer'] as const).map((kind) => ({ kind, out }) as Structure)),
      { kind: 'well' },
      { kind: 'door' },
      { kind: 'splitter' },
    ];
    const layout = startLayout(START_ROWS + 1);
    // Fill every free tile, in order, with the pieces above.
    let k = 0;
    for (let i = 0; i < layout.tiles.length && k < pieces.length; i++) if (!layout.tiles[i]) layout.tiles[i] = pieces[k++];
    expect(k).toBe(pieces.length);
    const data = { name: 'All of them', catName: '', walkedIn: 1, till: 0, gears: 0, layout };
    const encoded = encodeShare(data);
    expect(decodeShare(encoded, REGULARS)!.layout).toEqual(layout);
    // One character a tile keeps the link short.
    const floor = new URLSearchParams(encoded).get('floor')!;
    expect(floor.length).toBe(layout.tiles.length);
  });

  it('use only characters a URL carries as they are, apart from the names', () => {
    const data = shareOf(shopOn('all-twelve', 12));
    expect(encodeShare(data)).toMatch(/^[A-Za-z0-9._*=&-]+$/);
  });

  it('read the numbers players compare near the start of the link, and open the same shop whatever they claim', () => {
    const shop = shopOn('all-twelve', 12);
    shop.shopName = 'Twelve';
    const stats = shopStats(shop.layout, 12, REGULARS);
    const encoded = encodeShare(shareOf(shop), stats);
    expect(encoded.startsWith(`name=Twelve&happy=12-of-12&rows=${ref('all-twelve').boughtRows}&cost=${stats.cost}&`)).toBe(true);
    const lying = encoded.replace('happy=12-of-12', 'happy=99-of-99').replace(`cost=${stats.cost}`, 'cost=1');
    expect(decodeShare(lying, REGULARS)).toEqual(shareOf(shop));
  });

  it('cut a shop name to the longest a link carries', () => {
    const shop = new Shop({ defs: REGULARS });
    shop.shopName = 'a'.repeat(SHOP_NAME_MAX + 10);
    const data = shareOf(shop);
    expect(data.name).toBe('a'.repeat(SHOP_NAME_MAX));
    const long = encodeShare({ ...data, name: 'b'.repeat(SHOP_NAME_MAX + 10) });
    expect(decodeShare(long, REGULARS)!.name).toBe('b'.repeat(SHOP_NAME_MAX));
  });

  it('refuse a link that is not a shop', () => {
    const good = encodeShare(shareOf(shopOn('lamplighter', 1)));
    const params = () => new URLSearchParams(good);
    const without = (key: string) => {
      const p = params();
      p.delete(key);
      return p.toString();
    };
    const withValue = (key: string, value: string) => {
      const p = params();
      p.set(key, value);
      return p.toString();
    };
    expect(decodeShare(good, REGULARS)).not.toBeNull();
    expect(decodeShare('', REGULARS)).toBeNull();
    expect(decodeShare('debug', REGULARS)).toBeNull();
    for (const key of ['v', 'floor', 'in', 'till', 'gears']) expect(decodeShare(without(key), REGULARS), key).toBeNull();
    expect(decodeShare(withValue('v', '2'), REGULARS)).toBeNull();
    expect(decodeShare(withValue('in', '0'), REGULARS)).toBeNull();
    expect(decodeShare(withValue('in', String(REGULARS.length + 1)), REGULARS)).toBeNull();
    expect(decodeShare(withValue('in', '1.5'), REGULARS)).toBeNull();
    expect(decodeShare(withValue('till', 'lots'), REGULARS)).toBeNull();
    expect(decodeShare(withValue('gears', '-1'), REGULARS)).toBeNull();
    const floor = params().get('floor')!;
    expect(decodeShare(withValue('floor', floor.slice(12)), REGULARS), 'too few rows').toBeNull();
    expect(decodeShare(withValue('floor', floor.slice(1)), REGULARS), 'not whole rows').toBeNull();
    expect(decodeShare(withValue('floor', floor.replace('.', '!')), REGULARS), 'not a tile').toBeNull();
    // The shop's own rules for a floor still hold: the feeder down column 0 and the bowl in place.
    const noFeeder = floor.slice(0, 12) + '.' + floor.slice(13);
    expect(decodeShare(withValue('floor', noFeeder), REGULARS), 'feeder').toBeNull();
    const at = tileIndex(3, 9);
    const noBowl = floor.slice(0, at) + '.' + floor.slice(at + 1);
    expect(decodeShare(withValue('floor', noBowl), REGULARS), 'bowl').toBeNull();
  });

  it('open as a shop that plays from tick 0 with the sharer’s regulars, and is never saved', () => {
    const shop = shopOn('all-four', 4);
    shop.shopName = 'Four on four';
    const data = decodeShare(encodeShare(shareOf(shop)), REGULARS)!;
    const visit = visitShop(data, REGULARS, false)!;
    expect(visit.visiting).toBe(true);
    expect(shop.visiting).toBe(false);
    expect(visit.T).toBe(0);
    expect(visit.shopName).toBe('Four on four');
    expect(visit.layout).toEqual(shop.layout);
    expect(visit.regulars.map((r) => r.id)).toEqual(REGULARS.slice(0, 4).map((d) => d.id));
    expect(visit.till).toBe(shop.till);
    for (let k = 0; k < 12 * 6; k++) visit.tick();
    // All four are served and happy, so the next regular walks in, as in the sharer's own shop.
    expect([0, 1, 2, 3].map((i) => visit.isHappy(i))).toEqual([true, true, true, true]);
    expect(visit.regulars.length).toBe(5);
  });

  it('count rows bought, the cost of the floor and the regulars it keeps happy', () => {
    const layout = refLayout('all-twelve');
    const stats = shopStats(layout, 12, REGULARS);
    expect(stats.rowsBought).toBe(ref('all-twelve').boughtRows);
    // Every piece at its price, plus the rows bought: what the floor costs to build from scratch.
    expect(stats.cost).toBe(piecesCost(layout) + ref('all-twelve').boughtRows * FLOOR_ROW_PRICE);
    expect(stats.happy).toBe(12);
    expect(stats.walkedIn).toBe(12);
    expect(stats.regulars).toBe(REGULARS.length);
  });

  it('count only regulars served on every loop as happy', () => {
    // The lamplighter's line serves the lamplighter and nobody else.
    const stats = shopStats(refLayout('lamplighter'), 4, REGULARS);
    expect(stats.happy).toBe(1);
    expect(stats.rowsBought).toBe(0);
    expect(shopStats(startLayout(START_ROWS), 1, REGULARS)).toEqual({
      rowsBought: 0,
      cost: 0,
      happy: 0,
      walkedIn: 1,
      regulars: REGULARS.length,
    });
  });

  it('call a player behind who has fewer regulars in, or as many and fewer of them happy', () => {
    const shared = { walkedIn: 5, happy: 4 };
    expect(isBehind({ walkedIn: 4, happy: 4 }, shared)).toBe(true);
    expect(isBehind({ walkedIn: 5, happy: 3 }, shared)).toBe(true);
    expect(isBehind({ walkedIn: 5, happy: 4 }, shared)).toBe(false);
    expect(isBehind({ walkedIn: 5, happy: 5 }, shared)).toBe(false);
    expect(isBehind({ walkedIn: 6, happy: 0 }, shared)).toBe(false);
  });

  it('read a player’s progress from their own floor, or a new shop’s when they have none', () => {
    expect(progressOf(null, REGULARS)).toEqual({ walkedIn: 1, happy: 0 });
    expect(progressOf(shopOn('all-four', 4), REGULARS)).toEqual({ walkedIn: 4, happy: 4 });
    expect(progressOf(shopOn('all-four', 5), REGULARS)).toEqual({ walkedIn: 5, happy: 4 });
  });

  it('put the numbers players compare in the text that goes with the link', () => {
    const stats = shopStats(refLayout('all-twelve'), 12, REGULARS);
    const text = shareText("RocketCat's coffee shop", stats, 'https://example.test/#v=1');
    expect(text).toContain("RocketCat's coffee shop");
    expect(text).toContain('12 of 12 regulars happy');
    expect(text).toContain(`${ref('all-twelve').boughtRows} rows bought`);
    expect(text).toContain(`${stats.cost} coins`);
    expect(text.endsWith('https://example.test/#v=1')).toBe(true);
    expect(shareText('', shopStats(startLayout(START_ROWS), 1, REGULARS), 'u')).toMatch(/^A coffee shop: 0 of 1 regular happy, no rows bought, built for 0 coins/);
  });
});
