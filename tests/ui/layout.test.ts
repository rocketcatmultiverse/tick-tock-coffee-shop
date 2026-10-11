// Where the panels go, by the size of the window (docs/QUESTIONS.md, Q71):
// the side column on a desktop monitor, the controls under the floor on a
// phone held upright, and beside it on a phone on its side or in a short window.

import { describe, expect, it } from 'vitest';
import { FLAT_RATIO, WIDE_MIN_HEIGHT, WIDE_MIN_WIDTH, layoutFor } from '../../src/ui/layout';

describe('Layout', () => {
  it('desktop windows keep the side column', () => {
    for (const [w, h] of [
      [1920, 970],
      [1366, 650],
      [1280, 600],
      [1024, 700],
      [960, 1040],
    ])
      expect(layoutFor(w, h), `${w} by ${h}`).toBe('wide');
  });

  it('a phone held upright, a tablet held upright and a narrow window go tall', () => {
    for (const [w, h] of [
      [375, 667],
      [390, 750],
      [360, 560],
      [768, 1024],
      [700, 900],
    ])
      expect(layoutFor(w, h), `${w} by ${h}`).toBe('tall');
  });

  it('a phone on its side, and a small or short window, go flat', () => {
    for (const [w, h] of [
      [844, 390],
      [667, 340],
      [800, 600],
      [1400, 500],
    ])
      expect(layoutFor(w, h), `${w} by ${h}`).toBe('flat');
  });

  it('the edges', () => {
    expect(layoutFor(WIDE_MIN_WIDTH, WIDE_MIN_HEIGHT)).toBe('wide');
    expect(layoutFor(WIDE_MIN_WIDTH - 1, WIDE_MIN_HEIGHT)).not.toBe('wide');
    expect(layoutFor(WIDE_MIN_WIDTH, WIDE_MIN_HEIGHT - 1)).not.toBe('wide');
    expect(layoutFor(600 * FLAT_RATIO, 600)).toBe('flat');
    expect(layoutFor(600 * FLAT_RATIO - 1, 600)).toBe('tall');
  });
});
