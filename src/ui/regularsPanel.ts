// The card for the next regular, the list of regulars and recent happenings.

import type { RegularDef } from '../sim/types';
import { describeOrder, type RegularState } from '../game/regulars';
import { el } from './panel';

export class RegularsPanel {
  readonly root = el('div', { className: 'regulars' });
  private card = el('div', { className: 'card' });
  private list = el('ul', { className: 'reg-list' });
  private log = el('ul', { className: 'log' });

  constructor() {
    this.root.append(el('h2', {}, 'Next regular'), this.card, el('h2', {}, 'Regulars'), this.list, el('h2', {}, 'Happenings'), this.log);
  }

  update(defs: readonly RegularDef[], regulars: RegularState[], newcomer: RegularDef | null, notes: string[]): void {
    this.card.replaceChildren();
    if (newcomer) {
      this.card.append(
        el('div', { className: 'card-name' }, `${newcomer.name} (stool ${newcomer.col})`),
        el('div', {}, describeOrder(newcomer)),
        el('div', { className: 'intro' }, `"${newcomer.intro}"`),
      );
    } else {
      this.card.append(el('div', {}, 'Everyone in the gray box is seated.'));
    }
    this.list.replaceChildren(
      ...regulars.map((r, i) =>
        el(
          'li',
          { className: r.status },
          `${defs[i].name}, stool ${defs[i].col}: ${describeOrder(defs[i])}. ${r.status}${r.loyalty ? `, served ${r.loyalty}` : ''}`,
        ),
      ),
    );
    this.log.replaceChildren(...notes.map((n) => el('li', {}, n)));
  }
}
