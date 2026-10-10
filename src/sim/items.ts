import type { Drink, Item, Roast, Seat } from './types';
import {
  KETTLE_LIGHT_MAX_TICK,
  KETTLE_MEDIUM_MAX_TICK,
  LOOP,
  ROASTER_LIGHT_MAX_TIME,
  ROASTER_MEDIUM_MAX_TIME,
} from './tuning';

/** Kettle roast for plain beans, from the clock tick they land on. */
export function roastForTick(t: number): Roast {
  if (t <= KETTLE_LIGHT_MAX_TICK) return 'light';
  if (t <= KETTLE_MEDIUM_MAX_TICK) return 'medium';
  return 'dark';
}

/** Roaster roast, from the number of ticks the batch spent inside (1 to 12). */
export function roastForTime(ticks: number): Roast {
  if (ticks <= ROASTER_LIGHT_MAX_TIME) return 'light';
  if (ticks <= ROASTER_MEDIUM_MAX_TIME) return 'medium';
  return 'dark';
}

/**
 * Ticks a batch that landed on clock tick `landed` spends inside before the
 * release tick. A batch landing on the release tick itself waits a full loop.
 */
export function timeInRoaster(landed: number, release: number): number {
  const d = (((release - landed) % LOOP) + LOOP) % LOOP;
  return d === 0 ? LOOP : d;
}

const DRINKS: ReadonlySet<string> = new Set<Drink>(['coffee', 'espresso', 'warmMilk', 'auLait', 'latte']);

export function isDrink(item: Item): item is Extract<Item, { kind: Drink }> {
  return DRINKS.has(item.kind);
}

export function roastOf(item: Item): Roast | null {
  return 'roast' in item ? item.roast : null;
}

/** Whether `item` is the drink this seat ordered. */
export function matchesOrder(seat: Seat, item: Item): boolean {
  if (item.kind !== seat.drink) return false;
  if (seat.roast === 'any') return true;
  return roastOf(item) === seat.roast;
}

export function sameItem(a: Item | null, b: Item | null): boolean {
  if (a === null || b === null) return a === b;
  return a.kind === b.kind && roastOf(a) === roastOf(b);
}

const ROAST_LETTER: Record<Roast, string> = { light: 'L', medium: 'M', dark: 'D' };

/** Two-character label used by the text renderer and the gray-box canvas. */
export function itemGlyph(item: Item): string {
  switch (item.kind) {
    case 'water':
      return 'w';
    case 'beans':
      return 'b';
    case 'milk':
      return 'm';
    case 'warmMilk':
      return 'wm';
    case 'espressoBeans':
      return 'e' + ROAST_LETTER[item.roast];
    case 'coffee':
      return 'c' + ROAST_LETTER[item.roast];
    case 'espresso':
      return 'E' + ROAST_LETTER[item.roast];
    case 'auLait':
      return 'A' + ROAST_LETTER[item.roast];
    case 'latte':
      return 'L' + ROAST_LETTER[item.roast];
  }
}

export function itemName(item: Item): string {
  const names: Record<Item['kind'], string> = {
    water: 'bucket of water',
    beans: 'beans',
    espressoBeans: 'espresso beans',
    milk: 'milk pail',
    coffee: 'coffee',
    espresso: 'espresso',
    warmMilk: 'warm milk',
    auLait: 'café au lait',
    latte: 'latte',
  };
  const r = roastOf(item);
  return r ? `${r} ${names[item.kind]}` : names[item.kind];
}
