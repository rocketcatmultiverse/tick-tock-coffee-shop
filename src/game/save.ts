// The save file (docs/SPEC.md, Spec 3): the layout plus the shop's books.
// Pure: the UI decides where it is stored and passes the clock in.

import type { Dir, Layout, RegularDef, Structure } from '../sim/types';
import { tileIndex } from '../sim/grid';
import { COLS } from '../sim/tuning';
import type { RegularState } from './regulars';
import { Shop } from './shop';
import { BOWL_COL, BOWL_ROW, START_ROWS } from './tuning';

export interface Save {
  version: 1;
  layout: Layout;
  till: number;
  catName: string; // chosen by the player
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
    gears: shop.gears,
    regulars: shop.regulars.map((r) => ({ ...r })),
    lastSeen: now,
  };
}

/** Rebuild a shop from saved data, or null if the data is not a save this version understands. */
export function loadShop(data: unknown, defs: readonly RegularDef[], debug = false): { shop: Shop; lastSeen: number } | null {
  if (!isSave(data, defs)) return null;
  const shop = new Shop({ defs, debug });
  shop.restore(data);
  return { shop, lastSeen: data.lastSeen };
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
  const regs = d.regulars;
  if (!Array.isArray(regs) || regs.length > defs.length || (defs.length > 0 && regs.length === 0)) return false;
  return regs.every(
    (r, i) => r && r.id === defs[i].id && STATUSES.has(r.status) && Number.isInteger(r.loyalty) && r.loyalty >= 0,
  );
}
