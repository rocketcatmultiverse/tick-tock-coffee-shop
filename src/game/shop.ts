// The live shop: the layout, the simulator state, the till, the regulars and
// the milk order, advanced one tick at a time. All rules about what happens
// on the floor are in src/sim/; this layer only reads the simulator's events.

import { adaptState, emptyState, itemName, step, visitLength, visitOffset } from '../sim';
import type { Drink, Item, Layout, RegularDef, Seat, SimEvent, SimState } from '../sim/types';
import { COLS, LOOP, MILK_TICK } from '../sim/tuning';
import { type BuildPlan, type BuildRights, type TileChange, brokenChute, floorValue, planBuild, rightsAfter, startLayout, tileValue } from './build';
import { PIECE_LABEL, isFixed } from './pieces';
import { type RegularState, isMilkDrinker, seatFor } from './regulars';
import {
  ANY_TICK_WAITING,
  DEBUG_COINS,
  DRINK_PRICE,
  FLOOR_ROW_PRICE,
  GEARS_JUST_IN_TIME,
  GEARS_PER_CUP,
  HAPPY_LOOPS,
  JUST_IN_TIME_BONUS,
  MILK_PAIL_PRICE,
  ROWS_FOR_SALE_AFTER_HAPPY,
  START_COINS,
  START_ROWS,
} from './tuning';

export interface ShopOptions {
  defs: readonly RegularDef[];
  debug?: boolean;
  /** Opened from someone's share link: it plays, and it is never saved. */
  visiting?: boolean;
}

/** Rows taken back from a save that bought them too early, and what was refunded. */
export interface RowRefund {
  rows: number;
  /** Pieces that stood on those rows, or were a chute with one end there. */
  pieces: number;
  coins: number;
}

export interface TickReport {
  T: number;
  events: SimEvent[];
  notes: string[];
}

export class Shop {
  readonly defs: readonly RegularDef[];
  readonly debug: boolean;
  /** Someone else's shop, opened from a share link. Never saved. */
  readonly visiting: boolean;
  layout: Layout;
  sim: SimState;
  till: number;
  gears = 0;
  /** Chosen by the player; empty until then. */
  catName = '';
  /** The name a share link gives the shop; chosen by the player, empty until then. */
  shopName = '';
  /** The tour has been offered, and taken or skipped. Older saves have not had it offered. */
  tutorialSeen = false;
  /** Regulars who have walked in, in order. The last one may still be new. */
  regulars: RegularState[] = [];
  /** Spills counted on the current loop and on the last full loop. */
  spillsThisLoop = 0;
  spillsLastLoop = 0;
  /** Events of the most recent tick, for the renderer. */
  lastEvents: SimEvent[] = [];
  /** Per walked-in regular: took a cup during their current visit. */
  private visitServed: boolean[] = [];
  /** Per walked-in regular: full loops in a row with a cup, as of the last loop's end. */
  private streak: number[] = [];
  /** Per walked-in regular: took a cup during the current loop. */
  private servedThisLoop: boolean[] = [];
  /** The till could not cover a pail this loop, so the rest of the order does not come. */
  private milkStopped = false;

  constructor(opts: ShopOptions) {
    this.defs = opts.defs;
    this.debug = !!opts.debug;
    this.visiting = !!opts.visiting;
    this.layout = startLayout(START_ROWS);
    this.till = this.debug ? DEBUG_COINS : START_COINS;
    this.sim = emptyState(this.layout, 0);
    if (this.defs.length > 0) this.walkIn();
  }

