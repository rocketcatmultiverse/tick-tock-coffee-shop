// Where the panels go, by the size of the window (docs/QUESTIONS.md, Q71).
// Always one screen with no page scroll: only a tab's own content scrolls.
//
// - wide: the floor with the tool bar down its left, the build palette along
//   the bottom, and the clock, the till, the newest regular and the tabs in a
//   column on the right. As on a desktop monitor.
// - tall, for a phone held upright or a narrow window: the clock along the
//   top, the floor, then the coins and the messages, the tool bar and the
//   palette along the bottom. The newest regular, the till and the tabs open
//   from the menu as a drawer over the floor.
// - flat, for a phone on its side or a short window: the floor on the left,
//   and the clock, the coins and the menu, the messages, the tool bar and the
//   palette in a column on the right. The drawer as in tall.
//
// The panels are built once and moved between these places, so nothing in
// them is lost when the window changes shape.
//
// The thumb stick (joystick.ts) takes the bottom right corner of the screen
// while a finger holds something: in tall across the tool bar and the
// palette, which narrow beside it; in flat at the foot of the column, with
// the tool bar beside it. In wide it sits over the floor's bottom right,
// since the corner of the screen is the tabs (Q73).

import { icon } from './art/icons';
import { el } from './el';

export type LayoutMode = 'wide' | 'tall' | 'flat';

/** The smallest window that keeps the side column beside the floor. */
export const WIDE_MIN_WIDTH = 960;
export const WIDE_MIN_HEIGHT = 560;
/** A smaller window this much wider than tall puts its controls beside the floor rather than under it. */
export const FLAT_RATIO = 1.2;
/** A wide window shorter than this has the clock on one line, as the narrow layouts do, so the tabs keep their room. */
export const SHORT_HEIGHT = 700;

export function layoutFor(width: number, height: number): LayoutMode {
  if (width >= WIDE_MIN_WIDTH && height >= WIDE_MIN_HEIGHT) return 'wide';
  return width >= height * FLAT_RATIO ? 'flat' : 'tall';
}

export interface ShellParts {
  title: HTMLElement;
  /** The banner while visiting someone else's shop. */
  visit: HTMLElement | null;
  clock: HTMLElement;
  coins: HTMLElement;
  next: HTMLElement;
  till: HTMLElement;
  tabs: HTMLElement;
  floor: HTMLElement;
  tools: HTMLElement;
  palette: HTMLElement;
  info: HTMLElement;
  stick: HTMLElement;
}

export class Shell {
  mode: LayoutMode | null = null;
  /** Opens the drawer, in tall and flat. */
  readonly menu = el('button', { className: 'menu-btn' }, icon('menu'));
  private close = el('button', { className: 'drawer-close' }, icon('close'));
  private side = el('aside', { className: 'side' });
  private head = el('div', { className: 'drawer-head' });
  private backdrop = el('div', { className: 'backdrop', hidden: true });
  private top = el('div', { className: 'topbar' });
  private dock = el('div', { className: 'dock' });
  private build = el('div', { className: 'card build' });
  private status = el('div', { className: 'dock-status' });
  private coinsRow = el('div', { className: 'coins-row' });

  constructor(
    private readonly root: HTMLElement,
    private readonly parts: ShellParts,
    private readonly changed: () => void,
  ) {
    this.menu.setAttribute('aria-label', 'Menu: regulars, the till, help and more');
    this.close.setAttribute('aria-label', 'Close the menu');
    this.menu.onclick = () => this.openDrawer();
    this.close.onclick = () => this.closeDrawer();
    this.backdrop.onclick = () => this.closeDrawer();
    window.addEventListener('resize', () => this.arrange());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeDrawer();
    });
    // The first arrangement is the page being built: whoever built the shell draws it once it is done.
    this.arrange(false);
  }

  get compact(): boolean {
    return this.mode !== 'wide';
  }

  get drawerOpen(): boolean {
    return this.side.classList.contains('open');
  }

  /** Put every panel where this window's layout wants it, and say so if anything moved. */
  arrange(notify = true): void {
    const mode = layoutFor(window.innerWidth, window.innerHeight);
    const short = mode === 'wide' && window.innerHeight < SHORT_HEIGHT;
    this.root.className = `layout-${mode}${mode === 'wide' ? '' : ' compact'}${short ? ' short' : ''}`;
    if (mode === this.mode) return;
    this.mode = mode;
    this.closeDrawer();
    const p = this.parts;
    const visit = p.visit ? [p.visit] : [];
    if (mode === 'wide') {
      this.side.replaceChildren(p.title, ...visit, p.clock, p.till, p.next, p.tabs);
      this.build.replaceChildren(p.palette, p.info);
      this.dock.replaceChildren(this.build);
      p.floor.append(p.stick);
      this.root.replaceChildren(p.tools, p.floor, this.dock, this.side);
    } else {
      this.head.replaceChildren(p.title, this.close);
      this.side.replaceChildren(this.head, ...visit, p.next, p.till, p.tabs);
      if (mode === 'tall') {
        this.top.replaceChildren(p.clock, this.menu);
        this.status.replaceChildren(p.coins, p.info);
        this.dock.replaceChildren(this.status, p.tools, p.palette, p.stick);
        this.root.replaceChildren(this.top, p.floor, this.dock, this.backdrop, this.side);
      } else {
        this.coinsRow.replaceChildren(p.coins, this.menu);
        this.dock.replaceChildren(p.clock, this.coinsRow, p.info, p.tools, p.palette, p.stick);
        this.root.replaceChildren(p.floor, this.dock, this.backdrop, this.side);
      }
    }
    if (notify) this.changed();
  }

  /** While the thumb stick shows, the dock makes room for it in the corner. */
  setHolding(holding: boolean): void {
    this.dock.classList.toggle('holding', holding);
  }

  /** Slide the drawer in over the floor. The wide layout has no drawer: its column is always there. */
  openDrawer(): void {
    if (!this.compact) return;
    this.side.classList.add('open');
    this.backdrop.hidden = false;
  }

  closeDrawer(): void {
    this.side.classList.remove('open');
    this.backdrop.hidden = true;
  }
}
