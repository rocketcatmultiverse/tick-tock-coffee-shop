// The floor renderer: sprites from the visuals canvas (src/ui/art/) on a
// Canvas 2D. It draws the state as it stands and the events of the last tick
// (splashes); it never works out what happened by comparing states.

import type { Roast, Structure } from '../sim/types';
import { clockTick, colOf, feederSlot, isCounter, rowOf, slotOf, tileIndex } from '../sim';
import { COLS, GROWTH } from '../sim/tuning';
import type { Shop } from '../game/shop';
import type { Editor, Ghost } from './editor';
import { PAD, STOOL_H, TILE, WOOD_H, type Spot, canvasSize, tileXY } from './geometry';
import { PAL, type PlotStage, type TileLook, itemKey, splashKey, spriteBody, structureKey } from './art/svg';
import { portraitBody } from './art/portraits';
import type { SpriteBank } from './art/raster';

export interface StoolView {
  col: number;
  /** Regular id, which names their portrait. */
  id: string;
  /** The slot this regular wants, or "any" and the slot an any-tick regular last took from. */
  slot: string;
  present: boolean;
  /** Took a cup on this tick: drawn highlighted. */
  servedNow: boolean;
  status: 'new' | 'seated' | 'waiting';
}

export interface View {
  shop: Shop;
  editor: Editor;
  hover: Spot | null;
  /** Kettle readouts: the tick its input last landed on and the roast that gave. */
  readouts: Map<number, { tick: number; roast: Roast | null }>;
  stools: StoolView[];
  cat: { spot: Spot; heart: boolean; mad: boolean } | null;
  sprites: SpriteBank;
  /** Device pixels per CSS pixel; sprites are rasterised at this density. */
  dpr: number;
}

const BODY_FONT = "'Patrick Hand', 'Comic Sans MS', cursive";

/** Draw a 60-unit floor sprite into a square of `size` CSS pixels at (x, y). */
function blit(ctx: CanvasRenderingContext2D, view: View, key: string, x: number, y: number, size = TILE): void {
  const px = Math.round(size * view.dpr);
  const img = view.sprites.get(key, px, px, () => ({ body: spriteBody(key), viewBox: 60 }));
  if (img) ctx.drawImage(img, x, y, size, size);
}

/** A regular's round portrait, `size` CSS pixels across. */
export function drawPortrait(ctx: CanvasRenderingContext2D, view: View, id: string, x: number, y: number, size: number): void {
  const px = Math.round(size * view.dpr);
  const img = view.sprites.get(`portrait:${id}`, px, px, () => ({ body: portraitBody(id), viewBox: 160, seed: 23 }));
  if (img) ctx.drawImage(img, x, y, size, size);
}

function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  opts: { size?: number; color?: string; align?: CanvasTextAlign; base?: CanvasTextBaseline; font?: string } = {},
): void {
  ctx.font = `${opts.size ?? 13}px ${opts.font ?? BODY_FONT}`;
  ctx.fillStyle = opts.color ?? PAL.cream;
  ctx.textAlign = opts.align ?? 'center';
  ctx.textBaseline = opts.base ?? 'middle';
  ctx.fillText(s, x, y);
}

/** A small dark tag in a tile's corner: slot numbers, batch ages. */
function tag(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string = PAL.gold): void {
  ctx.font = `12px ${BODY_FONT}`;
  const w = Math.max(16, ctx.measureText(s).width + 8);
  ctx.fillStyle = 'rgba(36, 28, 38, 0.82)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, 15, 7);
  ctx.fill();
  text(ctx, s, x + w / 2, y + 8, { size: 12, color });
}

/** Pixel of any simulator tile index, back room or counter. */
function indexXY(view: View, index: number): { x: number; y: number } {
  const layout = view.shop.layout;
  if (isCounter(layout, index)) return tileXY(layout.rows, -1, index - layout.rows * COLS);
  return tileXY(layout.rows, rowOf(index), colOf(index));
}

/** How a tile looks right now: a plot's growth, a kettle's needle, a roaster's window. */
function lookOf(view: View, i: number, s: Structure): TileLook {
  const sim = view.shop.sim;
  if (s.kind === 'plot') {
    const p = sim.plots[i];
    if (!p) return { plotStage: 0 };
    const grown = 1 - (p.harvestAt - sim.T) / GROWTH;
    const stage: PlotStage = grown < 0.4 ? 1 : grown < 0.75 ? 2 : 3;
    return { plotStage: stage };
  }
  if (s.kind === 'kettle') return { kettleTick: view.readouts.get(i)?.tick ?? null };
  if (s.kind === 'roaster') return { roasterFull: !!sim.roasting[i] };
  return {};
}

