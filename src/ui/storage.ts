// Where the saves live: the browser's localStorage, one key per save slot.
// Every access is guarded, since storage can be missing or blocked (private
// windows, previews). A save that cannot be read is never written over
// unasked: its slot says so, and it can be exported or deleted.

import type { RegularDef } from '../sim/types';
import type { BenchProgress } from '../game/bench';
import { type Save, asSave, loadShop, saveShop } from '../game/save';
import type { Shop } from '../game/shop';
import { SAVE_SLOTS } from '../game/tuning';

/** How often a shop, or a workbench's progress, is saved while open, in milliseconds. */
export const AUTOSAVE_MS = 2000;

const prefix = (debug: boolean) => (debug ? 'ticktock.debug' : 'ticktock');
/** The one save from before there were slots. */
const legacyKey = (debug: boolean) => `${prefix(debug)}.save`;
export const slotKey = (debug: boolean, slot: number) => `${prefix(debug)}.slot.${slot}`;

/** The save slots, numbered from 1. */
export const SLOTS: readonly number[] = Array.from({ length: SAVE_SLOTS }, (_, k) => k + 1);

export type SlotState = { kind: 'empty' } | { kind: 'save'; save: Save } | { kind: 'unreadable'; raw: string };

function storage(): Storage | null {
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Whether saves are kept at all: storage can be missing or refuse writes. */
export function canSave(): boolean {
  try {
    const ls = storage();
    if (!ls) return false;
    ls.setItem('ticktock.probe', '1');
    ls.removeItem('ticktock.probe');
    return true;
  } catch {
    return false;
  }
}

/**
 * Move the save from before there were slots into the first empty slot, and
 * only then remove it. With every slot taken it stays where it is, to move
 * on a later visit. Returns the slot it moved to.
 */
export function migrateLegacySave(debug: boolean): number | null {
  try {
    const ls = storage();
    const raw = ls?.getItem(legacyKey(debug));
    if (!ls || raw == null) return null;
    const slot = SLOTS.find((n) => ls.getItem(slotKey(debug, n)) === null);
    if (slot === undefined) return null;
    ls.setItem(slotKey(debug, slot), raw);
    if (ls.getItem(slotKey(debug, slot)) !== raw) return null;
    ls.removeItem(legacyKey(debug));
    return slot;
  } catch {
    return null;
  }
}

/** What a slot holds, as stored. */
export function readSlot(defs: readonly RegularDef[], debug: boolean, slot: number): SlotState {
  let raw: string | null = null;
  try {
    raw = storage()?.getItem(slotKey(debug, slot)) ?? null;
  } catch {
    return { kind: 'empty' };
  }
  if (raw === null) return { kind: 'empty' };
  try {
    const save = asSave(JSON.parse(raw), defs);
    if (save) return { kind: 'save', save };
  } catch {
    // Not JSON: unreadable, below.
  }
  return { kind: 'unreadable', raw };
}

/** The shop in a slot, ready to play, or null if the slot holds none it can read. */
export function openSlot(defs: readonly RegularDef[], debug: boolean, slot: number): { shop: Shop; lastSeen: number } | null {
  const state = readSlot(defs, debug, slot);
  return state.kind === 'save' ? loadShop(state.save, defs, debug) : null;
}

/** Store a save in a slot, as an import does. Returns whether it was kept. */
export function writeSlot(debug: boolean, slot: number, save: Save): boolean {
  try {
    const ls = storage();
    if (!ls) return false;
    ls.setItem(slotKey(debug, slot), JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function writeSave(shop: Shop, slot: number): void {
  // Someone else's shop, opened from a share link, is never saved: it would overwrite the player's own.
  if (shop.visiting) return;
  writeSlot(shop.debug, slot, saveShop(shop, Date.now()));
}

/**
 * Keep a shop's workbench progress in its slot, and nothing else: the rest of
 * the save, its lastSeen with it, stays as the shop left it, so time at the
 * bench counts as time away (docs/QUESTIONS.md, Q77). Returns whether it was kept.
 */
export function writeBench(defs: readonly RegularDef[], debug: boolean, slot: number, bench: BenchProgress): boolean {
  const state = readSlot(defs, debug, slot);
  if (state.kind !== 'save') return false;
  return writeSlot(debug, slot, { ...state.save, bench: structuredClone(bench) });
}

export function clearSlot(debug: boolean, slot: number): void {
  try {
    storage()?.removeItem(slotKey(debug, slot));
  } catch {
    // Nothing to clear.
  }
}
