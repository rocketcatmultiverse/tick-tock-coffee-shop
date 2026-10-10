// Where the save lives: the browser's localStorage. Every access is guarded,
// since storage can be missing or blocked (private windows, previews).

import type { RegularDef } from '../sim/types';
import { type Save, loadShop, saveShop } from '../game/save';
import type { Shop } from '../game/shop';

const keyFor = (debug: boolean) => (debug ? 'ticktock.debug.save' : 'ticktock.save');

export function readSave(defs: readonly RegularDef[], debug: boolean): { shop: Shop; lastSeen: number } | null {
  try {
    const raw = window.localStorage.getItem(keyFor(debug));
    return raw ? loadShop(JSON.parse(raw), defs, debug) : null;
  } catch {
    return null;
  }
}

export function writeSave(shop: Shop): void {
  try {
    const save: Save = saveShop(shop, Date.now());
    window.localStorage.setItem(keyFor(shop.debug), JSON.stringify(save));
  } catch {
    // Storage unavailable: the shop simply is not saved.
  }
}

export function clearSave(debug: boolean): void {
  try {
    window.localStorage.removeItem(keyFor(debug));
  } catch {
    // Nothing to clear.
  }
}
