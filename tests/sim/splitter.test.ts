// The splitter (docs/ADDENDUM-01.md): it hands each item to the next of its
// outputs, clockwise from the top, one tick after it lands. Outputs are the
// neighbours that take items, except a piece pointing at the splitter, a
// machine putting out into it, another splitter, wells and the side door. The
// round restarts on tick 0.

import { describe, expect, it } from 'vitest';
import { tileIndex } from '../../src/sim/grid';
import type { Item, Structure } from '../../src/sim/types';
import { canTake, splitterNext } from '../../src/sim/step';
import { parseLayout } from '../../src/sim/text';
import { EMPTY, eventsOf, floor, runTo, start, tick } from '../helpers';

const IN = tileIndex(2, 4); // a belt pointing east into the splitter
const SPLIT = tileIndex(2, 5);
const N = tileIndex(3, 5);
const E = tileIndex(2, 6);
const S = tileIndex(1, 5);

/** A floor with the splitter at (2, 5), fed from the west, and the given tokens north, east and south of it. */
function around(north: string, east: string, south: string) {
  const row = (tokens: Record<number, string>) => {
    const toks = EMPTY.split(' ');
    for (const [c, t] of Object.entries(tokens)) toks[Number(c)] = t;
    return toks.join(' ');
  };
  return start([EMPTY, row({ 5: north }), row({ 4: '>', 5: 'Y', 6: east }), row({ 5: south }), EMPTY]);
}

const ITEMS: Item[] = [{ kind: 'water' }, { kind: 'beans' }, { kind: 'milk' }, { kind: 'warmMilk' }];

/** Feed one item a tick from T = `from`; return where each one was the tick after it left the splitter. */
function route(run: ReturnType<typeof around>, items: Item[], from = 0): (number | null)[] {
  runTo(run, from);
  const where: (number | null)[] = [];
  for (let k = 0; k < items.length + 2; k++) {
    if (k < items.length) run.state.belts[IN] = items[k];
    tick(run);
    // Item k landed on the splitter on tick from + k and leaves on from + k + 1.
    const left = k - 1;
    if (left >= 0 && left < items.length) {
      const at = run.state.belts.findIndex((x) => x !== null && x.kind === items[left].kind);
      where.push(at >= 0 ? at : null);
    }
  }
  return where;
}

describe('Splitter', () => {
  it('with three outputs, items in a row leave by the top one first, then clockwise', () => {
    const run = around('^', '>', 'v');
    expect(route(run, ITEMS.slice(0, 3)), floor(run)).toEqual([N, E, S]);
  });

  it('takes one tick: an item landing on tick t is on its output on tick t + 1', () => {
    const run = around('^', '.', '.');
    run.state.belts[IN] = { kind: 'beans' };
    tick(run); // lands on the splitter on tick 0
    expect(run.state.belts[SPLIT], floor(run)).toEqual({ kind: 'beans' });
    tick(run);
    expect(run.state.belts[N], floor(run)).toEqual({ kind: 'beans' });
  });

  it('with two outputs, items alternate', () => {
    const run = around('^', '.', 'v');
    expect(route(run, ITEMS), floor(run)).toEqual([N, S, N, S]);
  });

  it('with one output, it acts as a turn', () => {
    const run = around('.', '.', 'v');
    expect(route(run, ITEMS.slice(0, 3)), floor(run)).toEqual([S, S, S]);
  });

  it('with no output, the item spills', () => {
    const run = around('.', '.', '.');
    run.state.belts[IN] = { kind: 'beans' };
    tick(run);
    const spills = eventsOf(tick(run), 'spill');
    expect(spills, floor(run)).toEqual([{ type: 'spill', at: SPLIT, item: { kind: 'beans' } }]);
  });

  it('a belt that points at the splitter is never an output', () => {
    const run = around('v', '<', '^');
    run.state.belts[IN] = { kind: 'beans' };
    tick(run);
    expect(eventsOf(tick(run), 'spill').map((e) => e.at), floor(run)).toEqual([SPLIT]);
  });

  it('a spring is an output unless it points at the splitter', () => {
    const run = around('S^', 'S<', 'v');
    expect(route(run, ITEMS.slice(0, 2)), floor(run)).toEqual([null, S]); // the first is inside the spring
    expect(run.state.springs[N]?.filter(Boolean), floor(run)).toEqual([ITEMS[0]]);
  });

  it('a machine beside it is an output, unless it puts out into the splitter', () => {
    // A kettle to the north putting out north takes milk; one to the south putting out into the splitter does not count.
    const run = around('K^', '.', 'K^');
    run.state.belts[IN] = { kind: 'milk' };
    tick(run);
    tick(run);
    expect(run.state.pending[N], floor(run)).toMatchObject({ item: { kind: 'warmMilk' } });
    expect(run.state.pending[S] ?? null, floor(run)).toBeNull();
  });

  it('a chute launch beside it is an output, but a catch putting out into it is not', () => {
    const run = start([
      EMPTY,
      '. . . . . Cv . . . . . .',
      '. . . . > Y L> . C> . . .',
      EMPTY,
      EMPTY,
    ]);
    run.state.belts[IN] = { kind: 'beans' };
    tick(run);
    tick(run);
    expect(run.state.belts[E], floor(run)).toEqual({ kind: 'beans' });
    tick(run);
    expect(run.state.belts[tileIndex(2, 8)], floor(run)).toEqual({ kind: 'beans' });
  });

  it('another splitter is not an output; nor are a well or the side door', () => {
    for (const north of ['Y', 'W', 'D']) {
      const run = around(north, '.', 'v');
      // Milk and warm milk, so a well's own buckets are not mistaken for them.
      expect(route(run, ITEMS.slice(2, 4)), floor(run)).toEqual([S, S]);
    }
  });

  it('the feeder is an output', () => {
    const run = start([EMPTY, 'F Y < . . . . . . . . .', 'F . . . . . . . . . . .']);
    run.state.belts[tileIndex(1, 2)] = { kind: 'beans' };
    tick(run);
    tick(run);
    expect(run.state.belts[tileIndex(1, 0)], floor(run)).toEqual({ kind: 'beans' });
  });

  it('the round restarts on tick 0', () => {
    // Items leave on ticks 10, 11 and 0: north, east, then north again rather than south.
    const run = around('^', '>', 'v');
    expect(route(run, ITEMS.slice(0, 3), 9), floor(run)).toEqual([N, E, N]);
    // Without the restart the same three, leaving on ticks 2, 3 and 4, go north, east, south.
    const mid = around('^', '>', 'v');
    expect(route(mid, ITEMS.slice(0, 3), 1), floor(mid)).toEqual([N, E, S]);
  });

  it('takes items as a belt does: one a tick, by the usual priority rules', () => {
    const run = start([EMPTY, '. . . . . v . . . . . .', '. . . . > Y . . . . . .', '. . . . . v . . . . . .', EMPTY]);
    run.state.belts[tileIndex(3, 5)] = { kind: 'water' };
    run.state.belts[IN] = { kind: 'beans' };
    const spills = eventsOf(tick(run), 'spill');
    expect(run.state.belts[SPLIT], floor(run)).toEqual({ kind: 'water' });
    expect(spills.map((e) => e.item), floor(run)).toEqual([{ kind: 'beans' }]);
  });
});

