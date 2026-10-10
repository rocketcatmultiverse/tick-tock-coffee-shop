// Slots over the ladder data (docs/ADDENDUM-01.md, "The ladder"): every timed
// counter regular wants a different slot, the slot before a fussy regular's is
// unassigned or owned by someone seated to their left, and each any-tick
// regular sits to the right of every timed regular with the same drink.

import { describe, expect, it } from 'vitest';
import { REGULARS } from '../../src/levels/regulars';
import { slotOf } from '../../src/sim/grid';
import type { RegularDef } from '../../src/sim/types';

const counter = REGULARS.filter((d) => !d.bowl);
const timed = counter.filter((d) => d.order.tick !== 'any');
const slot = (d: RegularDef) => slotOf(d.order.tick as number, d.col);
const sameDrink = (a: RegularDef, b: RegularDef) => a.order.drink === b.order.drink && a.order.roast === b.order.roast;

describe('Slots', () => {
  it('match the ladder table: place, stool column, tick and slot', () => {
    const table = REGULARS.map((d) => [d.id, d.bowl ? 'bowl' : d.col, d.order.tick, d.bowl || d.order.tick === 'any' ? null : slot(d)]);
    expect(table).toEqual([
      ['lamplighter', 4, 'any', null],
      ['sweep', 11, 'any', null],
      ['clockmaker', 0, 9, 9],
      ['gargoyle', 6, 11, 5],
      ['postwoman', 3, 3, 0],
      ['baker', 9, 1, 4],
      ['apothecary', 2, 8, 6],
      ['witch', 10, 0, 2],
      ['alchemist', 7, 6, 11],
      ['cat', 'bowl', 10, null],
      ['innkeeper', 8, 4, 8],
      ['mayor', 1, 11, 10],
    ]);
  });

  it('every timed counter regular wants a different slot', () => {
    const slots = timed.map(slot);
    expect(new Set(slots).size).toBe(slots.length);
  });

  it('every counter regular has a stool of their own', () => {
    expect(new Set(counter.map((d) => d.col)).size).toBe(counter.length);
  });

  it('the slot before a fussy regular is unassigned, or owned by a regular seated to their left', () => {
    const fussy = timed.filter((d) => d.order.fussy);
    expect(fussy.map((d) => d.id)).toEqual(['alchemist']);
    for (const f of fussy) {
      const before = (slot(f) + 11) % 12;
      const owner = timed.find((d) => slot(d) === before);
      if (owner) expect(owner.col, `${owner.id} owns slot ${before}`).toBeLessThan(f.col);
    }
  });

  it('each any-tick regular sits to the right of every timed regular with the same drink', () => {
    for (const a of counter.filter((d) => d.order.tick === 'any')) {
      for (const t of timed.filter((d) => sameDrink(d, a))) expect(a.col, `${a.id} and ${t.id}`).toBeGreaterThan(t.col);
    }
  });
});
