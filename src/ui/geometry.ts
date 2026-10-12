// Where things are on the floor canvas. North is up, so back-room row 0 sits
// just above the counter and higher rows further up. The counter, its wooden
// edge and the stools are pinned to the bottom of the canvas; the back room
// above them is a window the camera moves over when it has more rows than fit.
// A canvas too narrow for all twelve columns at the smallest tile scrolls
// sideways the same way, the counter and the stools along with the floor.

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

/** A tile on the floor; row -1 is the counter, row -2 the stool band under it. */
export type Spot = { row: number; col: number };

export class Geometry {
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

  /**
   * Size the floor to the canvas: as big as fits its rows (up to
   * MAX_ROWS_IN_VIEW), the counter and the stools, and never smaller than
   * `minTile`. Then the zoom.
   */
  fit(width: number, height: number, rows: number, minTile = MIN_TILE): void {
    this.width = width;
    this.height = height;
    this.rows = rows;
    const inView = Math.max(MIN_ROWS_IN_VIEW, Math.min(MAX_ROWS_IN_VIEW, rows));
    const byHeight = (height - 2 * PAD) / (inView + 1 + WOOD + BAND);
    const byWidth = (width - 2 * PAD) / COLS;
    const across = byWidth < minTile ? Math.min(byHeight, minTile * SCROLLING_GROWTH) : byWidth;
    this.fitted = Math.max(minTile, Math.min(MAX_TILE, Math.floor(Math.min(byHeight, across))));
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
    return Math.round(this.tile * WOOD);
  }

  get band(): number {
    return Math.round(this.tile * BAND);
  }

  get floorW(): number {
    return COLS * this.tile;
  }

  /** Left edge of column 0. */
  get x0(): number {
    const room = this.width - 2 * PAD;
    return this.floorW <= room ? PAD + Math.round((room - this.floorW) / 2) : PAD - this.camX;
  }

  /** Top of the counter row. */
  get counterY(): number {
    return this.height - PAD - this.band - this.wood - this.tile;
  }

  /** Top of the stool band. */
  get bandY(): number {
    return this.counterY + this.tile + this.wood;
  }

  /** Height of the window onto the back room. */
  get roomH(): number {
    return this.counterY - PAD;
  }

  get maxCamY(): number {
    return Math.max(0, this.rows * this.tile - this.roomH);
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
    if (col < 0 || col >= COLS) return null;
    if (x < 0 || x >= this.width) return null;
    if (y >= this.bandY && y < this.bandY + this.band) return { row: -2, col };
    if (y >= this.counterY && y < this.counterY + this.tile) return { row: -1, col };
    if (y < PAD || y >= this.counterY) return null;
    const row = Math.floor((this.counterY + this.camY - y) / this.tile);
    return row >= 0 && row < this.rows ? { row, col } : null;
  }
}
