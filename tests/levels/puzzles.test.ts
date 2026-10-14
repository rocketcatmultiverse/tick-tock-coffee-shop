// Workbench puzzles (docs/QUESTIONS.md, Q77): every puzzle is well made, and
// its reference solution solves it. The solutions are fixtures: a rule change
// that breaks one is a finding to report, not something to patch around.
//
// The repo is public, so the solutions are not in it (Q78): they live in the
// git-ignored puzzle-solutions/ folder. Where it is missing, as on a fresh
// clone or in the deploy workflow, the solution runs are skipped and the test
// output counts them as skipped; every other check here still runs.

import { describe, expect, it } from 'vitest';
import { LADDERS, Workbench, parseBoard, steadyVerdict } from '../../src/game/bench';
import { rightsAfter } from '../../src/game/build';
import { pieceOf } from '../../src/game/pieces';
import { BENCH_SOLVE_LOOPS } from '../../src/game/tuning';
import { PUZZLES } from '../../src/levels/puzzles';
import { REGULARS } from '../../src/levels/regulars';
import { renderFloor } from '../../src/sim/text';
import type { PieceKind, Structure } from '../../src/sim/types';

/** The reference solutions, by puzzle id, if puzzle-solutions/ is here. */
const SOLUTIONS: Record<string, string[]> | null =
  Object.values(import.meta.glob<Record<string, string[]>>('../../puzzle-solutions/solutions.ts', { eager: true, import: 'PUZZLE_SOLUTIONS' }))[0] ?? null;

/** Loops a reference solution may take to settle before its streak starts. */
const SETTLE_LOOPS = 3;
const TIERS = ['tutorial', 'teaser', 'mastery'] as const;

/** Regulars in when a ladder opens: none for the basics, else the first whose walk-in unlocks its piece. */
function walkedInWhenOpen(ladder: (typeof LADDERS)[number]): number {
  if (ladder === 'basics') return 1;
  for (let n = 1; n <= REGULARS.length; n++) if (rightsAfter(REGULARS, n).unlocked.has(ladder)) return n;
  throw new Error(`No regular unlocks ${ladder}`);
}

/** The pieces a solution adds to its puzzle's bench, by tile. */
function solutionPieces(solutions: Record<string, string[]>, id: string): [number, Structure][] {
  const def = PUZZLES.find((p) => p.id === id)!;
  const start = parseBoard(def.board);
  const sol = parseBoard(solutions[id]);
  expect(sol.cols, id).toBe(start.cols);
  expect(sol.layout.rows, id).toBe(start.layout.rows);
  expect([...sol.holes], id).toEqual([...start.holes]);
  for (const i of start.fixed) expect(sol.layout.tiles[i], `${id}: the solution keeps tile ${i}`).toEqual(start.layout.tiles[i]);
  return sol.layout.tiles.flatMap((s, i): [number, Structure][] => (s && !start.fixed.has(i) ? [[i, s]] : []));
}

describe('Workbench puzzles', () => {
  it('have their own ids', () => {
    const ids = PUZZLES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.skipIf(!SOLUTIONS)('have a reference solution each, in puzzle-solutions/', () => {
    expect(Object.keys(SOLUTIONS!).sort()).toEqual(PUZZLES.map((p) => p.id).sort());
  });

  it('give every ladder a rung of each tier, in order from hands-on to mastery', () => {
    for (const ladder of LADDERS) {
      const tiers = PUZZLES.filter((p) => p.ladder === ladder).map((p) => TIERS.indexOf(p.tier));
      expect(new Set(tiers), ladder).toEqual(new Set([0, 1, 2]));
      expect(tiers, ladder).toEqual([...tiers].sort((a, b) => a - b));
    }
  });

  it('use only pieces unlocked by the time their ladder opens, placed or on the bench', () => {
    for (const def of PUZZLES) {
      const unlocked = rightsAfter(REGULARS, walkedInWhenOpen(def.ladder)).unlocked;
      for (const piece of Object.keys(def.pieces) as PieceKind[]) expect(unlocked.has(piece), `${def.id} offers ${piece}`).toBe(true);
      for (const s of parseBoard(def.board).layout.tiles) {
        const piece = s && pieceOf(s.kind);
        if (piece) expect(unlocked.has(piece), `${def.id} has ${piece} on its bench`).toBe(true);
      }
    }
  });

  it('bring pails exactly when there is a side door, on the bench or offered', () => {
    for (const def of PUZZLES) {
      const door = def.board.some((l) => l.split(/\s+/).includes('D')) || 'door' in def.pieces;
      expect((def.milkPails ?? 0) > 0, def.id).toBe(door);
    }
  });

  it('are not solved by the bench as it comes', () => {
    for (const def of PUZZLES) expect(steadyVerdict(parseBoard(def.board).layout, def).ok, def.id).toBe(false);
  });

  for (const def of PUZZLES) {
    it.skipIf(!SOLUTIONS)(`${def.id}: the reference solution keeps to the puzzle's pieces and solves it`, () => {
      const placed = solutionPieces(SOLUTIONS!, def.id);
      const bench = new Workbench(def, placed);
      // Every piece went down: none off the bench, on a fixed tile, or past the puzzle's limits.
      expect(bench.placed(), def.id).toEqual(placed);
      for (let k = 0; k < (SETTLE_LOOPS + BENCH_SOLVE_LOOPS) * 12 && !bench.solved; k++) bench.tick();
      expect(bench.solved, `${def.id}: ${bench.lastVerdict?.why}\n${renderFloor(bench.layout, bench.sim)}`).toBe(true);
    });
  }
});
