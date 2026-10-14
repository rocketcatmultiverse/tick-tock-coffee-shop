// The save file (docs/SPEC.md, Spec 3): the layout plus the shop's books.
// Pure: the UI decides where it is stored and passes the clock in. Fields
// added since are optional, so every older save still loads.

import type { Dir, Layout, RegularDef, Structure } from '../sim/types';
import { tileIndex } from '../sim/grid';
import { COLS } from '../sim/tuning';
import type { BenchProgress } from './bench';
import type { RegularState } from './regulars';
import { Shop } from './shop';
import { BOWL_COL, BOWL_ROW, START_ROWS } from './tuning';

export interface Save {
  version: 1;
  layout: Layout;
  till: number;
  catName: string; // chosen by the player
  shopName?: string; // chosen by the player, for share links; older saves have none
  tutorialSeen?: boolean; // the tour was offered; older saves have none, so it is offered to them
  apprentice?: boolean; // the keys wait for the lessons (Q80); older saves have none, and are their owners'
  bench?: BenchProgress; // workbench puzzles solved and the pieces on each bench; older saves have none
  gears: number; // paid by the clockmaker; buys nothing
  regulars: RegularState[];
  lastSeen: number; // epoch ms, read only by the game layer
}

export function saveShop(shop: Shop, now: number): Save {
  return {
    version: 1,
    layout: { cols: 12, rows: shop.layout.rows, tiles: shop.layout.tiles.slice() },
    till: shop.till,
    catName: shop.catName,
    shopName: shop.shopName,
    tutorialSeen: shop.tutorialSeen,
    apprentice: shop.apprentice,
    bench: structuredClone(shop.bench),
    gears: shop.gears,
    regulars: shop.regulars.map((r) => ({ ...r })),
    lastSeen: now,
  };
}

/**
 * Rebuild a shop from saved data, or null if the data is not a save this
 * version understands. A visiting shop is someone else's, from a share link.
 */
export function loadShop(
  data: unknown,
  defs: readonly RegularDef[],
  debug = false,
  visiting = false,
): { shop: Shop; lastSeen: number } | null {
  if (!isSave(data, defs)) return null;
  const shop = new Shop({ defs, debug, visiting });
  shop.restore(data);
  return { shop, lastSeen: data.lastSeen };
}

/** The data as a save this version understands, or null. */
export function asSave(data: unknown, defs: readonly RegularDef[]): Save | null {
  return isSave(data, defs) ? data : null;
}

/** A save as the text of an exported file, for keeping a copy or moving it to another browser. */
export function exportText(save: Save): string {
  return JSON.stringify(save, null, 2);
}

/** A save read back from an exported file's text, or null if the text is not one. */
export function importText(text: string, defs: readonly RegularDef[]): Save | null {
  try {
    return asSave(JSON.parse(text), defs);
  } catch {
    return null;
  }
}

const DIRS = new Set<Dir>(['N', 'E', 'S', 'W']);
const STATUSES = new Set(['new', 'seated', 'waiting']);

function isStructure(s: unknown): s is Structure {
  if (s === null || typeof s !== 'object') return false;
  const o = s as Record<string, unknown>;
  switch (o.kind) {
    case 'belt':
    case 'launch':
    case 'catch':
    case 'spring':
      return DIRS.has(o.dir as Dir);
    case 'plot':
    case 'roaster':
    case 'kettle':
    case 'mixer':
      return DIRS.has(o.out as Dir);
    case 'well':
    case 'bowl':
    case 'door':
    case 'feeder':
    case 'splitter':
      return true;
    default:
      return false;
  }
}

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/** Puzzles solved by id, and each bench's pieces by tile. A tray is never placed, so a save never holds one. */
export function isBenchProgress(b: unknown): b is BenchProgress {
  if (b === null || typeof b !== 'object') return false;
  const o = b as Record<string, unknown>;
  if (!Array.isArray(o.solved) || !o.solved.every((id) => typeof id === 'string')) return false;
  if (o.floors === null || typeof o.floors !== 'object' || Array.isArray(o.floors)) return false;
  return Object.values(o.floors).every(
    (tiles) => Array.isArray(tiles) && tiles.every((t) => Array.isArray(t) && t.length === 2 && Number.isInteger(t[0]) && t[0] >= 0 && isStructure(t[1])),
  );
}

function isSave(data: unknown, defs: readonly RegularDef[]): data is Save {
  if (data === null || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (d.version !== 1) return false;
  const layout = d.layout as Layout | undefined;
  if (!layout || layout.cols !== 12 || !Number.isInteger(layout.rows) || layout.rows < START_ROWS) return false;
  if (!Array.isArray(layout.tiles) || layout.tiles.length !== layout.rows * COLS) return false;
  if (!layout.tiles.every((t) => t === null || isStructure(t))) return false;
  if (layout.tiles[tileIndex(BOWL_ROW, BOWL_COL)]?.kind !== 'bowl') return false;
  // The feeder runs down column 0 of every row, and nowhere else.
  if (!layout.tiles.every((t, i) => (t?.kind === 'feeder') === (i % COLS === 0))) return false;
  if (typeof d.till !== 'number' || !Number.isFinite(d.till)) return false;
  if (!isCount(d.gears) || typeof d.catName !== 'string' || typeof d.lastSeen !== 'number') return false;
  if (d.shopName !== undefined && typeof d.shopName !== 'string') return false;
  if (d.tutorialSeen !== undefined && typeof d.tutorialSeen !== 'boolean') return false;
  if (d.apprentice !== undefined && typeof d.apprentice !== 'boolean') return false;
  if (d.bench !== undefined && !isBenchProgress(d.bench)) return false;
  const regs = d.regulars;
  if (!Array.isArray(regs) || regs.length > defs.length || (defs.length > 0 && regs.length === 0)) return false;
  return regs.every(
    (r, i) => r && r.id === defs[i].id && STATUSES.has(r.status) && Number.isInteger(r.loyalty) && r.loyalty >= 0,
  );
}
