import type { Drink, RegularDef, Seat } from '../sim/types';
import { slotOf, tileIndex } from '../sim/grid';
import { BOWL_COL, BOWL_ROW } from './tuning';

export type RegularStatus = 'new' | 'seated' | 'waiting';

export interface RegularState {
  id: string;
  status: RegularStatus;
  /** Loops served; flavour only for now. */
  loyalty: number;
}

/** The simulator's view of a regular at their stool. */
export function seatFor(def: RegularDef): Seat {
  return {
    col: def.col,
    drink: def.order.drink,
    roast: def.order.roast,
    tick: def.order.tick,
    fussy: def.order.fussy,
    ...(def.bowl ? { bowl: tileIndex(BOWL_ROW, BOWL_COL) } : {}),
  };
}

/** Milk drinkers grow the side door's standing order by one pail each. */
export function isMilkDrinker(def: RegularDef): boolean {
  return def.order.drink === 'warmMilk' || def.order.drink === 'auLait' || def.order.drink === 'latte';
}

const DRINK_NAME: Record<Drink, string> = {
  coffee: 'coffee',
  espresso: 'espresso',
  warmMilk: 'warm milk',
  auLait: 'café au lait',
  latte: 'latte',
};

/** "Medium coffee", "Warm milk": the drink a regular orders. */
export function orderName(def: RegularDef): string {
  const o = def.order;
  const name = `${o.roast === 'any' ? '' : o.roast + ' '}${DRINK_NAME[o.drink]}`;
  return name[0].toUpperCase() + name.slice(1);
}

/** ", tick 9 (slot 9)", " in the bowl, tick 10" and the like: where and when they want it. */
export function orderWhen(def: RegularDef): string {
  const o = def.order;
  const slot = def.bowl || o.tick === 'any' ? '' : ` (slot ${slotOf(o.tick, def.col)})`;
  const when = o.tick === 'any' ? 'any tick' : `tick ${o.tick}${slot}`;
  return `${def.bowl ? ' in the bowl' : ''}, ${when}${o.fussy ? ', fussy' : ''}`;
}
