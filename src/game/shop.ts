// The live shop: the layout, the simulator state and the till, advanced one
// tick at a time. All rules about what happens on the floor are in src/sim/;
// this layer only reads the simulator's events.

import { adaptState, emptyLayout, emptyState, step, tileIndex } from '../sim';
import type { Layout, RegularDef, Seat, SimEvent, SimState } from '../sim/types';
import { COLS, LOOP } from '../sim/tuning';
import { type BuildPlan, type BuildRights, type TileChange, planBuild, rightsAfter } from './build';
import { BOWL_COL, BOWL_ROW, DEBUG_COINS, FLOOR_ROW_PRICE, START_COINS, START_ROWS } from './tuning';

export interface ShopOptions {
  defs: readonly RegularDef[];
  debug?: boolean;
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
  /** Spills counted on the current loop and on the last full loop. */
  spillsThisLoop = 0;
  spillsLastLoop = 0;
  /** Events of the most recent tick, for the renderer. */
  lastEvents: SimEvent[] = [];

  constructor(opts: ShopOptions) {
    this.defs = opts.defs;
    this.debug = !!opts.debug;
    this.layout = emptyLayout(START_ROWS);
    this.layout.tiles[tileIndex(BOWL_ROW, BOWL_COL)] = { kind: 'bowl' };
    this.till = this.debug ? DEBUG_COINS : START_COINS;
    this.sim = emptyState(this.layout, 0);
  }

  get T(): number {
    return this.sim.T;
  }

  rights(): BuildRights {
    return rightsAfter(this.defs, 0, this.debug);
  }

  seats(): Seat[] {
    return [];
  }

  tick(): TickReport {
    if (this.sim.T % LOOP === 0) {
      this.spillsLastLoop = this.spillsThisLoop;
      this.spillsThisLoop = 0;
    }
    const T = this.sim.T;
    const { next, events } = step(this.layout, this.sim, { seats: this.seats(), canPayMilk: true });
    this.sim = next;
    this.lastEvents = events;
    this.spillsThisLoop += events.filter((e) => e.type === 'spill').length;
    return { T, events, notes: [] };
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
    this.sim = adaptState(this.layout, next, this.sim, this.seats().length);
    this.layout = next;
  }
}
