import { describe, expect, it } from 'vitest';
import { counterStrip } from '../../src/game/strip';
import { seatFor } from '../../src/game/regulars';
import { REGULARS } from '../../src/levels/regulars';
import { REFERENCE_LAYOUTS } from '../../src/levels/layouts';
import { startLayout } from '../../src/game/build';
import { parseLayout } from '../../src/sim/text';

describe('Counter strip', () => {
  it('reads Just in Time, within grace and the cups on each tile from steady state', () => {
    const layout = parseLayout(REFERENCE_LAYOUTS.find((r) => r.id === 'all-four')!.rows);
    const four = REGULARS.slice(0, 4);
    const strip = counterStrip(layout, four.map(seatFor), four)!;
    const byId = (id: string) => strip.find((c) => c.stool?.def.id === id)!;
    // Slots on the belt: 9 medium (taken on column 0), 7 medium, 1 dark, 5 dark. Slot k is in front of column c on tick k + c.
    expect(byId('lamplighter').stool).toMatchObject({ result: 'grace', tick: 11, item: { kind: 'coffee', roast: 'medium' } });
    expect(byId('sweep').stool).toMatchObject({ result: 'grace', tick: 0, item: { kind: 'coffee', roast: 'dark' } });
    expect(byId('clockmaker').stool).toMatchObject({ result: 'justInTime', tick: 9, item: { kind: 'coffee', roast: 'medium' } });
    expect(byId('gargoyle').stool).toMatchObject({ result: 'justInTime', tick: 11 });
    expect(strip[0].cupTicks).toEqual([1, 5, 7, 9]);
    // Column 5 has no stool; slot 7 was taken on column 4, so only the dark cups pass.
    expect(strip[5].cupTicks).toEqual([6, 10]);
    expect(strip[5].stool).toBeNull();
    // Past the gargoyle only the sweep's cup is left.
    expect(strip[10].cupTicks).toEqual([11]);
  });

  it('shows the slot each stool wants; an any-tick stool shows the slot it last took from', () => {
    const layout = parseLayout(REFERENCE_LAYOUTS.find((r) => r.id === 'all-four')!.rows);
    const four = REGULARS.slice(0, 4);
    const strip = counterStrip(layout, four.map(seatFor), four)!;
    const slots = Object.fromEntries(strip.flatMap((c) => (c.stool ? [[c.stool.def.id, c.stool.slot]] : [])));
    expect(slots).toEqual({ clockmaker: 9, lamplighter: 7, gargoyle: 5, sweep: 1 });
    const missing = counterStrip(startLayout(6), four.map(seatFor), four)!;
    expect(missing.find((c) => c.stool?.def.id === 'lamplighter')!.stool!.slot).toBeNull();
    expect(missing.find((c) => c.stool?.def.id === 'clockmaker')!.stool!.slot).toBe(9);
  });

  it('reads a miss when nothing arrives', () => {
    const four = REGULARS.slice(0, 4);
    const strip = counterStrip(startLayout(6), four.map(seatFor), four)!;
    expect(strip.filter((c) => c.stool).map((c) => c.stool!.result)).toEqual(['miss', 'miss', 'miss', 'miss']);
  });
});
