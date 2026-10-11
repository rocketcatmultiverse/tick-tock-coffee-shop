// One floating tooltip for the whole page. Any element with a data-tip
// attribute shows one; the attribute is a key that `content` turns into the
// tooltip's body. Hover is followed on the document rather than on each
// element because the side panels rebuild their DOM as the shop runs: a
// rebuilt element with the same key keeps the tooltip open.
//
// A mouse hovers. A finger presses and holds instead, on a palette piece, a
// tool or anything else with a tooltip, and the click that would follow is
// swallowed so holding a piece does not also pick it; a plain tap on
// underlined words shows theirs too. A finger's tooltip stays until the next
// touch (docs/QUESTIONS.md, Q71).

import { el } from './el';

/** Hover this long before a tooltip shows; moving from one tooltip to the next shows it at once. */
const DELAY_MS = 250;
/** Press and hold this long for a finger's tooltip, without moving more than HOLD_SLOP pixels. */
const HOLD_MS = 450;
const HOLD_SLOP = 10;
/** Pixels between the element and its tooltip, and kept clear of the window's edges. */
const GAP = 8;
const EDGE = 8;

export class Tooltip {
  private root = el('div', { className: 'tooltip', hidden: true });
  /** The key shown, or waiting to show. */
  private key: string | null = null;
  /** A key the player clicked on: its tooltip stays away until the pointer moves to something else. */
  private dismissed: string | null = null;
  private timer: number | undefined;
  private x = 0;
  private y = 0;
  private bodies = new Map<string, Node>();
  /** A finger's tooltip, shown on a held or tapped element until the next touch. */
  private pinned: HTMLElement | null = null;
  private hold: { x: number; y: number; at: HTMLElement; timer: number } | null = null;
  /** The click after a hold that showed a tooltip does nothing else. */
  private swallowClick = false;
  /** Whether the last press was a finger: not every browser says so on the click itself. */
  private touched = false;

  constructor(private readonly content: (key: string) => Node | null) {
    this.root.setAttribute('role', 'tooltip');
    document.body.append(this.root);
    const mouse = (e: PointerEvent) => e.pointerType !== 'touch';
    document.addEventListener('pointermove', (e) => {
      if (mouse(e)) {
        this.x = e.clientX;
        this.y = e.clientY;
      } else if (this.hold && Math.hypot(e.clientX - this.hold.x, e.clientY - this.hold.y) > HOLD_SLOP) this.cancelHold();
    });
    document.addEventListener('pointerover', (e) => {
      if (!mouse(e)) return;
      this.x = e.clientX;
      this.y = e.clientY;
      this.over(e.target);
    });
    // Leaving the window.
    document.addEventListener('pointerout', (e) => {
      if (mouse(e) && !e.relatedTarget) this.hide();
    });
    document.addEventListener('pointerdown', (e) => {
      this.touched = !mouse(e);
      if (mouse(e)) {
        this.dismissed = this.key;
        this.hide();
        return;
      }
      this.hide();
      this.swallowClick = false;
      const at = tipOf(e.target);
      if (at) this.startHold(at, e.clientX, e.clientY);
    });
    document.addEventListener('pointerup', (e) => {
      if (!mouse(e)) this.cancelHold();
    });
    document.addEventListener('pointercancel', () => this.cancelHold());
    document.addEventListener(
      'click',
      (e) => {
        if (this.swallowClick) {
          this.swallowClick = false;
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        // A tap on underlined words, which do nothing else, shows their tooltip.
        const at = tipOf(e.target);
        if (at && at.classList.contains('tip') && this.touched) this.pin(at);
      },
      true,
    );
    // A held finger would otherwise open the browser's own menu.
    document.addEventListener('contextmenu', (e) => {
      if (tipOf(e.target)) e.preventDefault();
    });
    window.addEventListener('scroll', () => this.hide(), true);
  }

  /** Call after the page changes: a tooltip whose element has gone from under the pointer is put away. */
  refresh(): void {
    if (this.pinned) {
      if (!this.pinned.isConnected || this.pinned.getClientRects().length === 0) this.hide();
      return;
    }
    if (this.key !== null && this.anchor()?.dataset.tip !== this.key) this.hide();
  }

  /** The element with a tooltip under the mouse, if any. */
  private anchor(): HTMLElement | null {
    return tipOf(document.elementFromPoint(this.x, this.y));
  }

  private over(target: EventTarget | null): void {
    const key = tipOf(target)?.dataset.tip || null;
    if (key !== this.dismissed) this.dismissed = null;
    if (key === this.key) return;
    const warm = !this.root.hidden;
    this.hide();
    if (key === null || key === this.dismissed) return;
    this.key = key;
    this.timer = window.setTimeout(() => {
      const at = this.anchor();
      if (at && at.dataset.tip === key) this.show(at);
    }, warm ? 0 : DELAY_MS);
  }

  private startHold(at: HTMLElement, x: number, y: number): void {
    this.cancelHold();
    const timer = window.setTimeout(() => {
      this.hold = null;
      this.swallowClick = true;
      this.pin(at);
    }, HOLD_MS);
    this.hold = { x, y, at, timer };
  }

  private cancelHold(): void {
    if (this.hold) window.clearTimeout(this.hold.timer);
    this.hold = null;
  }

  private pin(at: HTMLElement): void {
    this.pinned = at;
    this.key = at.dataset.tip ?? null;
    this.show(at);
  }

  private show(at: HTMLElement): void {
    const key = at.dataset.tip;
    if (!key) return;
    let body = this.bodies.get(key);
    if (!body) {
      const made = this.content(key);
      if (!made) return;
      body = made;
      this.bodies.set(key, body);
    }
    this.root.replaceChildren(body);
    this.root.hidden = false;
    // Above the element if it fits, else below; centred on it, inside the window.
    const r = at.getBoundingClientRect();
    const w = this.root.offsetWidth;
    const h = this.root.offsetHeight;
    const top = r.top - GAP - h >= EDGE ? r.top - GAP - h : Math.min(r.bottom + GAP, window.innerHeight - h - EDGE);
    const left = Math.max(EDGE, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - EDGE));
    this.root.style.left = `${Math.round(left)}px`;
    this.root.style.top = `${Math.round(Math.max(EDGE, top))}px`;
  }

  private hide(): void {
    window.clearTimeout(this.timer);
    this.key = null;
    this.pinned = null;
    this.root.hidden = true;
  }
}

/** The nearest element with a tooltip, from an event's target. */
function tipOf(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('[data-tip]') : null;
}
