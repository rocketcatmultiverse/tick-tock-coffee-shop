import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeShare, encodeShare, shareOf, visitShop } from '../../src/game/share';
import { Shop } from '../../src/game/shop';
import { REGULARS } from '../../src/levels/regulars';
import { readSave, writeSave } from '../../src/ui/storage';

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

describe('The save in the browser', () => {
  let storage: ReturnType<typeof memoryStorage>;
  beforeEach(() => {
    storage = memoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the player’s own shop', () => {
    const shop = new Shop({ defs: REGULARS });
    shop.shopName = 'Mine';
    writeSave(shop);
    expect(readSave(REGULARS, false)?.shop.shopName).toBe('Mine');
  });

  it('never writes a shop opened from a share link over the player’s own', () => {
    const own = new Shop({ defs: REGULARS });
    own.shopName = 'Mine';
    writeSave(own);
    const before = [...storage.items];

    const theirs = new Shop({ defs: REGULARS, debug: true });
    theirs.shopName = 'Theirs';
    theirs.buyRow();
    const visit = visitShop(decodeShare(encodeShare(shareOf(theirs)), REGULARS)!, REGULARS, false)!;
    for (let k = 0; k < 24; k++) visit.tick();
    writeSave(visit);

    expect([...storage.items]).toEqual(before);
    expect(readSave(REGULARS, false)?.shop.shopName).toBe('Mine');
  });

  it('never writes a shared shop when the player has no save of their own', () => {
    const visit = visitShop(decodeShare(encodeShare(shareOf(new Shop({ defs: REGULARS }))), REGULARS)!, REGULARS, false)!;
    writeSave(visit);
    expect(storage.items.size).toBe(0);
  });
});
