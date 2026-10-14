// The keys to the shop (docs/QUESTIONS.md, Q80): a new shop is not the
// player's until they have learned the basics. Its lessons are the hands-on
// rungs of the basics ladder at the workbench, taken in order; once every one
// is solved the keys are handed over and the shop opens for the first time.
// A save from before the lessons was its owner's already.

import { describe, expect, it } from 'vitest';
import { puzzleOpen } from '../../src/game/bench';
import { lessons, nextLesson } from '../../src/game/keys';
import { loadShop, saveShop } from '../../src/game/save';
import { Shop } from '../../src/game/shop';
import { START_COINS } from '../../src/game/tuning';
import { PUZZLES } from '../../src/levels/puzzles';
import { REGULARS } from '../../src/levels/regulars';

const LESSONS = ['basics-water', 'basics-beans', 'basics-cup', 'basics-dark', 'basics-nine'];

const apprentice = () => new Shop({ defs: REGULARS, apprentice: true });
const solve = (shop: Shop, ids: readonly string[]) => {
  shop.bench.solved.push(...ids);
};

describe('The lessons before the keys', () => {
  it('are the five hands-on rungs of the basics, in ladder order', () => {
    expect(lessons(PUZZLES).map((p) => p.id)).toEqual(LESSONS);
    for (const p of lessons(PUZZLES)) expect([p.ladder, p.tier]).toEqual(['basics', 'tutorial']);
  });

  it('come one at a time: the next is the first not yet solved', () => {
    expect(nextLesson(PUZZLES, [])?.id).toBe('basics-water');
    expect(nextLesson(PUZZLES, ['basics-water'])?.id).toBe('basics-beans');
    expect(nextLesson(PUZZLES, LESSONS.slice(0, 4))?.id).toBe('basics-nine');
    expect(nextLesson(PUZZLES, LESSONS)).toBeNull();
    // The brain teaser and the mastery rung come after the keys, from the shop's Workbench tab.
    expect(nextLesson(PUZZLES, [...LESSONS, 'basics-light'])).toBeNull();
  });

  it('are each open in a new shop once the one before is solved', () => {
    const shop = apprentice();
    const unlocked = shop.rights().unlocked;
    LESSONS.forEach((id, k) => {
      expect(puzzleOpen(PUZZLES, id, unlocked, new Set(LESSONS.slice(0, k))), id).toBe(true);
      if (k + 1 < LESSONS.length) expect(puzzleOpen(PUZZLES, LESSONS[k + 1], unlocked, new Set(LESSONS.slice(0, k))), id).toBe(false);
    });
  });
});

describe('An apprentice’s shop', () => {
  it('is a new shop as ever, waiting for its owner: the first regular at the door, the well down, the starting coins', () => {
    const shop = apprentice();
    expect(shop.apprentice).toBe(true);
    expect(shop.regulars.map((r) => r.id)).toEqual(['lamplighter']);
    expect(shop.layout.tiles.some((s) => s?.kind === 'well')).toBe(true);
    expect(shop.till).toBe(START_COINS);
  });

  it('has a lesson due until every lesson is solved', () => {
    const shop = apprentice();
    expect(shop.lessonDue(PUZZLES)?.id).toBe('basics-water');
    solve(shop, LESSONS.slice(0, 3));
    expect(shop.lessonDue(PUZZLES)?.id).toBe('basics-dark');
    solve(shop, LESSONS.slice(3));
    expect(shop.lessonDue(PUZZLES)).toBeNull();
  });

  it('gets its keys only once every lesson is solved, and only once', () => {
    const shop = apprentice();
    solve(shop, LESSONS.slice(0, 4));
    expect(shop.takeKeys(PUZZLES)).toBe(false);
    expect(shop.apprentice).toBe(true);
    solve(shop, LESSONS.slice(4));
    expect(shop.takeKeys(PUZZLES)).toBe(true);
    expect(shop.apprentice).toBe(false);
    expect(shop.takeKeys(PUZZLES)).toBe(false);
  });

  it('is not one unless asked for: a shop made otherwise is its owner’s, with no lesson due', () => {
    const shop = new Shop({ defs: REGULARS });
    expect(shop.apprentice).toBe(false);
    expect(shop.lessonDue(PUZZLES)).toBeNull();
    expect(shop.takeKeys(PUZZLES)).toBe(false);
  });
});

describe('Saving an apprentice’s shop', () => {
  it('keeps that it is one, through JSON', () => {
    const shop = apprentice();
    solve(shop, LESSONS.slice(0, 2));
    const back = loadShop(JSON.parse(JSON.stringify(saveShop(shop, 0))), REGULARS)!.shop;
    expect(back.apprentice).toBe(true);
    expect(back.lessonDue(PUZZLES)?.id).toBe('basics-cup');
    shop.apprentice = false;
    expect(loadShop(JSON.parse(JSON.stringify(saveShop(shop, 0))), REGULARS)!.shop.apprentice).toBe(false);
  });

  it('loads a save from before the lessons as its owner’s', () => {
    const save: Record<string, unknown> = { ...saveShop(new Shop({ defs: REGULARS }), 0) };
    delete save.apprentice;
    const back = loadShop(save, REGULARS)!.shop;
    expect(back.apprentice).toBe(false);
    expect(back.lessonDue(PUZZLES)).toBeNull();
  });

  it('refuses a save whose apprentice field is not a yes or a no', () => {
    expect(loadShop({ ...saveShop(apprentice(), 0), apprentice: 'yes' }, REGULARS)).toBeNull();
  });
});
