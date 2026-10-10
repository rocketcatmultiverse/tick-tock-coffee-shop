// The spring (docs/ADDENDUM-01.md): an item that lands on it on tick t lands
// on the next tile on tick t + SPRING_TICKS. It never blocks: it holds one
// item per tick of delay, and they leave in the order they came.

import { describe, expect, it } from 'vitest';
import { tileIndex } from '../../src/sim/grid';
import { SPRING_TICKS } from '../../src/sim/tuning';
import type { Item, Seat } from '../../src/sim/types';
import { EMPTY, allOf, eventsOf, floor, runTo, start, tick } from '../helpers';

const IN = tileIndex(1, 2); // the belt feeding the spring
const SPRING = tileIndex(1, 3);
const OUT = tileIndex(1, 4); // the tile after it

function line(): ReturnType<typeof start> {
  return start([EMPTY, '. . > S> > > > > > > > .', EMPTY]);
}

/** T on which each item that was put on the feeding belt is first seen on OUT. */
function arrivalsOnOut(run: ReturnType<typeof start>, until: number): [number, Item][] {
  const seen: [number, Item][] = [];
  while (run.state.T < until) {
    tick(run);
    const item = run.state.belts[OUT];
    if (item) seen.push([run.state.T - 1, item]);
  }
  return seen;
}

describe('Spring', () => {
  it('takes 4 ticks to cross', () => {
    expect(SPRING_TICKS).toBe(4);
  });

  for (const t of [0, 5, 11]) {
    it(`an item that lands on it on tick ${t} is on the next tile on tick ${t + SPRING_TICKS}`, () => {
      const run = line();
      runTo(run, t);
      run.state.belts[IN] = { kind: 'beans' }; // lands on the spring on tick t
      tick(run);
      expect(run.state.springs[SPRING]?.filter(Boolean), floor(run)).toEqual([{ kind: 'beans' }]);
      expect(arrivalsOnOut(run, t + 10), floor(run)).toEqual([[t + SPRING_TICKS, { kind: 'beans' }]]);
    });
  }

  it('items that enter on consecutive ticks leave on consecutive ticks, in order, and none spill', () => {
    const run = line();
    const items: Item[] = [{ kind: 'water' }, { kind: 'beans' }, { kind: 'milk' }, { kind: 'coffee', roast: 'dark' }, { kind: 'warmMilk' }];
    const out: [number, Item][] = [];
    for (let T = 0; T < 12; T++) {
      if (T < items.length) run.state.belts[IN] = items[T];
      tick(run);
      const item = run.state.belts[OUT];
      if (item) out.push([T, item]);
    }
    expect(out, floor(run)).toEqual(items.map((item, k) => [k + SPRING_TICKS, item]));
    expect(allOf(run, 'spill').filter((e) => e.at !== tileIndex(1, 11)), floor(run)).toEqual([]);
  });

  it('holds up to four items at once', () => {
    const run = line();
    for (let k = 0; k < 4; k++) {
      run.state.belts[IN] = { kind: 'water' };
      tick(run);
    }
    expect(run.state.springs[SPRING]?.filter(Boolean).length, floor(run)).toBe(4);
  });

  it('joining it follows the belt rules: north beats west, and the loser spills', () => {
    const run = start([EMPTY, '. . . v . . . . . . . .', '. . > S> > . . . . . . .', EMPTY]);
    run.state.belts[tileIndex(2, 3)] = { kind: 'water' };
    run.state.belts[IN] = { kind: 'beans' };
    const spills = eventsOf(tick(run), 'spill');
    expect(run.state.springs[SPRING]?.filter(Boolean), floor(run)).toEqual([{ kind: 'water' }]);
    expect(spills.map((e) => e.item), floor(run)).toEqual([{ kind: 'beans' }]);
  });

  it('what leaves it is a belt item: it beats a machine putting out onto the same tile', () => {
    const run = start([EMPTY, '. . . . Kv . . . . . . .', '. . > S> > > . . . . . .', EMPTY]);
    runTo(run, 0);
    run.state.belts[IN] = { kind: 'beans' };
    runTo(run, SPRING_TICKS); // the beans leave the spring on the next tick
    run.state.pending[tileIndex(2, 4)] = { item: { kind: 'coffee', roast: 'light' }, readyAt: 0 };
    const spills = eventsOf(tick(run), 'spill');
    expect(run.state.belts[OUT], floor(run)).toEqual({ kind: 'beans' });
    expect(spills.map((e) => e.item), floor(run)).toEqual([{ kind: 'coffee', roast: 'light' }]);
  });

  it('swapping one belt tile for a spring moves a cup 3 slots later', () => {
    // A medium line joins the feeder in row 0; between kettle and feeder are three belts, or two belts and a spring.
    const seat: Seat = { col: 11, drink: 'coffee', roast: 'any', tick: 'any', grace: 0 };
    const slot = (rows: string[]) => {
      const run = start(rows, [seat]);
      runTo(run, 40);
      const serve = allOf(run, 'serve')[0];
      expect(serve, floor(run)).toBeDefined();
      return (((serve.T - seat.col) % 12) + 12) % 12; // the tick it stepped onto column 0
    };
    const plain = slot(['F . . . W . . . . . . .', 'F . . . Pv . . . . . . .', 'F < < < K< . . . . . . .']);
    const sprung = slot(['F . . . W . . . . . . .', 'F . . . Pv . . . . . . .', 'F < S< < K< . . . . . . .']);
    expect(plain).toBe(9);
    expect(sprung).toBe((plain + 3) % 12);
  });
});
