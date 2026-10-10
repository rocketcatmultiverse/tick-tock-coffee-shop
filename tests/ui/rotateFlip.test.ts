import { describe, expect, it } from 'vitest';
import { flip, normalize, rotate, type Entry } from '../../src/ui/buffer';
import { seeded } from '../sim/layoutBuilder';
import type { Dir, Structure } from '../../src/sim/types';

const DIRS: Dir[] = ['N', 'E', 'S', 'W'];

function randomEntry(rand: () => number): Entry {
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const cells = new Map<string, Entry['cells'][number]>();
  const n = 1 + Math.floor(rand() * 8);
  for (let k = 0; k < n; k++) {
    const dc = Math.floor(rand() * 5);
    const dr = Math.floor(rand() * 4);
    const d = pick(DIRS);
    const s: Structure = pick<Structure>([
      { kind: 'belt', dir: d },
      { kind: 'plot', out: d },
      { kind: 'kettle', out: d },
      { kind: 'roaster', out: d },
      { kind: 'mixer', out: d },
      { kind: 'well' },
      { kind: 'launch', dir: d },
    ]);
    cells.set(`${dc},${dr}`, { dc, dr, s });
  }
  return normalize({ cells: [...cells.values()] });
}

describe('Rotate and flip', () => {
  it('four quarter turns give back the original', () => {
    const rand = seeded(7);
    for (let k = 0; k < 200; k++) {
      const e = randomEntry(rand);
      expect(rotate(rotate(rotate(rotate(e))))).toEqual(e);
    }
  });

  it('two flips give back the original', () => {
    const rand = seeded(8);
    for (let k = 0; k < 200; k++) {
      const e = randomEntry(rand);
      expect(flip(flip(e))).toEqual(e);
    }
  });

  it('a quarter turn moves north to east, and turns each piece with it', () => {
    // A belt with a plot north of it, both facing north.
    const e: Entry = normalize({
      cells: [
        { dc: 0, dr: 0, s: { kind: 'belt', dir: 'N' } },
        { dc: 0, dr: 1, s: { kind: 'plot', out: 'N' } },
      ],
    });
    expect(rotate(e)).toEqual({
      cells: [
        { dc: 0, dr: 0, s: { kind: 'belt', dir: 'E' } },
        { dc: 1, dr: 0, s: { kind: 'plot', out: 'E' } },
      ],
    });
  });

  it('a flip mirrors positions and east-west facings', () => {
    const e: Entry = normalize({
      cells: [
        { dc: 0, dr: 0, s: { kind: 'belt', dir: 'E' } },
        { dc: 1, dr: 0, s: { kind: 'kettle', out: 'S' } },
      ],
    });
    expect(flip(e)).toEqual({
      cells: [
        { dc: 0, dr: 0, s: { kind: 'kettle', out: 'S' } },
        { dc: 1, dr: 0, s: { kind: 'belt', dir: 'W' } },
      ],
    });
  });
});
