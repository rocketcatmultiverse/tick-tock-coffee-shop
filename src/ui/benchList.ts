// The Workbench tab (docs/QUESTIONS.md, Q77): the ladders of puzzles open in
// this shop, the basics first and then one for each piece a regular has
// brought, each rung with its tier and a tick once solved. A rung opens once
// the one below it is solved; a ladder still to come is a question mark, so
// nothing is spoiled. Opening a puzzle leaves the shop for the bench.

import type { PieceKind, PuzzleDef } from '../sim/types';
import { LADDERS, type Ladder, TIER_NAME, laddersOpen, ladderName, puzzleOpen } from '../game/bench';
import { spriteImg } from './art/dom';
import { el } from './el';
import { PIECE_ICON } from './palette';

/** The sprite a ladder is shown with: its piece, or a kettle for the basics. */
const ladderIcon = (l: Ladder) => (l === 'basics' ? 'kettle:S:-' : PIECE_ICON[l]);

export class BenchList {
  readonly root = el('div', { className: 'bench-list' });
  private shown = '';

  constructor(
    private readonly puzzles: readonly PuzzleDef[],
    private readonly open: (id: string) => void,
  ) {}

  update(unlocked: ReadonlySet<PieceKind>, solved: ReadonlySet<string>): void {
    const key = JSON.stringify([[...unlocked].sort(), [...solved].sort()]);
    if (key === this.shown) return;
    this.shown = key;
    const open = new Set(laddersOpen(unlocked));
    this.root.replaceChildren(
      el(
        'p',
        { className: 'muted' },
        'Puzzles on a bench of their own: building there is free, and nothing on it touches your shop. ' +
          'Your regulars carry on while you are away at the bench, and you come back to the morning report.',
      ),
      ...LADDERS.map((l) => (open.has(l) ? this.ladder(l, unlocked, solved) : this.locked())),
    );
  }

  private ladder(l: Ladder, unlocked: ReadonlySet<PieceKind>, solved: ReadonlySet<string>): HTMLElement {
    const rungs = this.puzzles.filter((p) => p.ladder === l);
    const done = rungs.filter((p) => solved.has(p.id)).length;
    return el(
      'section',
      { className: 'ladder' },
      el(
        'div',
        { className: 'ladder-head' },
        spriteImg(ladderIcon(l), 28),
        el('span', { className: 'card-name' }, ladderName(l)),
        el('span', { className: 'muted' }, `${done} of ${rungs.length} solved`),
      ),
      el(
        'ol',
        { className: 'rungs' },
        ...rungs.map((p) => {
          const isOpen = puzzleOpen(this.puzzles, p.id, unlocked, solved);
          const b = el(
            'button',
            { className: `rung${solved.has(p.id) ? ' solved' : ''}`, disabled: !isOpen },
            el('span', { className: 'rung-mark' }, solved.has(p.id) ? '✓' : isOpen ? '' : '·'),
            el('span', { className: 'rung-name' }, p.name),
            el('span', { className: 'muted rung-tier' }, TIER_NAME[p.tier]),
          );
          b.title = isOpen ? `Open ${p.name}` : 'Solve the one above it first';
          b.onclick = () => this.open(p.id);
          return el('li', {}, b);
        }),
      ),
    );
  }

  private locked(): HTMLElement {
    return el(
      'section',
      { className: 'ladder locked' },
      el('div', { className: 'ladder-head' }, el('span', { className: 'guide-q' }, '?'), el('span', { className: 'muted' }, 'More puzzles come with a piece a regular still to come brings.')),
    );
  }
}
