// The card for the next regular, the list of regulars and recent happenings.

import type { RegularDef } from '../sim/types';
import { describeOrder, type RegularState } from '../game/regulars';
import { HAPPY_LOOPS } from '../game/tuning';
import { portraitImg } from './art/dom';
import { el } from './panel';

const seatName = (def: RegularDef) => (def.bowl ? 'at the bowl' : `stool ${def.col}`);

/** Loops in a row with their cup, as filled pips out of HAPPY_LOOPS. */
export function happyPips(loops: number): HTMLSpanElement {
  const pips = el('span', { className: `pips${loops >= HAPPY_LOOPS ? ' happy' : ''}` });
  pips.title = loops >= HAPPY_LOOPS ? 'Happy' : `${loops} of ${HAPPY_LOOPS} loops in a row with their cup`;
  for (let k = 0; k < HAPPY_LOOPS; k++) pips.append(el('span', { className: k < loops ? 'pip on' : 'pip' }));
  return pips;
}

export class RegularsPanel {
  readonly root = el('div', { className: 'regulars' });
  private card = el('div', { className: 'card next' });
  private list = el('ul', { className: 'reg-list' });
  private log = el('ul', { className: 'log' });
  private shown = '';

  constructor() {
    this.root.append(
      el('h2', {}, 'Next regular'),
      this.card,
      el('details', { className: 'card', open: true }, el('summary', {}, 'Regulars'), this.list),
      el('h2', {}, 'Happenings'),
      el('div', { className: 'card' }, this.log),
    );
  }

  update(
    defs: readonly RegularDef[],
    regulars: RegularState[],
    happiness: number[],
    newcomer: RegularDef | null,
    notes: string[],
  ): void {
    // Rebuild only when something changed, so portraits are not reloaded every tick.
    const key = JSON.stringify([newcomer?.id ?? null, regulars, happiness, notes]);
    if (key === this.shown) return;
    this.shown = key;
    this.card.replaceChildren();
    if (newcomer) {
      this.card.append(
        portraitImg(newcomer.id, 110, 'portrait big'),
        el('div', { className: 'card-name' }, newcomer.name),
        el('div', { className: 'order' }, describeOrder(newcomer)),
        el('div', { className: 'muted' }, seatName(newcomer)),
        el('div', { className: 'intro' }, `"${newcomer.intro}"`),
        happyPips(happiness[regulars.length - 1] ?? 0),
        el('div', { className: 'muted' }, `Happy after ${HAPPY_LOOPS} loops in a row with their cup. The next regular walks in once everyone is happy.`),
      );
    } else {
      const allIn = regulars.length === defs.length;
      this.card.append(
        el('div', {}, allIn ? 'Everyone is in, and the newest regular is happy.' : 'The newest regular is happy.'),
        el('div', { className: 'muted' }, allIn ? 'Keep them all served.' : 'The next one walks in once everyone is happy.'),
      );
    }
    this.list.replaceChildren(
      ...regulars.map((r, i) =>
        el(
          'li',
          { className: r.status },
          portraitImg(defs[i].id, 30),
          el(
            'div',
            {},
            el('div', { className: 'card-name' }, defs[i].name, ' ', happyPips(happiness[i] ?? 0)),
            el(
              'div',
              { className: 'muted' },
              `${seatName(defs[i])}: ${describeOrder(defs[i])}. ${r.status}${r.loyalty ? `, served ${r.loyalty}` : ''}`,
            ),
          ),
        ),
      ),
    );
    this.log.replaceChildren(...notes.map((n) => el('li', {}, n)));
  }
}
