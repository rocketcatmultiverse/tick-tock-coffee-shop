// The build palette in pages (docs/QUESTIONS.md, Q71): as many pieces as fit
// on a page, with arrows either side once they do not all fit.

import { describe, expect, it } from 'vitest';
import { pageCount, paletteFit } from '../../src/ui/palette';

const PIECE = 60;
const GAP = 6;
const ARROW = 28;

describe('Palette pages', () => {
  it('all ten pieces on one page, with no arrows, when they fit', () => {
    const w = 10 * PIECE + 9 * GAP;
    expect(paletteFit(10, w, PIECE, PIECE, GAP, ARROW, false)).toEqual({ perPage: 10, arrows: false });
  });

  it('one pixel short of room: arrows, and as many pieces as fit beside them', () => {
    const w = 10 * PIECE + 9 * GAP - 1;
    const fit = paletteFit(10, w, PIECE, PIECE, GAP, ARROW, false);
    expect(fit.arrows).toBe(true);
    // The arrows and their gaps take 68 pixels, which leaves room for 8 pieces.
    expect(fit.perPage).toBe(8);
    expect(pageCount(10, fit.perPage)).toBe(2);
  });

  it('a phone held upright: four a page, three pages', () => {
    const fit = paletteFit(10, 343, 58, 58, GAP, 26, false);
    expect(fit).toEqual({ perPage: 4, arrows: true });
    expect(pageCount(10, fit.perPage)).toBe(3);
  });

  it('fills as many rows as the height takes when asked', () => {
    expect(paletteFit(10, 260, 130, 54, GAP, 24, true)).toEqual({ perPage: 6, arrows: true });
    expect(paletteFit(10, 260, 250, 54, GAP, 24, true)).toEqual({ perPage: 10, arrows: false });
    // One row only, whatever the height, when not asked.
    expect(paletteFit(10, 260, 250, 54, GAP, 24, false).perPage).toBe(3);
  });

  it('always at least one piece a page', () => {
    expect(paletteFit(10, 10, 10, PIECE, GAP, ARROW, false).perPage).toBe(1);
    expect(pageCount(10, 1)).toBe(10);
    expect(pageCount(0, 4)).toBe(1);
  });
});
