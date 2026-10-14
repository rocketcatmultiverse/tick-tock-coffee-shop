// Where things are on the floor canvas. North is up, so back-room row 0 sits
// just above the counter and higher rows further up. The counter, its wooden
// edge and the stools are pinned to the bottom of the canvas; the back room
// above them is a window the camera moves over when it has more rows than fit.
// A canvas too narrow for all twelve columns at the smallest tile scrolls
// sideways the same way, the counter and the stools along with the floor.
// Above the top row is one more row of tiles, for sale (docs/QUESTIONS.md,
// Q76): fitted and scrolled to as part of the back room, but not the floor.
//
// A workbench puzzle's bench (Q77) has its own width, and no counter, stools
// or row for sale: it is drawn in the middle of the canvas, with the camera
// moving over it the same way when it does not fit.

import { COLS } from '../sim/tuning';

export const PAD = 10;

/**
 * The tile size is chosen to show the whole floor, so a small shop is drawn
 * big and zooms out as rows are bought; past MAX_ROWS_IN_VIEW rows the size
 * stays put and the camera moves instead.
 */
export const MIN_ROWS_IN_VIEW = 6;
export const MAX_ROWS_IN_VIEW = 12;
/** The wooden edge under the counter, and the stool band, in tiles. */
const WOOD = 0.28;
const BAND = 2.1;
/** The smallest tile the floor is fitted to; below it the camera moves instead. */
export const MIN_TILE = 32;
/** The same on a touch screen, where a tile must take a fingertip. */
export const MIN_TOUCH_TILE = 40;
/**
 * A floor that scrolls sideways anyway may grow past the smallest tile to
 * fill the canvas's height, up to this many times it: a phone held upright
 * gets bigger tiles rather than an empty band above a short floor.
 */
const SCROLLING_GROWTH = 1.2;
const MAX_TILE = 88;
/** Pinching zooms between these tile sizes, whatever the fitted size. */
export const ZOOM_MIN_TILE = 24;
export const ZOOM_MAX_TILE = 112;
/** A bench is small, so it may be drawn bigger than the shop's floor ever is. */
const MAX_BENCH_TILE = ZOOM_MAX_TILE;

/** A tile on the floor; row -1 is the counter, row -2 the stool band under it. */
export type Spot = { row: number; col: number };

/** The floor's shape: the shop's twelve columns over its counter, or a bench of its own width. */
export interface FloorShape {
  cols: number;
  /** The counter, its wooden edge and the stools along the bottom, and the row for sale at the top: the shop has them, a bench does not. */
  counter: boolean;
}

export class Geometry {
  readonly cols: number;
  readonly counter: boolean;
  tile = 48;
  width = 0;
  height = 0;
  rows = 6;
  /** How far the back room is scrolled up from row 0, in pixels. */
  camY = 0;
  /** How far the floor is scrolled right, in pixels, when it is wider than the canvas. */
  camX = 0;
  /** The player's pinch on top of the fitted size: 1 shows the floor as fitted. */
  zoom = 1;
  /** The tile size fitted to the canvas, before the zoom. */
  private fitted = 48;

  constructor(shape: FloorShape = { cols: COLS, counter: true }) {
    this.cols = shape.cols;
    this.counter = shape.counter;
  }

  /**
   * Size the floor to the canvas: as big as fits its rows (up to
   * MAX_ROWS_IN_VIEW), the counter and the stools, and never smaller than
   * `minTile`. Then the zoom.
   */
  fit(width: number, height: number, rows: number, minTile = MIN_TILE): void {
    this.width = width;
    this.height = height;
    this.rows = rows;
    // The floor's rows in view, the row for sale above them, and the counter; or a bench's rows.
    const inView = this.counter ? Math.max(MIN_ROWS_IN_VIEW, Math.min(MAX_ROWS_IN_VIEW, rows)) + 1 : Math.min(MAX_ROWS_IN_VIEW, rows);
    const byHeight = (height - 2 * PAD) / (inView + (this.counter ? 1 + WOOD + BAND : 0));
    const byWidth = (width - 2 * PAD) / this.cols;
    const across = byWidth < minTile ? Math.min(byHeight, minTile * SCROLLING_GROWTH) : byWidth;
    this.fitted = Math.max(minTile, Math.min(this.counter ? MAX_TILE : MAX_BENCH_TILE, Math.floor(Math.min(byHeight, across))));
    this.applyZoom();
    this.pan(0, 0);
  }

  private applyZoom(): void {
    this.zoom = Math.max(ZOOM_MIN_TILE / this.fitted, Math.min(ZOOM_MAX_TILE / this.fitted, this.zoom));
    this.tile = Math.round(this.fitted * this.zoom);
  }

