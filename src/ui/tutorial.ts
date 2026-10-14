// The tour: a few short steps that point at the clock, the newest regular,
// the first four pieces, the feeder, the slots, the till, the workbench
// puzzles (docs/QUESTIONS.md, Q77) and the Help tab.
// It is offered once per shop, can be skipped at any step, and can be taken
// again from the Help tab. The floor keeps running and stays clickable
// underneath. Every number in the words comes from the tuning files. On a
// touch screen the words say tap rather than click and name no keys, and in a
// narrow window they find the Help tab in the menu (docs/QUESTIONS.md, Q71).

import type { Roast } from '../sim/types';
import { BREW_TIME, GROWTH, LOOP, WELL_TICK } from '../sim/tuning';
import { ALL_PIECES, PIECE_LABEL, type PieceKind } from '../game/pieces';
import { kettleTicks } from '../game/recipes';
import { FLOOR_ROW_PRICE, HAPPY_LOOPS, START_COINS, START_PIECES, START_ROWS } from '../game/tuning';
import { spriteImg } from './art/dom';
import { el } from './el';
import { pieceKey } from './hotkeys';
import { PIECE_ICON } from './palette';
import { ROWS_WAIT, tickRange } from './tips';

const ticks = (n: number) => `${n} tick${n === 1 ? '' : 's'}`;
const ROASTS: Roast[] = ['light', 'medium', 'dark'];

/** The stool the slots step reads out: a timed regular's tick and the slot that serves it. */
export interface StoolExample {
  tick: number;
  slot: number;
}

export type TourStepId = 'clock' | 'regular' | 'pieces' | 'feeder' | 'slots' | 'coins' | 'bench' | 'go';

/** How the player plays: by touch or with a mouse and keys, and whether the tabs are in the menu. */
export interface TourWords {
  touch: boolean;
  menu: boolean;
  /** A well is on the floor already, as a new shop has (docs/QUESTIONS.md, Q79). */
  well?: boolean;
}

export interface TourText {
  id: TourStepId;
  title: string;
  lines: string[];
  /** The pieces step: one line per piece, in the order a line runs. */
  pieces?: { piece: PieceKind; line: string }[];
}

/** What each piece of the first four does, in a sentence. */
const PIECE_LINE: Partial<Record<PieceKind, string>> = {
  well: `on tick ${WELL_TICK} it puts out a bucket of water on each of its four sides.`,
  plot: `water landing on it grows beans, put out ${ticks(GROWTH)} later.`,
  kettle:
    `brews the beans that land on it into coffee, put out ${ticks(BREW_TIME)} later. ` +
    `The tick they land on sets the roast: ${ROASTS.map((r) => `${tickRange(kettleTicks(r))} ${r}`).join(', ')}.`,
  belt: 'carries an item one tile a tick. Drag to lay a run of them.',
};

/** The belt's line on a touch screen, where the stick lays a run. */
const BELT_TOUCH = 'carries an item one tile a tick. Tap Lay on the stick and move it to lay a run of them; tap Stop to end it.';

/** The first pieces in the order a line runs, from the well to the feeder. */
const LINE_ORDER: PieceKind[] = ['well', 'plot', 'kettle', 'belt'];


