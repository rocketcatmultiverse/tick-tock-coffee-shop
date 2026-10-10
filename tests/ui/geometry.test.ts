// The floor's geometry and camera (docs/QUESTIONS.md, Q63): the floor is
// sized to show all its rows up to MAX_ROWS_IN_VIEW; beyond that the camera
// moves over the back room while the counter and the stools stay put.

import { describe, expect, it } from 'vitest';
import { Geometry, MAX_ROWS_IN_VIEW } from '../../src/ui/geometry';

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
});
