// A lesson solved before the keys is cheered on the bench, then the next
// lesson opens (docs/QUESTIONS.md, Q81). The cheer's frames are worked out
// from the time since it began, so they can be checked without a canvas.

import { describe, expect, it } from 'vitest';
import { CHEER_MS, cheerFrame } from '../../src/ui/celebrate';

const each = (step: number, f: (ms: number) => void) => {
  for (let ms = 0; ms <= CHEER_MS; ms += step) f(ms);
};

describe('The cheer for a solved lesson', () => {
  it('starts quiet and lasts a moment, not long enough to wait on', () => {
    const f = cheerFrame(0);
    expect(f.banner.alpha).toBe(0);
    expect(f.fade).toBe(0);
    expect(f.done).toBe(false);
    expect(CHEER_MS).toBeGreaterThanOrEqual(1500);
    expect(CHEER_MS).toBeLessThanOrEqual(3000);
  });

  it('lights the bench’s edge gold, and keeps it lit', () => {
    expect(cheerFrame(CHEER_MS / 2).glow).toBe(1);
    each(50, (ms) => expect(cheerFrame(ms).glow).toBeGreaterThanOrEqual(0));
  });

  it('pops the banner in, a touch too big, and settles it at its own size while it is read', () => {
    const scales: number[] = [];
    each(10, (ms) => scales.push(cheerFrame(ms).banner.scale));
    expect(Math.max(...scales)).toBeGreaterThan(1);
    expect(Math.max(...scales)).toBeLessThan(1.25);
    const mid = cheerFrame(CHEER_MS / 2).banner;
    expect(mid.alpha).toBe(1);
    expect(mid.scale).toBeCloseTo(1, 2);
  });

  it('bursts sparkles and rings from the tray that fade out well before the end', () => {
    const early = cheerFrame(300);
    expect(early.sparks.length).toBeGreaterThan(8);
    expect(early.rings.length).toBeGreaterThan(0);
    each(20, (ms) => {
      for (const s of cheerFrame(ms).sparks) {
        expect(Math.hypot(s.dx, s.dy), String(ms)).toBeLessThanOrEqual(4);
        expect(s.alpha).toBeGreaterThanOrEqual(0);
        expect(s.alpha).toBeLessThanOrEqual(1);
      }
    });
    const late = cheerFrame(CHEER_MS - 400);
    expect(late.sparks.every((s) => s.alpha === 0)).toBe(true);
    expect(late.rings.every((r) => r.alpha === 0)).toBe(true);
  });

  it('ends with the night falling over the bench, done, for the next lesson to open', () => {
    expect(cheerFrame(CHEER_MS - 1).done).toBe(false);
    const end = cheerFrame(CHEER_MS);
    expect(end.fade).toBe(1);
    expect(end.done).toBe(true);
    // The night only deepens.
    let last = 0;
    each(10, (ms) => {
      const { fade } = cheerFrame(ms);
      expect(fade).toBeGreaterThanOrEqual(last);
      last = fade;
    });
  });

  it('with reduced motion, has nothing fly or grow: the banner is there at its own size from the start', () => {
    each(20, (ms) => {
      const f = cheerFrame(ms, true);
      expect(f.sparks).toEqual([]);
      expect(f.rings).toEqual([]);
      expect(f.banner).toEqual({ scale: 1, alpha: 1 });
    });
    expect(cheerFrame(CHEER_MS, true).done).toBe(true);
  });
});