/** The words of every step. Pure, so the tests can read them. */
export function tourText(stool: StoolExample, words: TourWords = { touch: false, menu: false }): TourText[] {
  const key = (p: PieceKind) => pieceKey(ALL_PIECES.indexOf(p));
  const { touch, menu, well } = words;
  const help = menu ? 'The Help tab, in the menu, has' : 'The Help tab has';
  const bench = menu ? 'The Workbench tab, in the menu, has' : 'The Workbench tab has';
  return [
    {
      id: 'clock',
      title: 'The clock',
      lines: [
        `The shop runs on a clock of ${LOOP} ticks, 0 to ${LOOP - 1}, one a second, then round again. Everything on the floor happens on a tick.`,
        touch
          ? 'Pause stops it and Step moves it on one tick, so you can watch a line work. You can build while it runs or while it is paused.'
          : 'Space pauses it and . steps one tick, so you can watch a line work. You can build while it runs or while it is paused.',
      ],
    },
    {
      id: 'regular',
      title: 'Your regulars',
      lines: [
        `This card shows the newest regular: what they drink, and the tick they want it on. ${touch ? 'Tap' : 'Hover'} the underlined drink to see how it is made.`,
        `A regular served ${HAPPY_LOOPS} loops in a row is happy. Once everyone is happy, the next regular walks in.`,
      ],
    },
    {
      id: 'pieces',
      title: 'Your first four pieces',
      lines: [
        touch
          ? 'Tap a piece: its ghost appears in the middle of the floor. Move it with the stick at the bottom right, and tap Place to put it down. Turn it first with Turn, at the left of the tool bar: a machine puts out on the side it faces. Press and hold a piece for all its rules.'
          : 'Click a piece, or press its number key, then click the floor. Press R to turn it first: a machine puts out on the side it faces. Hover a piece for all its rules.',
      ],
      pieces: LINE_ORDER.filter((p) => START_PIECES.includes(p)).map((piece) => ({
        piece,
        line: `${PIECE_LABEL[piece]}${touch ? '' : `, key ${key(piece)}`}: ${touch && piece === 'belt' ? BELT_TOUCH : PIECE_LINE[piece]}`,
      })),
    },
    {
      id: 'feeder',
      title: 'The feeder',
      lines: [
        'Coffee reaches the counter one way only: down the feeder, the fixed belt in the left-hand column. Run your coffee into it from the side.',
        'From the feeder it rides along the counter, past every stool. A cup nobody takes spills off the far end.',
      ],
    },
    {
      id: 'slots',
      title: 'Slots',
      lines: [
        'The numbers riding along the feeder and the counter are slots. A cup keeps its slot all the way, and each extra tile in its line makes it ride one slot later.',
        `Each stool shows what its regular wants: t${stool.tick} · s${stool.slot} is a cup in front of them on tick ${stool.tick}, which is the cup in slot ${stool.slot}. ` +
          'Once your floor serves them it shows ●, Just in Time; ✕ is a miss.',
      ],
    },
    {
      id: 'coins',
      title: 'Coins',
      lines: [
        `A new shop has ${START_COINS} coins. Pieces cost coins, and regulars pay for their cups.`,
        `Deleting a piece gives back every coin it cost: ${touch ? 'tap it, then Delete' : 'hover it and press Z'}. So try things, and move them about freely.`,
        `Floor rows cost ${FLOOR_ROW_PRICE} and are not given back; buy one from the row for sale at the top of the floor. They are for sale once ${ROWS_WAIT}; the ${START_ROWS} rows you start with are plenty until then.`,
      ],
    },
    {
      id: 'bench',
      title: 'The workbench',
      lines: [
        `${bench} puzzles on a bench of their own: get the right things into the tray, loop after loop. Building there costs nothing.`,
        'The basics are there from the start, and each new piece a regular brings opens a ladder of puzzles for it, from hands-on to mastery.',
        'Your regulars carry on while you are at the bench, and the shop greets you with the morning report when you come back.',
      ],
    },
    {
      id: 'go',
      title: 'Your turn',
      lines: [
        well
          ? 'A well is already on the floor. Build a line from it: a plot, then a kettle, then into the feeder, with belts where you need them. Move the well if you like. Time it so the cup rides in the slot your regular wants.'
          : 'Build a line: a well, a plot and a kettle, then into the feeder, with belts where you need them. Time it so the cup rides in the slot your regular wants.',
        touch ? `${help} every control, and this tour again. The Guide tab has every rule.` : `${help} every key, and this tour again. The Guide tab has every rule.`,
      ],
    },
  ];
}

