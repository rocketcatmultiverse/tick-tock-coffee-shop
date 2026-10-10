// The live shop: the layout, the simulator state, the till, the regulars, the
// shelf and walk-ins, advanced one tick at a time. All rules about what happens
// on the floor are in src/sim/; this layer only reads the simulator's events.

import { adaptState, emptyLayout, emptyState, isDrink, itemName, step, tileIndex, visitLength, visitOffset } from '../sim';
import type { Drink, Item, Layout, RegularDef, Seat, SimEvent, SimState } from '../sim/types';
import { COLS, LOOP } from '../sim/tuning';
import { type BuildPlan, type BuildRights, type TileChange, planBuild, rightsAfter } from './build';
import { PIECE_LABEL } from './pieces';
import { type RegularState, seatFor } from './regulars';
import { type Rng, makeRng, nextRandom } from './rng';
import {
  BOWL_COL,
  BOWL_ROW,
  DEBUG_COINS,
  DRINK_PRICE,
  FLOOR_ROW_PRICE,
  GEARS_JUST_IN_TIME,
  GEARS_PER_CUP,
  JUST_IN_TIME_BONUS,
  MILK_PAIL_PRICE,
  SHELF_SIZE,
  SHELF_STALE_TICKS,
  START_COINS,
  START_ROWS,
  WALK_IN_CHANCE,
  WALK_IN_PRICE_SHARE,
  WALK_IN_SEED,
} from './tuning';

export interface ShopOptions {
  defs: readonly RegularDef[];
  debug?: boolean;
  seed?: number;
}

export interface ShelfCup {
  item: Item;
  /** Ticks on the shelf, counting the tick it arrived. */
  age: number;
}

export interface TickReport {
  T: number;
  events: SimEvent[];
  notes: string[];
}

export class Shop {
  readonly defs: readonly RegularDef[];
  readonly debug: boolean;
  layout: Layout;
  sim: SimState;
  till: number;
  gears = 0;
  /** Chosen by the player; empty until then. */
  catName = '';
  /** Regulars who have walked in, in order. The last one may still be new. */
  regulars: RegularState[] = [];
  shelf: ShelfCup[] = [];
  rng: Rng;
  /** Spills counted on the current loop and on the last full loop. */
  spillsThisLoop = 0;
  spillsLastLoop = 0;
  /** Events of the most recent tick, for the renderer. */
  lastEvents: SimEvent[] = [];
  /** Per walked-in regular: took a cup during their current visit. */
  private visitServed: boolean[] = [];

  constructor(opts: ShopOptions) {
    this.defs = opts.defs;
    this.debug = !!opts.debug;
    this.layout = emptyLayout(START_ROWS);
    this.layout.tiles[tileIndex(BOWL_ROW, BOWL_COL)] = { kind: 'bowl' };
    this.till = this.debug ? DEBUG_COINS : START_COINS;
    this.rng = makeRng(opts.seed ?? WALK_IN_SEED);
    this.sim = emptyState(this.layout, 0);
    if (this.defs.length > 0) this.walkIn();
  }

  /** Put back a saved shop: layout, books and regulars. The floor starts empty, on tick 0. */
  restore(saved: { layout: Layout; till: number; gears: number; catName: string; regulars: RegularState[] }): void {
    this.layout = saved.layout;
    this.till = saved.till;
    this.gears = saved.gears;
    this.catName = saved.catName;
    this.regulars = saved.regulars.map((r) => ({ ...r }));
    this.visitServed = this.regulars.map(() => false);
    this.shelf = [];
    this.sim = emptyState(this.layout, this.regulars.length);
  }

  get T(): number {
    return this.sim.T;
  }

  rights(): BuildRights {
    return rightsAfter(this.defs, this.regulars.length, this.debug);
  }

  /** Seats for every regular who has walked in, in order. The cat's seat is its bowl. */
  seats(): Seat[] {
    return this.regulars.map((_, i) => seatFor(this.defs[i]));
  }

  /** The newest regular, while they wait for their first cup. */
  newcomer(): RegularDef | null {
    const last = this.regulars[this.regulars.length - 1];
    return last && last.status === 'new' ? this.defs[this.regulars.length - 1] : null;
  }

