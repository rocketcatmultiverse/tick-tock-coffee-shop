// Sharing a shop by link. The floor and the books are packed into the URL's
// fragment, since the site has no backend, with one character per tile so
// the link stays short. A shop opened from a link is a visit: it plays as
// usual and is never saved. Pure: the UI reads and writes the URL.

import { findCycle } from '../sim/steady';
import { parseToken, structureToken } from '../sim/text';
import { LOOP } from '../sim/tuning';
import type { Dir, Layout, RegularDef, Structure } from '../sim/types';
import { tileValue } from './build';
import { isMilkDrinker, seatFor } from './regulars';
import { type Save, loadShop } from './save';
import type { Shop } from './shop';
import { FLOOR_ROW_PRICE, START_ROWS } from './tuning';

/** The longest shop name, or cat name, a link carries. */
export const SHOP_NAME_MAX = 40;

/** What a share link carries. */
export interface ShareData {
  name: string;
  catName: string;
  /** Regulars who have walked in, in ladder order. */
  walkedIn: number;
  till: number;
  gears: number;
  layout: Layout;
}

/** The numbers players compare. */
export interface ShopStats {
  rowsBought: number;
  /** Every piece at its price, and every row bought: what the floor costs to build from scratch. */
  cost: number;
  /** Regulars the floor serves on every loop of its steady state, so they all end up happy. */
  happy: number;
  walkedIn: number;
  regulars: number;
}

/** How far a shop has got: compared to warn about spoilers. */
export interface Progress {
  walkedIn: number;
  happy: number;
}

// One character per tile: each piece that turns once per direction, then the
// plain pieces. The text layout's tokens name them, so the two never disagree.
const DIRS: readonly Dir[] = ['N', 'E', 'S', 'W'];
const PIECES: Structure[] = [
  ...(['belt', 'launch', 'catch', 'spring'] as const).flatMap((kind) => DIRS.map((dir) => ({ kind, dir }) as Structure)),
  ...(['plot', 'roaster', 'kettle', 'mixer'] as const).flatMap((kind) => DIRS.map((out) => ({ kind, out }) as Structure)),
  ...(['well', 'bowl', 'door', 'feeder', 'splitter'] as const).map((kind) => ({ kind }) as Structure),
];
const TOKENS = PIECES.map(structureToken);
const CODES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.slice(0, PIECES.length);
const EMPTY = '.';
const VERSION = '1';

function tileCode(s: Structure | null): string {
  return s ? CODES[TOKENS.indexOf(structureToken(s))] : EMPTY;
}

/** The structure a character stands for: null for an empty tile, undefined if it stands for nothing. */
function codeTile(c: string): Structure | null | undefined {
  if (c === EMPTY) return null;
  const k = CODES.indexOf(c);
  return k < 0 ? undefined : parseToken(TOKENS[k]);
}

const cut = (name: string) => name.trim().slice(0, SHOP_NAME_MAX);

/** What a link to this shop carries. */
export function shareOf(shop: Shop): ShareData {
  return {
    name: cut(shop.shopName),
    catName: cut(shop.catName),
    walkedIn: shop.regulars.length,
    till: shop.till,
    gears: shop.gears,
    layout: { cols: 12, rows: shop.layout.rows, tiles: shop.layout.tiles.slice() },
  };
}

/**
 * The URL fragment, without its '#'. With stats, the link also reads
 * "happy=4-of-5&rows=1&cost=212" near its start, for people looking at it;
 * opening a link ignores them and counts again from the floor.
 */
export function encodeShare(d: ShareData, stats?: ShopStats): string {
  const p = new URLSearchParams({ name: d.name });
  if (stats) {
    p.set('happy', `${stats.happy}-of-${stats.walkedIn}`);
    p.set('rows', String(stats.rowsBought));
    p.set('cost', String(stats.cost));
  }
  p.set('v', VERSION);
  p.set('cat', d.catName);
  p.set('in', String(d.walkedIn));
  p.set('till', String(d.till));
  p.set('gears', String(d.gears));
  p.set('floor', d.layout.tiles.map(tileCode).join(''));
  return p.toString();
}

const WHOLE = /^\d{1,15}$/;

