// The panels around the floor: plain DOM, updated in place on every render.
// The clock and its controls, the till, the line of messages under the
// palette, and the tabs. Floor rows are bought on the floor itself (Q76). Where each goes depends on the
// window (layout.ts); the panels themselves do not know.

import { roastForTick } from '../sim/items';
import { LOOP } from '../sim/tuning';
import { clockFace } from './art/dom';
import { icon } from './art/icons';
import { svgUrl } from './art/raster';
import { el } from './el';

export interface PanelModel {
  T: number;
  running: boolean;
  speed: number;
  till: number;
  gears: number;
  spillsThisLoop: number;
  spillsLastLoop: number;
  milk: string;
  /** "3 seated", "all happy" and the like. */
  seated: string;
  message: string;
  hoverInfo: string;
  bufferInfo: string;
  /** What the narrow layouts' coins line says instead of the coins, as at the workbench. */
  coinsText?: string;
}

export interface PanelActions {
  togglePause(): void;
  stepOnce(): void;
  setSpeed(n: number): void;
}

const ROAST_LEGEND: [string, number, number][] = [
  ['Light', 0, 3],
  ['Medium', 4, 7],
  ['Dark', 8, 11],
];

export class Panel {
  /** The clock and the time controls. */
  readonly clock: HTMLElement;
  /** The till, and how the shop is doing. */
  readonly tillCard: HTMLElement;
  /** The coins alone, for a narrow window's top bar. */
  readonly coins = el('div', { className: 'coins' });
  /** What just happened, and what is under the cursor or was last tapped. */
  readonly info: HTMLElement;

  private dial = el('img', { className: 'dial', width: 104, height: 104, alt: 'The shop clock' });
  private dialTick: number | null | undefined = undefined;
  private tickBig = el('div', { className: 'big tick-big' });
  private tickSmall = el('div', { className: 'muted tick-small' });
  private playLabel = el('span', { className: 'btn-label' });
  private playIcon = el('span', { className: 'btn-icon' });
  private playBtn = el('button', { className: 'primary play' }, this.playIcon, this.playLabel);
  private stepBtn = el('button', { className: 'step' }, el('span', { className: 'btn-icon' }, icon('step', 18)), el('span', { className: 'btn-label', textContent: 'Step' }));
  private speed = el('select', { className: 'speed' });
  private till = el('div', { className: 'big' });
  private gears = el('div', { className: 'muted' });
  private seated = el('div');
  private spills = el('div', { className: 'muted' });
  private milk = el('div', { className: 'muted' });
  private message = el('div', { className: 'message' });
  private hover = el('div', { className: 'hover' });
  private bufferInfo = el('div', { className: 'muted buffer-info' });
  private running: boolean | null = null;

  constructor(actions: PanelActions, private readonly refundHint: string) {
    this.playBtn.onclick = () => actions.togglePause();
    this.stepBtn.onclick = () => actions.stepOnce();
    this.stepBtn.setAttribute('aria-label', 'Step one tick');
    for (const n of [1, 2, 4]) this.speed.append(el('option', { value: String(n), textContent: `${n}×` }));
    this.speed.setAttribute('aria-label', 'Speed');
    this.speed.onchange = () => actions.setSpeed(Number(this.speed.value));

    const legend = el(
      'div',
      { className: 'legend' },
      ...ROAST_LEGEND.map(([name, a, b]) => el('div', {}, el('span', { className: `swatch ${name.toLowerCase()}` }), `${name} ${a}–${b}`)),
    );
    this.clock = el(
      'div',
      { className: 'card clock' },
      el(
        'div',
        { className: 'clock-top' },
        this.dial,
        el('div', { className: 'clock-text' }, el('div', { className: 'muted tick-label' }, 'Tick'), this.tickBig, legend, this.tickSmall),
      ),
      el('div', { className: 'controls' }, this.playBtn, this.stepBtn, this.speed),
    );

    this.tillCard = el(
      'div',
      { className: 'card till-card' },
      el('div', { className: 'till-line' }, this.till, this.gears),
      this.seated,
      this.spills,
      this.milk,
    );

    this.info = el('div', { className: 'info' }, this.message, this.hover, this.bufferInfo);
  }

