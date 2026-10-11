// The Guide tab: every tooltip in one place, for a touch screen with no
// hover and for anyone who wants to look something up (docs/QUESTIONS.md,
// Q71). Each piece unlocked so far, each drink a regular here orders, floor
// rows, and what the marks on the floor mean. Pieces still to come stay a
// question mark, and drinks nobody has ordered yet are left out: no spoilers.

import type { RegularDef, Roast } from '../sim/types';
import { ALL_PIECES, PIECE_LABEL, type PieceKind } from '../game/pieces';
import type { Ingredient } from '../game/recipes';
import { FLOOR_ROW_PRICE, HAPPY_LOOPS, PIECE_PRICE } from '../game/tuning';
import { spriteImg } from './art/dom';
import { el } from './el';
import { PIECE_ICON } from './palette';
import { LOCKED_LINE, coins, drinkSprite, drinkTitle, orderBody, pieceBody, rowBody } from './tips';

/** What the floor's marks mean. */
export const FLOOR_MARKS: string[] = [
  'The numbers riding the feeder and the counter are slots. A cup keeps its slot all the way along, and each extra tile in its line makes it ride one slot later.',
  'A stool reads t9 · s9: its regular wants a cup on tick 9, which is the cup in slot 9. An any-tick regular reads any, and the slot they last took a cup from.',
  `Under the portrait, from the floor as it runs: ● Just in Time, ◐ served, ✕ a miss. The pips are loops in a row with their cup; ${HAPPY_LOOPS} make a regular happy.`,
  "A kettle's needle points at the tick its last input landed on. A roaster's tag counts the ticks its batch has been in; a spring's counts what is inside.",
  'Splitter edges: yellow for its outputs, green where the next item goes, red where it would spill.',
  'A splash is an item spilled on that tick.',
];

export interface GuideModel {
  unlocked: ReadonlySet<PieceKind>;
  rowsLocked: boolean;
  /** The regulars who have walked in, in order. */
  regulars: readonly RegularDef[];
}

/** Each drink ordered by these regulars, once, with who orders it. */
export function drinksOrdered(regulars: readonly RegularDef[]): { want: Ingredient; key: string; who: string[] }[] {
  const out = new Map<string, { want: Ingredient; key: string; who: string[] }>();
  for (const def of regulars) {
    const roast: Roast | null = def.order.roast === 'any' ? null : def.order.roast;
    const key = `drink:${def.order.drink}:${def.order.roast}`;
    const entry = out.get(key) ?? { want: { kind: def.order.drink, roast }, key, who: [] };
    entry.who.push(def.name.replace(/^The /, 'the '));
    out.set(key, entry);
  }
  return [...out.values()];
}

export class Guide {
  readonly root = el('div', { className: 'guide' });
  private shown = '';
  private entries = new Map<string, HTMLDetailsElement>();

  update(m: GuideModel): void {
    const key = JSON.stringify([[...m.unlocked].sort(), m.rowsLocked, m.regulars.map((d) => d.id)]);
    if (key === this.shown) return;
    this.shown = key;
    // Keep open whatever the player had open.
    const open = new Set([...this.entries].filter(([, d]) => d.open).map(([k]) => k));
    this.entries.clear();
    const pieces = ALL_PIECES.map((piece) =>
      m.unlocked.has(piece)
        ? this.entry(`piece:${piece}`, spriteImg(PIECE_ICON[piece], 30), PIECE_LABEL[piece], coins(PIECE_PRICE[piece]), pieceBody(piece))
        : el('div', { className: 'guide-locked' }, el('span', { className: 'guide-q' }, '?'), el('span', { className: 'muted' }, LOCKED_LINE)),
    );
    const drinks = drinksOrdered(m.regulars).map((d) =>
      this.entry(d.key, spriteImg(drinkSprite(d.want), 30), drinkTitle(d.want), `for ${d.who.join(', ')}`, orderBody(d.want)),
    );
    this.root.replaceChildren(
      el('p', { className: 'muted' }, 'Everything the tooltips say. Open an entry to read it.'),
      el('h3', { className: 'guide-head' }, 'Pieces'),
      ...pieces,
      el('h3', { className: 'guide-head' }, 'Drinks'),
      ...(drinks.length ? drinks : [el('p', { className: 'muted' }, 'No regular has ordered yet.')]),
      el('h3', { className: 'guide-head' }, 'The floor'),
      this.entry('rows', null, 'Floor rows', m.rowsLocked ? 'not for sale yet' : coins(FLOOR_ROW_PRICE), rowBody(m.rowsLocked)),
      this.entry('marks', null, 'Reading the floor', '', [el('ul', { className: 'tip-rules' }, ...FLOOR_MARKS.map((t) => el('li', {}, t)))]),
    );
    for (const k of open) {
      const d = this.entries.get(k);
      if (d) d.open = true;
    }
  }

  /** Open the entry `key` names, such as "piece:kettle", and scroll the tab to it. */
  open(key: string): void {
    const d = this.entries.get(key);
    if (!d) return;
    d.open = true;
    const body = this.root.closest<HTMLElement>('.tab-body');
    if (!body) return;
    body.scrollTop += d.getBoundingClientRect().top - body.getBoundingClientRect().top;
    // In a short drawer the tabs themselves may be below the fold.
    body.parentElement?.scrollIntoView({ block: 'nearest' });
  }

  private entry(key: string, pic: HTMLElement | null, name: string, aside: string, body: HTMLElement[]): HTMLDetailsElement {
    const summary = el(
      'summary',
      { className: 'guide-summary' },
      ...(pic ? [pic] : []),
      el('span', { className: 'guide-name' }, name),
      el('span', { className: 'muted guide-aside' }, aside),
    );
    const d = el('details', { className: 'guide-entry' }, summary, el('div', { className: 'guide-body' }, ...body));
    this.entries.set(key, d);
    return d;
  }
}
