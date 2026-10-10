// Core data model for the simulator. See docs/SPEC.md, "Spec 3: data model",
// as amended by docs/ADDENDUM-01.md, "Changes for the build".

export type Dir = 'N' | 'E' | 'S' | 'W';
export type Roast = 'light' | 'medium' | 'dark';
export type Drink = 'coffee' | 'espresso' | 'warmMilk' | 'auLait' | 'latte';

export type Item =
  | { kind: 'water' }
  | { kind: 'beans' }
  | { kind: 'espressoBeans'; roast: Roast }
  | { kind: 'milk' }
  | { kind: 'coffee'; roast: Roast }
  | { kind: 'espresso'; roast: Roast }
  | { kind: 'warmMilk' }
  | { kind: 'auLait'; roast: Roast }
  | { kind: 'latte'; roast: Roast };

export type Structure =
  | { kind: 'belt'; dir: Dir }
  | { kind: 'launch'; dir: Dir } // chute: its item lands on the tile two along
  | { kind: 'catch'; dir: Dir } // the other end; carries on like a belt
  | { kind: 'well' }
  | { kind: 'plot'; out: Dir }
  | { kind: 'roaster'; out: Dir }
  | { kind: 'kettle'; out: Dir }
  | { kind: 'mixer'; out: Dir }
  | { kind: 'bowl' } // the cat's bowl: pre-placed, cannot be removed
  | { kind: 'door' } // the side door: column 11 only, faces left, at most one
  | { kind: 'feeder' } // column 0 only, pre-placed in every row, flows toward the counter, cannot be removed
  | { kind: 'spring'; dir: Dir } // an item crosses it in SPRING_TICKS ticks instead of 1
  | { kind: 'splitter' }; // hands each item to the next of its outputs, clockwise from the top

export type StructureKind = Structure['kind'];

/**
 * Back room only, row-major. Row 0 is the row next to the counter, so buying
 * rows never renumbers tiles. The counter row is implicit and always present:
 * counter tile `col` has index `rows * 12 + col`.
 */
export interface Layout {
  cols: 12;
  rows: number;
  tiles: (Structure | null)[];
}

/** A regular at their stool, or the cat at its bowl. */
export interface Seat {
  col: number; // counter column the stool faces
  drink: Drink;
  roast: Roast | 'any';
  tick: number | 'any'; // 'any' = takes the first matching cup, then nothing for ANY_TICK_WAIT ticks
  grace: number; // ticks they stay after their own tick, 0 to 3
  fussy?: boolean; // refuses their cup if anything was on their tile the tick before
  bowl?: number; // the cat only: back-room tile of its bowl, used instead of col
}

export interface SimState {
  T: number; // ticks since start
  belts: (Item | null)[]; // back room tiles, then the 12 counter tiles
  plots: Record<number, { harvestAt: number } | null>; // by tile index; null = idle
  pending: Record<number, { item: Item; readyAt: number } | null>; // kettle and mixer output
  roasting: Record<number, { since: number } | null>; // roaster batches: the tick the beans landed
  servedThisVisit: boolean[]; // per seat: set when they take a cup, cleared when they leave
  blocked: boolean[]; // per seat: a fussy regular saw a busy tile, or the cat bolted; cleared when they leave
  lastServedAt: (number | null)[]; // per seat: T of their last cup; drives the any-tick wait
  springs: Record<number, (Item | null)[]>; // by tile index: the items inside, one place per tick of delay
  splitters: Record<number, number>; // by tile index: items passed since tick 0; picks the next output
}

export type SimEvent =
  | { type: 'spill'; at: number; item: Item }
  | { type: 'water'; at: number } // a bucket started a plot growing
  | { type: 'harvest'; at: number }
  | { type: 'brew'; at: number; item: Item; tick: number } // a kettle took an input on clock tick `tick`; `item` is what it will put out
  | { type: 'roast'; at: number } // a roaster took a batch of beans
  | { type: 'release'; at: number; item: Item } // a roaster put out its batch
  | { type: 'mix'; at: number; item: Item } // a mixer paired two ingredients
  | { type: 'milk'; at: number } // a pail was delivered; the game layer charges for it
  | { type: 'serve'; seat: number; at: number; item: Item; justInTime: boolean }
  | { type: 'refuse'; seat: number; at: number; item: Item } // a fussy regular turned down the right cup
  | { type: 'bolt'; seat: number; at: number } // plain milk scared the cat off the bowl
  | { type: 'end'; item: Item }; // a drink ran off the end of the counter untaken; the game counts it as a spill

/** A regular's definition. Lives here so that `src/levels/` can import it as a type. */
export interface RegularDef {
  id: string;
  name: string;
  intro: string; // one line shown when they walk in
  col: number; // counter column where their stool appears
  order: {
    drink: Drink;
    roast: Roast | 'any';
    tick: number | 'any'; // 'any' for the first two regulars
    grace: 0 | 1 | 2 | 3; // ticks they stay after their own tick
    fussy?: boolean;
  };
  bowl?: boolean; // the cat: served at its bowl in the back room, not at a stool
  unlocks?: StructureKind[]; // pieces added to the palette when they walk in
  wellLimit?: number; // raises the number of wells you may own
  paysIn?: 'coins' | 'gears' | 'nothing'; // coins unless stated
}

export interface StepOpts {
  seats: Seat[];
  /** Pails the side door delivers this loop, one a tick from MILK_TICK; the game layer works it out. */
  milkPails: number;
}
