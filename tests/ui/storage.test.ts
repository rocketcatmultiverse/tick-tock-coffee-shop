import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportText, importText, saveShop } from '../../src/game/save';
import { decodeShare, encodeShare, shareOf, visitShop } from '../../src/game/share';
import { Shop } from '../../src/game/shop';
import { SAVE_SLOTS } from '../../src/game/tuning';
import { REGULARS } from '../../src/levels/regulars';
import type { Structure } from '../../src/sim/types';
import { SLOTS, clearSlot, migrateLegacySave, openSlot, readSlot, slotKey, writeBench, writeSave, writeSlot } from '../../src/ui/storage';

/** localStorage, in memory. */
function memoryStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    removeItem: (k: string) => void items.delete(k),
  };
}

/** The key the one save lived under before there were slots. */
const LEGACY = 'ticktock.save';

function named(name: string): Shop {
  const shop = new Shop({ defs: REGULARS });
  shop.shopName = name;
  return shop;
}

describe('The saves in the browser', () => {
  let storage: ReturnType<typeof memoryStorage>;
  beforeEach(() => {
    storage = memoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
  });
  afterEach(() => vi.unstubAllGlobals());

  it(`has at least three slots, numbered from 1`, () => {
    expect(SAVE_SLOTS).toBeGreaterThanOrEqual(3);
    expect(SLOTS).toEqual(Array.from({ length: SAVE_SLOTS }, (_, k) => k + 1));
  });

  it('keeps the player’s own shop', () => {
    writeSave(named('Mine'), 1);
    expect(openSlot(REGULARS, false, 1)?.shop.shopName).toBe('Mine');
  });

  it('keeps each slot’s shop apart from the others', () => {
    writeSave(named('One'), 1);
    writeSave(named('Three'), 3);
    expect(readSlot(REGULARS, false, 2)).toEqual({ kind: 'empty' });
    expect(openSlot(REGULARS, false, 1)?.shop.shopName).toBe('One');
    expect(openSlot(REGULARS, false, 3)?.shop.shopName).toBe('Three');
    clearSlot(false, 1);
    expect(readSlot(REGULARS, false, 1)).toEqual({ kind: 'empty' });
    expect(openSlot(REGULARS, false, 3)?.shop.shopName).toBe('Three');
  });

  it('keeps debug saves apart from the player’s', () => {
    writeSave(named('Mine'), 1);
    writeSave(new Shop({ defs: REGULARS, debug: true }), 1);
    expect(openSlot(REGULARS, false, 1)?.shop.shopName).toBe('Mine');
    expect(openSlot(REGULARS, true, 1)?.shop.debug).toBe(true);
  });

  it('never writes a shop opened from a share link over the player’s own', () => {
    writeSave(named('Mine'), 1);
    const before = [...storage.items];

    const theirs = new Shop({ defs: REGULARS, debug: true });
    theirs.shopName = 'Theirs';
    theirs.buyRow();
    const visit = visitShop(decodeShare(encodeShare(shareOf(theirs)), REGULARS)!, REGULARS, false)!;
    for (let k = 0; k < 24; k++) visit.tick();
    for (const slot of SLOTS) writeSave(visit, slot);

    expect([...storage.items]).toEqual(before);
    expect(openSlot(REGULARS, false, 1)?.shop.shopName).toBe('Mine');
  });

  it('never writes a shared shop when the player has no save of their own', () => {
    const visit = visitShop(decodeShare(encodeShare(shareOf(new Shop({ defs: REGULARS }))), REGULARS)!, REGULARS, false)!;
    for (const slot of SLOTS) writeSave(visit, slot);
    expect(storage.items.size).toBe(0);
  });

  describe('the save from before there were slots', () => {
    it('moves into slot 1, unchanged, and leaves its old place', () => {
      const raw = JSON.stringify(saveShop(named('Old'), 5));
      storage.setItem(LEGACY, raw);
      expect(migrateLegacySave(false)).toBe(1);
      expect(storage.getItem(slotKey(false, 1))).toBe(raw);
      expect(storage.getItem(LEGACY)).toBeNull();
      expect(openSlot(REGULARS, false, 1)?.shop.shopName).toBe('Old');
      // Once moved, there is nothing more to move.
      expect(migrateLegacySave(false)).toBeNull();
    });

    it('moves into the first empty slot, never over a shop already there', () => {
      writeSave(named('One'), 1);
      writeSave(named('Two'), 2);
      storage.setItem(LEGACY, JSON.stringify(saveShop(named('Old'), 5)));
      expect(migrateLegacySave(false)).toBe(3);
      expect(SLOTS.map((n) => openSlot(REGULARS, false, n)?.shop.shopName)).toEqual(['One', 'Two', 'Old']);
    });

    it('stays where it is while every slot is taken', () => {
      for (const n of SLOTS) writeSave(named(`Shop ${n}`), n);
      const raw = JSON.stringify(saveShop(named('Old'), 5));
      storage.setItem(LEGACY, raw);
      expect(migrateLegacySave(false)).toBeNull();
      expect(storage.getItem(LEGACY)).toBe(raw);
      clearSlot(false, 2);
      expect(migrateLegacySave(false)).toBe(2);
      expect(storage.getItem(LEGACY)).toBeNull();
    });

    it('moves even if this version cannot read it, so nothing is lost', () => {
      storage.setItem(LEGACY, '{"version": 9}');
      expect(migrateLegacySave(false)).toBe(1);
      expect(readSlot(REGULARS, false, 1)).toEqual({ kind: 'unreadable', raw: '{"version": 9}' });
    });
  });

  it('reports a slot it cannot read, and keeps it as it is', () => {
    storage.setItem(slotKey(false, 2), 'not json');
    expect(readSlot(REGULARS, false, 2)).toEqual({ kind: 'unreadable', raw: 'not json' });
    expect(openSlot(REGULARS, false, 2)).toBeNull();
    expect(storage.getItem(slotKey(false, 2))).toBe('not json');
  });

  it('imports an exported save into a slot', () => {
    const shop = named('Travelling');
    shop.catName = 'Pendulum';
    const text = exportText(saveShop(shop, 7));
    const save = importText(text, REGULARS);
    expect(save).not.toBeNull();
    expect(writeSlot(false, 2, save!)).toBe(true);
    const back = openSlot(REGULARS, false, 2)!;
    expect(back.shop.shopName).toBe('Travelling');
    expect(back.shop.catName).toBe('Pendulum');
    expect(back.lastSeen).toBe(7);
  });

  it('refuses to import a file that is not a save', () => {
    expect(importText('', REGULARS)).toBeNull();
    expect(importText('hello', REGULARS)).toBeNull();
    expect(importText('{"version": 1}', REGULARS)).toBeNull();
    expect(importText(JSON.stringify({ ...saveShop(named('x'), 0), tutorialSeen: 'yes' }), REGULARS)).toBeNull();
  });

  it('keeps a workbench puzzle’s progress in its shop’s slot, leaving the rest of the save as it was (Q77)', () => {
    const shop = named('The Night Owl');
    writeSlot(false, 2, saveShop(shop, 1234));
    const before = readSlot(REGULARS, false, 2);
    const bench = { solved: ['basics-water'], floors: { 'basics-beans': [[13, { kind: 'plot', out: 'E' }]] as [number, Structure][] } };
    expect(writeBench(REGULARS, false, 2, bench)).toBe(true);
    const after = readSlot(REGULARS, false, 2);
    if (before.kind !== 'save' || after.kind !== 'save') throw new Error('no save');
    // Time at the bench is time away from the shop: lastSeen does not move.
    expect(after.save).toEqual({ ...before.save, bench });
    expect(after.save.lastSeen).toBe(1234);
    // There is no shop in an empty slot to keep it in.
    expect(writeBench(REGULARS, false, 3, bench)).toBe(false);
    expect(readSlot(REGULARS, false, 3).kind).toBe('empty');
  });
});

