// Builds a real single bean line from the timing-equation parameters, for the
// property test. The line joins the feeder from the east at a chosen row and
// zig-zags up from there inside columns 2 and 3, so it has turns as well as
// straight runs. Any belt in a run may be a spring instead.

import { emptyLayout, tileIndex } from '../../src/sim/grid';
import type { Dir, Layout, Structure } from '../../src/sim/types';

/** One run of belt-shaped tiles: `belts` plain belts and `springs` springs, in a random order. */
export interface Run {
  belts: number;
  springs: number;
}

export interface LineSpec {
  b1: Run;
  b2: Run;
  /** Tiles between the kettle and the feeder; the feeder tiles ridden come from the join row. */
  b3: Run;
  /** The feeder row the line joins. */
  row: number;
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

type Kind = 'well' | 'belt' | 'spring' | 'plot' | 'kettle';

function shuffled(run: Run, rand: () => number): Kind[] {
  const out: Kind[] = [...Array<Kind>(run.belts).fill('belt'), ...Array<Kind>(run.springs).fill('spring')];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildLine(spec: LineSpec, rand: () => number): Layout {
  const kinds: Kind[] = [
    'well',
    ...shuffled(spec.b1, rand),
    'plot',
    ...shuffled(spec.b2, rand),
    'kettle',
    ...shuffled(spec.b3, rand),
  ];
  const n = kinds.length;
  // Walk backwards from the tile east of the feeder. The piece before it sits
  // east of it; after that each step goes north, or sideways between columns
  // 2 and 3. The well's step is always north, so its spare sides touch nothing.
  const pos: { r: number; c: number }[] = new Array(n);
  pos[n - 1] = { r: spec.row, c: 1 };
  pos[n - 2] = { r: spec.row, c: 2 };
  let lastSide = true;
  for (let k = n - 3; k >= 0; k--) {
    const p = pos[k + 1];
    const side: boolean = k > 0 && !lastSide && rand() < 0.5;
    pos[k] = side ? { r: p.r, c: p.c === 2 ? 3 : 2 } : { r: p.r + 1, c: p.c };
    lastSide = side;
  }
  const rows = pos[0].r + 1;
  const layout = emptyLayout(rows);
  for (let r = 0; r < rows; r++) layout.tiles[tileIndex(r, 0)] = { kind: 'feeder' };
  const dirTo = (a: { r: number; c: number }, b: { r: number; c: number }): Dir =>
    b.r > a.r ? 'N' : b.r < a.r ? 'S' : b.c > a.c ? 'E' : 'W';
  for (let k = 0; k < n; k++) {
    const d: Dir = k === n - 1 ? 'W' : dirTo(pos[k], pos[k + 1]);
    let s: Structure;
    switch (kinds[k]) {
      case 'well':
        s = { kind: 'well' };
        break;
      case 'belt':
        s = { kind: 'belt', dir: d };
        break;
      case 'spring':
        s = { kind: 'spring', dir: d };
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
