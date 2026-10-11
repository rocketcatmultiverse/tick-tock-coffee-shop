import { describe, expect, it } from 'vitest';
import { ALL_PIECES } from '../../src/game/pieces';
import { START_COINS, START_PIECES } from '../../src/game/tuning';
import { REGULARS } from '../../src/levels/regulars';
import { slotOf } from '../../src/sim/grid';
import { TOUR_STEPS, placeCard, tourText } from '../../src/ui/tutorial';

const lamplighter = REGULARS[0].order.tick as number;
const STOOL = { tick: lamplighter, slot: slotOf(lamplighter, REGULARS[0].col) };

describe('The tour', () => {
  const steps = tourText(STOOL);
  const all = (s: (typeof steps)[number]) => [...s.lines, ...(s.pieces ?? []).map((p) => p.line)];

  it('is a few short steps, with every number filled in', () => {
    expect(TOUR_STEPS).toBe(steps.length);
    expect(steps.length).toBeLessThanOrEqual(8);
    for (const s of steps) {
      expect(s.title.length, s.id).toBeGreaterThan(0);
      for (const line of all(s)) expect(line, s.id).not.toMatch(/undefined|NaN|\$\{|null/);
    }
  });

  it('covers ticks, slots and the first four pieces', () => {
    expect(steps.map((s) => s.id)).toEqual(expect.arrayContaining(['clock', 'pieces', 'slots']));
    const pieces = steps.find((s) => s.id === 'pieces')!.pieces!;
    // In the order a line runs, each with its number key.
    expect(pieces.map((p) => p.piece)).toEqual(['well', 'plot', 'kettle', 'belt']);
    expect(new Set(pieces.map((p) => p.piece))).toEqual(new Set(START_PIECES));
    for (const p of pieces) expect(p.line).toContain(`key ${(ALL_PIECES.indexOf(p.piece) + 1) % 10}`);
    expect(pieces.find((p) => p.piece === 'kettle')!.line).toContain('0–3 light, 4–7 medium, 8–11 dark');
  });

  it('reads out the stool as it is drawn: the lamplighter wants slot 7 on tick 11', () => {
    expect(STOOL).toEqual({ tick: 11, slot: 7 });
    expect(steps.find((s) => s.id === 'slots')!.lines.join(' ')).toContain('t11 · s7');
  });

  it('says deleting gives every coin back, and that rows do not', () => {
    const coins = steps.find((s) => s.id === 'coins')!.lines.join(' ');
    expect(coins).toContain(`${START_COINS} coins`);
    expect(coins).toMatch(/Deleting a piece gives back every coin/);
    expect(coins).toMatch(/rows .* are not given back/i);
  });
});

describe('Placing the tour card', () => {
  const box = { left: 1200, top: 100, width: 300, height: 200 };

  it('goes on the side asked for when it fits', () => {
    expect(placeCard(box, 'left', 340, 200, 1600, 900)).toEqual({ left: 1200 - 14 - 340, top: 100 });
  });

  it('goes on the other side when the one asked for has no room', () => {
    const low = { left: 400, top: 20, width: 400, height: 60 };
    expect(placeCard(low, 'above', 340, 200, 1600, 900)).toEqual({ left: 430, top: 20 + 60 + 14 });
  });

  it('stays inside the window', () => {
    const at = placeCard({ left: 0, top: 0, width: 1600, height: 900 }, 'right', 340, 200, 1600, 900);
    expect(at.left).toBeGreaterThanOrEqual(12);
    expect(at.left + 340).toBeLessThanOrEqual(1600 - 12);
    expect(at.top).toBeGreaterThanOrEqual(12);
  });

  it('sits in the middle with nothing to point at', () => {
    expect(placeCard(null, 'left', 300, 100, 1000, 800)).toEqual({ left: 350, top: 350 });
  });
});