  update(m: PanelModel): void {
    // The floor shows the result of the last tick run, so the clock names that tick.
    const shown = m.T - 1;
    const t = shown >= 0 ? shown % LOOP : null;
    if (t !== this.dialTick) {
      this.dial.src = svgUrl(clockFace(t));
      this.dialTick = t;
    }
    this.tickBig.textContent = t === null ? '– / 12' : `${t} / 12`;
    this.tickSmall.textContent = t === null ? 'not started' : `${roastForTick(t)} roast · T = ${shown}`;
    if (m.running !== this.running) {
      this.running = m.running;
      this.playLabel.textContent = m.running ? 'Pause' : 'Play';
      this.playIcon.replaceChildren(icon(m.running ? 'pause' : 'play', 18));
      this.playBtn.setAttribute('aria-label', m.running ? 'Pause' : 'Play');
    }
    this.stepBtn.disabled = m.running;
    this.speed.value = String(m.speed);
    this.till.textContent = `${m.till.toLocaleString()} coins`;
    this.coins.textContent = m.coinsText ?? `${m.till.toLocaleString()} coins`;
    this.gears.textContent = `· ${m.gears.toLocaleString()} gear${m.gears === 1 ? '' : 's'}`;
    this.seated.textContent = m.seated;
    this.spills.textContent = `Spills: ${m.spillsThisLoop} this loop, ${m.spillsLastLoop} last loop`;
    this.milk.textContent = m.milk;
    this.bufferInfo.textContent = m.bufferInfo;
    this.message.textContent = m.message;
    this.hover.textContent = m.hoverInfo || this.refundHint;
  }
}

/** A card with a row of tabs; one pane shows at a time and scrolls on its own. */
export class Tabs {
  readonly root = el('div', { className: 'card tabs' });
  private buttons = new Map<string, HTMLButtonElement>();
  private panes = new Map<string, HTMLElement>();
  private body = el('div', { className: 'tab-body' });

  constructor(
    tabs: { id: string; label: string; content: Node[] }[],
    private readonly onSelect: (id: string) => void = () => {},
  ) {
    const bar = el('div', { className: 'tab-bar' });
    bar.setAttribute('role', 'tablist');
    for (const t of tabs) {
      const b = el('button', { className: 'tab', textContent: t.label });
      b.setAttribute('role', 'tab');
      b.onclick = () => this.select(t.id);
      this.buttons.set(t.id, b);
      bar.append(b);
      const pane = el('div', { className: 'pane' }, ...t.content);
      this.panes.set(t.id, pane);
      this.body.append(pane);
    }
    this.root.append(bar, this.body);
    this.select(tabs[0].id);
  }

  /** The tab showing. */
  current = '';

  /** A tab's button, for the tour to point at. */
  button(id: string): HTMLElement {
    return this.buttons.get(id)!;
  }

  select(id: string): void {
    if (id !== this.current) this.body.scrollTop = 0;
    this.current = id;
    for (const [k, b] of this.buttons) {
      b.classList.toggle('active', k === id);
      b.setAttribute('aria-selected', String(k === id));
    }
    for (const [k, p] of this.panes) p.hidden = k !== id;
    this.onSelect(id);
  }
}

/** The mouse and the keys. */
const KEYS = [
  'Click a palette piece, or press its number key (1 to 9, then 0), then click the floor. Drag to lay belts.',
  'Hover a palette piece for its rules, and an underlined drink for how it is made. The Guide tab has them all.',
  'R turn · F flip · Esc or right-click put down',
  'Z delete, with a full refund · X cut · C copy (the tile under the cursor, or the one last clicked)',
  'Shift+drag box select, then Z, Ctrl+X, Ctrl+C',
  'Ctrl+V pick up the buffer · Ctrl+wheel older entries',
  'Ctrl+Z undo · Ctrl+Y redo',
  'Space pause · . step one tick',
  'Right-drag, middle-drag or the mouse wheel: look around a big floor',
  'The row of tiles for sale at the top of the floor buys one more row: click it, then again to be sure. Never refunded.',
  'The tool bar beside the floor does all of this with a click, too.',
];

