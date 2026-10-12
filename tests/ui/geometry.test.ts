// The floor's geometry and camera (docs/QUESTIONS.md, Q63): the floor is
// sized to show all its rows up to MAX_ROWS_IN_VIEW; beyond that the camera
// moves over the back room while the counter and the stools stay put. A
// canvas too narrow for twelve columns at the smallest tile scrolls sideways,
// a touch screen keeps tiles a fingertip wide, and a pinch zooms about the
// fingers (Q71).

import { describe, expect, it } from 'vitest';
import { Geometry, MAX_ROWS_IN_VIEW, MIN_TILE, MIN_TOUCH_TILE, PAD, ZOOM_MAX_TILE, ZOOM_MIN_TILE } from '../../src/ui/geometry';

/** The floor area a 1920 by 1080 monitor leaves once the browser and the panels have their share. */
const W = 1480;
const H = 800;

function fitted(rows: number): Geometry {
  const g = new Geometry();
  g.fit(W, H, rows);
  return g;
}

describe('Geometry', () => {
  it('shows a small floor big, and zooms out as rows are bought, until MAX_ROWS_IN_VIEW', () => {
    const tiles = [6, 8, 10, 12, 16].map((rows) => fitted(rows).tile);
    expect(tiles[0]).toBeGreaterThan(tiles[1]);
    expect(tiles[1]).toBeGreaterThan(tiles[2]);
    expect(tiles[2]).toBeGreaterThan(tiles[3]);
    expect(tiles[4]).toBe(tiles[3]);
    expect(MAX_ROWS_IN_VIEW).toBe(12);
  });

  it('fits twelve rows, the counter and the stools without moving the camera', () => {
    const g = fitted(12);
    expect(g.maxCamY).toBe(0);
    expect(g.tile * 12).toBeLessThanOrEqual(g.roomH);
    expect(g.bandY + g.band).toBeLessThanOrEqual(H);
  });

  it('the camera moves only as far as the floor goes', () => {
    const g = fitted(16);
    expect(g.maxCamY).toBeGreaterThan(0);
    g.pan(0, -500);
    expect(g.camY).toBe(0);
    g.pan(0, 10_000);
    expect(g.camY).toBe(g.maxCamY);
  });

  it('hit-tests through the camera; the counter and the stool band stay put', () => {
    const g = fitted(16);
    const x = g.x0 + g.tile * 3 + 1;
    expect(g.hitTest(x, g.counterY - 1)).toEqual({ row: 0, col: 3 });
    expect(g.hitTest(x, g.counterY + 1)).toEqual({ row: -1, col: 3 });
    expect(g.hitTest(x, g.bandY + 1)).toEqual({ row: -2, col: 3 });
    g.pan(0, g.tile * 2);
    expect(g.hitTest(x, g.counterY - 1)).toEqual({ row: 2, col: 3 });
    expect(g.hitTest(x, g.counterY + 1)).toEqual({ row: -1, col: 3 });
    expect(g.tileXY(2, 3).y).toBe(g.counterY - g.tile);
    // Left of column 0 and right of column 11 is not the floor.
    expect(g.hitTest(g.x0 - 1, g.counterY - 1)).toBeNull();
    expect(g.hitTest(g.x0 + g.floorW + 1, g.counterY - 1)).toBeNull();
  });

  it('rows above the top of the floor are not the floor', () => {
    const g = fitted(6);
    expect(g.hitTest(g.x0 + 1, g.counterY - g.tile * 6 - 1)).toBeNull();
    expect(g.hitTest(g.x0 + 1, g.counterY - g.tile * 6 + 1)).toEqual({ row: 5, col: 0 });
  });

  it('a canvas too narrow for twelve columns scrolls sideways, counter and stools along with the floor', () => {
    const g = new Geometry();
    g.fit(300, 700, 6, MIN_TOUCH_TILE);
    expect(g.tile).toBeGreaterThanOrEqual(MIN_TOUCH_TILE);
    expect(g.maxCamX).toBe(12 * g.tile - (300 - 2 * PAD));
    expect(g.hiddenCols.left).toBe(0);
    expect(g.hiddenCols.right).toBeGreaterThan(0);
    const y = g.counterY + 1;
    expect(g.hitTest(PAD + 1, y)).toEqual({ row: -1, col: 0 });
    g.pan(-10_000, 0);
    expect(g.camX).toBe(g.maxCamX);
    expect(g.hiddenCols.right).toBe(0);
    expect(g.hitTest(300 - PAD - 1, y)).toEqual({ row: -1, col: 11 });
    expect(g.hitTest(300 - PAD - 1, g.bandY + 1)).toEqual({ row: -2, col: 11 });
    // Nothing off the canvas is hit, even where the floor runs on past it.
    g.pan(10_000, 0);
    expect(g.hitTest(300, y)).toBeNull();
  });

  it('a mouse fits tiles down to MIN_TILE, a finger only to MIN_TOUCH_TILE', () => {
    const mouse = new Geometry();
    mouse.fit(420, 500, 6, MIN_TILE);
    const touch = new Geometry();
    touch.fit(420, 500, 6, MIN_TOUCH_TILE);
    expect(mouse.tile).toBeGreaterThanOrEqual(MIN_TILE);
    expect(mouse.tile).toBeLessThan(MIN_TOUCH_TILE);
    expect(mouse.maxCamX).toBe(0);
    expect(touch.tile).toBeGreaterThanOrEqual(MIN_TOUCH_TILE);
    expect(touch.maxCamX).toBeGreaterThan(0);
  });

  it('a floor that scrolls sideways anyway grows with a tall canvas, but only so far', () => {
    const short = new Geometry();
    short.fit(360, 380, 6, MIN_TOUCH_TILE);
    const tall = new Geometry();
    tall.fit(360, 900, 6, MIN_TOUCH_TILE);
    expect(short.tile).toBe(MIN_TOUCH_TILE);
    expect(tall.tile).toBeGreaterThan(MIN_TOUCH_TILE);
    expect(tall.tile).toBeLessThanOrEqual(MIN_TOUCH_TILE * 1.2);
  });

  it('a pinch zooms about the fingers: the tile under them stays under them', () => {
    const g = new Geometry();
    g.fit(360, 600, 16, MIN_TOUCH_TILE);
    g.pan(-40, 60);
    const at = { x: 200, y: g.counterY - 2.5 * g.tile };
    const before = g.hitTest(at.x, at.y);
    expect(before).not.toBeNull();
    g.zoomAt(at.x, at.y, 1.5);
    expect(g.tile).toBeGreaterThan(MIN_TOUCH_TILE);
    expect(g.hitTest(at.x, at.y)).toEqual(before);
    g.zoomAt(at.x, at.y, 1 / 1.5);
    expect(g.hitTest(at.x, at.y)).toEqual(before);
  });

  it('centres the camera on a column, or a back-room tile, as far as the floor goes', () => {
    const g = new Geometry();
    g.fit(300, 420, 16, MIN_TOUCH_TILE);
    const mid = (col: number) => g.x0 + (col + 0.5) * g.tile;
    g.centerOn(null, 6);
    expect(Math.abs(mid(6) - 150)).toBeLessThan(1);
    // Column 11 cannot be centred: the camera stops at the floor's edge.
    g.centerOn(null, 11);
    expect(g.camX).toBe(g.maxCamX);
    g.centerOn(10, 3);
    const { y } = g.tileXY(10, 3);
    expect(Math.abs(y + g.tile / 2 - (PAD + g.counterY) / 2)).toBeLessThan(1);
    g.centerOn(0, 0);
    expect(g.camY).toBe(0);
    expect(g.camX).toBe(0);
  });

  it('says whether a back-room tile is in view, by its middle', () => {
    const g = new Geometry();
    g.fit(300, 420, 16, MIN_TOUCH_TILE);
    expect(g.shows(0, 0)).toBe(true);
    // Too far right, and too far back, for the window.
    expect(g.shows(0, 11)).toBe(false);
    expect(g.shows(15, 0)).toBe(false);
    g.centerOn(15, 11);
    expect(g.shows(15, 11)).toBe(true);
    expect(g.shows(0, 0)).toBe(false);
  });

  it('the zoom stays between ZOOM_MIN_TILE and ZOOM_MAX_TILE, and lasts through a refit', () => {
    const g = new Geometry();
    g.fit(360, 600, 6, MIN_TOUCH_TILE);
    g.zoomAt(100, 100, 100);
    expect(g.tile).toBe(ZOOM_MAX_TILE);
    g.zoomAt(100, 100, 0.0001);
    expect(g.tile).toBe(ZOOM_MIN_TILE);
    // Zoomed out, the whole floor fits across and nothing scrolls sideways.
    expect(g.maxCamX).toBe(0);
    g.fit(360, 600, 6, MIN_TOUCH_TILE);
    expect(g.tile).toBe(ZOOM_MIN_TILE);
  });
});