  tick(): TickReport {
    const T = this.sim.T;
    if (T % LOOP === 0) {
      this.spillsLastLoop = this.spillsThisLoop;
      this.spillsThisLoop = 0;
    }
    const notes: string[] = [];
    const seats = this.seats();
    seats.forEach((seat, i) => {
      if (visitOffset(seat, T) === 0) this.visitServed[i] = false;
    });

    const canPayMilk = Math.floor(this.till / MILK_PAIL_PRICE);
    const { next, events } = step(this.layout, this.sim, { seats, canPayMilk });
    this.sim = next;

    let spills = 0;
    let newcomerSeated = false;
    for (const e of events) {
      switch (e.type) {
        case 'spill':
          spills++;
          break;
        case 'milk':
          this.till -= MILK_PAIL_PRICE;
          break;
        case 'serve': {
          const reg = this.regulars[e.seat];
          const def = this.defs[e.seat];
          this.visitServed[e.seat] = true;
          reg.loyalty++;
          if (reg.status === 'new' && e.seat === this.regulars.length - 1) newcomerSeated = true;
          notes.push(this.pay(def, e.item, e.justInTime));
          if (reg.status !== 'seated') notes.push(`${def.name} is seated.`);
          reg.status = 'seated';
          break;
        }
        case 'end':
          if (this.shelf.length < SHELF_SIZE) this.shelf.push({ item: e.item, age: 0 });
          else spills++;
          break;
        default:
          break;
      }
    }

    // Shelf cups age; stale ones spill. Then a walk-in may buy the oldest.
    for (const cup of this.shelf) cup.age++;
    const fresh = this.shelf.filter((c) => c.age <= SHELF_STALE_TICKS);
    spills += this.shelf.length - fresh.length;
    this.shelf = fresh;
    const roll = nextRandom(this.rng);
    if (roll < WALK_IN_CHANCE && this.shelf.length > 0) {
      const cup = this.shelf.shift()!;
      const paid = this.walkInPrice(cup.item);
      this.till += paid;
      notes.push(`A walk-in buys a ${itemName(cup.item)} off the shelf for ${paid}.`);
    }

    // Seated regulars whose visit ends without a cup go to waiting.
    seats.forEach((seat, i) => {
      if (visitOffset(seat, T) !== visitLength(seat)) return;
      const reg = this.regulars[i];
      if (reg.status === 'seated' && !this.visitServed[i]) {
        reg.status = 'waiting';
        notes.push(`${this.defs[i].name} is waiting.`);
      }
    });

    if (newcomerSeated && this.regulars.length < this.defs.length) notes.push(this.walkIn());

    this.spillsThisLoop += spills;
    this.lastEvents = events;
    return { T, events, notes };
  }

  private pay(def: RegularDef, item: Item, justInTime: boolean): string {
    const what = itemName(item);
    const jit = justInTime ? ' Just in Time!' : '';
    if (def.paysIn === 'gears') {
      const n = justInTime ? GEARS_JUST_IN_TIME : GEARS_PER_CUP;
      this.gears += n;
      return `${def.name} takes a ${what} and leaves ${n} gear${n === 1 ? '' : 's'}.${jit}`;
    }
    if (def.paysIn === 'nothing') return `${def.name} takes a ${what}.`;
    const drink = item.kind as Drink;
    const coins = DRINK_PRICE[drink] + (justInTime ? JUST_IN_TIME_BONUS[drink] : 0);
    this.till += coins;
    return `${def.name} takes a ${what} for ${coins}.${jit}`;
  }

  private walkInPrice(item: Item): number {
    if (!isDrink(item)) return 0;
    return Math.floor(DRINK_PRICE[item.kind] * WALK_IN_PRICE_SHARE);
  }

  /** The next regular walks in with their stool, and anything they unlock. */
  private walkIn(): string {
    const before = this.rights();
    const def = this.defs[this.regulars.length];
    this.regulars.push({ id: def.id, status: 'new', loyalty: 0 });
    this.visitServed.push(false);
    this.sim = adaptState(this.layout, this.layout, this.sim, this.regulars.length);
    const after = this.rights();
    const extra: string[] = [];
    const fresh = [...after.unlocked].filter((p) => !before.unlocked.has(p));
    if (fresh.length) extra.push(`New in the palette: ${fresh.map((p) => PIECE_LABEL[p]).join(', ')}.`);
    if (after.wellLimit > before.wellLimit) extra.push(`You may now own ${after.wellLimit} wells.`);
    const arrives = def.bowl ? `${def.name} starts asking for warm milk at the bowl` : `${def.name} walks in`;
    return [`${arrives}: "${def.intro}"`, ...extra].join(' ');
  }

  /** Check an edit; if it is allowed, apply it to the live floor and pay for it. */
  build(changes: readonly TileChange[]): BuildPlan {
    const plan = planBuild(this.layout, changes, this.rights(), this.till);
    if (!plan.ok) return plan;
    this.till -= plan.cost;
    this.setLayout(plan.layout);
    return plan;
  }

  /** Buy one more back-room row, at the far end so nothing is renumbered. */
  buyRow(): string | null {
    if (this.till < FLOOR_ROW_PRICE) return `A floor row costs ${FLOOR_ROW_PRICE}`;
    this.till -= FLOOR_ROW_PRICE;
    const tiles = this.layout.tiles.concat(new Array(COLS).fill(null));
    this.setLayout({ cols: 12, rows: this.layout.rows + 1, tiles });
    return null;
  }

  private setLayout(next: Layout): void {
    this.sim = adaptState(this.layout, next, this.sim, this.regulars.length);
    this.layout = next;
  }
}