function floorSprite(view: View, rows: number): HTMLCanvasElement | null {
  const w = COLS * TILE;
  const h = rows * TILE;
  const grid =
    Array.from({ length: COLS - 1 }, (_, k) => `M${(k + 1) * 60} 0V${rows * 60}`).join('') +
    Array.from({ length: rows - 1 }, (_, k) => `M0 ${(k + 1) * 60}H720`).join('');
  return view.sprites.get(`floor:${rows}`, Math.round(w * view.dpr), Math.round(h * view.dpr), () => ({
    viewBox: 720,
    seed: 4,
    body:
      `<rect x="-10" y="-10" width="740" height="${rows * 60 + 20}" fill="${PAL.floor}" stroke="none"/>` +
      `<path d="${grid}" stroke="${PAL.floorLine}" stroke-width="2"/>`,
  }));
}

export function draw(ctx: CanvasRenderingContext2D, view: View): void {
  const { shop, editor } = view;
  const { layout, sim } = shop;
  const rows = layout.rows;
  const size = canvasSize(rows);
  // The floor shows the tick just run, so the slots are read for that tick.
  const shown = clockTick(sim.T - 1);

  ctx.fillStyle = PAL.night;
  ctx.fillRect(0, 0, size.w, size.h);
  const floorW = COLS * TILE;
  const counterY = tileXY(rows, -1, 0).y;

  // The room: tan floor, then the counter's dark strip, its wooden edge and the stools.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(PAD, PAD, floorW, size.h - 2 * PAD, 14);
  ctx.clip();
  const floor = floorSprite(view, rows);
  if (floor) ctx.drawImage(floor, PAD, PAD, floorW, rows * TILE);
  else {
    ctx.fillStyle = PAL.floor;
    ctx.fillRect(PAD, PAD, floorW, rows * TILE);
  }
  ctx.fillStyle = PAL.track;
  ctx.fillRect(PAD, counterY, floorW, TILE);
  ctx.fillStyle = PAL.wood;
  ctx.fillRect(PAD, counterY + TILE, floorW, WOOD_H);
  ctx.fillStyle = PAL.woodTop;
  ctx.fillRect(PAD, counterY + TILE, floorW, 4);
  ctx.fillStyle = PAL.stools;
  ctx.fillRect(PAD, counterY + TILE + WOOD_H, floorW, STOOL_H);
  ctx.restore();

  // Structures, and what they are doing.
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < COLS; col++) {
      const i = tileIndex(row, col);
      const s = layout.tiles[i];
      if (!s) continue;
      const { x, y } = tileXY(rows, row, col);
      blit(ctx, view, structureKey(s, lookOf(view, i, s)), x, y);
      if (s.kind === 'feeder') tag(ctx, String(feederSlot(shown, row)), x + 2, y + 2);
      const roast = sim.roasting[i];
      if (s.kind === 'roaster' && roast) tag(ctx, `in ${sim.T - roast.since}`, x + 2, y + TILE - 17, PAL.cream);
      const inside = sim.springs[i]?.filter((it) => it !== null).length;
      if (s.kind === 'spring' && inside) tag(ctx, `${inside}`, x + TILE - 18, y + 2, PAL.cream);
      const pend = sim.pending[i];
      if (pend) blit(ctx, view, itemKey(pend.item), x + TILE * 0.5, y - TILE * 0.08, TILE * 0.55);
    }
  }
  // Chute spans: a dashed hop from launch to catch.
  for (let i = 0; i < layout.tiles.length; i++) {
    const s = layout.tiles[i];
    if (s?.kind !== 'launch') continue;
    const a = tileXY(rows, rowOf(i), colOf(i));
    const dr = s.dir === 'N' ? 2 : s.dir === 'S' ? -2 : 0;
    const dc = s.dir === 'E' ? 2 : s.dir === 'W' ? -2 : 0;
    const b = tileXY(rows, rowOf(i) + dr, colOf(i) + dc);
    const ax = a.x + TILE / 2;
    const ay = a.y + TILE / 2;
    const bx = b.x + TILE / 2;
    const by = b.y + TILE / 2;
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = PAL.cream;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    // Bow the hop sideways so it reads as a jump over the middle tile.
    ctx.quadraticCurveTo((ax + bx) / 2 + (by - ay) * 0.35, (ay + by) / 2 + (bx - ax) * 0.35, bx, by);
    ctx.stroke();
    ctx.restore();
  }

  // The feeder carries on along the counter as one fixed belt, slot numbers riding along.
  for (let col = 0; col < COLS; col++) {
    const { x, y } = tileXY(rows, -1, col);
    blit(ctx, view, 'fixed:E', x, y);
    tag(ctx, String(slotOf(shown, col)), x + 2, y + 2);
  }

  // Items on belts and the counter.
  sim.belts.forEach((item, i) => {
    if (!item) return;
    const { x, y } = indexXY(view, i);
    blit(ctx, view, itemKey(item), x, y);
  });

  drawStools(ctx, view, counterY + TILE + WOOD_H);

  // Your cat, with a heart when petted and a cross mark when it is mad at you.
  if (view.cat && view.cat.spot.row < rows) {
    const { x, y } = tileXY(rows, view.cat.spot.row, view.cat.spot.col);
    blit(ctx, view, 'cat', x + TILE * 0.3, y + TILE * 0.25, TILE * 0.75);
    if (view.cat.heart) text(ctx, '♥', x + TILE * 0.68, y + 6, { size: 20, color: '#e0245e' });
    else if (view.cat.mad) text(ctx, '!', x + TILE * 0.68, y + 6, { size: 22, color: PAL.cherry, font: "'Caveat Brush', cursive" });
  }

  // Splashes for this tick's spills, and for a cup that ran off the end of the counter.
  for (const e of shop.lastEvents) {
    if (e.type !== 'spill' && e.type !== 'end') continue;
    const { x, y } = e.type === 'end' ? tileXY(rows, -1, COLS - 1) : indexXY(view, e.at);
    blit(ctx, view, splashKey(e.item), x, y);
  }

  drawEditing(ctx, view, editor, rows);
}

