// Offline progress (docs/SPEC.md, Rules 6): being away earns loyalty, and the
// clockmaker's gears, and nothing else. Counts come from the layout's steady
// state, found by the simulator.

import { findCycle } from '../sim/steady';
import { LOOP } from '../sim/tuning';
import type { Shop } from './shop';
import { GEARS_JUST_IN_TIME, GEARS_PER_CUP, MAX_OFFLINE_LOOPS, MILK_PAIL_PRICE } from './tuning';

export interface MorningReport {
  loops: number;
  /** Per regular in the shop: loops they were served while you were away. */
  regulars: { id: string; name: string; served: number }[];
  gears: number; // the total, after this report
  gearsEarned: number;
}

/** Loops away: seconds away divided by 12, rounded down, capped. */
export function loopsAway(lastSeen: number, now: number): number {
  const seconds = Math.max(0, now - lastSeen) / 1000;
  return Math.min(MAX_OFFLINE_LOOPS, Math.floor(seconds / LOOP));
}

/** Apply time away to the shop's loyalty and gears. Null when less than a loop has passed. */
export function applyOffline(shop: Shop, lastSeen: number, now: number): MorningReport | null {
  const loops = loopsAway(lastSeen, now);
  if (loops < 1) return null;
  const seats = shop.seats();
  // The till does not move while away, so the door delivers the pails it could pay for when you left.
  const milkPails = Math.min(shop.milkOrder(), Math.floor(shop.till / MILK_PAIL_PRICE));
  const cycle = findCycle(shop.layout, { seats, milkPails });
  const report: MorningReport = { loops, regulars: [], gears: shop.gears, gearsEarned: 0 };
  shop.regulars.forEach((reg, i) => {
    const def = shop.defs[i];
    let served = 0;
    if (cycle) {
      served = Math.floor(loops * cycle.servesPerLoop[i]);
      if (def.paysIn === 'gears') {
        const perCycle = cycle.ticks
          .flatMap((t) => t.events)
          .reduce((n, e) => n + (e.type === 'serve' && e.seat === i ? (e.justInTime ? GEARS_JUST_IN_TIME : GEARS_PER_CUP) : 0), 0);
        report.gearsEarned += Math.floor((loops * perCycle) / cycle.loops);
      }
    }
    reg.loyalty += served;
    report.regulars.push({ id: def.id, name: def.name, served });
  });
  shop.gears += report.gearsEarned;
  report.gears = shop.gears;
  return report;
}