  /** Zoom by `factor`, keeping the floor under the pixel (x, y) where it is. */
  zoomAt(x: number, y: number, factor: number): void {
    const col = (x - this.x0) / this.tile;
    const up = (this.counterY + this.camY - y) / this.tile;
    this.zoom *= factor;
    this.applyZoom();
    this.camX = PAD + col * this.tile - x;
    this.camY = y - this.counterY + up * this.tile;
    this.pan(0, 0);
  }

  get wood(): number {
    return this.counter ? Math.round(this.tile * WOOD) : 0;
  }

  get band(): number {
    return this.counter ? Math.round(this.tile * BAND) : 0;
  }

  get floorW(): number {
    return this.cols * this.tile;
  }

  /** Left edge of column 0. */
  get x0(): number {
    const room = this.width - 2 * PAD;
    return this.floorW <= room ? PAD + Math.round((room - this.floorW) / 2) : PAD - this.camX;
  }

  /** Top of the counter row: the bottom of the back room. A bench has no counter, and sits in the middle. */
  get counterY(): number {
    if (this.counter) return this.height - PAD - this.band - this.wood - this.tile;
    const spare = this.height - 2 * PAD - this.rows * this.tile;
    return this.height - PAD - Math.max(0, Math.floor(spare / 2));
  }

  /** Top of the stool band. */
  get bandY(): number {
    return this.counterY + this.tile + this.wood;
  }

  /** Height of the window onto the back room. */
  get roomH(): number {
    return this.counterY - PAD;
  }

  /** The back room's rows: the floor's, and the row for sale above them. */
  get roomRows(): number {
    return this.rows + (this.counter ? 1 : 0);
  }

  get maxCamY(): number {
    return Math.max(0, this.roomRows * this.tile - this.roomH);
  }

  get maxCamX(): number {
    return Math.max(0, this.floorW - (this.width - 2 * PAD));
  }

  /** Whole columns out of view to the left and to the right. */
  get hiddenCols(): { left: number; right: number } {
    if (this.maxCamX === 0) return { left: 0, right: 0 };
    return { left: Math.floor(this.camX / this.tile + 0.25), right: Math.floor((this.maxCamX - this.camX) / this.tile + 0.25) };
  }

  /** Move the camera to put column `col` in the middle, and back-room row `row` too unless it is null; kept inside the floor. */
  centerOn(row: number | null, col: number): void {
    this.camX = PAD + (col + 0.5) * this.tile - this.width / 2;
    if (row !== null) this.camY = (PAD + this.counterY) / 2 - this.counterY + (row + 0.5) * this.tile;
    this.pan(0, 0);
  }

  /** Whether a pixel is on the row for sale above the floor's top row. */
  onRowForSale(x: number, y: number): boolean {
    const col = Math.floor((x - this.x0) / this.tile);
    if (!this.counter || col < 0 || col >= this.cols || x < 0 || x >= this.width || y < PAD || y >= this.counterY) return false;
    return Math.floor((this.counterY + this.camY - y) / this.tile) === this.rows;
  }

  /** Whether a back-room tile's middle is inside the canvas's window onto the back room. */
  shows(row: number, col: number): boolean {
    const { x, y } = this.tileXY(row, col);
    const cx = x + this.tile / 2;
    const cy = y + this.tile / 2;
    return cx >= 0 && cx < this.width && cy >= PAD && cy < this.counterY;
  }

  /** Move the camera by a drag of (dx, dy) pixels, kept inside the floor. */
  pan(dx: number, dy: number): void {
    this.camY = Math.max(0, Math.min(this.maxCamY, this.camY + dy));
    this.camX = Math.max(0, Math.min(this.maxCamX, this.camX - dx));
  }

  /** Top-left pixel of a tile. Row -1 is the counter. */
  tileXY(row: number, col: number): { x: number; y: number } {
    const x = this.x0 + col * this.tile;
    if (row === -1) return { x, y: this.counterY };
    return { x, y: this.counterY - (row + 1) * this.tile + this.camY };
  }

  /** The tile under a pixel: back room, the counter (row -1), the stool band (row -2), or null. */
  hitTest(x: number, y: number): Spot | null {
    const col = Math.floor((x - this.x0) / this.tile);
    if (col < 0 || col >= this.cols) return null;
    if (x < 0 || x >= this.width) return null;
    if (this.counter && y >= this.bandY && y < this.bandY + this.band) return { row: -2, col };
    if (this.counter && y >= this.counterY && y < this.counterY + this.tile) return { row: -1, col };
    if (y < PAD || y >= this.counterY) return null;
    const row = Math.floor((this.counterY + this.camY - y) / this.tile);
    return row >= 0 && row < this.rows ? { row, col } : null;
  }
}
