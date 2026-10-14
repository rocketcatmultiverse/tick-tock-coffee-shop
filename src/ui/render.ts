// The floor renderer: sprites from the visuals canvas (src/ui/art/) on a
// Canvas 2D. It draws the state as it stands and the events of the last tick
// (splashes); it never works out what happened by comparing states.
//
// The back room is a window the camera moves over; the counter, its wooden
// edge and the stool band (which carries the counter strip) stay pinned to
// the bottom. A floor wider than the canvas scrolls sideways, counter and all.
//
// A workbench puzzle's bench (docs/QUESTIONS.md, Q77) is drawn the same way,
// at its own width, without the counter, the stools or the row for sale. Its
// holes are left dark, the pieces it came with are bolted down, and the tray
// shows what it took on the tick just run. A lesson solved before the keys is
// cheered over it (Q81).

import type { Dir, Item, Layout, Roast, SimEvent, SimState, Structure } from '../sim/types';
import { canTake, clockTick, colOf, feederSlot, isCounter, rowOf, slotOf, splitterNext, splitterOutputs, stepFrom, tileIndex } from '../sim';
import { COLS, GROWTH } from '../sim/tuning';
import type { StoolResult } from '../game/strip';
import { HAPPY_LOOPS } from '../game/tuning';
import type { Editor, Ghost } from './editor';
import { type Geometry, PAD, type Spot } from './geometry';
import { PAL, type PlotStage, type TileLook, itemKey, splashKey, spriteBody, structureKey } from './art/svg';
import { portraitBody } from './art/portraits';
import type { SpriteBank } from './art/raster';
import { cheerFrame } from './celebrate';

/** One stool: its regular now, and what the counter strip says about them in steady state. */
export interface StoolView {
  col: number;
  /** Regular id, which names their portrait. */
  id: string;
  /** "t9 · s9", or "any · s7" for an any-tick regular (the slot they last took from). */
  label: string;
  /** At the counter on the tick shown. Any-tick regulars always are. */
  present: boolean;
  /** Took a cup on this tick: drawn with a gold ring. */
  servedNow: boolean;
  status: 'new' | 'seated' | 'waiting';
  /** Loops in a row with their cup, up to HAPPY_LOOPS. */
  happy: number;
  /** The counter strip, from steady state. */
  result: StoolResult | null;
  cup: Item | null;
}

/** What the renderer draws: the shop's floor, or a workbench puzzle's bench. */
export interface FloorModel {
  readonly layout: Layout;
  readonly sim: SimState;
  /** Events of the tick just run: splashes, and what a tray took. */
  readonly lastEvents: SimEvent[];
}

/** A bench's own marks: tiles that are not bench, the pieces it came with, and whether what a tray just took is wanted. */
export interface BenchView {
  holes: ReadonlySet<number>;
  fixed: ReadonlySet<number>;
  /** Per tray that took an item on the tick just run: whether the order wants it. */
  took: Map<number, boolean>;
  /** The tray, where a cheer bursts from. */
  tray: number;
  /** A solved lesson's cheer (Q81): how far into it, and the line under "Solved!" saying what comes next. */
  cheer: { ms: number; line: string; reduced: boolean } | null;
}

export interface View {
  floor: FloorModel;
  editor: Editor;
  geo: Geometry;
  hover: Spot | null;
  /** The tile last tapped or clicked with nothing in hand. */
  inspect: Spot | null;
  /** How to move the camera, for the hint at the edge: "right-drag or scroll", "drag". */
  panHint: string;
  /** `hover` is a finger's ghost, moved by the thumb stick, not the mouse: drawn bolder so it reads at a glance. */
  ghostCursor: boolean;
  /** The row for sale above the floor: its words, whether rows are for sale yet or a first click awaits a second, and whether the mouse is on it. A bench has none. */
  forSale: { label: string; look: 'locked' | 'open' | 'armed'; hot: boolean } | null;
  /** Kettle readouts: the tick its input last landed on and the roast that gave. */
  readouts: Map<number, { tick: number; roast: Roast | null }>;
  stools: StoolView[];
  cat: { spot: Spot; heart: boolean; mad: boolean } | null;
  /** A workbench puzzle's bench; null in the shop. */
  bench: BenchView | null;
  sprites: SpriteBank;
  /** Device pixels per CSS pixel; sprites are rasterised at this density. */
  dpr: number;
}

