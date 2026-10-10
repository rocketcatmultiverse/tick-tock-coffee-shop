// Text layouts and the debugging renderer. One token per tile, rows written
// north (top) to south (row 0, next to the counter).
//
//   .   empty          > < ^ v   belt E W N S
//   W   well           Px  plot facing x       Kx  kettle facing x
//   D   back door      Rx  roaster facing x    Mx  mixer facing x
//   B   cat's bowl     Lx  chute launch        Cx  chute catch
//
// where x is one of > < ^ v.

import type { Dir, Layout, SimState, Structure } from './types';
import { clockTick, counterIndex, tileIndex } from './grid';
import { COLS } from './tuning';
import { itemGlyph } from './items';

const ARROW_TO_DIR: Record<string, Dir> = { '^': 'N', '>': 'E', v: 'S', '<': 'W' };
const DIR_TO_ARROW: Record<Dir, string> = { N: '^', E: '>', S: 'v', W: '<' };

export function parseToken(token: string): Structure | null {
  if (token === '.') return null;
  if (token in ARROW_TO_DIR) return { kind: 'belt', dir: ARROW_TO_DIR[token] };
  if (token === 'W') return { kind: 'well' };
  if (token === 'D') return { kind: 'door' };
  if (token === 'B') return { kind: 'bowl' };
  const head = token[0];
  const d = ARROW_TO_DIR[token.slice(1)];
  if (token.length === 2 && d) {
    switch (head) {
      case 'P':
        return { kind: 'plot', out: d };
      case 'K':
        return { kind: 'kettle', out: d };
      case 'R':
        return { kind: 'roaster', out: d };
      case 'M':
        return { kind: 'mixer', out: d };
      case 'L':
        return { kind: 'launch', dir: d };
      case 'C':
        return { kind: 'catch', dir: d };
    }
  }
  throw new Error(`Unknown layout token "${token}"`);
}

export function structureToken(s: Structure | null): string {
  if (s === null) return '.';
  switch (s.kind) {
    case 'belt':
      return DIR_TO_ARROW[s.dir];
    case 'well':
      return 'W';
    case 'door':
      return 'D';
    case 'bowl':
      return 'B';
    case 'plot':
      return 'P' + DIR_TO_ARROW[s.out];
    case 'kettle':
      return 'K' + DIR_TO_ARROW[s.out];
    case 'roaster':
      return 'R' + DIR_TO_ARROW[s.out];
    case 'mixer':
      return 'M' + DIR_TO_ARROW[s.out];
    case 'launch':
      return 'L' + DIR_TO_ARROW[s.dir];
    case 'catch':
      return 'C' + DIR_TO_ARROW[s.dir];
  }
}

/** Parse a text layout. The first line is the northernmost row. */
export function parseLayout(lines: readonly string[]): Layout {
  const rows = lines.length;
  const tiles: (Structure | null)[] = new Array(rows * COLS).fill(null);
  lines.forEach((line, i) => {
    const tokens = line.trim().split(/\s+/);
    if (tokens.length !== COLS) {
      throw new Error(`Layout line ${i} has ${tokens.length} tokens, expected ${COLS}: "${line}"`);
    }
    const row = rows - 1 - i;
    tokens.forEach((tok, col) => {
      tiles[tileIndex(row, col)] = parseToken(tok);
    });
  });
  return { cols: 12, rows, tiles };
}

export function layoutToText(layout: Layout): string[] {
  const out: string[] = [];
  for (let row = layout.rows - 1; row >= 0; row--) {
    const toks: string[] = [];
    for (let col = 0; col < COLS; col++) toks.push(structureToken(layout.tiles[tileIndex(row, col)]));
    out.push(toks.map((t) => t.padEnd(2)).join(' ').trimEnd());
  }
  return out;
}

/**
 * Print a state as a grid of characters: each tile is its structure token and
 * then what it holds (an item, ticks left to harvest, or a roaster's batch age).
 */
export function renderFloor(layout: Layout, state: SimState): string {
  const lines: string[] = [];
  lines.push(`T=${state.T}  t=${clockTick(state.T)}`);
  for (let row = layout.rows - 1; row >= 0; row--) {
    const cells: string[] = [];
    for (let col = 0; col < COLS; col++) {
      const i = tileIndex(row, col);
      const s = layout.tiles[i];
      let content = '';
      const item = state.belts[i];
      if (item) content = itemGlyph(item);
      const plot = state.plots[i];
      if (plot) content = 'g' + (plot.harvestAt - state.T);
      const pend = state.pending[i];
      if (pend) content = itemGlyph(pend.item);
      const roast = state.roasting[i];
      if (roast) content = 'r' + (state.T - roast.since);
      cells.push(structureToken(s).padEnd(2) + content.padEnd(3));
    }
    lines.push(String(row).padStart(2) + ' |' + cells.join('') + '|');
  }
  const counter: string[] = [];
  for (let col = 0; col < COLS; col++) {
    const item = state.belts[counterIndex(layout, col)];
    counter.push('=' + (item ? itemGlyph(item) : '').padEnd(2) + '==');
  }
  lines.push(' c |' + counter.join('') + '|');
  lines.push('    ' + Array.from({ length: COLS }, (_, c) => String(c).padEnd(5)).join(''));
  return lines.join('\n');
}