  /** Put back a saved shop: layout, books and regulars. The floor starts empty, on tick 0. */
  restore(saved: {
    layout: Layout;
    till: number;
    gears: number;
    catName: string;
    shopName?: string;
    tutorialSeen?: boolean;
    regulars: RegularState[];
  }): void {
    this.layout = saved.layout;
    this.till = saved.till;
    this.gears = saved.gears;
    this.catName = saved.catName;
    this.shopName = saved.shopName ?? '';
    this.tutorialSeen = saved.tutorialSeen ?? false;
    this.regulars = saved.regulars.map((r) => ({ ...r }));
    this.visitServed = this.regulars.map(() => false);
    // Happiness is not saved: after a load everyone earns it again (docs/QUESTIONS.md, Q62).
    this.streak = this.regulars.map(() => 0);
    this.servedThisLoop = this.regulars.map(() => false);
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

  /** The newest regular, until they are happy: the one the panel introduces. */
  newcomer(): RegularDef | null {
    const i = this.regulars.length - 1;
    return i >= 0 && !this.isHappy(i) ? this.defs[i] : null;
  }

  /** Full loops in a row regular `i` has had their cup, up to HAPPY_LOOPS. */
  happiness(i: number): number {
    return Math.min(HAPPY_LOOPS, this.streak[i] ?? 0);
  }

  isHappy(i: number): boolean {
    return (this.streak[i] ?? 0) >= HAPPY_LOOPS;
  }

  /**
   * Regulars who have been happy at some point. Happiness is not saved, but
   * each regular walks in only once everyone before them is happy, so all
   * but the newest have been; the newest counts once they are happy now.
   */
  beenHappy(): number {
    const n = this.regulars.length;
    return n === 0 ? 0 : n - 1 + (this.isHappy(n - 1) ? 1 : 0);
  }

  /** Why no floor row is for sale yet, or null if one is. Debug shops may always buy. */
  rowsLocked(): string | null {
    const need = Math.min(ROWS_FOR_SALE_AFTER_HAPPY, this.defs.length);
    if (this.debug || this.beenHappy() >= need) return null;
    const who = this.defs[need - 1].name;
    return `Floor rows are for sale once ${who[0].toLowerCase()}${who.slice(1)} is happy`;
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

    const { next, events } = step(this.layout, this.sim, { seats, milkPails: this.milkPails(T) });
    this.sim = next;

    let spills = 0;
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
          this.servedThisLoop[e.seat] = true;
          reg.loyalty++;
          notes.push(this.pay(def, e.item, e.justInTime));
          if (reg.status !== 'seated') notes.push(`${def.name} is seated.`);
          reg.status = 'seated';
          break;
        }
        case 'end':
          spills++; // no shelf: a cup nobody takes spills at the end of the counter
          break;
        default:
          break;
      }
    }

    // Seated regulars whose visit ends without a cup go to waiting. Any-tick
    // regulars are always there: they wait once ANY_TICK_WAITING ticks pass without a cup.
    seats.forEach((seat, i) => {
      const reg = this.regulars[i];
      if (reg.status !== 'seated') return;
      const last = this.sim.lastServedAt[i];
      const waiting =
        seat.tick === 'any'
          ? last !== null && T - last >= ANY_TICK_WAITING
          : visitOffset(seat, T) === visitLength(seat) && !this.visitServed[i];
      if (waiting) {
        reg.status = 'waiting';
        notes.push(`${this.defs[i].name} is waiting.`);
      }
    });

    // At each loop's end, count who had their cup; the next regular walks in only when everyone is happy.
    if (T % LOOP === LOOP - 1) {
      this.regulars.forEach((_, i) => {
        const wasHappy = this.isHappy(i);
        this.streak[i] = this.servedThisLoop[i] ? this.streak[i] + 1 : 0;
        this.servedThisLoop[i] = false;
        if (this.isHappy(i) && !wasHappy) notes.push(`${this.defs[i].name} is happy.`);
      });
      if (this.regulars.length < this.defs.length && this.regulars.every((_, i) => this.isHappy(i))) notes.push(this.walkIn());
    }

    this.spillsThisLoop += spills;
    this.lastEvents = events;
    return { T, events, notes };
  }

  /** Pails in the standing milk order: one per milk drinker who has walked in. */
  milkOrder(): number {
    return this.regulars.filter((_, i) => isMilkDrinker(this.defs[i])).length;
  }

  /**
   * Pails the side door may deliver this loop, as seen on tick T. Each pail is
   * paid on delivery; if the till cannot cover one, that pail and the rest of
   * the loop's order do not come (docs/ADDENDUM-01.md).
   */
  private milkPails(T: number): number {
    const t = T % LOOP;
    if (t === 0) this.milkStopped = false;
    const order = this.milkOrder();
    const due = t - MILK_TICK; // which pail of the order is due now
    if (due < 0 || due >= order) return order;
    if (!this.milkStopped && this.till < MILK_PAIL_PRICE) this.milkStopped = true;
    return this.milkStopped ? due : due + 1;
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
    const drink = item.kind as Exclude<Drink, 'warmMilk'>;
    const coins = DRINK_PRICE[drink] + (justInTime ? JUST_IN_TIME_BONUS[drink] : 0);
    this.till += coins;
    return `${def.name} takes a ${what} for ${coins}.${jit}`;
  }

  /** The next regular walks in with their stool, and anything they unlock. */
  private walkIn(): string {
    const before = this.rights();
    const def = this.defs[this.regulars.length];
    this.regulars.push({ id: def.id, status: 'new', loyalty: 0 });
    this.visitServed.push(false);
    this.streak.push(0);
    this.servedThisLoop.push(false);
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
    const locked = this.rowsLocked();
    if (locked) return locked;
    if (this.till < FLOOR_ROW_PRICE) return `A floor row costs ${FLOOR_ROW_PRICE}`;
    this.till -= FLOOR_ROW_PRICE;
    // The new row comes with its own feeder tile, free.
    const tiles = this.layout.tiles.concat([{ kind: 'feeder' }, ...new Array(COLS - 1).fill(null)]);
    this.setLayout({ cols: 12, rows: this.layout.rows + 1, tiles });
    return null;
  }

  /**
   * A save from before rows waited for a happy regular may have spent its
   * first coins on floor and be left unable to build a first line. Its
   * bought rows are taken back with whatever stands on them, and all of it
   * refunded in full. Only for a shop just loaded: the floor starts empty.
   */
  refundEarlyRows(): RowRefund | null {
    const rows = this.layout.rows - START_ROWS;
    if (rows <= 0 || this.rowsLocked() === null) return null;
    const keep = START_ROWS * COLS;
    const gone = this.layout.tiles.slice(keep).filter((s) => s && !isFixed(s));
    // A catch is part of its launch's chute: the pair counts as one piece.
    let pieces = gone.filter((s) => s!.kind !== 'catch').length;
    let coins = rows * FLOOR_ROW_PRICE + gone.reduce((n, s) => n + tileValue(s), 0);
    const layout: Layout = { cols: 12, rows: START_ROWS, tiles: this.layout.tiles.slice(0, keep) };
    // A chute with its other end on a row taken back goes too.
    for (let i = brokenChute(layout); i !== null; i = brokenChute(layout)) {
      if (layout.tiles[i]!.kind === 'launch') pieces++;
      coins += tileValue(layout.tiles[i]);
      layout.tiles[i] = null;
    }
    this.layout = layout;
    this.till += coins;
    this.sim = emptyState(layout, this.regulars.length);
    return { rows, pieces, coins };
  }

  /**
   * A shop whose till and pieces together are worth less than a new shop's
   * till is topped up to it, so no save is left too poor to build. Rows
   * bought are not counted. Returns the coins added.
   */
  topUp(): number {
    const short = START_COINS - (this.till + floorValue(this.layout));
    if (short <= 0) return 0;
    this.till += short;
    return short;
  }

  private setLayout(next: Layout): void {
    this.sim = adaptState(this.layout, next, this.sim, this.regulars.length);
    this.layout = next;
  }
}
