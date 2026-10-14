import { describe, expect, it } from 'vitest';
import { Shop } from '../../src/game/shop';
import { START_COINS } from '../../src/game/tuning';
import { tileIndex } from '../../src/sim/grid';
import { layoutToText } from '../../src/sim/text';
import { Workbench } from '../../src/game/bench';
import type { PuzzleDef } from '../../src/sim/types';
import { Editor } from '../../src/ui/editor';

function setup(debug = false) {
  const shop = new Shop({ defs: [], debug });
  return { shop, ed: new Editor(shop) };
}

describe('Editor', () => {
  it('pays for a piece, and undo and redo move the money back and forth', () => {
    const { shop, ed } = setup();
    ed.pick('well');
    ed.press(2, 5);
    expect(shop.till).toBe(START_COINS - 25);
    ed.pick('plot');
    ed.press(1, 5);
    expect(shop.till).toBe(START_COINS - 35);
    ed.undo();
    expect(shop.layout.tiles[tileIndex(1, 5)]).toBeNull();
    expect(shop.till).toBe(START_COINS - 25);
    ed.redo();
    expect(shop.layout.tiles[tileIndex(1, 5)]).toEqual({ kind: 'plot', out: 'S' });
    expect(shop.till).toBe(START_COINS - 35);
  });

  it('a drag lays a run of belts that turn to follow it, as one undo step', () => {
    const { shop, ed } = setup();
    ed.pick('belt');
    ed.press(2, 2);
    ed.dragTo(2, 4);
    ed.dragTo(0, 4);
    ed.release();
    expect(layoutToText(shop.layout).slice(3)).toEqual([
      'F  .  >  >  v  .  .  .  .  .  .  .',
      'F  .  .  .  v  .  .  .  .  .  .  .',
      'F  .  .  .  v  .  .  .  .  .  .  .',
    ]);
    expect(shop.till).toBe(START_COINS - 5);
    ed.undo();
    expect(shop.layout.tiles.filter((t) => t?.kind === 'belt')).toEqual([]);
    expect(shop.till).toBe(START_COINS);
  });

  it('a drag into a machine turns the last belt to point at it', () => {
    const { shop, ed } = setup();
    ed.pick('plot');
    ed.press(2, 6);
    ed.pick('belt');
    ed.press(2, 4);
    ed.dragTo(2, 6);
    ed.release();
    expect(shop.layout.tiles[tileIndex(2, 5)]).toEqual({ kind: 'belt', dir: 'E' });
    expect(shop.layout.tiles[tileIndex(2, 6)]).toEqual({ kind: 'plot', out: 'S' });
  });

  it('delete refunds in full and goes into the buffer; Ctrl+V pastes it back for the price', () => {
    const { shop, ed } = setup();
    ed.pick('kettle');
    ed.press(1, 1);
    ed.putDown();
    ed.deleteKey(1, 1);
    expect(shop.till).toBe(START_COINS);
    expect(ed.hand).toBeNull();
    ed.pickUpBuffer();
    ed.press(3, 3);
    expect(shop.layout.tiles[tileIndex(3, 3)]).toEqual({ kind: 'kettle', out: 'S' });
    expect(shop.till).toBe(START_COINS - 15);
  });

  it('refuses a paste that overlaps, and says why', () => {
    const { shop, ed } = setup();
    ed.pick('belt');
    ed.press(0, 1);
    ed.release();
    ed.copy('hover', 0, 1);
    expect(ed.ghost(0, 1)?.reason).toBe('Overlaps something');
    ed.press(0, 1);
    expect(shop.till).toBe(START_COINS - 1);
  });

  it('cutting either end of a chute takes the whole chute', () => {
    const { shop, ed } = setup(true);
    const till = shop.till;
    ed.pick('chute');
    ed.press(2, 2);
    // Non-belt pieces start facing south, toward the counter.
    expect(shop.layout.tiles[tileIndex(0, 2)]).toEqual({ kind: 'catch', dir: 'S' });
    expect(shop.till).toBe(till - 30);
    ed.cut('hover', 0, 2);
    expect(shop.layout.tiles.filter((t) => t?.kind === 'launch' || t?.kind === 'catch')).toEqual([]);
    expect(shop.till).toBe(till);
    expect(ed.hand?.type).toBe('group');
  });

  it('box copy, rotate and paste turns the whole group', () => {
    const { shop, ed } = setup();
    ed.pick('belt');
    ed.press(0, 1);
    ed.dragTo(0, 2);
    ed.release();
    ed.beginSelect(0, 1);
    ed.selectTo(0, 2);
    ed.endSelect();
    ed.copy('box');
    ed.rotateHand();
    ed.press(3, 6);
    expect(shop.layout.tiles[tileIndex(3, 6)]).toEqual({ kind: 'belt', dir: 'S' });
    expect(shop.layout.tiles[tileIndex(2, 6)]).toEqual({ kind: 'belt', dir: 'S' });
  });

  it('a locked piece cannot be picked up, and what was in hand stays', () => {
    const { ed } = setup();
    ed.pick('belt');
    ed.pick('roaster');
    expect(ed.hand).toEqual({ type: 'piece', piece: 'belt', dir: 'E' });
    expect(ed.message).toMatch(/not unlocked/i);
  });

  it('the cat\'s bowl cannot be deleted', () => {
    const { shop, ed } = setup();
    ed.deleteKey(3, 9);
    expect(shop.layout.tiles[tileIndex(3, 9)]).toEqual({ kind: 'bowl' });
  });

  it('a flip that would change nothing is not offered (Q73)', () => {
    const { shop, ed } = setup();
    expect(ed.canFlip).toBe(false);
    ed.pick('kettle');
    // Facing south, a mirror left to right leaves it as it is.
    expect(ed.hand).toMatchObject({ dir: 'S' });
    expect(ed.canFlip).toBe(false);
    ed.rotateHand();
    expect(ed.hand).toMatchObject({ dir: 'W' });
    expect(ed.canFlip).toBe(true);
    // A well faces no way at all, however it was turned.
    ed.pick('well');
    ed.rotateHand();
    expect(ed.canFlip).toBe(false);
    // A group is offered a flip unless it is its own mirror image.
    ed.pick('belt');
    ed.press(1, 2);
    ed.dragTo(1, 4);
    ed.release();
    ed.putDown();
    ed.copy('hover', 1, 3);
    expect(ed.hand?.type).toBe('group');
    expect(ed.canFlip).toBe(true);
    ed.putDown();
    ed.pick('plot');
    ed.press(2, 6);
    ed.press(3, 6);
    ed.putDown();
    ed.selection = { r0: 2, r1: 3, c0: 6, c1: 6 };
    ed.copy('box');
    expect(shop.layout.tiles[tileIndex(2, 6)]?.kind).toBe('plot');
    expect(ed.canFlip).toBe(false);
  });

  it('putting down mid-run keeps the run, as one undo step', () => {
    const { shop, ed } = setup();
    ed.pick('belt');
    ed.press(1, 2);
    expect(ed.dragging).toBe(true);
    ed.dragTo(1, 5);
    ed.putDown();
    expect(ed.dragging).toBe(false);
    expect(ed.hand).toBeNull();
    expect([2, 3, 4, 5].map((c) => shop.layout.tiles[tileIndex(1, c)]?.kind)).toEqual(['belt', 'belt', 'belt', 'belt']);
    ed.undo();
    expect([2, 3, 4, 5].map((c) => shop.layout.tiles[tileIndex(1, c)])).toEqual([null, null, null, null]);
    expect(shop.till).toBe(START_COINS);
  });

  it('picking another piece mid-run ends the run, and the new piece lays no belts', () => {
    const { shop, ed } = setup();
    ed.pick('belt');
    ed.press(1, 2);
    ed.dragTo(1, 3);
    ed.pick('plot');
    expect(ed.dragging).toBe(false);
    ed.dragTo(1, 6);
    expect(shop.layout.tiles[tileIndex(1, 4)]).toBeNull();
    ed.undo();
    expect(shop.layout.tiles[tileIndex(1, 2)]).toBeNull();
    expect(shop.layout.tiles[tileIndex(1, 3)]).toBeNull();
  });
});

