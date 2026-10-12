// The card that says a regular has walked in (docs/QUESTIONS.md, Q74): their
// portrait, what they order and where they sit, and what they bring to the
// palette, at the top of the floor. A tap or click on it brings their stool
// (or the cat's bowl) into view; the cross, or a few seconds, puts it away.
// The seconds only count while the page is in sight, so a regular who walked
// in while the player was away is still announced when they come back.

import type { RegularDef } from '../sim/types';
import { PIECE_LABEL } from '../game/pieces';
import { orderName, orderWhen } from '../game/regulars';
import type { WalkIn } from '../game/shop';
import { icon } from './art/icons';
import { portraitImg } from './art/dom';
import { el } from './el';

/** How long the card stays, while the page is in sight. */
const SHOW_MS = 10_000;

export class Toast {
  readonly root = el('div', { className: 'toast', hidden: true });
  private body = el('button', { className: 'toast-body' });
  private close = el('button', { className: 'toast-close' }, icon('close', 18));
  private def: RegularDef | null = null;
  private timer: number | undefined;

  constructor(
    private readonly touch: boolean,
    private readonly show: (def: RegularDef) => void,
  ) {
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-live', 'polite');
    this.close.setAttribute('aria-label', 'Dismiss');
    this.body.onclick = () => {
      if (this.def) this.show(this.def);
      this.hide();
    };
    this.close.onclick = () => this.hide();
    this.root.append(this.body, this.close);
    document.addEventListener('visibilitychange', () => this.countdown());
  }

  /** Announce a regular who just walked in. */
  walkIn(w: WalkIn): void {
    const { def } = w;
    this.def = def;
    const seat = def.bowl ? 'at the bowl' : `stool ${def.col}`;
    const brings = [
      ...(w.unlocked.length ? [`New in the palette: ${w.unlocked.map((p) => PIECE_LABEL[p]).join(', ')}.`] : []),
      ...(w.wellLimit !== null ? [`You may now own ${w.wellLimit} wells.`] : []),
    ];
    this.body.replaceChildren(
      portraitImg(def.id, 52, 'portrait'),
      el(
        'span',
        { className: 'toast-text' },
        el('span', { className: 'muted' }, def.bowl ? 'Your cat wants warm milk' : 'A new regular walks in'),
        el('span', { className: 'card-name' }, def.name),
        el('span', { className: 'order' }, `${orderName(def)}${orderWhen(def)} · ${seat}`),
        ...brings.map((line) => el('span', { className: 'toast-brings' }, line)),
        el('span', { className: 'muted toast-hint' }, `${this.touch ? 'Tap' : 'Click'} to see ${def.bowl ? 'the bowl' : 'their stool'}`),
      ),
    );
    this.body.setAttribute('aria-label', `${def.name} walks in: ${orderName(def)}${orderWhen(def)}, ${seat}. Show me.`);
    this.root.hidden = false;
    this.countdown();
  }

  /** Start the seconds when the page is in sight, and hold them while it is not. */
  private countdown(): void {
    window.clearTimeout(this.timer);
    if (this.root.hidden || document.visibilityState === 'hidden') return;
    this.timer = window.setTimeout(() => this.hide(), SHOW_MS);
  }

  private hide(): void {
    window.clearTimeout(this.timer);
    this.root.hidden = true;
    this.def = null;
  }
}
