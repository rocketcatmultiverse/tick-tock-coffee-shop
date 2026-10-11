import { describe, expect, it } from 'vitest';
import { ALL_PIECES } from '../../src/game/pieces';
import { PIECE_RULES, tickRange } from '../../src/ui/tips';

describe('Tooltips', () => {
  it('every palette piece has its rules, with every number filled in', () => {
    for (const piece of ALL_PIECES) {
      expect(PIECE_RULES[piece].length, piece).toBeGreaterThan(0);
      for (const line of PIECE_RULES[piece]) expect(line, piece).not.toMatch(/undefined|NaN|\$\{/);
    }
  });

  it('the kettle and the roaster name the ticks each roast lands on', () => {
    // Read past the characters that keep each range on one line.
    const plain = (lines: string[]) => lines.join(' ').replace(/\u2060/g, '').replace(/\u00a0/g, ' ');
    expect(plain(PIECE_RULES.kettle)).toContain('0–3 light, 4–7 medium, 8–11 dark');
    expect(plain(PIECE_RULES.roaster)).toContain('2–5 light, 10–1 medium, 6–9 dark');
  });

  it('writes ticks as runs round the clock', () => {
    expect(tickRange([0, 1, 2, 3])).toBe('0–3');
    expect(tickRange([0, 1, 10, 11])).toBe('10–1');
    expect(tickRange([5])).toBe('5');
    expect(tickRange([2, 3, 6])).toBe('2–3, 6');
  });
});
