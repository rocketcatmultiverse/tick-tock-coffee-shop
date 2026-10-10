/** Seeded generator (mulberry32). Its whole state is one number, so it can be saved. */
export interface Rng {
  state: number;
}

export function makeRng(seed: number): Rng {
  return { state: seed >>> 0 };
}

/** Next number in [0, 1). Advances `rng` in place. */
export function nextRandom(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
