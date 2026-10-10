// Every provisional number the game layer uses (docs/SPEC.md, Rules 4 to 6).

import type { Drink } from '../sim/types';
import type { PieceKind } from './pieces';

export const START_COINS = 80;
export const START_ROWS = 6;
export const DEBUG_COINS = 9999;

/** Pieces in the palette from the start, and how many wells you may own. */
export const START_PIECES: readonly PieceKind[] = ['belt', 'plot', 'kettle', 'well'];
export const START_WELL_LIMIT = 1;

export const PIECE_PRICE: Record<PieceKind, number> = {
  belt: 1,
  chute: 30, // launch and catch together
  plot: 10,
  kettle: 15,
  roaster: 20,
  well: 25,
  mixer: 20,
  door: 20,
};

export const FLOOR_ROW_PRICE = 50;
export const MILK_PAIL_PRICE = 2;

export const DRINK_PRICE: Record<Drink, number> = {
  coffee: 5,
  warmMilk: 6, // sold from the shelf only
  espresso: 8,
  auLait: 10,
  latte: 12,
};

export const JUST_IN_TIME_BONUS: Record<Drink, number> = {
  coffee: 3,
  warmMilk: 0,
  espresso: 4,
  auLait: 5,
  latte: 6,
};

/** Gears the clockmaker pays per cup, and on his exact tick (proposed). */
export const GEARS_PER_CUP = 1;
export const GEARS_JUST_IN_TIME = 2;

export const SHELF_SIZE = 3;
/** A shelf cup spills once it has sat this many ticks (proposed). */
export const SHELF_STALE_TICKS = 6;
/** Chance per tick that a walk-in buys the oldest shelf cup (proposed). */
export const WALK_IN_CHANCE = 1 / 6;
/** Walk-ins pay this share of the price, rounded down. */
export const WALK_IN_PRICE_SHARE = 0.5;

/** Seed for the walk-in generator. */
export const WALK_IN_SEED = 12;

/** The cat's bowl: against the right-hand wall, in the back row you start with (proposed). */
export const BOWL_ROW = START_ROWS - 1;
export const BOWL_COL = 11;

/** Entries kept in the paste buffer history, newest first (proposed). */
export const BUFFER_HISTORY = 10;
