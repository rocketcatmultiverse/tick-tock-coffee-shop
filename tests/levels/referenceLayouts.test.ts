// Reference layouts (Spec 6, whole-system tests, with docs/ADDENDUM-01.md):
// each saved solution serves the regulars it names every loop, in a shop
// where everyone up to the last of them has walked in.

import { describe, expect, it } from 'vitest';
import { REFERENCE_LAYOUTS, type ReferenceLayout } from '../../src/levels/layouts';
import { REGULARS } from '../../src/levels/regulars';
import { isMilkDrinker, seatFor } from '../../src/game/regulars';
import { planBuild, rightsAfter, startLayout } from '../../src/game/build';
import { BOWL_COL, BOWL_ROW, START_ROWS } from '../../src/game/tuning';
import { findCycle } from '../../src/sim/steady';
import { emptyState } from '../../src/sim/state';
import { parseLayout, renderFloor } from '../../src/sim/text';
import { tileIndex } from '../../src/sim/grid';

/** Everyone up to the last regular the layout serves, as in play, and the milk order they bring. */
function shopFor(ref: ReferenceLayout) {
  const last = Math.max(...ref.serves.map((id) => REGULARS.findIndex((d) => d.id === id)));
  const defs = REGULARS.slice(0, last + 1);
  return { defs, opts: { seats: defs.map(seatFor), milkPails: defs.filter(isMilkDrinker).length } };
}

function cycleOf(id: string) {
  const ref = REFERENCE_LAYOUTS.find((r) => r.id === id)!;
  const layout = parseLayout(ref.rows);
  const cycle = findCycle(layout, shopFor(ref).opts)!;
  return { layout, cycle, events: cycle.ticks.flatMap((t) => t.events), floor: renderFloor(layout, cycle.ticks[0].after) };
}

describe('Reference layouts', () => {
  it('there is one per regular and one serving all twelve', () => {
    for (const def of REGULARS) expect(REFERENCE_LAYOUTS.some((r) => r.id === def.id), def.id).toBe(true);
    expect(REFERENCE_LAYOUTS.find((r) => r.id === 'all-twelve')?.serves.length).toBe(12);
  });

  for (const ref of REFERENCE_LAYOUTS) {
    it(`${ref.id}: serves ${ref.serves.join(', ')} every loop`, () => {
      const layout = parseLayout(ref.rows);
      const floor = renderFloor(layout, emptyState(layout));
      // It fits the starting floor plus the rows it says it buys, with the feeder and the bowl where the shop puts them.
      expect(layout.rows, floor).toBe(START_ROWS + ref.boughtRows);
      expect(layout.tiles[tileIndex(BOWL_ROW, BOWL_COL)], floor).toEqual({ kind: 'bowl' });
      for (let r = 0; r < layout.rows; r++) expect(layout.tiles[tileIndex(r, 0)], floor).toEqual({ kind: 'feeder' });

      // It can be built on the shop's floor with the pieces and wells unlocked by then.
      const { defs, opts } = shopFor(ref);
      const changes = layout.tiles.flatMap((to, index) => (to && to.kind !== 'bowl' && to.kind !== 'feeder' ? [{ index, to }] : []));
      const plan = planBuild(startLayout(layout.rows), changes, rightsAfter(REGULARS, defs.length), Infinity);
      expect(plan.ok ? 'ok' : plan.reason, floor).toBe('ok');

      const cycle = findCycle(layout, opts);
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

  it('the all-four layout: four serves a loop, all Just in Time, and no spills', () => {
    const { events, floor } = cycleOf('all-four');
    expect(events.filter((e) => e.type === 'serve').length, floor).toBe(4);
    expect(events.filter((e) => e.type === 'serve' && e.justInTime).length, floor).toBe(4);
    expect(events.filter((e) => e.type === 'spill'), floor).toEqual([]);
    expect(events.filter((e) => e.type === 'end'), floor).toEqual([]);
  });

  it('the milk corner: each of the three pails is met on its own tick, and only spare buckets spill', () => {
    const { events, floor } = cycleOf('milk-corner');
    expect(events.filter((e) => e.type === 'milk').length, floor).toBe(3);
    expect(events.filter((e) => e.type === 'spill' && e.item.kind !== 'water'), floor).toEqual([]);
    expect(events.filter((e) => e.type === 'end'), floor).toEqual([]);
  });

  it('the all-twelve layout lets nothing run off the end of the counter', () => {
    const { events, floor } = cycleOf('all-twelve');
    expect(events.filter((e) => e.type === 'end'), floor).toEqual([]);
    expect(events.filter((e) => e.type === 'serve').length, floor).toBe(12);
  });
});
