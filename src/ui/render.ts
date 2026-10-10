// Gray-box canvas renderer: flat coloured tiles and plain text labels. It
// draws the state as it stands and the events of the last tick (splashes);
// it never works out what happened by comparing states.

import type { Dir, Item, Roast, Structure } from '../sim/types';
import { rowOf, colOf, isCounter, itemGlyph, tileIndex } from '../sim';
import { COLS } from '../sim/tuning';
import type { Shop } from '../game/shop';
import type { Editor, Ghost } from './editor';
import { PAD, SHELF_W, STOOL_H, TILE, type Spot, canvasSize, tileXY } from './geometry';

export interface StoolView {
  col: number;
  label: string;
  present: boolean;
  /** Took a cup on this tick: drawn highlighted. */
  servedNow: boolean;
  status: 'new' | 'seated' | 'waiting';
}

export interface ShelfCupView {
  item: Item;
  age: number;
}

export interface View {
  shop: Shop;
  editor: Editor;
  hover: Spot | null;
  /** Kettle readouts: the tick its input last landed on and the roast that gave. */
  readouts: Map<number, { tick: number; roast: Roast | null }>;
  stools: StoolView[];
  shelf: ShelfCupView[];
  cat: Spot | null;
}

const COLOR = {
  bg: '#f4f1ea',
  floor: '#e6e2d8',
  grid: '#cfc9bc',
  belt: '#bdb7ab',
  arrow: '#6e685d',
  well: '#6fa8dc',
  plot: '#93c47d',
  kettle: '#e69138',
  roaster: '#cc4125',
  mixer: '#8e7cc3',
  door: '#a67c52',
  chute: '#45a5a0',
  bowl: '#e8a0bf',
  counter: '#c9a777',
  counterArrow: '#a88a5e',
  stool: '#7a6a55',
  text: '#222',
  splash: '#d0021b',
  select: '#1f6feb',
  ghostBad: 'rgba(208, 2, 27, 0.35)',
};

const ROAST_COLOR: Record<Roast, string> = { light: '#d9b382', medium: '#8b5a2b', dark: '#3b2314' };

export function itemColor(item: Item): string {
  switch (item.kind) {
    case 'water':
      return '#3d85c6';
    case 'beans':
      return '#7f6000';
    case 'milk':
      return '#ffffff';
    case 'warmMilk':
      return '#fff2cc';
    default:
      return ROAST_COLOR[item.roast];
  }
}

function textOn(bg: string): string {
  const hex = bg.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return r * 0.3 + g * 0.59 + b * 0.11 > 150 ? '#222' : '#fff';
}

const STRUCTURE_COLOR: Record<Structure['kind'], string> = {
  belt: COLOR.belt,
  launch: COLOR.chute,
  catch: COLOR.chute,
  well: COLOR.well,
  plot: COLOR.plot,
  kettle: COLOR.kettle,
  roaster: COLOR.roaster,
  mixer: COLOR.mixer,
  door: COLOR.door,
  bowl: COLOR.bowl,
};

const STRUCTURE_LABEL: Record<Structure['kind'], string> = {
  belt: '',
  launch: 'Lch',
  catch: 'Cat',
  well: 'Well',
  plot: 'Plot',
  kettle: 'Ktl',
  roaster: 'Rst',
  mixer: 'Mix',
  door: 'Door',
  bowl: 'Bowl',
};

function facing(s: Structure): Dir | null {
  if ('dir' in s) return s.dir;
  if ('out' in s) return s.out;
  if (s.kind === 'door') return 'E';
  return null;
}

/** A triangle pointing `d`, centred in the tile at (x, y). */
function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, d: Dir, size: number, color: string): void {
  const cx = x + TILE / 2;
  const cy = y + TILE / 2;
  const pts: [number, number][] = [
    [0, -size],
    [size * 0.8, size * 0.6],
    [-size * 0.8, size * 0.6],
  ];
  const angle = { N: 0, E: Math.PI / 2, S: Math.PI, W: -Math.PI / 2 }[d];
  ctx.fillStyle = color;
  ctx.beginPath();
  pts.forEach(([px, py], i) => {
    const rx = px * Math.cos(angle) - py * Math.sin(angle);
    const ry = px * Math.sin(angle) + py * Math.cos(angle);
    if (i === 0) ctx.moveTo(cx + rx, cy + ry);
    else ctx.lineTo(cx + rx, cy + ry);
  });
  ctx.closePath();
  ctx.fill();
}

