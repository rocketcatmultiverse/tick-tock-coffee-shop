import type { Drink, RegularDef, Seat } from '../sim/types';
import { tileIndex } from '../sim/grid';
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
    grace: def.order.grace,
    fussy: def.order.fussy,
    ...(def.bowl ? { bowl: tileIndex(BOWL_ROW, BOWL_COL) } : {}),
  };
}

const DRINK_NAME: Record<Drink, string> = {
  coffee: 'coffee',
  espresso: 'espresso',
  warmMilk: 'warm milk',
  auLait: 'café au lait',
  latte: 'latte',
};

/** "Medium coffee, tick 5, grace 2" and the like. */
export function describeOrder(def: RegularDef): string {
  const o = def.order;
  const what = `${o.roast === 'any' ? '' : o.roast[0].toUpperCase() + o.roast.slice(1) + ' '}${DRINK_NAME[o.drink]}`;
  const when = o.tick === 'any' ? 'any tick' : `tick ${o.tick}, grace ${o.grace}`;
  return `${what}${def.bowl ? ' in the bowl' : ''}, ${when}${o.fussy ? ', fussy' : ''}`;
}