/** Read a URL fragment, without its '#'. Null unless it is a shop this version can open. */
export function decodeShare(fragment: string, defs: readonly RegularDef[]): ShareData | null {
  const p = new URLSearchParams(fragment);
  const [walkedIn, till, gears, floor] = [p.get('in'), p.get('till'), p.get('gears'), p.get('floor')];
  if (p.get('v') !== VERSION || floor === null) return null;
  if (![walkedIn, till, gears].every((n) => n !== null && WHOLE.test(n))) return null;
  const n = Number(walkedIn);
  if (n < 1 || n > defs.length) return null;
  if (floor.length % 12 !== 0 || floor.length / 12 < START_ROWS) return null;
  const tiles = [...floor].map(codeTile);
  if (tiles.some((t) => t === undefined)) return null;
  const data: ShareData = {
    name: cut(p.get('name') ?? ''),
    catName: cut(p.get('cat') ?? ''),
    walkedIn: n,
    till: Number(till),
    gears: Number(gears),
    layout: { cols: 12, rows: floor.length / 12, tiles: tiles as (Structure | null)[] },
  };
  // The shop's own checks on a floor still apply: the feeder, the bowl and every piece.
  return visitShop(data, defs, false) ? data : null;
}

/** The shop a link opens: tick 0, an empty floor, the sharer's regulars and books. Never saved. */
export function visitShop(d: ShareData, defs: readonly RegularDef[], debug: boolean): Shop | null {
  const save: Save = {
    version: 1,
    layout: d.layout,
    till: d.till,
    catName: d.catName,
    shopName: d.name,
    gears: d.gears,
    regulars: defs.slice(0, d.walkedIn).map((def) => ({ id: def.id, status: 'seated', loyalty: 0 })),
    lastSeen: 0,
  };
  return loadShop(save, defs, debug, true)?.shop ?? null;
}

/** Rows bought, the floor's cost and the regulars it keeps happy, with everyone up to `walkedIn` in. */
export function shopStats(layout: Layout, walkedIn: number, defs: readonly RegularDef[]): ShopStats {
  const rowsBought = Math.max(0, layout.rows - START_ROWS);
  const cost = layout.tiles.reduce((n, s) => n + tileValue(s), 0) + rowsBought * FLOOR_ROW_PRICE;
  // Steady state with the whole milk order paid for, as the counter strip reads it.
  const inShop = defs.slice(0, walkedIn);
  const seats = inShop.map(seatFor);
  const cycle = findCycle(layout, { seats, milkPails: inShop.filter(isMilkDrinker).length });
  let happy = 0;
  if (cycle) {
    seats.forEach((_, i) => {
      const loops = new Set<number>();
      for (const tk of cycle.ticks) {
        if (tk.events.some((e) => e.type === 'serve' && e.seat === i)) loops.add(Math.floor((tk.T - cycle.start) / LOOP));
      }
      if (loops.size === cycle.loops) happy++;
    });
  }
  return { rowsBought, cost, happy, walkedIn, regulars: defs.length };
}

/** How far a shop has got; a player with no save has a new shop's progress. */
export function progressOf(shop: Shop | null, defs: readonly RegularDef[]): Progress {
  if (!shop) return { walkedIn: Math.min(1, defs.length), happy: 0 };
  return { walkedIn: shop.regulars.length, happy: shopStats(shop.layout, shop.regulars.length, defs).happy };
}

/** Behind: fewer regulars in, or as many in and fewer of them happy. Such a player may meet spoilers. */
export function isBehind(own: Progress, shared: Progress): boolean {
  return own.walkedIn < shared.walkedIn || (own.walkedIn === shared.walkedIn && own.happy < shared.happy);
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "4 of 5 regulars happy, 1 row bought, built for 212 coins". */
export function statsLine(s: ShopStats): string {
  const rows = s.rowsBought === 0 ? 'no rows bought' : `${plural(s.rowsBought, 'row', 'rows')} bought`;
  return `${s.happy} of ${plural(s.walkedIn, 'regular', 'regulars')} happy, ${rows}, built for ${s.cost.toLocaleString('en')} coins`;
}

/** A shop's name for others to read. */
export function shopTitle(name: string): string {
  return name.trim() || 'A coffee shop';
}

/** What the share button copies: the shop, the numbers players compare, and the link. */
export function shareText(name: string, stats: ShopStats, url: string): string {
  return `${shopTitle(name)}: ${statsLine(stats)}. ${url}`;
}