/** A small notch on the edge a machine puts out on. */
function outputNotch(ctx: CanvasRenderingContext2D, x: number, y: number, d: Dir): void {
  ctx.fillStyle = '#222';
  const n = 8;
  const m = TILE / 2 - n / 2;
  if (d === 'N') ctx.fillRect(x + m, y, n, 4);
  if (d === 'S') ctx.fillRect(x + m, y + TILE - 4, n, 4);
  if (d === 'E') ctx.fillRect(x + TILE - 4, y + m, 4, n);
  if (d === 'W') ctx.fillRect(x, y + m, 4, n);
}

function drawStructure(ctx: CanvasRenderingContext2D, x: number, y: number, s: Structure): void {
  const color = STRUCTURE_COLOR[s.kind];
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
  const d = facing(s);
  if (s.kind === 'belt' || s.kind === 'launch' || s.kind === 'catch') {
    if (d) arrow(ctx, x, y, d, s.kind === 'belt' ? 9 : 7, COLOR.arrow);
  } else if (d) {
    outputNotch(ctx, x, y, d);
  }
  const label = STRUCTURE_LABEL[s.kind];
  if (label) {
    ctx.fillStyle = textOn(color);
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x + 4, y + 4);
  }
}

export function drawItem(ctx: CanvasRenderingContext2D, x: number, y: number, item: Item, r = 11): void {
  const cx = x + TILE / 2;
  const cy = y + TILE / 2;
  const color = itemColor(item);
  ctx.fillStyle = color;
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.beginPath();
  // Drinks are round; ingredients are square.
  const drink = ['coffee', 'espresso', 'warmMilk', 'auLait', 'latte'].includes(item.kind);
  if (drink) ctx.arc(cx, cy, r, 0, Math.PI * 2);
  else ctx.rect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = textOn(color);
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(itemGlyph(item), cx, cy + 1);
}

function smallText(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color = '#222'): void {
  ctx.fillStyle = color;
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(text, x + TILE - 4, y + TILE - 3);
}

/** Pixel of any simulator tile index, back room or counter. */
function indexXY(view: View, index: number): { x: number; y: number } {
  const layout = view.shop.layout;
  if (isCounter(layout, index)) return tileXY(layout.rows, -1, index - layout.rows * COLS);
  return tileXY(layout.rows, rowOf(index), colOf(index));
}

