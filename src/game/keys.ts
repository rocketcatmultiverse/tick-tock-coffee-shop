// The keys to the shop (docs/QUESTIONS.md, Q80): a new shop is not the
// player's until they have learned the basics. Its lessons are the hands-on
// rungs of the basics ladder at the workbench, taken in order, as any rungs
// are. Once every one is solved the keys are handed over and the shop opens
// for the first time. A save from before the lessons was its owner's already.

import type { PuzzleDef } from '../sim/types';

/** The lessons before the keys: every hands-on rung of the basics, in ladder order. */
export function lessons(puzzles: readonly PuzzleDef[]): PuzzleDef[] {
  return puzzles.filter((p) => p.ladder === 'basics' && p.tier === 'tutorial');
}

/** The first lesson not yet solved, or null once every one is. */
export function nextLesson(puzzles: readonly PuzzleDef[], solved: readonly string[]): PuzzleDef | null {
  return lessons(puzzles).find((p) => !solved.includes(p.id)) ?? null;
}
