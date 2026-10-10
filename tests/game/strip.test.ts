import { describe, expect, it } from 'vitest';
import { counterStrip } from '../../src/game/strip';
import { seatFor } from '../../src/game/regulars';
import { REGULARS } from '../../src/levels/regulars';
import { REFERENCE_LAYOUTS } from '../../src/levels/layouts';
import { emptyLayout } from '../../src/sim/grid';
import { parseLayout } from '../../src/sim/text';

describe('Counter strip', () => {
  it('reads Just in Time, within grace and the cups on each tile from steady state', () => {
    const layout = parseLayout(REFERENCE_LAYOUTS.find((r) => r.id === 'all-four')!.rows);
    const four = REGULARS.slice(0, 4);
    const strip = counterStrip(layout, four.map(seatFor), four)!;
    const byId = (id: string) => strip.find((c) => c.stool?.def.id === id)!;
    expect(byId('lamplighter').stool).toMatchObject({ result: 'grace', tick: 7, item: { kind: 'coffee', roast: 'medium' } });
    expect(byId('sweep').stool).toMatchObject({ result: 'grace', tick: 11, item: { kind: 'coffee', roast: 'dark' } });
    expect(byId('clockmaker').stool).toMatchObject({ result: 'justInTime', tick: 5, item: { kind: 'coffee', roast: 'medium' } });
    expect(byId('gargoyle').stool).toMatchObject({ result: 'justInTime', tick: 11 });
    expect(strip[5].cupTicks).toEqual([5]);
    expect(strip[10].cupTicks).toEqual([10]);
    expect(strip[0].cupTicks).toEqual([]);
    expect(strip[0].stool).toBeNull();
  });

  it('reads a miss when nothing arrives', () => {
    const four = REGULARS.slice(0, 4);
    const strip = counterStrip(emptyLayout(6), four.map(seatFor), four)!;
    expect(strip.filter((c) => c.stool).map((c) => c.stool!.result)).toEqual(['miss', 'miss', 'miss', 'miss']);
  });
});