const BODY_FONT = "'Patrick Hand', 'Comic Sans MS', cursive";
const RESULT_MARK: Record<StoolResult, string> = { justInTime: '●', served: '◐', miss: '✕' };
const RESULT_COLOR: Record<StoolResult, string> = { justInTime: PAL.leaf, served: PAL.gold, miss: PAL.cherry };

/** Draw a 60-unit floor sprite into a square of `size` CSS pixels at (x, y). */
function blit(ctx: CanvasRenderingContext2D, view: View, key: string, x: number, y: number, size = view.geo.tile): void {
  const px = Math.round(size * view.dpr);
  const img = view.sprites.get(key, px, px, () => ({ body: spriteBody(key), viewBox: 60 }));
  if (img) ctx.drawImage(img, x, y, size, size);
}

/** A regular's round portrait, `size` CSS pixels across. */
function drawPortrait(ctx: CanvasRenderingContext2D, view: View, id: string, x: number, y: number, size: number): void {
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

/** Text on a tile, shrunk with the tile so it stays inside it. */
const tileFont = (tile: number, max = 12) => Math.max(8, Math.min(max, Math.round(tile * 0.26)));

/** A small dark tag: slot numbers, batch ages, hints. */
function tag(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string = PAL.gold, size = 12): void {
  ctx.font = `${size}px ${BODY_FONT}`;
  const w = Math.max(size + 4, ctx.measureText(s).width + 8);
  ctx.fillStyle = 'rgba(36, 28, 38, 0.82)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, size + 3, (size + 3) / 2);
  ctx.fill();
  text(ctx, s, x + w / 2, y + (size + 3) / 2 + 0.5, { size, color });
}

/** Pixel of any simulator tile index, back room or counter. */
function indexXY(view: View, index: number): { x: number; y: number } {
  const layout = view.floor.layout;
  if (isCounter(layout, index)) return view.geo.tileXY(-1, index - layout.rows * COLS);
  return view.geo.tileXY(rowOf(index), colOf(index));
}

/** How a tile looks right now: a plot's growth, a kettle's needle, a roaster's window. */
function lookOf(view: View, i: number, s: Structure): TileLook {
  const sim = view.floor.sim;
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
  const { tile, cols } = view.geo;
  const w = cols * 60;
  const grid =
    Array.from({ length: cols - 1 }, (_, k) => `M${(k + 1) * 60} 0V${rows * 60}`).join('') +
    Array.from({ length: rows - 1 }, (_, k) => `M0 ${(k + 1) * 60}H${w}`).join('');
  return view.sprites.get(`floor:${cols}x${rows}`, Math.round(cols * tile * view.dpr), Math.round(rows * tile * view.dpr), () => ({
    viewBox: w,
    seed: 4,
    body:
      `<rect x="-10" y="-10" width="${w + 20}" height="${rows * 60 + 20}" fill="${PAL.floor}" stroke="none"/>` +
      `<path d="${grid}" stroke="${PAL.floorLine}" stroke-width="2"/>`,
  }));
}

export function draw(ctx: CanvasRenderingContext2D, view: View): void {
  const { floor: model, editor, geo } = view;
  const { layout, sim } = model;
  const rows = layout.rows;
  const T = geo.tile;
  const x0 = geo.x0;
  // The floor shows the tick just run, so the slots are read for that tick.
  const shown = clockTick(sim.T - 1);

  ctx.fillStyle = PAL.night;
  ctx.fillRect(0, 0, geo.width, geo.height);

  // ---- The back room, seen through the camera's window. ----
  ctx.save();
  ctx.beginPath();
  // The shop's back room runs down into the counter; a bench is a board of its own, rounded all round.
  const floorTop = geo.counterY - rows * T + geo.camY;
  if (geo.counter) ctx.roundRect(x0, PAD, geo.floorW, geo.roomH, [14, 14, 0, 0]);
  else ctx.roundRect(x0, Math.max(PAD, floorTop), geo.floorW, Math.min(geo.roomH, rows * T), 14);
  ctx.clip();
  const floor = floorSprite(view, rows);
  if (floor) ctx.drawImage(floor, x0, floorTop, geo.floorW, rows * T);
  else {
    ctx.fillStyle = PAL.floor;
    ctx.fillRect(x0, floorTop, geo.floorW, rows * T);
  }
  if (view.forSale) drawRowForSale(ctx, view, view.forSale);
  // Tiles inside the bench that are not bench.
  for (const i of view.bench?.holes ?? []) {
    const { x, y } = indexXY(view, i);
    ctx.fillStyle = PAL.night;
    ctx.fillRect(x - 0.5, y - 0.5, T + 1, T + 1);
  }

  for (let row = 0; row < rows; row++) {
    const y = geo.tileXY(row, 0).y;
    if (y > geo.counterY || y + T < PAD) continue;
    for (let col = 0; col < geo.cols; col++) {
      const i = tileIndex(row, col);
      const s = layout.tiles[i];
      if (!s) continue;
      const x = x0 + col * T;
      blit(ctx, view, structureKey(s, lookOf(view, i, s)), x, y);
      if (view.bench?.fixed.has(i)) drawBolts(ctx, x, y, T);
      const took = view.bench?.took.get(i);
      if (took !== undefined) drawTook(ctx, view, i, x, y, took);
      if (s.kind === 'feeder') tag(ctx, String(feederSlot(shown, row)), x + 2, y + 2, PAL.gold, tileFont(T));
      const roast = sim.roasting[i];
      if (s.kind === 'roaster' && roast) tag(ctx, `in ${sim.T - roast.since}`, x + 2, y + T - tileFont(T) - 5, PAL.cream, tileFont(T));
      const inside = sim.springs[i]?.filter((it) => it !== null).length;
      if (s.kind === 'spring' && inside) tag(ctx, `${inside}`, x + T - tileFont(T) - 6, y + 2, PAL.cream, tileFont(T));
      const pend = sim.pending[i];
      if (pend) blit(ctx, view, itemKey(pend.item), x + T * 0.5, y - T * 0.08, T * 0.55);
      if (s.kind === 'splitter') drawSplitterEdges(ctx, view, i, x, y);
    }
  }
  drawChutes(ctx, view);
  // Items in the back room; the counter's own are drawn with it below.
  sim.belts.forEach((item, i) => {
    if (!item || isCounter(layout, i)) return;
    const { x, y } = indexXY(view, i);
    blit(ctx, view, itemKey(item), x, y);
  });
  // Your cat, with a heart when petted and a mark when it is mad at you.
  if (view.cat && view.cat.spot.row < rows) {
    const { x, y } = geo.tileXY(view.cat.spot.row, view.cat.spot.col);
    blit(ctx, view, 'cat', x + T * 0.3, y + T * 0.25, T * 0.75);
    if (view.cat.heart) text(ctx, '♥', x + T * 0.68, y + 6, { size: 20, color: '#e0245e' });
    else if (view.cat.mad) text(ctx, '!', x + T * 0.68, y + 6, { size: 22, color: PAL.cherry, font: "'Caveat Brush', cursive" });
  }
  ctx.restore();

  if (geo.counter) drawCounter(ctx, view);

  // Splashes for this tick's spills, and for a cup that ran off the end of the counter.
  for (const e of model.lastEvents) {
    if (e.type !== 'spill' && e.type !== 'end') continue;
    const { x, y } = e.type === 'end' ? geo.tileXY(-1, COLS - 1) : indexXY(view, e.at);
    if (y + T < PAD || y > geo.counterY + (geo.counter ? T : 0)) continue;
    blit(ctx, view, splashKey(e.item), x, y);
  }

  drawCameraHints(ctx, view);
  drawEditing(ctx, view, editor);
  if (view.bench?.cheer) drawCheer(ctx, view, view.bench.tray, view.bench.cheer);
}

const CHEER_HUES = [PAL.gold, PAL.cream, PAL.leaf];

/** A four-pointed sparkle of radius `r`. */
function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 - Math.PI / 2;
    const d = k % 2 ? r * 0.38 : r;
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/**
 * A solved lesson's cheer, over everything (Q81): the bench's edge lit gold,
 * rings and sparkles from the tray, the "Solved!" banner over the middle of
 * the bench, and at the end the night falling over the floor.
 */
function drawCheer(ctx: CanvasRenderingContext2D, view: View, tray: number, cheer: NonNullable<BenchView['cheer']>): void {
  const { geo } = view;
  const T = geo.tile;
  const f = cheerFrame(cheer.ms, cheer.reduced);
  const rows = view.floor.layout.rows;
  const top = Math.max(PAD, geo.counterY - rows * T + geo.camY);
  const board = { x: geo.x0, y: top, w: geo.floorW, h: Math.min(geo.roomH, rows * T) };
  const at = indexXY(view, tray);
  const cx = at.x + T / 2;
  const cy = at.y + T / 2;
  ctx.save();
  ctx.globalAlpha = f.glow;
  ctx.strokeStyle = PAL.gold;
  ctx.lineWidth = 5;
  ctx.shadowColor = PAL.gold;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.roundRect(board.x, board.y, board.w, board.h, 14);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 4;
  for (const r of f.rings) {
    if (r.alpha <= 0) continue;
    ctx.globalAlpha = r.alpha;
    ctx.beginPath();
    ctx.arc(cx, cy, r.r * T, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Outlined in ink like the sprites, so they show on the bench's pale floor too.
  ctx.strokeStyle = PAL.ink;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  for (const s of f.sparks) {
    if (s.alpha <= 0) continue;
    ctx.globalAlpha = s.alpha;
    ctx.fillStyle = CHEER_HUES[s.hue];
    sparkle(ctx, cx + s.dx * T, cy + s.dy * T, s.size * T);
  }
  if (f.banner.alpha > 0) {
    const title = Math.max(28, Math.min(64, Math.round(board.w * 0.14)));
    const sub = Math.max(14, Math.round(title * 0.4));
    ctx.font = `${title}px 'Caveat Brush', cursive`;
    const titleW = ctx.measureText('Solved!').width;
    ctx.font = `${sub}px ${BODY_FONT}`;
    const lineW = ctx.measureText(cheer.line).width;
    const w = Math.max(titleW, lineW) + title;
    const h = title * 1.15 + sub * 1.5 + title * 0.4;
    const bx = Math.max(w / 2 + 4, Math.min(geo.width - w / 2 - 4, board.x + board.w / 2));
    const by = Math.max(h / 2 + 4, Math.min(geo.height - h / 2 - 4, board.y + board.h / 2));
    ctx.translate(bx, by);
    ctx.scale(f.banner.scale, f.banner.scale);
    ctx.globalAlpha = f.banner.alpha;
    ctx.fillStyle = 'rgba(36, 28, 38, 0.92)';
    ctx.strokeStyle = PAL.gold;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 16);
    ctx.fill();
    ctx.stroke();
    text(ctx, 'Solved!', 0, -h / 2 + title * 0.2 + (title * 1.15) / 2, { size: title, color: PAL.gold, font: "'Caveat Brush', cursive" });
    text(ctx, cheer.line, 0, h / 2 - title * 0.2 - (sub * 1.5) / 2, { size: sub, color: PAL.cream });
  }
  ctx.restore();
  if (f.fade > 0) {
    ctx.save();
    ctx.globalAlpha = f.fade;
    ctx.fillStyle = PAL.night;
    ctx.fillRect(0, 0, geo.width, geo.height);
    ctx.restore();
  }
}

/** The counter: the feeder carries on along it as one fixed belt, slot numbers riding along; then the stools. */
function drawCounter(ctx: CanvasRenderingContext2D, view: View): void {
  const { geo } = view;
  const { layout, sim } = view.floor;
  const T = geo.tile;
  const x0 = geo.x0;
  // The floor shows the tick just run, so the slots are read for that tick.
  const shown = clockTick(sim.T - 1);
  ctx.fillStyle = PAL.track;
  ctx.fillRect(x0, geo.counterY, geo.floorW, T);
  for (let col = 0; col < COLS; col++) {
    const { x, y } = geo.tileXY(-1, col);
    blit(ctx, view, 'fixed:E', x, y);
    tag(ctx, String(slotOf(shown, col)), x + 2, y + 2, PAL.gold, tileFont(T));
    const item = sim.belts[layout.rows * COLS + col];
    if (item) blit(ctx, view, itemKey(item), x, y);
  }
  ctx.fillStyle = PAL.wood;
  ctx.fillRect(x0, geo.counterY + T, geo.floorW, geo.wood);
  ctx.fillStyle = PAL.woodTop;
  ctx.fillRect(x0, geo.counterY + T, geo.floorW, Math.max(2, Math.round(geo.wood / 4)));
  ctx.fillStyle = PAL.stools;
  ctx.beginPath();
  ctx.roundRect(x0, geo.bandY, geo.floorW, geo.band, [0, 0, 14, 14]);
  ctx.fill();
  drawStools(ctx, view);
}

/** Fixed to the bench: a brass bolt in each corner. */
function drawBolts(ctx: CanvasRenderingContext2D, x: number, y: number, T: number): void {
  const r = Math.max(2, T * 0.045);
  const inset = T * 0.1;
  ctx.save();
  ctx.fillStyle = PAL.gold;
  ctx.strokeStyle = PAL.ink;
  ctx.lineWidth = 1;
  for (const [bx, by] of [
    [x + inset, y + inset],
    [x + T - inset, y + inset],
    [x + inset, y + T - inset],
    [x + T - inset, y + T - inset],
  ]) {
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** What a tray took on the tick just run, over it: ringed gold when the order wants it, red when not. */
function drawTook(ctx: CanvasRenderingContext2D, view: View, at: number, x: number, y: number, wanted: boolean): void {
  const T = view.geo.tile;
  const e = view.floor.lastEvents.find((ev) => ev.type === 'deliver' && ev.at === at);
  if (e?.type !== 'deliver') return;
  ctx.save();
  ctx.strokeStyle = wanted ? PAL.gold : PAL.cherry;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, T - 4, T - 4, 10);
  ctx.stroke();
  ctx.restore();
  blit(ctx, view, itemKey(e.item), x + T * 0.15, y + T * 0.08, T * 0.7);
}

/**
 * The row for sale above the floor's top row (Q76): pale dashed tiles with
 * the price across them, brighter under the mouse and after a first click;
 * greyed until rows are for sale.
 */
function drawRowForSale(ctx: CanvasRenderingContext2D, view: View, forSale: NonNullable<View['forSale']>): void {
  const { geo } = view;
  const T = geo.tile;
  const { y } = geo.tileXY(geo.rows, 0);
  if (y > geo.counterY || y + T < PAD) return;
  const { look, hot, label } = forSale;
  ctx.save();
  ctx.fillStyle = look === 'locked' ? 'rgba(46, 36, 51, 0.55)' : look === 'armed' || hot ? 'rgba(230, 180, 80, 0.26)' : 'rgba(224, 195, 154, 0.14)';
  ctx.fillRect(geo.x0, y, geo.floorW, T);
  ctx.strokeStyle = look === 'locked' ? 'rgba(205, 189, 176, 0.3)' : look === 'armed' ? PAL.gold : 'rgba(224, 195, 154, 0.55)';
  ctx.lineWidth = look === 'armed' ? 2.5 : 1.5;
  ctx.setLineDash([5, 4]);
  for (let col = 0; col < COLS; col++) {
    ctx.beginPath();
    ctx.roundRect(geo.x0 + col * T + 3, y + 3, T - 6, T - 6, 7);
    ctx.stroke();
  }
  ctx.restore();
  // The words across the middle of the strip in view.
  const left = Math.max(geo.x0, PAD);
  const right = Math.min(geo.x0 + geo.floorW, geo.width - PAD);
  const size = Math.max(11, Math.min(18, Math.round(T * 0.36)));
  ctx.font = `${size}px ${BODY_FONT}`;
  const w = Math.min(ctx.measureText(label).width + 18, right - left - 8);
  const color = look === 'locked' ? PAL.muted : PAL.gold;
  ctx.fillStyle = 'rgba(36, 28, 38, 0.86)';
  ctx.beginPath();
  ctx.roundRect((left + right) / 2 - w / 2, y + T / 2 - size * 0.8, w, size * 1.6, size * 0.8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect((left + right) / 2 - w / 2 + 6, y, w - 12, T);
  ctx.clip();
  text(ctx, label, (left + right) / 2, y + T / 2 + 1, { size, color });
  ctx.restore();
}

const SPLIT_OUT = PAL.gold;
const SPLIT_NEXT = '#7cd65a';
const SPLIT_SPILL = PAL.cherry;

/**
 * A splitter's sides: yellow for its outputs, green for where the next item
 * goes, red for a side that would spill the item now on it (or the whole rim
 * when nothing beside it takes items). Read from the simulator's own rules.
 */
function drawSplitterEdges(ctx: CanvasRenderingContext2D, view: View, i: number, x: number, y: number): void {
  const { layout, sim } = view.floor;
  const T = view.geo.tile;
  const outs = splitterOutputs(layout, i);
  const next = splitterNext(layout, sim, i);
  const waiting = sim.belts[i];
  const bar = (d: Dir, color: string) => {
    const t = Math.max(4, Math.round(T * 0.09));
    const len = Math.round(T * 0.56);
    const off = (T - len) / 2;
    const r =
      d === 'N' ? [x + off, y + 2, len, t] : d === 'S' ? [x + off, y + T - 2 - t, len, t] : d === 'W' ? [x + 2, y + off, t, len] : [x + T - 2 - t, y + off, t, len];
    ctx.fillStyle = color;
    ctx.strokeStyle = PAL.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(r[0], r[1], r[2], r[3], t / 2);
    ctx.fill();
    ctx.stroke();
  };
  if (outs.length === 0) {
    if (waiting) for (const d of ['N', 'E', 'S', 'W'] as Dir[]) bar(d, SPLIT_SPILL);
    return;
  }
  for (const d of outs) {
    const j = stepFrom(layout, i, d);
    const spills = !!waiting && d === next && !canTake(j === null ? null : layout.tiles[j] ?? null, waiting);
    bar(d, spills ? SPLIT_SPILL : d === next ? SPLIT_NEXT : SPLIT_OUT);
  }
}

function drawChutes(ctx: CanvasRenderingContext2D, view: View): void {
  const { layout } = view.floor;
  const T = view.geo.tile;
  for (let i = 0; i < layout.tiles.length; i++) {
    const s = layout.tiles[i];
    if (s?.kind !== 'launch') continue;
    const a = view.geo.tileXY(rowOf(i), colOf(i));
    const dr = s.dir === 'N' ? 2 : s.dir === 'S' ? -2 : 0;
    const dc = s.dir === 'E' ? 2 : s.dir === 'W' ? -2 : 0;
    const b = view.geo.tileXY(rowOf(i) + dr, colOf(i) + dc);
    const [ax, ay, bx, by] = [a.x + T / 2, a.y + T / 2, b.x + T / 2, b.y + T / 2];
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
}

/** The stool band: each regular's portrait, what they want, the strip's verdict and their happiness. */
function drawStools(ctx: CanvasRenderingContext2D, view: View): void {
  const { geo } = view;
  const T = geo.tile;
  const top = geo.bandY;
  const d = Math.round(T * 0.72);
  for (const st of view.stools) {
    const x = geo.x0 + st.col * T;
    const cx = x + T / 2;
    // The cell, outlined by its result as the strip was: solid, dashed or dotted.
    ctx.save();
    ctx.fillStyle = PAL.panel;
    ctx.strokeStyle = st.result ? RESULT_COLOR[st.result] : PAL.muted;
    ctx.lineWidth = st.result === 'justInTime' ? 2.5 : 2;
    ctx.setLineDash(st.result === 'served' ? [5, 3] : st.result === 'miss' ? [2, 3] : []);
    ctx.beginPath();
    ctx.roundRect(x + 2, top + 4, T - 4, geo.band - 8, 9);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    if (!st.present || st.status === 'waiting') ctx.globalAlpha = 0.45;
    drawPortrait(ctx, view, st.id, cx - d / 2, top + 8, d);
    ctx.restore();
    // A regular not yet served since walking in wears a tag, so a new stool is easy to find (Q74).
    if (st.status === 'new') tag(ctx, 'new', x + 3, top + 3, PAL.gold, tileFont(T, 11));
    if (st.servedNow) {
      ctx.strokeStyle = PAL.gold;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, top + 8 + d / 2, d / 2 + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    const fs = tileFont(T);
    let y = top + 8 + d + fs * 0.75;
    text(ctx, st.label, cx, y, { size: fs, color: PAL.cream });
    y += fs + 3;
    if (st.result) text(ctx, RESULT_MARK[st.result], cx - T * 0.18, y, { size: fs + 1, color: RESULT_COLOR[st.result] });
    if (st.cup) blit(ctx, view, itemKey(st.cup), cx - T * 0.02, y - T * 0.2, T * 0.4);
    // Happiness: one pip per loop in a row with their cup.
    const py = top + geo.band - 13;
    const pip = Math.min(9, T / (HAPPY_LOOPS + 1));
    for (let k = 0; k < HAPPY_LOOPS; k++) {
      const px = cx + (k - (HAPPY_LOOPS - 1) / 2) * pip;
      ctx.beginPath();
      ctx.arc(px, py, Math.min(3, pip / 3), 0, Math.PI * 2);
      if (k < st.happy) {
        ctx.fillStyle = st.happy >= HAPPY_LOOPS ? PAL.leaf : PAL.gold;
        ctx.fill();
      } else {
        ctx.strokeStyle = PAL.muted;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
  }
}

/** When rows or columns are out of view, say so at the edge where they are, with a slim scroll bar. */
function drawCameraHints(ctx: CanvasRenderingContext2D, view: View): void {
  const { geo } = view;
  const many = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
  const tagW = (s: string) => ctx.measureText(s).width + 8;
  ctx.save();
  ctx.font = `13px ${BODY_FONT}`;
  if (geo.maxCamY > 0) {
    // The middle of the floor in view.
    const mid = (Math.max(geo.x0, PAD) + Math.min(geo.x0 + geo.floorW, geo.width - PAD)) / 2;
    // Rows of floor out of view above, not counting the row for sale at the top.
    const above = Math.floor((geo.maxCamY - geo.camY) / geo.tile) - 1;
    const below = Math.floor(geo.camY / geo.tile);
    if (geo.camY < geo.maxCamY) {
      const s = `▲ ${above > 0 ? `${many(above, 'row')} above` : 'rows for sale above'} · ${view.panHint}`;
      tag(ctx, s, mid - tagW(s) / 2, PAD + 4, PAL.gold, 13);
    }
    if (geo.camY > 0) {
      const s = `▼ ${many(Math.max(1, below), 'row')} below`;
      tag(ctx, s, mid - tagW(s) / 2, geo.counterY - 22, PAL.gold, 13);
    }
    // A slim scroll bar beside the floor, or at the canvas's edge when the floor runs past it.
    const trackX = Math.min(geo.x0 + geo.floorW + 4, geo.width - 6);
    const trackH = geo.roomH;
    const thumbH = Math.max(24, (trackH * geo.roomH) / (geo.roomRows * geo.tile));
    const thumbY = PAD + (trackH - thumbH) * (1 - geo.camY / geo.maxCamY);
    ctx.fillStyle = 'rgba(205, 189, 176, 0.18)';
    ctx.fillRect(trackX, PAD, 4, trackH);
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(trackX, thumbY, 4, thumbH);
  }
  if (geo.maxCamX > 0) {
    const { left, right } = geo.hiddenCols;
    const y = PAD + Math.max(24, geo.roomH / 2 - 8);
    if (left > 0) tag(ctx, `◀ ${left}`, PAD + 2, y, PAL.gold, 13);
    if (right > 0) {
      const s = `${right} ▶`;
      tag(ctx, s, geo.width - PAD - 2 - Math.max(17, tagW(s)), y, PAL.gold, 13);
    }
    // A slim scroll bar under the stools.
    const trackW = geo.width - 2 * PAD;
    const thumbW = Math.max(24, (trackW * trackW) / geo.floorW);
    const thumbX = PAD + (trackW - thumbW) * (geo.camX / geo.maxCamX);
    const trackY = geo.height - 6;
    ctx.fillStyle = 'rgba(205, 189, 176, 0.18)';
    ctx.fillRect(PAD, trackY, trackW, 4);
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(thumbX, trackY, thumbW, 4);
  }
  ctx.restore();
}

function drawEditing(ctx: CanvasRenderingContext2D, view: View, editor: Editor): void {
  const { geo } = view;
  const T = geo.tile;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, geo.width, geo.counterY);
  ctx.clip();
  // Selection box.
  const sel = editor.selection;
  if (sel) {
    const a = geo.tileXY(sel.r1, sel.c0);
    const w = (sel.c1 - sel.c0 + 1) * T;
    const h = (sel.r1 - sel.r0 + 1) * T;
    ctx.save();
    ctx.fillStyle = 'rgba(230, 180, 80, 0.14)';
    ctx.fillRect(a.x, a.y, w, h);
    ctx.strokeStyle = PAL.gold;
    ctx.setLineDash([7, 5]);
    ctx.lineWidth = 2.5;
    ctx.strokeRect(a.x + 1, a.y + 1, w - 2, h - 2);
    ctx.restore();
  }
  ctx.restore();

  // The tile last tapped or clicked, while nothing is in hand.
  const ins = view.inspect;
  if (ins && !editor.hand) {
    const { x, y } = ins.row === -2 ? { x: geo.x0 + ins.col * T, y: geo.bandY } : geo.tileXY(ins.row, ins.col);
    const h = ins.row === -2 ? geo.band : T;
    if (ins.row < 0 || (y + T > PAD && y < geo.counterY)) {
      ctx.save();
      ctx.strokeStyle = PAL.gold;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.roundRect(x + 2, y + 2, T - 4, h - 4, 8);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Hover and the ghost of whatever is in hand. The outline goes under the
  // ghost, so the side a machine puts out on stays in sight at the tile's edge.
  if (!view.hover || view.hover.row < -1) return;
  const ghost: Ghost | null = view.hover.row >= 0 ? editor.ghost(view.hover.row, view.hover.col) : null;
  const { x, y } = geo.tileXY(view.hover.row, view.hover.col);
  ctx.strokeStyle = ghost?.reason ? PAL.cherry : view.ghostCursor ? PAL.gold : PAL.cream;
  ctx.lineWidth = view.ghostCursor ? 3.5 : 2.5;
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, T - 4, T - 4, 8);
  ctx.stroke();
  if (ghost) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    for (const ch of ghost.changes) {
      if (!ch.to) continue;
      const at = indexXY(view, ch.index);
      blit(ctx, view, structureKey(ch.to), at.x, at.y);
      if (ghost.reason) {
        ctx.fillStyle = 'rgba(200, 85, 61, 0.45)';
        ctx.fillRect(at.x, at.y, T, T);
      }
    }
    ctx.restore();
  }
  if (ghost?.reason) {
    ctx.font = `15px ${BODY_FONT}`;
    const tw = ctx.measureText(ghost.reason).width;
    const tx = Math.max(Math.max(geo.x0, PAD), Math.min(x, Math.min(geo.x0 + geo.floorW, geo.width - PAD) - tw - 14));
    const ty = y < PAD + 30 ? y + T + 4 : y - 26;
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
