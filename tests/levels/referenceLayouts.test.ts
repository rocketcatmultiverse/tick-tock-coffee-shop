// Reference layouts (Spec 6, whole-system tests): for each regular, the saved
// solution serves that regular every loop; one more layout serves all four.

import { describe, expect, it } from 'vitest';
import { REFERENCE_LAYOUTS } from '../../src/levels/layouts';
import { REGULARS } from '../../src/levels/regulars';
import { seatFor } from '../../src/game/regulars';
import { BOWL_COL, BOWL_ROW, START_ROWS } from '../../src/game/tuning';
import { findCycle } from '../../src/sim/steady';
import { emptyState } from '../../src/sim/state';
import { parseLayout, renderFloor } from '../../src/sim/text';
import { tileIndex } from '../../src/sim/grid';

describe('Reference layouts', () => {
  for (const ref of REFERENCE_LAYOUTS) {
    it(`${ref.id}: serves ${ref.serves.join(', ')} every loop`, () => {
      const layout = parseLayout(ref.rows);
      const floor = renderFloor(layout, emptyState(layout));
      // They fit the starting floor, with the bowl where the shop puts it.
      expect(layout.rows, floor).toBe(START_ROWS);
      expect(layout.tiles[tileIndex(BOWL_ROW, BOWL_COL)], floor).toEqual({ kind: 'bowl' });
      expect(layout.tiles.filter((s) => s?.kind === 'well').length, floor).toBe(1);

      // Every regular up to the last one served is at the counter, as in play.
      const last = Math.max(...ref.serves.map((id) => REGULARS.findIndex((d) => d.id === id)));
      const defs = REGULARS.slice(0, last + 1);
      const seats = defs.map(seatFor);
      const cycle = findCycle(layout, { seats, canPayMilk: true });
      expect(cycle, floor).not.toBeNull();
      for (const id of ref.serves) {
        const i = defs.findIndex((d) => d.id === id);
        expect(cycle!.servesPerLoop[i], `${id}\n${floor}`).toBe(1);
        // A regular with a tick is served Just in Time in the reference layout.
        if (defs[i].order.tick !== 'any') {
          const serves = cycle!.ticks.flatMap((t) => t.events).filter((e) => e.type === 'serve' && e.seat === i);
          expect(serves.every((e) => e.type === 'serve' && e.justInTime), `${id}\n${floor}`).toBe(true);
        }
      }
      // The cycle settles quickly and repeats every loop.
      expect(cycle!.loops, floor).toBe(1);
      expect(cycle!.start, floor).toBeLessThanOrEqual(36);
    });
  }

  it('the all-four layout spills nothing but the well buckets it has no use for', () => {
    const ref = REFERENCE_LAYOUTS.find((r) => r.id === 'all-four')!;
    const layout = parseLayout(ref.rows);
    const cycle = findCycle(layout, { seats: REGULARS.map(seatFor), canPayMilk: true })!;
    const events = cycle.ticks.flatMap((t) => t.events);
    expect(events.filter((e) => e.type === 'spill'), renderFloor(layout, cycle.ticks[0].after)).toEqual([]);
    expect(events.filter((e) => e.type === 'end')).toEqual([]);
  });
});