/** A box on the page, in CSS pixels from the window's top left. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

type Side = 'left' | 'right' | 'above' | 'below';

/** What the tour points at, read again on every frame so it follows the page. */
export interface TourTargets {
  clock: HTMLElement;
  newcomer: HTMLElement;
  /** The palette buttons of the first pieces. */
  pieces(): HTMLElement[];
  /** The coins: the till, or in a narrow window the coins in the top bar. */
  till(): HTMLElement;
  /** Where the Help tab is: its button, or the menu that opens it. */
  help(): HTMLElement;
  /** Where the Workbench tab is: its button, or the menu that opens it. */
  bench(): HTMLElement;
  /** The feeder column, or the counter with its stools, on the floor canvas. */
  floor(part: 'feeder' | 'counter'): Box | null;
  /** Get the page ready for a step, such as opening the menu that holds its target; null when the tour ends. */
  prepare(step: TourStepId | null): void;
}

interface TourStep {
  text: TourText;
  target(): Box | null;
  /** Where the card goes, if it fits there. */
  side: Side;
}

const boxOf = (...els: HTMLElement[]): Box | null => {
  const rects = els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  return { left, top, width: Math.max(...rects.map((r) => r.right)) - left, height: Math.max(...rects.map((r) => r.bottom)) - top };
};

function steps(t: TourTargets, stool: StoolExample, words: TourWords): TourStep[] {
  const at: Record<TourStepId, Omit<TourStep, 'text'>> = {
    clock: { target: () => boxOf(t.clock), side: 'left' },
    regular: { target: () => boxOf(t.newcomer), side: 'left' },
    pieces: { target: () => boxOf(...t.pieces()), side: 'above' },
    feeder: { target: () => t.floor('feeder'), side: 'right' },
    slots: { target: () => t.floor('counter'), side: 'above' },
    coins: { target: () => boxOf(t.till()), side: 'above' },
    bench: { target: () => boxOf(t.bench()), side: 'left' },
    go: { target: () => boxOf(t.help()), side: 'left' },
  };
  return tourText(stool, words).map((text) => ({ text, ...at[text.id] }));
}

/** Space between the spotlight and what it lights, between it and the card, and from the window's edges. */
const RING = 6;
const GAP = 14;
const EDGE = 12;
const OPPOSITE: Record<Side, Side> = { left: 'right', right: 'left', above: 'below', below: 'above' };

/** Where the card goes beside `r`: the preferred side if it fits, else the opposite, else any that fits. */
export function placeCard(r: Box | null, side: Side, w: number, h: number, vw: number, vh: number): { left: number; top: number } {
  const clamp = (x: number, y: number) => ({
    left: Math.round(Math.max(EDGE, Math.min(x, vw - w - EDGE))),
    top: Math.round(Math.max(EDGE, Math.min(y, vh - h - EDGE))),
  });
  if (!r) return clamp((vw - w) / 2, (vh - h) / 2);
  const cx = r.left + r.width / 2 - w / 2;
  const cy = r.top + r.height / 2 - h / 2;
  const spots: Record<Side, { x: number; y: number; fits: boolean }> = {
    left: { x: r.left - GAP - w, y: cy, fits: r.left - GAP - w >= EDGE },
    right: { x: r.left + r.width + GAP, y: cy, fits: r.left + r.width + GAP + w <= vw - EDGE },
    above: { x: cx, y: r.top - GAP - h, fits: r.top - GAP - h >= EDGE },
    below: { x: cx, y: r.top + r.height + GAP, fits: r.top + r.height + GAP + h <= vh - EDGE },
  };
  const order: Side[] = [side, OPPOSITE[side], 'above', 'below', 'left', 'right'];
  const pick = spots[order.find((s) => spots[s].fits) ?? side];
  return clamp(pick.x, pick.y);
}

