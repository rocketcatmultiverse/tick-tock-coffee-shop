// The tray: where a workbench puzzle's items are handed in (docs/QUESTIONS.md,
// Q77). It takes one item a tick from any side, as a machine takes its
// input, says so with a deliver event, and keeps nothing.

import { describe, expect, it } from 'vitest';
import { canTake, splitterOutputs } from '../../src/sim/step';
import { tileIndex } from '../../src/sim/grid';
import { parseToken, structureToken } from '../../src/sim/text';
import type { Item } from '../../src/sim/types';
import { EMPTY, allOf, eventsOf, floor, start, tick } from '../helpers';

describe('Tray', () => {
  it('takes an item on the tick it lands, from a belt, and keeps nothing', () => {
    const run = start([EMPTY, '. . W > > T . . . . . .', EMPTY]);
    for (let T = 0; T < 36; T++) tick(run);
    const tray = tileIndex(1, 5);
    // The east bucket is on the belt beside the well on tick 0, and lands in the tray two ticks later.
    expect(allOf(run, 'deliver').map((e) => [e.T, e.at, e.item]), floor(run)).toEqual(
      [2, 14, 26].map((T) => [T, tray, { kind: 'water' }]),
    );
    expect(run.state.belts[tray], floor(run)).toBeNull();
    expect(allOf(run, 'spill').some((e) => e.at === tray), floor(run)).toBe(false);
  });

  it('takes a machine output straight off its side, on any side', () => {
    // A well puts out onto all four sides: a tray on each takes its bucket on tick 0.
    const run = start(['. . . . . T . . . . . .', '. . . . T W T . . . . .', '. . . . . T . . . . . .']);
    const events = tick(run);
    expect(eventsOf(events, 'deliver').map((e) => e.at).sort((a, b) => a - b), floor(run)).toEqual(
      [tileIndex(0, 5), tileIndex(1, 4), tileIndex(1, 6), tileIndex(2, 5)],
    );
    expect(eventsOf(events, 'spill'), floor(run)).toEqual([]);
  });

  it('takes one item a tick: belt beats machine, then north, east, south, west; the rest spill', () => {
    const run = start([
      '. . . . . v . . . . . .',
      '. . . . > T < . . . . .',
      '. . . . . ^ . . . . . .',
    ]);
    const tray = tileIndex(1, 5);
    const items: Item[] = [{ kind: 'water' }, { kind: 'beans' }, { kind: 'milk' }, { kind: 'coffee', roast: 'dark' }];
    const from = [tileIndex(2, 5), tileIndex(1, 6), tileIndex(0, 5), tileIndex(1, 4)];
    from.forEach((at, k) => (run.state.belts[at] = items[k]));
    const events = tick(run);
    expect(eventsOf(events, 'deliver'), floor(run)).toEqual([{ type: 'deliver', at: tray, item: items[0] }]);
    expect(eventsOf(events, 'spill').map((e) => [e.at, e.item]), floor(run)).toEqual(items.slice(1).map((it) => [tray, it]));

    // A machine putting out into the tray loses to a belt item on the same tick.
    const fight = start([EMPTY, '. . . . > T K< . . . . .', EMPTY]);
    fight.state.pending[tileIndex(1, 6)] = { item: { kind: 'coffee', roast: 'light' }, readyAt: 0 };
    fight.state.belts[tileIndex(1, 4)] = { kind: 'beans' };
    const ev = tick(fight);
    expect(eventsOf(ev, 'deliver').map((e) => e.item), floor(fight)).toEqual([{ kind: 'beans' }]);
    expect(eventsOf(ev, 'spill').map((e) => e.item), floor(fight)).toEqual([{ kind: 'coffee', roast: 'light' }]);
  });

  it('is an output of a splitter beside it, takes anything, and is written T', () => {
    const run = start([EMPTY, '. . . . . Y T . . . . .', EMPTY]);
    expect(splitterOutputs(run.layout, tileIndex(1, 5)), floor(run)).toEqual(['E']);
    const items: Item[] = [{ kind: 'water' }, { kind: 'milk' }, { kind: 'espressoBeans', roast: 'medium' }, { kind: 'latte', roast: 'dark' }];
    for (const it of items) expect(canTake({ kind: 'tray' }, it)).toBe(true);
    expect(parseToken('T')).toEqual({ kind: 'tray' });
    expect(structureToken({ kind: 'tray' })).toBe('T');
  });
});