// What the splitter will do next, for the floor's highlight: which output the
// next item leaving it goes to, and whether the piece there can take that item.
describe('Splitter, looking ahead', () => {
  it('names the output the next item goes to, following the round and its restart on tick 0', () => {
    const run = around('^', '>', 'v');
    expect(splitterNext(run.layout, run.state, SPLIT)).toBe('N');
    // Two items pass, north then east: the next goes south.
    for (const item of ITEMS.slice(0, 2)) {
      run.state.belts[IN] = item;
      tick(run);
    }
    runTo(run, 5);
    expect(splitterNext(run.layout, run.state, SPLIT)).toBe('S');
    // The tick about to run is tick 0: the round starts again at the top.
    runTo(run, 12);
    expect(splitterNext(run.layout, run.state, SPLIT)).toBe('N');
  });

  it('agrees with where items really go', () => {
    const run = around('^', '>', 'v');
    for (let T = 0; T < 30; T++) {
      if (T % 2 === 0) run.state.belts[IN] = { kind: 'beans' };
      const leaving = run.state.belts[SPLIT];
      const next = splitterNext(run.layout, run.state, SPLIT);
      tick(run);
      if (!leaving) continue;
      const at = { N, E, S }[next as 'N' | 'E' | 'S'];
      expect(run.state.belts[at], `T=${T}${floor(run)}`).toEqual(leaving);
    }
  });

  it('has no next output when nothing beside it takes items', () => {
    const run = around('.', '.', '.');
    expect(splitterNext(run.layout, run.state, SPLIT)).toBeNull();
  });

  it('knows which pieces can ever take an item: anything a machine cannot use spills', () => {
    const machines: Structure[] = [
      { kind: 'plot', out: 'N' },
      { kind: 'kettle', out: 'N' },
      { kind: 'roaster', out: 'N' },
      { kind: 'mixer', out: 'N' },
      { kind: 'bowl' },
      { kind: 'well' },
      { kind: 'door' },
    ];
    const items: Item[] = [
      { kind: 'water' },
      { kind: 'beans' },
      { kind: 'milk' },
      { kind: 'warmMilk' },
      { kind: 'coffee', roast: 'dark' },
      { kind: 'espresso', roast: 'dark' },
      { kind: 'espressoBeans', roast: 'dark' },
      { kind: 'latte', roast: 'dark' },
    ];
    for (const m of machines) {
      for (const item of items) {
        if (canTake(m, item)) continue;
        // Something it can never take spills the moment it lands, whatever else happens.
        const layout = parseLayout([EMPTY, '. . . . > . . . . . . .', EMPTY]);
        layout.tiles[tileIndex(1, 5)] = m;
        const run = start(layout, [], 3);
        run.state.belts[tileIndex(1, 4)] = item;
        const spills = eventsOf(tick(run), 'spill');
        expect(spills.map((e) => [e.at, e.item]), `${m.kind} takes ${item.kind}`).toContainEqual([tileIndex(1, 5), item]);
      }
    }
    // Belts and the like take anything; bare floor takes nothing.
    expect(canTake({ kind: 'belt', dir: 'N' }, { kind: 'latte', roast: 'dark' })).toBe(true);
    expect(canTake(null, { kind: 'water' })).toBe(false);
    expect(canTake({ kind: 'kettle', out: 'N' }, { kind: 'milk' })).toBe(true);
    expect(canTake({ kind: 'plot', out: 'N' }, { kind: 'milk' })).toBe(false);
  });
});
