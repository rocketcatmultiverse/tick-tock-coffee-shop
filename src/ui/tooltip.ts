// One floating tooltip for the whole page. Any element with a data-tip
// attribute shows one on hover; the attribute is a key that `content` turns
// into the tooltip's body. Hover is followed on the document rather than on
// each element because the side panels rebuild their DOM as the shop runs: a
// rebuilt element with the same key keeps the tooltip open.

import { el } from './el';

/** Hover this long before a tooltip shows; moving from one tooltip to the next shows it at once. */
const DELAY_MS = 250;
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

  constructor(private readonly content: (key: string) => Node | null) {
    this.root.setAttribute('role', 'tooltip');
    document.body.append(this.root);
    document.addEventListener('mousemove', (e) => {
      this.x = e.clientX;
      this.y = e.clientY;
    });
    document.addEventListener('mouseover', (e) => {
      this.x = e.clientX;
      this.y = e.clientY;
      this.over(e.target);
    });
    // Leaving the window.
    document.addEventListener('mouseout', (e) => {
      if (!e.relatedTarget) this.hide();
    });
    document.addEventListener('mousedown', () => {
      this.dismissed = this.key;
      this.hide();
    });
  }

  /** Call after the page changes: a tooltip whose element has gone from under the pointer is put away. */
  refresh(): void {
    if (this.key !== null && this.anchor()?.dataset.tip !== this.key) this.hide();
  }

  /** The element with a tooltip under the pointer, if any. */
  private anchor(): HTMLElement | null {
    return document.elementFromPoint(this.x, this.y)?.closest<HTMLElement>('[data-tip]') ?? null;
  }

  private over(target: EventTarget | null): void {
    const key = (target instanceof Element ? target.closest<HTMLElement>('[data-tip]')?.dataset.tip : undefined) || null;
    if (key !== this.dismissed) this.dismissed = null;
    if (key === this.key) return;
    const warm = !this.root.hidden;
    this.hide();
    if (key === null || key === this.dismissed) return;
    this.key = key;
    this.timer = window.setTimeout(() => this.show(key), warm ? 0 : DELAY_MS);
  }

  private show(key: string): void {
    const at = this.anchor();
    if (!at || at.dataset.tip !== key) return;
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
    this.root.hidden = true;
  }
}
