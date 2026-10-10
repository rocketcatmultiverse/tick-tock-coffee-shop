import { describe, expect, it } from 'vitest';
import { emptyState } from '../../src/sim/state';
import { step } from '../../src/sim/step';
import { parseLayout } from '../../src/sim/text';
import type { Seat, SimEvent, SimState } from '../../src/sim/types';

// Every machine in one layout: wells, plots, kettles, a roaster, a mixer, a
// chute, a back door and merges onto the counter.
const BUSY = parseLayout([
  '. . . . . . . . . . . B',
  '> > > v . . . . . . . .',
  'D > R> v . . . W > P> v .',
  '. . . v . . . v . . v .',
  'W > P> K> M> > > Lv > Kv < .',
  '. . . . ^ . . P< Cv . v .',
  '. . . . ^ < < K< v . v .',
]);

const SEATS: Seat[] = [
  { col: 3, drink: 'coffee', roast: 'any', tick: 'any', grace: 0 },
  { col: 9, drink: 'coffee', roast: 'dark', tick: 2, grace: 2, fussy: true },
];

function runAll(ticks: number): { events: SimEvent[][]; final: SimState } {
  let state = emptyState(BUSY, SEATS.length);
  const events: SimEvent[][] = [];
  for (let T = 0; T < ticks; T++) {
    const r = step(BUSY, state, { seats: SEATS, canPayMilk: true });
    events.push(r.events);
    state = r.next;
  }
  return { events, final: state };
}

describe('Determinism', () => {
  it('the same layout run twice gives an identical event list', () => {
    const a = runAll(240);
    const b = runAll(240);
    expect(a.events).toEqual(b.events);
    expect(a.final).toEqual(b.final);
    expect(a.events.flat().length).toBeGreaterThan(50);
  });

  it('step never mutates its input', () => {
    let state = emptyState(BUSY, SEATS.length);
    const layoutCopy = structuredClone(BUSY);
    for (let T = 0; T < 60; T++) {
      const before = structuredClone(state);
      const { next } = step(BUSY, state, { seats: SEATS, canPayMilk: true });
      expect(state).toEqual(before);
      expect(next).not.toBe(state);
      state = next;
    }
    expect(BUSY).toEqual(layoutCopy);
  });
});
