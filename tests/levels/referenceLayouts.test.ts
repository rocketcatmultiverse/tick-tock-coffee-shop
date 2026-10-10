// Reference layouts (Spec 6, whole-system tests): for each regular, the saved
// solution serves that regular every loop; one more serves all twelve at once.

import { describe, expect, it } from 'vitest';
import { REFERENCE_LAYOUTS } from '../../src/levels/layouts';
import { REGULARS } from '../../src/levels/regulars';
import { seatFor } from '../../src/game/regulars';
import { planBuild, rightsAfter } from '../../src/game/build';
import { BOWL_COL, BOWL_ROW, START_ROWS } from '../../src/game/tuning';
import { findCycle } from '../../src/sim/steady';
import { emptyState } from '../../src/sim/state';
import { parseLayout, renderFloor } from '../../src/sim/text';
import { emptyLayout, tileIndex } from '../../src/sim/grid';

describe('Reference layouts', () => {
  it('there is one per regular and one serving all twelve', () => {
    for (const def of REGULARS) expect(REFERENCE_LAYOUTS.some((r) => r.id === def.id), def.id).toBe(true);
    expect(REFERENCE_LAYOUTS.find((r) => r.id === 'all-twelve')?.serves.length).toBe(12);
  });

  for (const ref of REFERENCE_LAYOUTS) {
    it(`${ref.id}: serves ${ref.serves.join(', ')} every loop`, () => {
      const layout = parseLayout(ref.rows);
      const floor = renderFloor(layout, emptyState(layout));
      // It fits the starting floor plus the rows it says it buys, with the bowl where the shop puts it.
      expect(layout.rows, floor).toBe(START_ROWS + ref.boughtRows);
      expect(layout.tiles[tileIndex(BOWL_ROW, BOWL_COL)], floor).toEqual({ kind: 'bowl' });

      // Every regular up to the last one served is in the shop, as in play.
      const last = Math.max(...ref.serves.map((id) => REGULARS.findIndex((d) => d.id === id)));
      const defs = REGULARS.slice(0, last + 1);

      // It can be built with the pieces and wells unlocked by then.
      const blank = emptyLayout(layout.rows);
      blank.tiles[tileIndex(BOWL_ROW, BOWL_COL)] = { kind: 'bowl' };
      const changes = layout.tiles.flatMap((to, index) => (to && to.kind !== 'bowl' ? [{ index, to }] : []));
      const plan = planBuild(blank, changes, rightsAfter(REGULARS, defs.length), Infinity);
      expect(plan.ok ? 'ok' : plan.reason, floor).toBe('ok');

      const seats = defs.map(seatFor);
      const cycle = findCycle(layout, { seats, canPayMilk: true });
      expect(cycle, floor).not.toBeNull();
      for (const id of ref.serves) {
        const i = defs.findIndex((d) => d.id === id);
        expect(cycle!.servesPerLoop[i], `${id}\n${floor}`).toBe(1);
      }
      for (const id of ref.justInTime) {
        const i = defs.findIndex((d) => d.id === id);
        const serves = cycle!.ticks.flatMap((t) => t.events).filter((e) => e.type === 'serve' && e.seat === i);
        expect(serves.length > 0 && serves.every((e) => e.type === 'serve' && e.justInTime), `${id}\n${floor}`).toBe(true);
      }
      // The cycle settles quickly and repeats every loop.
      expect(cycle!.loops, floor).toBe(1);
      expect(cycle!.start, floor).toBeLessThanOrEqual(12 * (ref.settlesWithin ?? 3));
    });
  }

  it('the all-four layout spills nothing but the well buckets it has no use for', () => {
    const ref = REFERENCE_LAYOUTS.find((r) => r.id === 'all-four')!;
    const layout = parseLayout(ref.rows);
    const cycle = findCycle(layout, { seats: REGULARS.slice(0, 4).map(seatFor), canPayMilk: true })!;
    const events = cycle.ticks.flatMap((t) => t.events);
    expect(events.filter((e) => e.type === 'spill'), renderFloor(layout, cycle.ticks[0].after)).toEqual([]);
    expect(events.filter((e) => e.type === 'end')).toEqual([]);
  });

  it('the all-twelve layout sends nothing to the shelf', () => {
    const ref = REFERENCE_LAYOUTS.find((r) => r.id === 'all-twelve')!;
    const layout = parseLayout(ref.rows);
    const cycle = findCycle(layout, { seats: REGULARS.map(seatFor), canPayMilk: true })!;
    const events = cycle.ticks.flatMap((t) => t.events);
    expect(events.filter((e) => e.type === 'end'), renderFloor(layout, cycle.ticks[0].after)).toEqual([]);
    expect(events.filter((e) => e.type === 'serve').length).toBe(12);
  });
});