export class Tour {
  private spot = el('div', { className: 'tour-spot' });
  private card = el('div', { className: 'tour-card' });
  private steps: TourStep[];
  private k = 0;
  private frame = 0;
  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.end();
  };

  constructor(
    private readonly targets: TourTargets,
    stool: StoolExample,
    words: TourWords,
    private readonly onEnd: () => void = () => {},
  ) {
    this.steps = steps(targets, stool, words);
    this.card.setAttribute('role', 'dialog');
    this.card.setAttribute('aria-label', 'Tour');
  }

  start(): void {
    document.body.append(this.spot, this.card);
    window.addEventListener('keydown', this.onKey);
    this.show(0);
    const follow = () => {
      this.place();
      this.frame = requestAnimationFrame(follow);
    };
    follow();
  }

  end(): void {
    cancelAnimationFrame(this.frame);
    window.removeEventListener('keydown', this.onKey);
    this.spot.remove();
    this.card.remove();
    this.targets.prepare(null);
    this.onEnd();
  }

  private show(k: number): void {
    this.k = k;
    const { text } = this.steps[k];
    this.targets.prepare(text.id);
    const last = k === this.steps.length - 1;
    const back = el('button', { textContent: 'Back', hidden: k === 0 });
    const next = el('button', { className: 'primary', textContent: last ? 'Start playing' : 'Next' });
    const skip = el('button', { className: 'link', textContent: last ? 'Close' : 'Skip the tour' });
    back.onclick = () => this.show(k - 1);
    next.onclick = () => (last ? this.end() : this.show(k + 1));
    skip.onclick = () => this.end();
    const pieces = text.pieces
      ? [
          el(
            'ul',
            { className: 'tour-pieces' },
            ...text.pieces.map(({ piece, line }) => el('li', {}, spriteImg(PIECE_ICON[piece], 30), el('span', {}, line))),
          ),
        ]
      : [];
    this.card.replaceChildren(
      el('div', { className: 'tour-head' }, el('span', { className: 'muted' }, `${k + 1} of ${this.steps.length}`), skip),
      el('h3', {}, text.title),
      ...pieces,
      ...text.lines.map((line) => el('p', {}, line)),
      el('div', { className: 'tour-actions' }, back, next),
    );
    this.place();
  }

  /** Light the step's target and put the card beside it. */
  private place(): void {
    const step = this.steps[this.k];
    const r = step.target();
    const lit = r && { left: r.left - RING, top: r.top - RING, width: r.width + 2 * RING, height: r.height + 2 * RING };
    this.spot.hidden = !lit;
    if (lit) {
      this.spot.style.left = `${Math.round(lit.left)}px`;
      this.spot.style.top = `${Math.round(lit.top)}px`;
      this.spot.style.width = `${Math.round(lit.width)}px`;
      this.spot.style.height = `${Math.round(lit.height)}px`;
    }
    const at = placeCard(lit, step.side, this.card.offsetWidth, this.card.offsetHeight, window.innerWidth, window.innerHeight);
    this.card.style.left = `${at.left}px`;
    this.card.style.top = `${at.top}px`;
  }
}

/** Offered once per shop: take the tour now, or skip it. Either way it is not offered again. */
export function offerTour(stepCount: number, choose: { take(): void; skip(): void }, menu = false): void {
  const take = el('button', { className: 'primary', textContent: 'Show me around' });
  const skip = el('button', { textContent: 'Skip the tour' });
  const card = el(
    'div',
    { className: 'report' },
    el('h2', {}, 'Welcome to the shop'),
    el(
      'p',
      {},
      `New here? A short tour shows how the shop works in ${stepCount} quick steps: the clock, slots, your first four pieces and the workbench puzzles. The floor keeps running while you read.`,
    ),
    el('p', { className: 'muted' }, `You can take it again any time from the Help tab${menu ? ', in the menu' : ''}.`),
    el('div', { className: 'row' }, skip, take),
  );
  const overlay = el('div', { className: 'overlay' }, card);
  const close = (then: () => void) => () => {
    overlay.remove();
    then();
  };
  take.onclick = close(choose.take);
  skip.onclick = close(choose.skip);
  document.body.append(overlay);
  take.focus();
}

/** Steps in the tour, for the offer. */
export const TOUR_STEPS = tourText({ tick: 0, slot: 0 }).length;