/** Fingers. */
const TOUCH = [
  'Tap a palette piece: its ghost appears on the tile you last tapped, if it is in view, or else in the middle of the floor. Swipe across the palette, or use its arrows, for more pieces.',
  'Move the ghost with the stick at the bottom right, and tap Place in its middle to put the piece down. Or tap a tile to move the ghost there, and tap the ghost to put it down.',
  'Holding a belt, tap Lay to start a run: moving the ghost lays belts that turn to follow it. Tap Stop to end the run.',
  'Turn is first in the tool bar while you hold something, then Put down (in red), then Flip, greyed out when it would change nothing.',
  'Drag one finger to look around. With nothing in hand, tap a tile to see what is on it, then Delete (a full refund), Cut or Copy it.',
  'Two fingers drag to look around, or pinch to zoom, at any time.',
  'The row of tiles for sale at the top of the floor buys one more row: tap it, then again to be sure. Never refunded.',
  'Select, then drag a box: Delete, Cut and Copy work on all of it. Paste picks up what you last cut, copied or deleted.',
  'Press and hold a palette piece or a tool for what it does, and tap an underlined drink for how it is made. The Guide tab has them all.',
];

/** What the floor's marks mean, for any player. */
const MARKS = [
  'Splitter edges: yellow outputs, green where the next item goes, red where it would spill.',
  'A stool reads t9 · s9: its regular wants a cup on tick 9, which is the cup in slot 9. ● Just in Time, ◐ served, ✕ a miss.',
];

/** At the workbench: what is different there (docs/QUESTIONS.md, Q77). */
const BENCH = [
  'Every piece is free here, and the bench is the size it is: there are no rows to buy.',
  'Pieces with brass bolts came with the bench and stay put. The palette says how many of each piece are left.',
  'The tray wants the same things every loop. Fill its order on loops in a row and the puzzle is solved.',
  'Start over clears the floor of items and starts the clock again from tick 0, keeping your pieces.',
];

/** The controls as said at the workbench: no row for sale, and no coins to get back. */
export function benchLines(lines: readonly string[]): string[] {
  return lines.filter((t) => !t.includes('for sale')).map((t) => t.replace(', with a full refund', '').replace(' (a full refund)', ''));
}

/**
 * The tour, the controls for this device first, and credits for the fonts. At
 * the workbench (no tour to take) a note on the bench comes first instead, and
 * the controls leave out the shop's rows and refunds.
 */
export function helpPane(startTour: (() => void) | null, touch: boolean): HTMLElement[] {
  const list = (lines: string[]) => el('ul', { className: 'keys' }, ...lines.map((t) => el('li', {}, t)));
  const keys = startTour ? KEYS : benchLines(KEYS);
  const fingers = startTour ? TOUCH : benchLines(TOUCH);
  const [first, firstName, other, otherName] = touch ? [fingers, 'Touch', keys, 'Mouse and keys'] : [keys, 'Mouse and keys', fingers, 'Touch'];
  let lead: HTMLElement;
  if (startTour) {
    const tour = el('button', { className: 'primary', textContent: 'Take the tour' });
    tour.onclick = startTour;
    lead = el('div', { className: 'help-tour' }, tour, el('span', { className: 'muted' }, 'A few short steps: the clock, slots, your first four pieces and the workbench.'));
  } else lead = list(BENCH);
  return [
    lead,
    el('h3', { className: 'help-head' }, firstName),
    list(first),
    // The stools and slots are the shop's; the Guide tab reads the bench's own marks.
    ...(startTour ? [list(MARKS)] : []),
    el('details', {}, el('summary', {}, otherName), list(other)),
    el(
      'p',
      { className: 'credits' },
      'Fonts: Caveat Brush and Patrick Hand, under the SIL Open Font License (',
      el('a', { href: 'licenses/OFL-CaveatBrush.txt', target: '_blank', textContent: 'Caveat Brush' }),
      ', ',
      el('a', { href: 'licenses/OFL-PatrickHand.txt', target: '_blank', textContent: 'Patrick Hand' }),
      ').',
    ),
  ];
}
