// The counter strip (docs/SPEC.md, Spec 4): for each counter column, what the
// layout does there in steady state. Read from the events of one cycle found
// by the simulator's steady-state detection.

import { counterIndex, findCycle, slotOf } from '../sim';
import type { Item, Layout, RegularDef, Seat } from '../sim/types';
import { LOOP } from '../sim/tuning';
import { isMilkDrinker } from './regulars';

/** Timed regulars are served Just in Time or not at all; any-tick regulars are simply served. */
export type StoolResult = 'justInTime' | 'served' | 'miss';

export interface StripCell {
  col: number;
  /** Clock ticks on which something sits on this counter tile, in steady state. */
  cupTicks: number[];
  stool: {
    seat: number;
    def: RegularDef;
    result: StoolResult;
    /** The tick they want, or the tick they take their cup if they accept any. */
    tick: number | null;
    /** What is in front of them on that tick. */
    item: Item | null;
    /** The slot they want; for an any-tick regular, the slot they last took a cup from, if any. */
    slot: number | null;
  } | null;
}

export function counterStrip(layout: Layout, seats: Seat[], defs: readonly RegularDef[]): StripCell[] | null {
  // Steady state with the whole milk order paid for.
  const milkPails = defs.slice(0, seats.length).filter(isMilkDrinker).length;
  const cycle = findCycle(layout, { seats, milkPails });
  if (!cycle) return null;
  const cells: StripCell[] = [];
  for (let col = 0; col < 12; col++) {
    const at = counterIndex(layout, col);
    const ticks = new Set<number>();
    for (const tk of cycle.ticks) {
      const taken = tk.events.some((e) => e.type === 'serve' && e.at === at);
      if (tk.after.belts[at] || taken) ticks.add(tk.T % LOOP);
    }
    cells.push({ col, cupTicks: [...ticks].sort((a, b) => a - b), stool: null });
  }
  seats.forEach((seat, i) => {
    if (seat.bowl !== undefined) return;
    const serves = cycle.ticks.flatMap((tk) =>
      tk.events.flatMap((e) => (e.type === 'serve' && e.seat === i ? [{ T: tk.T, e }] : [])),
    );
    let result: StoolResult = 'miss';
    if (serves.length >= cycle.loops) result = serves.every((s) => s.e.justInTime) && seat.tick !== 'any' ? 'justInTime' : 'served';
    let tick: number | null = seat.tick === 'any' ? null : seat.tick;
    let item: Item | null = null;
    if (seat.tick === 'any') {
      if (serves[0]) {
        tick = serves[0].T % LOOP;
        item = serves[0].e.item;
      }
    } else {
      const own = cycle.ticks.find((tk) => tk.T % LOOP === seat.tick);
      const served = serves.find((s) => s.T % LOOP === seat.tick);
      item = served ? served.e.item : (own?.after.belts[counterIndex(layout, seat.col)] ?? null);
      if (!served && serves[0]) {
        tick = serves[0].T % LOOP;
        item = serves[0].e.item;
      }
    }
    const slot = seat.tick === 'any' ? (serves[0] ? slotOf(serves[0].T, seat.col) : null) : slotOf(seat.tick, seat.col);
    cells[seat.col].stool = { seat: i, def: defs[i], result, tick, item, slot };
  });
  return cells;
}
