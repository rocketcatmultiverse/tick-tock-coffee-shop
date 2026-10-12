// The thumb stick (docs/QUESTIONS.md, Q72): a push past the dead zone moves
// the ghost one tile the way it mostly points, up the screen being north;
// held, it repeats faster the further it is pushed; the ghost stays on the floor.

import { describe, expect, it } from 'vitest';
import { DEAD_ZONE, stepEvery, stepSpot, stickDir } from '../../src/ui/joystick';

const REACH = 30;

describe('The thumb stick', () => {
  it('does nothing inside the dead zone', () => {
    expect(stickDir(0, 0, REACH)).toBeNull();
    expect(stickDir(DEAD_ZONE * REACH - 1, 0, REACH)).toBeNull();
    expect(stickDir(3, -3, REACH)).toBeNull();
  });

  it('points the way it is mostly pushed, up the screen being north', () => {
    expect(stickDir(0, -REACH, REACH)).toBe('N');
    expect(stickDir(0, REACH, REACH)).toBe('S');
    expect(stickDir(REACH, 0, REACH)).toBe('E');
    expect(stickDir(-REACH, 0, REACH)).toBe('W');
    expect(stickDir(20, -12, REACH)).toBe('E');
    expect(stickDir(-12, 20, REACH)).toBe('S');
  });

  it('repeats faster the further it is pushed', () => {
    expect(stepEvery(DEAD_ZONE)).toBeGreaterThan(stepEvery(0.7));
    expect(stepEvery(0.7)).toBeGreaterThan(stepEvery(1));
    expect(stepEvery(2)).toBe(stepEvery(1));
    expect(stepEvery(0)).toBe(stepEvery(DEAD_ZONE));
  });

  it('north is a row further from the counter, and the ghost stays on the floor', () => {
    expect(stepSpot({ row: 2, col: 5 }, 'N', 6)).toEqual({ row: 3, col: 5 });
    expect(stepSpot({ row: 2, col: 5 }, 'S', 6)).toEqual({ row: 1, col: 5 });
    expect(stepSpot({ row: 2, col: 5 }, 'E', 6)).toEqual({ row: 2, col: 6 });
    expect(stepSpot({ row: 0, col: 5 }, 'S', 6)).toEqual({ row: 0, col: 5 });
    expect(stepSpot({ row: 5, col: 5 }, 'N', 6)).toEqual({ row: 5, col: 5 });
    expect(stepSpot({ row: 2, col: 0 }, 'W', 6)).toEqual({ row: 2, col: 0 });
    expect(stepSpot({ row: 2, col: 11 }, 'E', 6)).toEqual({ row: 2, col: 11 });
  });
});
