// The card for the newest regular, the list of regulars and recent happenings.
// The card sits on the right under the clock; the list and the happenings are tabs.

import type { RegularDef } from '../sim/types';
import { orderName, orderWhen, type RegularState } from '../game/regulars';
import { HAPPY_LOOPS } from '../game/tuning';
import { portraitImg } from './art/dom';
import { el } from './el';
import { orderTipKey } from './tips';

const seatName = (def: RegularDef) => (def.bowl ? 'at the bowl' : `stool ${def.col}`);

/** The drink a regular orders, underlined: hovering it shows how it is made. */
const drinkTip = (def: RegularDef) => {
  const span = el('span', { className: 'tip', textContent: orderName(def) });
  span.dataset.tip = orderTipKey(def.order.drink, def.order.roast);
  return span;
};

/** Loops in a row with their cup, as filled pips out of HAPPY_LOOPS. */
export function happyPips(loops: number): HTMLSpanElement {
  const pips = el('span', { className: `pips${loops >= HAPPY_LOOPS ? ' happy' : ''}` });
  pips.title = loops >= HAPPY_LOOPS ? 'Happy' : `${loops} of ${HAPPY_LOOPS} loops in a row with their cup`;
  for (let k = 0; k < HAPPY_LOOPS; k++) pips.append(el('span', { className: k < loops ? 'pip on' : 'pip' }));
  return pips;
}

export class RegularsPanel {
  readonly next = el('div', { className: 'card next' });
  readonly list = el('ul', { className: 'reg-list' });
  readonly log = el('ul', { className: 'log' });
  private shown = '';

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
    this.next.replaceChildren();
    if (newcomer) {
      this.next.append(
        portraitImg(newcomer.id, 76, 'portrait big'),
        el(
          'div',
          { className: 'next-text' },
          el('div', { className: 'muted' }, 'Newest regular'),
          el('div', { className: 'card-name' }, newcomer.name),
          el('div', { className: 'order' }, drinkTip(newcomer), `${orderWhen(newcomer)} · ${seatName(newcomer)}`),
          el('div', { className: 'intro' }, `"${newcomer.intro}"`),
          el(
            'div',
            { className: 'muted' },
            happyPips(happiness[regulars.length - 1] ?? 0),
            ` Happy after ${HAPPY_LOOPS} loops in a row with their cup. The next regular walks in once everyone is happy.`,
          ),
        ),
      );
    } else {
      const allIn = regulars.length === defs.length;
      this.next.append(
        el(
          'div',
          { className: 'next-text' },
          el('div', { className: 'card-name' }, allIn ? 'Everyone is in' : 'The newest regular is happy'),
          el('div', { className: 'muted' }, allIn ? 'Keep them all served.' : 'The next one walks in once everyone is happy.'),
        ),
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
              `${seatName(defs[i])}: `,
              drinkTip(defs[i]),
              `${orderWhen(defs[i])}. ${r.status}${r.loyalty ? `, served ${r.loyalty}` : ''}`,
            ),
          ),
        ),
      ),
    );
    this.log.replaceChildren(...notes.map((n) => el('li', {}, n)));
  }
}