export function draw(ctx: CanvasRenderingContext2D, view: View): void {
  const { shop, editor } = view;
  const { layout, sim } = shop;
  const rows = layout.rows;
  const size = canvasSize(rows);
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, size.w, size.h);

  // Back room.
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < COLS; col++) {
      const { x, y } = tileXY(rows, row, col);
      ctx.fillStyle = COLOR.floor;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = COLOR.grid;
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      const i = tileIndex(row, col);
      const s = layout.tiles[i];
      if (!s) continue;
      drawStructure(ctx, x, y, s);
      const plot = sim.plots[i];
      if (s.kind === 'plot' && plot) smallText(ctx, x, y, `grow ${plot.harvestAt - sim.T}`);
      const roast = sim.roasting[i];
      if (s.kind === 'roaster' && roast) smallText(ctx, x, y, `in ${sim.T - roast.since}`, '#fff');
      const ro = view.readouts.get(i);
      if (s.kind === 'kettle' && ro) smallText(ctx, x, y, `t${ro.tick}${ro.roast ? ' ' + ro.roast[0].toUpperCase() : ''}`);
      const pend = sim.pending[i];
      if (pend) {
        ctx.save();
        ctx.translate(x + TILE * 0.25, y - TILE * 0.05);
        drawItem(ctx, 0, 0, pend.item, 7);
        ctx.restore();
      }
    }
  }
  // Chute spans: a dashed line from launch to catch.
  for (let i = 0; i < layout.tiles.length; i++) {
    const s = layout.tiles[i];
    if (s?.kind !== 'launch') continue;
    const a = tileXY(rows, rowOf(i), colOf(i));
    const dr = s.dir === 'N' ? 2 : s.dir === 'S' ? -2 : 0;
    const dc = s.dir === 'E' ? 2 : s.dir === 'W' ? -2 : 0;
    const b = tileXY(rows, rowOf(i) + dr, colOf(i) + dc);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = COLOR.chute;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a.x + TILE / 2, a.y + TILE / 2);
    ctx.lineTo(b.x + TILE / 2, b.y + TILE / 2);
    ctx.stroke();
    ctx.restore();
  }

  // Counter.
  for (let col = 0; col < COLS; col++) {
    const { x, y } = tileXY(rows, -1, col);
    ctx.fillStyle = COLOR.counter;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = COLOR.counterArrow;
    ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    arrow(ctx, x, y, 'E', 6, COLOR.counterArrow);
  }
  ctx.fillStyle = COLOR.text;
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const counterY = tileXY(rows, -1, 0).y;

  // Items on belts and the counter.
  sim.belts.forEach((item, i) => {
    if (!item) return;
    const { x, y } = indexXY(view, i);
    drawItem(ctx, x, y, item);
  });

  // Shelf, at the end of the counter belt.
  const shelfX = PAD + COLS * TILE + 6;
  ctx.fillStyle = '#ddd5c4';
  ctx.fillRect(shelfX, counterY, SHELF_W - 6, TILE);
  ctx.fillStyle = COLOR.text;
  ctx.fillText('Shelf', shelfX + 2, counterY - 12);
  view.shelf.forEach((cup, k) => {
    ctx.save();
    ctx.translate(shelfX - TILE / 2 + 15 + k * 28, counterY);
    drawItem(ctx, 0, 0, cup.item, 10);
    ctx.restore();
    ctx.fillStyle = COLOR.text;
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(cup.age), shelfX + 15 + k * 28, counterY + TILE - 11);
    ctx.textAlign = 'left';
    ctx.font = '10px sans-serif';
  });

  // Stools and regulars.
  const stoolY = counterY + TILE + 4;
  for (const st of view.stools) {
    const x = PAD + st.col * TILE;
    ctx.fillStyle = COLOR.stool;
    ctx.fillRect(x + TILE / 2 - 10, stoolY + STOOL_H - 10, 20, 6);
    if (st.present) {
      ctx.fillStyle = st.servedNow ? '#2e9e44' : st.status === 'waiting' ? '#999' : '#4a6fa5';
      ctx.beginPath();
      ctx.arc(x + TILE / 2, stoolY + 14, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(st.label, x + TILE / 2, stoolY + 15);
    } else {
      ctx.strokeStyle = '#aaa';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(x + TILE / 2, stoolY + 14, 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // The cat: a plain marker.
  if (view.cat && view.cat.row < rows) {
    const { x, y } = tileXY(rows, view.cat.row, view.cat.col);
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.moveTo(x + TILE - 16, y + 6);
    ctx.lineTo(x + TILE - 4, y + 6);
    ctx.lineTo(x + TILE - 10, y + 16);
    ctx.closePath();
    ctx.fill();
  }

  // Splashes for this tick's spills.
  for (const e of shop.lastEvents) {
    if (e.type !== 'spill') continue;
    const { x, y } = indexXY(view, e.at);
    ctx.strokeStyle = COLOR.splash;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 10);
    ctx.lineTo(x + TILE - 10, y + TILE - 10);
    ctx.moveTo(x + TILE - 10, y + 10);
    ctx.lineTo(x + 10, y + TILE - 10);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  // Selection box.
  const sel = editor.selection;
  if (sel) {
    const a = tileXY(rows, sel.r1, sel.c0);
    const w = (sel.c1 - sel.c0 + 1) * TILE;
    const h = (sel.r1 - sel.r0 + 1) * TILE;
    ctx.save();
    ctx.strokeStyle = COLOR.select;
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.strokeRect(a.x + 1, a.y + 1, w - 2, h - 2);
    ctx.fillStyle = 'rgba(31, 111, 235, 0.08)';
    ctx.fillRect(a.x, a.y, w, h);
    ctx.restore();
  }

  // Hover and the ghost of whatever is in hand.
  if (view.hover) {
    const ghost: Ghost | null = view.hover.row >= 0 ? editor.ghost(view.hover.row, view.hover.col) : null;
    if (ghost) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      for (const ch of ghost.changes) {
        if (!ch.to) continue;
        const { x, y } = indexXY(view, ch.index);
        drawStructure(ctx, x, y, ch.to);
        if (ghost.reason) {
          ctx.fillStyle = COLOR.ghostBad;
          ctx.fillRect(x, y, TILE, TILE);
        }
      }
      ctx.restore();
    }
    const { x, y } = tileXY(rows, view.hover.row, view.hover.col);
    ctx.strokeStyle = ghost?.reason ? COLOR.splash : '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    ctx.lineWidth = 1;
    if (ghost?.reason) {
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      const tw = ctx.measureText(ghost.reason).width;
      const tx = Math.min(x, PAD + COLS * TILE - tw - 8);
      const ty = y < 24 ? y + TILE + 16 : y; // below the tile when there is no room above
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(tx, ty - 16, tw + 8, 15);
      ctx.fillStyle = COLOR.splash;
      ctx.fillText(ghost.reason, tx + 4, ty - 3);
    }
  }
}

