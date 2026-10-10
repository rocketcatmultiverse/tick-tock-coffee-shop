import { describe, expect, it } from 'vitest';
import { emptyState } from '../../src/sim/state';
import { findCycle } from '../../src/sim/steady';
import { parseLayout, renderFloor } from '../../src/sim/text';
import { tileIndex } from '../../src/sim/grid';
import type { Seat } from '../../src/sim/types';

const EMPTY = '. . . . . . . . . . . .';

describe('Steady state', () => {
  it('finds a one-loop cycle for a single line, and counts one serve per loop', () => {
    const layout = parseLayout([
      'F . . W . . . . . . . .',
      'F . . Pv . . . . . . . .',
      'F < < K< . . . . . . . .',
    ]);
    const seat: Seat = { col: 9, drink: 'coffee', roast: 'any', tick: 'any', grace: 0 };
    const cycle = findCycle(layout, { seats: [seat], milkPails: 3 });
    expect(cycle, renderFloor(layout, emptyState(layout))).not.toBeNull();
    expect(cycle!.loops).toBe(1);
    expect(cycle!.length).toBe(12);
    expect(cycle!.servesPerLoop).toEqual([1]);
    expect(cycle!.ticks.length).toBe(12);
    expect(cycle!.start % 12).toBe(0);
  });

  it('counts serves per loop by hand: two cups a loop, one regular who takes one', () => {
    // One well feeds two medium lines that join the feeder in rows 0 and 2.
    const layout = parseLayout([
      'F < < < K< . . . . . . .',
      'F . Pv W P^ . . . . . . .',
      'F < K< . . . . . . . . .',
    ]);
    const seats: Seat[] = [{ col: 10, drink: 'coffee', roast: 'medium', tick: 'any', grace: 0 }];
    const cycle = findCycle(layout, { seats, milkPails: 3 })!;
    expect(cycle.loops).toBe(1);
    expect(cycle.servesPerLoop).toEqual([1]);
    const ends = cycle.ticks.flatMap((t) => t.events).filter((e) => e.type === 'end');
    expect(ends.length).toBe(1);
  });

  it('finds a two-loop cycle: one cup riding a ring of eight belts', () => {
    const layout = parseLayout([
      '. > > v . . . . . . . .',
      '. ^ . v . . . . . . . .',
      '. ^ < < . . . . . . . .',
    ]);
    const from = emptyState(layout);
    from.belts[tileIndex(2, 1)] = { kind: 'coffee', roast: 'light' };
    const cycle = findCycle(layout, { seats: [], milkPails: 3 }, { from })!;
    expect(cycle.loops).toBe(2);
    expect(cycle.length).toBe(24);
    expect(cycle.start).toBe(0);
  });

  it('an empty floor is its own one-loop cycle', () => {
    const layout = parseLayout([EMPTY]);
    const cycle = findCycle(layout, { seats: [], milkPails: 3 })!;
    expect(cycle.loops).toBe(1);
    expect(cycle.start).toBe(0);
  });
});
