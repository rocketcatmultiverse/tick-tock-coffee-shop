// One tick of the shop, as six steps (docs/SPEC.md, "Rules 2: what happens in
// one tick"). Every step reads the state as it was at the start of the step,
// so the order tiles are visited in never changes the result.

import type { Dir, Item, Layout, Seat, SimEvent, SimState, StepOpts, Structure } from './types';
import { DIRS, DIR_RANK, beltSlots, clockTick, counterIndex, isCounter, opposite, stepFrom } from './grid';
import { isDrink, matchesOrder, roastForTick, roastForTime } from './items';
import { visitLength, visitOffset } from './state';
import { BREW_TIME, COLS, DOOR_TICK, GROWTH, MIX_TIME, ROASTER_TICK, WELL_TICK } from './tuning';

interface Arrival {
  item: Item;
  /** The side of the target tile the item comes from. */
  side: Dir;
  /** Moved along a belt (or a chute) rather than put out by a machine. */
  belt: boolean;
  /** Arrived by chute: wins a tie with a belt item from the same side (docs/QUESTIONS.md). */
  chute: boolean;
}

function byPriority(a: Arrival, b: Arrival): number {
  if (a.belt !== b.belt) return a.belt ? -1 : 1; // belt beats machine
  if (a.side !== b.side) return DIR_RANK[a.side] - DIR_RANK[b.side]; // clockwise from the top
  if (a.chute !== b.chute) return a.chute ? -1 : 1;
  return 0;
}

function isBeltLike(s: Structure | null): s is Extract<Structure, { kind: 'belt' | 'launch' | 'catch' }> {
  return !!s && (s.kind === 'belt' || s.kind === 'launch' || s.kind === 'catch');
}

/** Whether door number `ordinal` (in tile order) gets its pail this loop. */
function doorPaid(canPayMilk: StepOpts['canPayMilk'], ordinal: number): boolean {
  if (typeof canPayMilk === 'number') return ordinal < canPayMilk;
  return canPayMilk;
}

