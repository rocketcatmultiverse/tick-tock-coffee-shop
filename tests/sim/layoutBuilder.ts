// Builds a real single bean line from the timing-equation parameters, for the
// property test. The line zig-zags up from the counter inside two adjacent
// columns, so it has turns as well as straight runs.

import { emptyLayout, tileIndex } from '../../src/sim/grid';
import type { Dir, Layout, Structure } from '../../src/sim/types';

export interface LineSpec {
  b1: number;
  b2: number;
  b3: number;
  c: number;
}

/** Small seeded generator for tests only (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildLine(spec: LineSpec, rand: () => number): Layout {
  const { b1, b2, b3, c } = spec;
  // Pieces in flow order: well, b1 belts, plot, b2 belts, kettle, b3 belts.
  const kinds: ('well' | 'belt' | 'plot' | 'kettle')[] = [
    'well',
    ...Array<'belt'>(b1).fill('belt'),
    'plot',
    ...Array<'belt'>(b2).fill('belt'),
    'kettle',
    ...Array<'belt'>(b3).fill('belt'),
  ];
  const n = kinds.length;
  const other = c < 11 ? c + 1 : c - 1;
  // Walk backwards from the tile above column c. Each step goes north or
  // sideways to the other column; the well's step is always north so that its
  // spare sides touch nothing.
  const pos: { r: number; c: number }[] = new Array(n);
  pos[n - 1] = { r: 0, c };
  let lastSide = false;
  for (let k = n - 2; k >= 0; k--) {
    const p = pos[k + 1];
    const side: boolean = k > 0 && !lastSide && rand() < 0.5;
    pos[k] = side ? { r: p.r, c: p.c === c ? other : c } : { r: p.r + 1, c: p.c };
    lastSide = side;
  }
  const rows = pos[0].r + 1;
  const layout = emptyLayout(rows);
  const dirTo = (a: { r: number; c: number }, b: { r: number; c: number }): Dir =>
    b.r > a.r ? 'N' : b.r < a.r ? 'S' : b.c > a.c ? 'E' : 'W';
  for (let k = 0; k < n; k++) {
    const d: Dir = k === n - 1 ? 'S' : dirTo(pos[k], pos[k + 1]);
    let s: Structure;
    switch (kinds[k]) {
      case 'well':
        s = { kind: 'well' };
        break;
      case 'belt':
        s = { kind: 'belt', dir: d };
        break;
      case 'plot':
        s = { kind: 'plot', out: d };
        break;
      case 'kettle':
        s = { kind: 'kettle', out: d };
        break;
    }
    layout.tiles[tileIndex(pos[k].r, pos[k].c)] = s;
  }
  return layout;
}
