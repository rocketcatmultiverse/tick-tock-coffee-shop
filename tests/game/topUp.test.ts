// No save is left too poor to build (docs/QUESTIONS.md, Q69): when a shop is
// opened, a till and pieces worth less than a new shop's till are topped up
// to it. Pieces count at their full refund; rows bought do not count.

import { describe, expect, it } from 'vitest';
import { loadShop, saveShop } from '../../src/game/save';
import { Shop } from '../../src/game/shop';
import { PIECE_PRICE, START_COINS, START_ROWS, START_WELL_COL, START_WELL_ROW } from '../../src/game/tuning';
import { REGULARS } from '../../src/levels/regulars';
import { tileIndex } from '../../src/sim/grid';
import type { Structure } from '../../src/sim/types';

function opened(till: number, pieces: [number, number, Structure][] = [], rows = START_ROWS, walkedIn = 1): Shop {
  const built = new Shop({ defs: REGULARS, debug: true });
  // The pieces given are the whole floor: take up the well a new shop opens with (Q79).
  built.build([{ index: tileIndex(START_WELL_ROW, START_WELL_COL), to: null }]);
  while (built.layout.rows < rows) built.buyRow();
  built.build(pieces.map(([row, col, to]) => ({ index: tileIndex(row, col), to })));
  const save = saveShop(built, 0);
  save.till = till;
  save.regulars = REGULARS.slice(0, walkedIn).map((d) => ({ id: d.id, status: 'seated', loyalty: 0 }));
  return loadShop(save, REGULARS)!.shop;
}

describe('Topping up a poor shop', () => {
  it('fills an empty floor’s till up to a new shop’s', () => {
    const shop = opened(30);
    expect(shop.topUp()).toBe(START_COINS - 30);
    expect(shop.till).toBe(START_COINS);
  });

  it('counts the pieces on the floor at their full refund', () => {
    const shop = opened(20, [
      [0, 3, { kind: 'well' }],
      [0, 2, { kind: 'plot', out: 'W' }],
    ]);
    const worth = 20 + PIECE_PRICE.well + PIECE_PRICE.plot;
    expect(shop.topUp()).toBe(START_COINS - worth);
    expect(shop.till + PIECE_PRICE.well + PIECE_PRICE.plot).toBe(START_COINS);
  });

  it('leaves a shop worth a new shop’s till or more alone', () => {
    expect(opened(START_COINS).topUp()).toBe(0);
    const built = opened(START_COINS - PIECE_PRICE.well, [[0, 3, { kind: 'well' }]]);
    expect(built.topUp()).toBe(0);
    expect(built.till).toBe(START_COINS - PIECE_PRICE.well);
    expect(opened(500).topUp()).toBe(0);
  });

  it('does not count rows bought', () => {
    const shop = opened(30, [], START_ROWS + 1, 2);
    expect(shop.topUp()).toBe(START_COINS - 30);
    expect(shop.layout.rows).toBe(START_ROWS + 1);
  });
});