export function step(layout: Layout, state: SimState, opts: StepOpts): { next: SimState; events: SimEvent[] } {
  const T = state.T;
  const t = clockTick(T);
  const events: SimEvent[] = [];
  const backRoom = layout.rows * COLS;
  const seats = opts.seats;

  const plots = { ...state.plots };
  const pending = { ...state.pending };
  const roasting = { ...state.roasting };
  const served = seats.map((_, i) => state.servedThisVisit[i] ?? false);
  const blocked = seats.map((_, i) => state.blocked[i] ?? false);

  // Seats arriving this tick start a fresh visit. A fussy regular looks at
  // their counter tile as it was at the end of the tick before.
  seats.forEach((seat, i) => {
    if (visitOffset(seat, T) !== 0) return;
    served[i] = false;
    blocked[i] = false;
    if (seat.fussy && seat.bowl === undefined && state.belts[counterIndex(layout, seat.col)] !== null) blocked[i] = true;
  });

  const arrivals = new Map<number, Arrival[]>();
  const spill = (at: number, item: Item) => events.push({ type: 'spill', at, item });
  const aim = (from: number, d: Dir, item: Item, belt: boolean, distance = 1) => {
    const target = stepFrom(layout, from, d, distance);
    if (target === null) {
      spill(from, item); // a wall
      return;
    }
    const list = arrivals.get(target) ?? [];
    list.push({ item, side: opposite(d), belt, chute: distance > 1 });
    arrivals.set(target, list);
  };

  // 1. Emit.
  let doorOrdinal = 0;
  for (let i = 0; i < backRoom; i++) {
    const s = layout.tiles[i];
    if (!s) continue;
    switch (s.kind) {
      case 'well':
        if (t === WELL_TICK) for (const d of DIRS) aim(i, d, { kind: 'water' }, false);
        break;
      case 'door': {
        const ordinal = doorOrdinal++;
        if (t === DOOR_TICK && doorPaid(opts.canPayMilk, ordinal)) {
          events.push({ type: 'milk', at: i });
          aim(i, 'E', { kind: 'milk' }, false);
        }
        break;
      }
      case 'plot': {
        const p = state.plots[i];
        if (p && p.harvestAt <= T) {
          plots[i] = null;
          events.push({ type: 'harvest', at: i });
          aim(i, s.out, { kind: 'beans' }, false);
        }
        break;
      }
      case 'roaster': {
        const r = state.roasting[i];
        if (r && t === ROASTER_TICK && r.since < T) {
          roasting[i] = null;
          const item: Item = { kind: 'espressoBeans', roast: roastForTime(T - r.since) };
          events.push({ type: 'release', at: i, item });
          aim(i, s.out, item, false);
        }
        break;
      }
      case 'kettle':
      case 'mixer': {
        const p = state.pending[i];
        if (p && p.readyAt <= T) {
          pending[i] = null;
          aim(i, s.out, p.item, false);
        }
        break;
      }
      default:
        break;
    }
  }

  // 2. Move. Items emitted above do not also move this tick.
  const ranOffEnd: Item[] = [];
  for (let i = 0; i < beltSlots(layout); i++) {
    const item = state.belts[i];
    if (!item) continue;
    if (isCounter(layout, i)) {
      const col = i - backRoom;
      if (col === COLS - 1) ranOffEnd.push(item);
      else {
        const list = arrivals.get(i + 1) ?? [];
        list.push({ item, side: 'W', belt: true, chute: false });
        arrivals.set(i + 1, list);
      }
      continue;
    }
    const s = layout.tiles[i];
    if (isBeltLike(s)) aim(i, s.dir, item, true, s.kind === 'launch' ? 2 : 1);
    else spill(i, item); // only reachable after a live edit left an item stranded
  }

  // 3. Land, and 4. machines take in.
  const belts: (Item | null)[] = new Array(beltSlots(layout)).fill(null);
  const targets = [...arrivals.keys()].sort((a, b) => a - b);
  for (const at of targets) {
    const list = arrivals.get(at)!.slice().sort(byPriority);
    const s = at < backRoom ? layout.tiles[at] : null;
    if (isCounter(layout, at) || isBeltLike(s)) {
      belts[at] = list[0].item;
      for (const loser of list.slice(1)) spill(at, loser.item);
      continue;
    }
    if (!s) {
      for (const a of list) spill(at, a.item); // bare floor
      continue;
    }
    takeIn(s, at, list);
  }

  function takeIn(s: Structure, at: number, list: Arrival[]): void {
    switch (s.kind) {
      case 'plot':
        for (const a of list) {
          if (a.item.kind === 'water' && !plots[at]) {
            plots[at] = { harvestAt: T + GROWTH };
            events.push({ type: 'water', at });
          } else spill(at, a.item);
        }
        return;
      case 'kettle': {
        let took = false;
        for (const a of list) {
          const out = took || pending[at] ? null : brew(a.item, t);
          if (out) {
            took = true;
            pending[at] = { item: out, readyAt: T + BREW_TIME };
            events.push({ type: 'brew', at, item: out, tick: t });
          } else spill(at, a.item);
        }
        return;
      }
      case 'roaster':
        for (const a of list) {
          if (a.item.kind === 'beans' && !roasting[at]) {
            roasting[at] = { since: T };
            events.push({ type: 'roast', at });
          } else spill(at, a.item);
        }
        return;
      case 'mixer': {
        const milk = list.find((a) => a.item.kind === 'milk');
        const partner = list.find((a) => a.item.kind === 'espresso' || a.item.kind === 'coffee');
        const base = partner?.item;
        if (milk && partner && base && (base.kind === 'espresso' || base.kind === 'coffee') && !pending[at]) {
          const item: Item = { kind: base.kind === 'espresso' ? 'latte' : 'auLait', roast: base.roast };
          pending[at] = { item, readyAt: T + MIX_TIME };
          events.push({ type: 'mix', at, item });
          for (const a of list) if (a !== milk && a !== partner) spill(at, a.item);
        } else {
          for (const a of list) spill(at, a.item);
        }
        return;
      }
      case 'bowl': {
        const cat = seats.findIndex((seat) => seat.bowl === at);
        const offset = cat >= 0 ? visitOffset(seats[cat], T) : null;
        for (const a of list) {
          const there = offset !== null && !blocked[cat];
          if (there && a.item.kind === 'warmMilk' && !served[cat]) {
            served[cat] = true;
            events.push({ type: 'serve', seat: cat, at, item: a.item, justInTime: offset === 0 && seats[cat].tick !== 'any' });
            continue;
          }
          if (there && a.item.kind === 'milk') {
            blocked[cat] = true;
            events.push({ type: 'bolt', seat: cat, at });
          }
          spill(at, a.item);
        }
        return;
      }
      default:
        // Wells and doors take nothing.
        for (const a of list) spill(at, a.item);
    }
  }

  // 5. Counter: regulars take their cups, then the end of the belt.
  seats.forEach((seat: Seat, i) => {
    if (seat.bowl !== undefined) return;
    const offset = visitOffset(seat, T);
    if (offset === null || served[i]) return;
    const at = counterIndex(layout, seat.col);
    const item = belts[at];
    if (!item || !matchesOrder(seat, item)) return;
    if (blocked[i]) {
      events.push({ type: 'refuse', seat: i, at, item });
      return;
    }
    belts[at] = null;
    served[i] = true;
    events.push({ type: 'serve', seat: i, at, item, justInTime: offset === 0 && seat.tick !== 'any' });
  });
  for (const item of ranOffEnd) {
    if (isDrink(item)) events.push({ type: 'end', item });
    else spill(counterIndex(layout, COLS - 1), item);
  }

  // Seats whose visit ends this tick leave and forget it.
  seats.forEach((seat, i) => {
    if (visitOffset(seat, T) === visitLength(seat)) {
      served[i] = false;
      blocked[i] = false;
    }
  });

  // 6. Advance.
  return {
    next: { T: T + 1, belts, plots, pending, roasting, servedThisVisit: served, blocked },
    events,
  };
}

/**
 * What a kettle makes of an input landing on clock tick `t`, or null if it
 * cannot use it. Plain beans take their roast from the tick; espresso beans
 * keep theirs; milk becomes warm milk on any tick.
 */
function brew(item: Item, t: number): Item | null {
  switch (item.kind) {
    case 'beans':
      return { kind: 'coffee', roast: roastForTick(t) };
    case 'espressoBeans':
      return { kind: 'espresso', roast: item.roast };
    case 'milk':
      return { kind: 'warmMilk' };
    default:
      return null;
  }
}
