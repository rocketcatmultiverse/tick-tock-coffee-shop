// A new shop opens with its first well already down, at row 1, column 3,
// where the lamplighter's line wants it, so a new player has something to
// build from (docs/QUESTIONS.md, Q79). It is an ordinary well, a gift on top
// of the starting till: it can be moved or deleted, and it is the one well the
// shop may own until the postwoman raises the limit.

import { describe, expect, it } from 'vitest';
import type { TileChange } from '../../src/game/build';
import { loadShop, saveShop } from '../../src/game/save';
import { Shop } from '../../src/game/shop';
import { PIECE_PRICE, START_COINS, START_WELL_COL, START_WELL_ROW } from '../../src/game/tuning';
import { REFERENCE_LAYOUTS } from '../../src/levels/layouts';
import { REGULARS } from '../../src/levels/regulars';
import { tileIndex } from '../../src/sim/grid';
import { parseLayout, renderFloor } from '../../src/sim/text';
import type { Structure } from '../../src/sim/types';

const WELL = tileIndex(START_WELL_ROW, START_WELL_COL);
const wells = (shop: Shop) => shop.layout.tiles.flatMap((s, i) => (s?.kind === 'well' ? [i] : []));
const changes = (pieces: [number, number, Structure][]): TileChange[] =>
  pieces.map(([row, col, to]) => ({ index: tileIndex(row, col), to }));

/** Run a few loops and return the lamplighter's notes. */
function serve(shop: Shop, loops: number): string[] {
  const notes: string[] = [];
  for (let k = 0; k < 12 * loops; k++) notes.push(...shop.tick().notes);
  return notes.filter((n) => n.startsWith('The lamplighter'));
}

describe('A new shop’s first well', () => {
  it('is down at row 1, column 3, and the till still holds the starting coins', () => {
    const shop = new Shop({ defs: REGULARS });
    expect([START_WELL_ROW, START_WELL_COL]).toEqual([1, 3]);
    expect(wells(shop)).toEqual([WELL]);
    expect(shop.till).toBe(START_COINS);
  });

  it('is where the lamplighter’s reference line has its well', () => {
    const ref = parseLayout(REFERENCE_LAYOUTS.find((r) => r.id === 'lamplighter')!.rows);
    expect(ref.tiles[WELL]).toEqual({ kind: 'well' });
  });

  it('with a plot under it, a kettle and one belt, serves the lamplighter Just in Time from the first loop', () => {
    const shop = new Shop({ defs: REGULARS });
    const plan = shop.build(
      changes([
        [0, 3, { kind: 'plot', out: 'W' }],
        [0, 2, { kind: 'kettle', out: 'W' }],
        [0, 1, { kind: 'belt', dir: 'W' }],
      ]),
    );
    expect(plan.ok ? plan.cost : plan.reason).toBe(PIECE_PRICE.plot + PIECE_PRICE.kettle + PIECE_PRICE.belt);
    const notes = serve(shop, 4);
    expect(notes.filter((n) => n.endsWith('Just in Time!')).length, renderFloor(shop.layout, shop.sim)).toBe(4);
    expect(shop.isHappy(0)).toBe(true);
  });

  it('with a plot beside it and a kettle into the feeder, serves the lamplighter too', () => {
    const shop = new Shop({ defs: REGULARS });
    const plan = shop.build(
      changes([
        [1, 2, { kind: 'plot', out: 'W' }],
        [1, 1, { kind: 'kettle', out: 'W' }],
      ]),
    );
    expect(plan.ok ? plan.cost : plan.reason).toBe(PIECE_PRICE.plot + PIECE_PRICE.kettle);
    const notes = serve(shop, 4);
    expect(notes.filter((n) => n.endsWith('Just in Time!')).length, renderFloor(shop.layout, shop.sim)).toBe(4);
  });

  it('is the one well a new shop may own: a second is refused', () => {
    const shop = new Shop({ defs: REGULARS });
    expect(shop.build([{ index: tileIndex(3, 5), to: { kind: 'well' } }])).toEqual({ ok: false, reason: 'Well limit reached (1)' });
  });

  it('can be moved in one edit, for nothing', () => {
    const shop = new Shop({ defs: REGULARS });
    const plan = shop.build([
      { index: WELL, to: null },
      { index: tileIndex(3, 5), to: { kind: 'well' } },
    ]);
    expect(plan.ok ? plan.cost : plan.reason).toBe(0);
    expect(wells(shop)).toEqual([tileIndex(3, 5)]);
    expect(shop.till).toBe(START_COINS);
  });

  it('can be deleted, refunded in full like any well, and then placed anywhere', () => {
    const shop = new Shop({ defs: REGULARS });
    expect(shop.build([{ index: WELL, to: null }]).ok).toBe(true);
    expect(wells(shop)).toEqual([]);
    expect(shop.till).toBe(START_COINS + PIECE_PRICE.well);
    expect(shop.build([{ index: tileIndex(4, 6), to: { kind: 'well' } }]).ok).toBe(true);
    expect(shop.till).toBe(START_COINS);
  });

  it('is only for a new shop: a save opens with the floor it saved', () => {
    const built = new Shop({ defs: REGULARS });
    built.build([{ index: WELL, to: null }]);
    const loaded = loadShop(saveShop(built, 0), REGULARS)!.shop;
    expect(wells(loaded)).toEqual([]);
  });
});
