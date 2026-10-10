// Every provisional number the simulator uses. See docs/SPEC.md, Rules 1 to 5.

/** Ticks in one loop of the clock. */
export const LOOP = 12;
/** The shop is 12 tiles wide. */
export const COLS = 12;

/** Plot growth time, `G`. */
export const GROWTH = 4;

/** The well pulses on this clock tick. */
export const WELL_TICK = 0;
/** The back door delivers on this clock tick. */
export const DOOR_TICK = 7;
/** The roaster releases on this clock tick (proposed). */
export const ROASTER_TICK = 6;

/** Kettle: the clock tick the beans land on picks the roast. Upper bounds, inclusive. */
export const KETTLE_LIGHT_MAX_TICK = 3;
export const KETTLE_MEDIUM_MAX_TICK = 7;

/** Roaster: ticks spent inside before release pick the roast (proposed). Upper bounds, inclusive. */
export const ROASTER_LIGHT_MAX_TIME = 4;
export const ROASTER_MEDIUM_MAX_TIME = 8;

/** Kettles and mixers put out this many ticks after their input lands. */
export const BREW_TIME = 1;
export const MIX_TIME = 1;
