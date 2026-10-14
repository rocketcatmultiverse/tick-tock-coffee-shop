import { describe, expect, it } from 'vitest';
import { ALL_PIECES } from '../../src/game/pieces';
import { BENCH_SOLVE_LOOPS, PIECE_PRICE, START_COINS, START_PIECES } from '../../src/game/tuning';
import { PUZZLES } from '../../src/levels/puzzles';
import { REGULARS } from '../../src/levels/regulars';
import { slotOf } from '../../src/sim/grid';
import { BENCH_TOUR_STEPS, SHOP_TOUR_STEPS, type TourText, benchTourText, keysText, offerText, placeCard, shopTourText } from '../../src/ui/tutorial';

const lamplighter = REGULARS[0].order.tick as number;
const STOOL = { tick: lamplighter, slot: slotOf(lamplighter, REGULARS[0].col) };
const puzzle = (id: string) => PUZZLES.find((p) => p.id === id)!;

const all = (s: TourText) => [...s.lines, ...(s.pieces ?? []).map((p) => p.line)];
const text = (steps: TourText[], id: string) => all(steps.find((s) => s.id === id)!).join(' ');
const filledIn = (steps: TourText[]) => {
  for (const s of steps) {
    expect(s.title.length, s.id).toBeGreaterThan(0);
    for (const line of all(s)) expect(line, s.id).not.toMatch(/undefined|NaN|\$\{|null/);
  }
};
const noKeys = (steps: TourText[]) => {
  for (const s of steps) for (const line of all(s)) expect(line, s.id).not.toMatch(/\bkey\b|\bSpace\b|\bclick\b|\bHover\b|\bpress Z\b/i);
};

describe('The bench tour, during the first lesson (Q80)', () => {
  const first = puzzle('basics-water');
  const lesson = { n: 1, of: 5 };
  const steps = benchTourText(first, { touch: false, menu: false, lesson });

  it('is a few short steps, the same on every bench, with every number filled in', () => {
    expect(BENCH_TOUR_STEPS).toBe(steps.length);
    expect(steps.length).toBeLessThanOrEqual(6);
    filledIn(steps);
    for (const p of PUZZLES) {
      const other = benchTourText(p);
      expect(other.map((s) => s.id), p.id).toEqual(steps.map((s) => s.id));
      filledIn(other);
    }
  });

  it('covers the lesson, the order, the bench, the pieces, the clock and help', () => {
    expect(steps.map((s) => s.id)).toEqual(['lesson', 'order', 'floor', 'pieces', 'clock', 'help']);
  });

  it('says which lesson this is and that the keys come after the last, or nothing of keys on any other bench', () => {
    const top = steps.find((s) => s.id === 'lesson')!;
    expect(top.title).toBe('Lesson 1 of 5');
    expect(all(top).join(' ')).toMatch(/Solve all 5 lessons and the keys to the shop are yours/);
    const later = benchTourText(puzzle('basics-light'));
    expect(later.find((s) => s.id === 'lesson')!.title).toBe('The workbench');
    expect(later.flatMap(all).join(' ')).not.toMatch(/keys/);
  });

  it('says how a puzzle is solved', () => {
    expect(text(steps, 'order')).toContain(`Fill the order ${BENCH_SOLVE_LOOPS} loops in a row and the puzzle is solved`);
    expect(text(steps, 'lesson')).toMatch(/Start over/);
  });

  it('teaches the clock: ticks, pausing and stepping', () => {
    expect(text(steps, 'clock')).toMatch(/12 ticks, 0 to 11/);
    expect(text(steps, 'clock')).toMatch(/Space pauses it and \. steps one tick/);
    expect(text(benchTourText(first, { touch: true, menu: true }), 'clock')).toMatch(/Pause stops it and Step moves it on one tick/);
  });

  it('names the pieces on offer and the pieces bolted to the bench, in the order a line runs', () => {
    const pieces = (id: string) => benchTourText(puzzle(id)).find((s) => s.id === 'pieces')!.pieces!;
    // The first lesson's well came with the bench: it has no key, since it is not in the palette.
    expect(pieces('basics-water').map((p) => p.piece)).toEqual(['well', 'belt']);
    expect(pieces('basics-water')[0].line).toMatch(/^Well, on the bench: on tick 0/);
    expect(pieces('basics-water')[1].line).toMatch(/^Belt, key 1: carries an item one tile a tick/);
    expect(pieces('basics-cup').map((p) => p.piece)).toEqual(['well', 'plot', 'kettle', 'belt']);
    expect(pieces('basics-cup').find((p) => p.piece === 'kettle')!.line).toContain('0–3 light, 4–7 medium, 8–11 dark');
    for (const p of pieces('basics-cup').slice(1)) expect(p.line).toContain(`key ${(ALL_PIECES.indexOf(p.piece) + 1) % 10}`);
  });

  it('says what is not bench where the bench has a gap', () => {
    expect(text(steps, 'floor')).toMatch(/gap/);
    expect(text(benchTourText(puzzle('basics-beans')), 'floor')).not.toMatch(/gap/);
  });

  it('says every piece is free, and names no coin or refund (Q77)', () => {
    expect(text(steps, 'pieces')).toMatch(/Every piece here is free/);
    for (const s of steps) for (const line of all(s)) expect(line, s.id).not.toMatch(/coin|refund/i);
  });

  it('on a touch screen, says tap, names no keys, and teaches the stick (Q71, Q72)', () => {
    const touch = benchTourText(first, { touch: true, menu: true, lesson });
    expect(touch.map((s) => s.id)).toEqual(steps.map((s) => s.id));
    noKeys(touch);
    filledIn(touch);
    expect(text(touch, 'pieces')).toMatch(/Tap a piece: its ghost appears in the middle of the floor/);
    expect(text(touch, 'pieces')).toMatch(/stick at the bottom right, and tap Place/);
    expect(text(touch, 'pieces')).toMatch(/Tap Lay on the stick/);
    expect(text(touch, 'order')).toMatch(/Tap the underlined name/);
  });

  it('finds the Help tab in the menu when the tabs are in the drawer', () => {
    expect(text(steps, 'help')).toContain('The Help tab has every key, and this tour again');
    expect(text(benchTourText(first, { touch: false, menu: true }), 'help')).toContain('The Help tab, in the menu, has every key');
    expect(text(benchTourText(first, { touch: true, menu: true }), 'help')).toContain('The Help tab, in the menu, has every control');
  });
});

describe('The shop tour, once the keys are handed over (Q80)', () => {
  const steps = shopTourText(STOOL);

  it('is a few short steps, with every number filled in', () => {
    expect(SHOP_TOUR_STEPS).toBe(steps.length);
    expect(steps.length).toBeLessThanOrEqual(8);
    filledIn(steps);
  });

  it('covers the regulars, the feeder, slots, the pieces at a price, coins and the workbench, and leaves the clock to the lessons', () => {
    expect(steps.map((s) => s.id)).toEqual(['regular', 'feeder', 'slots', 'pieces', 'coins', 'bench', 'go']);
  });

  it('lists the first four pieces in the order a line runs, each with its number key, its price and its rule', () => {
    const pieces = steps.find((s) => s.id === 'pieces')!.pieces!;
    expect(pieces.map((p) => p.piece)).toEqual(['well', 'plot', 'kettle', 'belt']);
    expect(new Set(pieces.map((p) => p.piece))).toEqual(new Set(START_PIECES));
    for (const p of pieces) {
      expect(p.line).toContain(`key ${(ALL_PIECES.indexOf(p.piece) + 1) % 10}`);
      expect(p.line).toContain(`${PIECE_PRICE[p.piece]} coin`);
    }
    expect(pieces.find((p) => p.piece === 'kettle')!.line).toContain('0–3 light, 4–7 medium, 8–11 dark');
    expect(text(steps, 'pieces')).toMatch(/A \? is a piece still to come/);
  });

  it('reads out the stool as it is drawn: the lamplighter wants slot 7 on tick 11', () => {
    expect(STOOL).toEqual({ tick: 11, slot: 7 });
    expect(text(steps, 'slots')).toContain('t11 · s7');
  });

  it('on a touch screen, says tap and names no keys (Q71)', () => {
    const touch = shopTourText(STOOL, { touch: true, menu: true });
    expect(touch.map((s) => s.id)).toEqual(steps.map((s) => s.id));
    noKeys(touch);
    filledIn(touch);
    expect(text(touch, 'coins')).toMatch(/tap it, then Delete/);
    expect(text(touch, 'regular')).toMatch(/Tap the underlined drink/);
    expect(touch.find((s) => s.id === 'pieces')!.pieces!.map((p) => p.piece)).toEqual(['well', 'plot', 'kettle', 'belt']);
  });

  it('builds the first line from the well already on the floor, or asks for one when there is none (Q79)', () => {
    const go = (well: boolean) => text(shopTourText(STOOL, { touch: false, menu: false, well }), 'go');
    expect(go(true)).toMatch(/A well is already on the floor\. Build a line from it: a plot, then a kettle/);
    expect(go(true)).toMatch(/Move the well if you like/);
    expect(go(false)).toMatch(/Build a line: a well, a plot and a kettle/);
    expect(go(false)).not.toMatch(/already on the floor/);
  });

  it('finds the Help tab in the menu when the tabs are in the drawer', () => {
    const go = (words: { touch: boolean; menu: boolean }) => text(shopTourText(STOOL, words), 'go');
    expect(go({ touch: false, menu: false })).toContain('The Help tab has every key');
    expect(go({ touch: false, menu: true })).toContain('The Help tab, in the menu, has every key');
    expect(go({ touch: true, menu: true })).toContain('The Help tab, in the menu, has every control');
  });

  it('points back to the workbench for the rest of the puzzles, and finds its tab in the menu (Q77)', () => {
    const bench = (words: { touch: boolean; menu: boolean }) => text(shopTourText(STOOL, words), 'bench');
    expect(steps.map((s) => s.id).indexOf('bench')).toBe(steps.length - 2);
    expect(bench({ touch: false, menu: false })).toContain('The Workbench tab has the rest of the basics');
    expect(bench({ touch: true, menu: true })).toContain('The Workbench tab, in the menu, has the rest of the basics');
    expect(bench({ touch: false, menu: false })).toMatch(/each new piece a regular brings opens a ladder/);
    expect(bench({ touch: false, menu: false })).toMatch(/morning report/);
  });

  it('says deleting gives every coin back, and that rows do not', () => {
    const coins = text(steps, 'coins');
    expect(coins).toContain(`${START_COINS} coins`);
    expect(coins).toMatch(/Deleting a piece gives back every coin/);
    expect(coins).toMatch(/rows .* are not given back/i);
  });
});

describe('The keys, and the offers of a tour (Q80)', () => {
  it('a new shop’s keys wait for its lessons, counted out', () => {
    const k = keysText(5);
    expect(k.title).toBe('The keys to the shop');
    expect(k.lines.join(' ')).toMatch(/five lessons at the workbench/);
    expect(k.lines.join(' ')).toMatch(/the keys are yours/);
  });

  it('the shop offers its tour as the keys are handed over, or as a welcome to an older save', () => {
    const keys = offerText('keys', REGULARS[0].name, false);
    expect(keys.title).toBe('The keys are yours');
    expect(keys.lines.join(' ')).toContain('The lamplighter is at the door');
    expect(keys.lines.join(' ')).toContain(`${SHOP_TOUR_STEPS} quick steps`);
    const welcome = offerText('welcome', REGULARS[0].name, true);
    expect(welcome.title).toBe('Welcome to the shop');
    expect(welcome.note).toContain('from the Help tab, in the menu');
    expect(keys.note).not.toContain('in the menu');
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
