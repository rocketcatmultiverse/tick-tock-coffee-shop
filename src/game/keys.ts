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

/** Where a lesson just solved leads straight on to (Q81). */
export type AfterLesson = { to: 'lesson'; lesson: PuzzleDef } | { to: 'shop' };

/**
 * Once lesson `id` is solved (and in `solved`): on to the first lesson not
 * yet solved, or into the shop, with its keys, after the last. Null for a
 * puzzle that is not a lesson, which leads nowhere by itself.
 */
export function afterLesson(puzzles: readonly PuzzleDef[], id: string, solved: readonly string[]): AfterLesson | null {
  if (!lessons(puzzles).some((p) => p.id === id)) return null;
  const lesson = nextLesson(puzzles, solved);
  return lesson ? { to: 'lesson', lesson } : { to: 'shop' };
}
