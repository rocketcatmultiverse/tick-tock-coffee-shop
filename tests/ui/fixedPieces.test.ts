// Fixed pieces (Spec 4, with docs/ADDENDUM-01.md): the feeder, like the cat's
// bowl, cannot be selected, cut, deleted or built or pasted over. A new floor
// has a feeder tile in every row, and buying a row adds one at the top.

import { describe, expect, it } from 'vitest';
import { Shop } from '../../src/game/shop';
import { planBuild, rightsAfter, tileValue } from '../../src/game/build';
import { BOWL_COL, BOWL_ROW, FLOOR_ROW_PRICE, START_COINS, START_ROWS, START_WELL_COL, START_WELL_ROW } from '../../src/game/tuning';
import { REGULARS } from '../../src/levels/regulars';
import { tileIndex } from '../../src/sim/grid';
import { Editor } from '../../src/ui/editor';

function setup() {
  const shop = new Shop({ defs: [], debug: true });
  return { shop, ed: new Editor(shop) };
}

const feederRows = (shop: Shop) =>
  Array.from({ length: shop.layout.rows }, (_, r) => shop.layout.tiles[tileIndex(r, 0)]?.kind ?? null);

describe('Fixed pieces', () => {
  it('a new shop has the feeder down column 0 of every row and the bowl at row 3, column 9', () => {
    const shop = new Shop({ defs: [] });
    expect(feederRows(shop)).toEqual(new Array(START_ROWS).fill('feeder'));
    expect([BOWL_ROW, BOWL_COL]).toEqual([3, 9]);
    expect(shop.layout.tiles[tileIndex(3, 9)]).toEqual({ kind: 'bowl' });
    const others = shop.layout.tiles.filter((s, i) => s && i % 12 !== 0 && i !== tileIndex(3, 9));
    expect(others).toEqual([]);
    expect(shop.till).toBe(START_COINS);
  });

  it('the well a shop opens with is not fixed: X takes it up and a click puts it down elsewhere (Q79)', () => {
    const shop = new Shop({ defs: REGULARS });
    const ed = new Editor(shop);
    ed.cut('hover', START_WELL_ROW, START_WELL_COL);
    expect(shop.layout.tiles[tileIndex(START_WELL_ROW, START_WELL_COL)]).toBeNull();
    ed.press(2, 6);
    expect(shop.layout.tiles[tileIndex(2, 6)]).toEqual({ kind: 'well' });
    expect(shop.till).toBe(START_COINS);
  });

  it('buying a row adds one feeder tile at the top and nothing else, and the feeder itself is free', () => {
    const shop = new Shop({ defs: [] });
    expect(shop.buyRow()).toBeNull();
    expect(feederRows(shop)).toEqual(new Array(START_ROWS + 1).fill('feeder'));
    expect(shop.layout.tiles.slice(START_ROWS * 12 + 1)).toEqual(new Array(11).fill(null));
    expect(shop.till).toBe(START_COINS - FLOOR_ROW_PRICE);
    expect(tileValue({ kind: 'feeder' })).toBe(0);
  });

  it('nothing can be built on column 0, and the feeder cannot be removed', () => {
    const { shop } = setup();
    const rights = rightsAfter([], 0, true);
    expect(planBuild(shop.layout, [{ index: tileIndex(2, 0), to: null }], rights, 1000)).toEqual({
      ok: false,
      reason: 'The feeder is fixed',
    });
    expect(planBuild(shop.layout, [{ index: tileIndex(2, 0), to: { kind: 'belt', dir: 'S' } }], rights, 1000)).toEqual({
      ok: false,
      reason: 'The feeder is fixed',
    });
    // Nor can a feeder be placed anywhere else.
    expect(planBuild(shop.layout, [{ index: tileIndex(2, 4), to: { kind: 'feeder' } }], rights, 1000)).toEqual({
      ok: false,
      reason: 'The feeder is fixed',
    });
  });

  it('a piece in hand over column 0 is refused, and the ghost says why', () => {
    const { shop, ed } = setup();
    ed.pick('kettle');
    expect(ed.ghost(2, 0)?.reason).toBe('The feeder is fixed');
    ed.press(2, 0);
    expect(shop.layout.tiles[tileIndex(2, 0)]).toEqual({ kind: 'feeder' });
  });

  it('Z, X and C do nothing to the feeder', () => {
    const { shop, ed } = setup();
    ed.deleteKey(2, 0);
    ed.cut('hover', 2, 0);
    ed.copy('hover', 2, 0);
    expect(feederRows(shop)).toEqual(new Array(START_ROWS).fill('feeder'));
    expect(ed.buffer.entries).toEqual([]);
  });

  it('a box over the feeder selects only what is beside it', () => {
    const { shop, ed } = setup();
    ed.pick('belt');
    ed.press(2, 1);
    ed.release();
    ed.putDown();
    ed.beginSelect(3, 0);
    ed.selectTo(1, 2);
    ed.endSelect();
    ed.copy('box');
    expect(ed.buffer.entries[0].cells.map((c) => c.s.kind)).toEqual(['belt']);
    ed.putDown();
    ed.beginSelect(3, 0);
    ed.selectTo(1, 2);
    ed.endSelect();
    ed.deleteKey(0, 0);
    expect(shop.layout.tiles[tileIndex(2, 1)]).toBeNull();
    expect(feederRows(shop)).toEqual(new Array(START_ROWS).fill('feeder'));
  });

  it('a paste that would cover the feeder is refused, and the ghost says why', () => {
    const { shop, ed } = setup();
    ed.pick('belt');
    ed.press(2, 3);
    ed.dragTo(2, 4);
    ed.release();
    ed.copy('hover', 2, 3);
    // The group's top-left corner on column 0 puts its first belt on the feeder.
    expect(ed.ghost(2, 0)?.reason).toBe('The feeder is fixed');
    const before = shop.layout.tiles.slice();
    ed.press(2, 0);
    expect(shop.layout.tiles).toEqual(before);
  });

  it('a belt drag across column 0 leaves the feeder alone', () => {
    const { shop, ed } = setup();
    ed.pick('belt');
    ed.press(2, 2);
    ed.dragTo(2, 0);
    ed.release();
    expect(shop.layout.tiles[tileIndex(2, 0)]).toEqual({ kind: 'feeder' });
    expect(shop.layout.tiles[tileIndex(2, 1)]).toEqual({ kind: 'belt', dir: 'W' });
  });
});
