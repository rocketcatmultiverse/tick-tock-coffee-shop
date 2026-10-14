// The cheer for a lesson solved before the keys (docs/QUESTIONS.md, Q81):
// gold rings and sparkles burst from the tray, the bench's edge lights gold,
// a "Solved!" banner pops in over the bench saying what comes next, and the
// night falls over the floor before the next lesson opens. Only the lessons
// have it; any other puzzle solved just says so.
//
// The frames are worked out here from the time since the cheer began, so the
// tests can read them; render.ts draws them. With reduced motion nothing flies
// or grows: the banner is simply there, and the night still falls at the end.

/** The whole cheer, in milliseconds; then the next lesson opens. */
export const CHEER_MS = 2200;
/** Each ring's spread, and the second ring's delay after the first. */
const RING_MS = 900;
const RING_GAP_MS = 180;
/** The sparkles' flight. */
const SPARK_MS = 1300;
const SPARKS = 16;
/** The banner pops in after a beat. */
const POP_AT_MS = 150;
const POP_MS = 450;
/** The edge lights up this fast. */
const GLOW_MS = 200;
/** The night falls over the last of it. */
const FADE_MS = 350;

/** One frame of the cheer. Distances and sizes are in tiles, from the tray's middle. */
export interface CheerFrame {
  /** Gold rings spreading from the tray. */
  rings: { r: number; alpha: number }[];
  /** Sparkles flying out from the tray, each in one of three colours. */
  sparks: { dx: number; dy: number; size: number; alpha: number; hue: 0 | 1 | 2 }[];
  /** The bench's edge lit gold. */
  glow: number;
  /** The banner. */
  banner: { scale: number; alpha: number };
  /** The night falling over the floor. */
  fade: number;
  done: boolean;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOut = (p: number) => 1 - (1 - p) ** 3;
/** Overshoots a little, then settles at 1. */
const easeOutBack = (p: number) => 1 + 2.2 * (p - 1) ** 3 + 1.2 * (p - 1) ** 2;

export function cheerFrame(ms: number, reduced = false): CheerFrame {
  const fade = clamp01((ms - (CHEER_MS - FADE_MS)) / FADE_MS);
  const done = ms >= CHEER_MS;
  const glow = reduced ? 1 : clamp01(ms / GLOW_MS);
  if (reduced) return { rings: [], sparks: [], glow, banner: { scale: 1, alpha: 1 }, fade, done };
  const rings = [0, 1].map((k) => {
    const p = clamp01((ms - k * RING_GAP_MS) / RING_MS);
    return { r: 0.5 + 3 * easeOut(p), alpha: p > 0 && p < 1 ? 0.9 * (1 - p) : 0 };
  });
  const p = clamp01(ms / SPARK_MS);
  const sparks = Array.from({ length: SPARKS }, (_, k) => {
    const angle = (2 * Math.PI * k) / SPARKS + (k % 2) * 0.2;
    const reach = (1.2 + (k % 3) * 0.6) * easeOut(p);
    return {
      dx: Math.cos(angle) * reach,
      // They drift down a little as they slow.
      dy: Math.sin(angle) * reach + 0.5 * p * p,
      size: 0.2 * (1 - 0.5 * p),
      alpha: p >= 1 ? 0 : p < 0.6 ? 1 : (1 - p) / 0.4,
      hue: (k % 3) as 0 | 1 | 2,
    };
  });
  const pop = clamp01((ms - POP_AT_MS) / POP_MS);
  return { rings, sparks, glow, banner: { scale: 0.6 + 0.4 * easeOutBack(pop), alpha: clamp01(pop * 2) }, fade, done };
}
