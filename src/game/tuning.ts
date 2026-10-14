// Every provisional number the game layer uses (docs/SPEC.md, Rules 4 to 6).

import type { Drink } from '../sim/types';
import type { PieceKind } from './pieces';

export const START_COINS = 80;

/**
 * Full loops in a row with their cup before a regular is happy. The next
 * regular walks in only when everyone already in is happy (docs/QUESTIONS.md, Q62).
 */
export const HAPPY_LOOPS = 3;

/**
 * Loops in a row that fill a workbench tray's order before the puzzle is
 * solved, once the headless simulator agrees (proposed, docs/QUESTIONS.md, Q77).
 */
export const BENCH_SOLVE_LOOPS = 2;

/** An any-tick regular counts as waiting once this many ticks pass without a cup (proposed). */
export const ANY_TICK_WAITING = 24;
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
  spring: 8, // proposed, docs/ADDENDUM-01.md
  splitter: 15, // proposed, docs/ADDENDUM-01.md
};

export const FLOOR_ROW_PRICE = 50;
/**
 * Floor rows are for sale once this many regulars have been happy, so a new
 * shop cannot spend its first coins on floor it does not need yet (proposed,
 * docs/QUESTIONS.md).
 */
export const ROWS_FOR_SALE_AFTER_HAPPY = 1;
export const MILK_PAIL_PRICE = 2;

/** Warm milk has no price: only the cat drinks it, and the cat pays nothing. */
export const DRINK_PRICE: Record<Exclude<Drink, 'warmMilk'>, number> = {
  coffee: 5,
  espresso: 8,
  auLait: 10,
  latte: 12,
};

export const JUST_IN_TIME_BONUS: Record<Exclude<Drink, 'warmMilk'>, number> = {
  coffee: 3,
  espresso: 4,
  auLait: 5,
  latte: 6,
};

/** Gears the clockmaker pays per cup, and on his exact tick (proposed). */
export const GEARS_PER_CUP = 1;
export const GEARS_JUST_IN_TIME = 2;

/** The cat's bowl: pre-placed at row 3, column 9, next to the milk (docs/ADDENDUM-01.md). */
export const BOWL_ROW = 3;
export const BOWL_COL = 9;

/**
 * A new shop's first well, already on the floor where the lamplighter's line
 * wants it. It is an ordinary well, free to move or delete (docs/QUESTIONS.md, Q79).
 */
export const START_WELL_ROW = 1;
export const START_WELL_COL = 3;

/** Save slots on the title screen, each holding one shop. */
export const SAVE_SLOTS = 3;

/** Entries kept in the paste buffer history, newest first (proposed). */
export const BUFFER_HISTORY = 10;

/** Offline progress stops counting after 3 real days: 3 * 86,400 s / 12 s a loop. */
export const MAX_OFFLINE_LOOPS = 21600;
