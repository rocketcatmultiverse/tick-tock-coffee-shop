// Floor rows wait for a happy regular (docs/QUESTIONS.md, Q69). A new shop
// that spent its first coins on a row could not afford a first line, so rows
// are for sale only once the first regular has been happy, and a save that
// bought one before then has it taken back and refunded on load.

import { describe, expect, it } from 'vitest';
import type { TileChange } from '../../src/game/build';
import { loadShop, saveShop } from '../../src/game/save';
import { Shop } from '../../src/game/shop';
import { FLOOR_ROW_PRICE, PIECE_PRICE, START_COINS, START_ROWS, START_WELL_COL, START_WELL_ROW } from '../../src/game/tuning';
import { REFERENCE_LAYOUTS } from '../../src/levels/layouts';
import { REGULARS } from '../../src/levels/regulars';
import { tileIndex } from '../../src/sim/grid';
import { parseLayout, renderFloor } from '../../src/sim/text';
import type { Structure } from '../../src/sim/types';

function lineFor(id: string): TileChange[] {
  const layout = parseLayout(REFERENCE_LAYOUTS.find((r) => r.id === id)!.rows);
  return layout.tiles.flatMap((to, index) => (to && to.kind !== 'bowl' && to.kind !== 'feeder' ? [{ index, to }] : []));
}

/** A shop as an older version may have saved it, opened as a player's own. */
function oldSave(opts: { rows: number; till: number; walkedIn: number; pieces?: [number, number, Structure][] }): Shop {
  const built = new Shop({ defs: REGULARS, debug: true });
  // Older versions opened on a bare floor, with no well already down (Q79).
  built.build([{ index: tileIndex(START_WELL_ROW, START_WELL_COL), to: null }]);
  while (built.layout.rows < opts.rows) built.buyRow();
  const plan = built.build((opts.pieces ?? []).map(([row, col, to]) => ({ index: tileIndex(row, col), to })));
  expect(plan.ok ? 'ok' : plan.reason).toBe('ok');
  const save = saveShop(built, 0);
  save.till = opts.till;
  save.regulars = REGULARS.slice(0, opts.walkedIn).map((d) => ({ id: d.id, status: 'seated', loyalty: 0 }));
  return loadShop(save, REGULARS)!.shop;
}

describe('Floor rows wait for a happy regular', () => {
  it('a new shop cannot buy a row, and keeps its coins', () => {
    const shop = new Shop({ defs: REGULARS });
    expect(shop.rowsLocked()).toMatch(/the lamplighter is happy/);
    expect(shop.buyRow()).toBe(shop.rowsLocked());
    expect(shop.layout.rows).toBe(START_ROWS);
    expect(shop.till).toBe(START_COINS);
  });

  it('rows are for sale once the first regular is happy', () => {
    const shop = new Shop({ defs: REGULARS });
    const plan = shop.build(lineFor('lamplighter'));
    expect(plan.ok ? 'ok' : plan.reason).toBe('ok');
    for (let k = 0; k < 12 * 6 && shop.regulars.length < 2; k++) shop.tick();
    expect(shop.regulars.length, renderFloor(shop.layout, shop.sim)).toBe(2);
    expect(shop.rowsLocked()).toBeNull();
    // Earn the price of a row, then buy one.
    for (let k = 0; k < 12 * 12 && shop.till < FLOOR_ROW_PRICE; k++) shop.tick();
    expect(shop.buyRow()).toBeNull();
    expect(shop.layout.rows).toBe(START_ROWS + 1);
  });

  it('stays for sale after a load, though happiness starts again from nothing', () => {
    const shop = oldSave({ rows: START_ROWS, till: 200, walkedIn: 2 });
    expect(shop.isHappy(0)).toBe(false);
    expect(shop.rowsLocked()).toBeNull();
  });

  it('a debug shop may always buy rows', () => {
    expect(new Shop({ defs: REGULARS, debug: true }).rowsLocked()).toBeNull();
  });
});

describe('A save that bought rows too early', () => {
  it('has its rows taken back and refunded in full', () => {
    const shop = oldSave({ rows: START_ROWS + 1, till: START_COINS - FLOOR_ROW_PRICE, walkedIn: 1 });
    expect(shop.refundEarlyRows()).toEqual({ rows: 1, pieces: 0, coins: FLOOR_ROW_PRICE });
    expect(shop.layout.rows).toBe(START_ROWS);
    expect(shop.layout.tiles.length).toBe(START_ROWS * 12);
    expect(shop.till).toBe(START_COINS);
    // Fixed once: there is nothing left to take back.
    expect(shop.refundEarlyRows()).toBeNull();
  });

  it('refunds the pieces on those rows too, and keeps the rest of the floor', () => {
    const kettle: Structure = { kind: 'kettle', out: 'W' };
    const shop = oldSave({
      rows: START_ROWS + 2,
      till: 0,
      walkedIn: 1,
      pieces: [
        [1, 1, kettle],
        [START_ROWS, 2, { kind: 'well' }],
        [START_ROWS + 1, 2, { kind: 'plot', out: 'S' }],
      ],
    });
    const coins = 2 * FLOOR_ROW_PRICE + PIECE_PRICE.well + PIECE_PRICE.plot;
    expect(shop.refundEarlyRows()).toEqual({ rows: 2, pieces: 2, coins });
    expect(shop.till).toBe(coins);
    expect(shop.layout.tiles[tileIndex(1, 1)]).toEqual(kettle);
    expect(shop.layout.tiles.filter((s) => s?.kind === 'feeder').length).toBe(START_ROWS);
  });

  it('takes back a chute with one end on those rows, as one piece, whichever end it is', () => {
    const top = START_ROWS - 1;
    const shop = oldSave({
      rows: START_ROWS + 2,
      till: 0,
      walkedIn: 1,
      pieces: [
        // Launched from the floor kept, caught on a row taken back.
        [top, 3, { kind: 'launch', dir: 'N' }],
        [top + 2, 3, { kind: 'catch', dir: 'N' }],
        // Launched from a row taken back, caught on the floor kept.
        [top + 1, 6, { kind: 'launch', dir: 'S' }],
        [top - 1, 6, { kind: 'catch', dir: 'S' }],
      ],
    });
    expect(shop.refundEarlyRows()).toEqual({ rows: 2, pieces: 2, coins: 2 * FLOOR_ROW_PRICE + 2 * PIECE_PRICE.chute });
    expect(shop.layout.tiles.filter((s) => s && s.kind !== 'feeder' && s.kind !== 'bowl'), renderFloor(shop.layout, shop.sim)).toEqual([]);
  });

  it('is left alone once a regular has been happy', () => {
    const shop = oldSave({ rows: START_ROWS + 1, till: 0, walkedIn: 2 });
    expect(shop.refundEarlyRows()).toBeNull();
    expect(shop.layout.rows).toBe(START_ROWS + 1);
  });

  it('leaves a save with no rows bought alone', () => {
    const shop = oldSave({ rows: START_ROWS, till: 5, walkedIn: 1 });
    expect(shop.refundEarlyRows()).toBeNull();
    expect(shop.till).toBe(5);
  });
});