function drawStools(ctx: CanvasRenderingContext2D, view: View, top: number): void {
  for (const st of view.stools) {
    const cx = PAD + st.col * TILE + TILE / 2;
    // The stool: a round wooden seat on two legs.
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 2;
    ctx.fillStyle = PAL.woodTop;
    ctx.fillRect(cx - 9, top + 34, 4, 16);
    ctx.fillRect(cx + 5, top + 34, 4, 16);
    ctx.beginPath();
    ctx.ellipse(cx, top + 34, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const r = 18;
    if (st.present) {
      ctx.save();
      if (st.status === 'waiting') ctx.globalAlpha = 0.55;
      drawPortrait(ctx, view, st.id, cx - r, top + 2, r * 2);
      ctx.restore();
      if (st.servedNow) {
        ctx.strokeStyle = PAL.gold;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, top + 2 + r, r + 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      ctx.save();
      ctx.strokeStyle = 'rgba(205, 189, 176, 0.45)';
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, top + 2 + r, r - 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    text(ctx, st.slot, cx, top + STOOL_H - 8, { size: 13, color: PAL.muted });
  }
}

function drawEditing(ctx: CanvasRenderingContext2D, view: View, editor: Editor, rows: number): void {
  // Selection box.
  const sel = editor.selection;
  if (sel) {
    const a = tileXY(rows, sel.r1, sel.c0);
    const w = (sel.c1 - sel.c0 + 1) * TILE;
    const h = (sel.r1 - sel.r0 + 1) * TILE;
    ctx.save();
    ctx.fillStyle = 'rgba(230, 180, 80, 0.14)';
    ctx.fillRect(a.x, a.y, w, h);
    ctx.strokeStyle = PAL.gold;
    ctx.setLineDash([7, 5]);
    ctx.lineWidth = 2.5;
    ctx.strokeRect(a.x + 1, a.y + 1, w - 2, h - 2);
    ctx.restore();
  }

  // Hover and the ghost of whatever is in hand.
  if (!view.hover) return;
  const ghost: Ghost | null = view.hover.row >= 0 ? editor.ghost(view.hover.row, view.hover.col) : null;
  if (ghost) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    for (const ch of ghost.changes) {
      if (!ch.to) continue;
      const { x, y } = indexXY(view, ch.index);
      blit(ctx, view, structureKey(ch.to), x, y);
      if (ghost.reason) {
        ctx.fillStyle = 'rgba(200, 85, 61, 0.45)';
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
    ctx.restore();
  }
  const { x, y } = tileXY(rows, view.hover.row, view.hover.col);
  ctx.strokeStyle = ghost?.reason ? PAL.cherry : PAL.cream;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, TILE - 4, TILE - 4, 8);
  ctx.stroke();
  if (ghost?.reason) {
    ctx.font = `15px ${BODY_FONT}`;
    const tw = ctx.measureText(ghost.reason).width;
    const tx = Math.max(PAD, Math.min(x, PAD + COLS * TILE - tw - 14));
    const ty = y < 30 ? y + TILE + 4 : y - 26;
    ctx.fillStyle = PAL.night;
    ctx.strokeStyle = PAL.line;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw + 14, 22, 8);
    ctx.fill();
    ctx.stroke();
    text(ctx, ghost.reason, tx + 7, ty + 11, { size: 15, align: 'left', color: PAL.cream });
  }
}