describe('Editor on a workbench (Q77)', () => {
  const def: PuzzleDef = {
    id: 'test',
    name: 'Test',
    ladder: 'basics',
    tier: 'tutorial',
    brief: '',
    board: ['. . . . .', 'W . . . T', '. . . . .'],
    pieces: { belt: 2, plot: null },
    wants: [{ kind: 'water' }],
  };

  it('builds for nothing, and says no price', () => {
    const bench = new Workbench(def);
    const ed = new Editor(bench);
    ed.pick('plot');
    ed.press(2, 2);
    expect(ed.message).toBe('Placed plot');
    ed.putDown();
    ed.deleteKey(2, 2);
    expect(ed.message).toBe('Deleted 1 piece');
    ed.pickUpBuffer();
    ed.press(0, 2);
    expect(ed.message).toBe('Pasted 1 piece');
  });

  it('cannot cut, copy or delete what the bench came with', () => {
    const bench = new Workbench(def);
    const ed = new Editor(bench);
    ed.deleteKey(1, 0);
    expect(ed.message).toBe('Nothing there');
    ed.cut('hover', 1, 4);
    expect(ed.hand).toBeNull();
    ed.copy('hover', 1, 0);
    expect(ed.message).toBe('Nothing to copy');
    // A box over the whole bench takes only what was placed.
    ed.pick('belt');
    ed.press(1, 1);
    ed.release();
    ed.putDown();
    ed.beginSelect(0, 0);
    ed.selectTo(2, 4);
    ed.endSelect();
    ed.copy('box');
    expect(ed.message).toBe('Copied 1 piece');
  });

  it('offers only the puzzle’s own pieces, and says when one has run out', () => {
    const bench = new Workbench(def);
    const ed = new Editor(bench);
    ed.pick('kettle');
    expect(ed.hand).toBeNull();
    expect(ed.message).toBe('Not in this puzzle');
    ed.pick('belt');
    ed.press(0, 1);
    ed.dragTo(0, 3);
    ed.release();
    expect(bench.left('belt')).toBe(0);
    expect(ed.ghost(2, 2)?.reason).toBe('Only 2 belts in this puzzle');
  });
});

