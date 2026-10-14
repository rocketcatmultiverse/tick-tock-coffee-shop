// The very first thing a new shop shows (docs/QUESTIONS.md, Q82): a note in
// Grandpa's hand, taped over the first lesson. The shop is to be yours, but
// the lessons at the workbench are his test, your cousins have all failed it,
// and you are his last hope. Under the paper, the offer of the bench tour.

import { keyImg } from './art/dom';
import { el } from './el';
import { BENCH_TOUR_STEPS } from './tutorial';

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const inWords = (n: number) => NUMBER_WORDS[n] ?? String(n);
/** "the lamplighter": a regular's name in the middle of a sentence. */
const midSentence = (name: string) => name[0].toLowerCase() + name.slice(1);

export interface LetterText {
  greeting: string;
  lines: string[];
  /** "With love," and the name under it. */
  signoff: [string, string];
  ps: string;
  /** Under the paper: the offer of the bench tour. */
  tour: string;
}

/** Grandpa's note. `lessons` is how many there are; `first` is the regular who walks in first. Pure, so the tests can read it. */
export function keysLetter(lessons: number, first: string, menu = false): LetterText {
  const n = inWords(lessons);
  return {
    greeting: 'My dear grandchild,',
    lines: [
      'My knees can’t keep up with the clock any more, so the shop needs a new keeper. But the keys don’t go to just anyone.',
      `There are ${n} lessons on the workbench out the back. Think of them as my test. Pass all ${n}, and the shop is yours.`,
      'Your cousins all had a go, bless them. Barnaby flooded the back room. Clementine brewed something that bit. And we don’t talk about what Tobias did to the kettle.',
      'You’re my last hope. Don’t tell them I said so.',
    ],
    signoff: ['With love,', 'Grandpa'],
    ps: `P.S. ${first} comes in first thing every morning. Never keep ${midSentence(first)} waiting.`,
    tour: `A short tour shows you round the workbench in ${BENCH_TOUR_STEPS} quick steps. You can take it again any time from the Help tab${menu ? ', in the menu' : ''}.`,
  };
}

/** Show the note over the page, with the tour's two buttons under it. */
export function showLetter(words: LetterText, choose: { take(): void; skip(): void }): void {
  const take = el('button', { className: 'primary', textContent: 'Show me the workbench' });
  const skip = el('button', { textContent: 'Skip the tour' });
  const paper = el(
    'article',
    { className: 'letter' },
    el('p', { className: 'letter-greeting' }, words.greeting),
    ...words.lines.map((line) => el('p', {}, line)),
    el(
      'div',
      { className: 'letter-sign' },
      keyImg(56),
      el('div', {}, el('div', {}, words.signoff[0]), el('div', { className: 'letter-name' }, words.signoff[1])),
    ),
    el('p', { className: 'letter-ps' }, words.ps),
  );
  paper.setAttribute('aria-label', `A note from ${words.signoff[1]}`);
  const overlay = el(
    'div',
    { className: 'overlay letter-overlay' },
    el('div', { className: 'letter-wrap' }, paper, el('div', { className: 'letter-after' }, el('p', {}, words.tour), el('div', { className: 'row' }, skip, take))),
  );
  overlay.setAttribute('role', 'dialog');
  const close = (then: () => void) => () => {
    overlay.remove();
    then();
  };
  take.onclick = close(choose.take);
  skip.onclick = close(choose.skip);
  document.body.append(overlay);
  // On a short screen the overlay scrolls: keep the letter's first lines in view, not the button.
  take.focus({ preventScroll: true });
}
