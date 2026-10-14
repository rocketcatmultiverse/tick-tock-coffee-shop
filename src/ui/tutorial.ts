// The tours: a few short steps each, with a spotlight on one part of the page
// and a card beside it. There are two (docs/QUESTIONS.md, Q80):
//
// - the bench tour, offered with the keys dialog on a new shop's first lesson
//   at the workbench: the puzzle's card, its order, the bench, placing pieces,
//   the clock and the Help tab. It can be taken again from the bench's Help tab;
// - the shop tour, offered once per shop when it first opens (for a new shop,
//   as the keys are handed over): the newest regular, the feeder, slots, the
//   pieces at a price, coins, the rest of the workbench puzzles (Q77) and the
//   Help tab. It can be taken again from the shop's Help tab.
//
// Either can be skipped at any step. The floor keeps running and stays
// clickable underneath. Every number in the words comes from the tuning
// files. On a touch screen the words say tap rather than click and name no
// keys, and in a narrow window they find the tabs in the menu (Q71).

import type { PieceKind, PuzzleDef, Roast } from '../sim/types';
import { BREW_TIME, GROWTH, LOOP, MILK_TICK, MIX_TIME, ROASTER_TICK, SPRING_TICKS, WELL_TICK } from '../sim/tuning';
import { parseBoard } from '../game/bench';
import { ALL_PIECES, PIECE_LABEL, pieceOf } from '../game/pieces';
import { kettleTicks } from '../game/recipes';
import { BENCH_SOLVE_LOOPS, FLOOR_ROW_PRICE, HAPPY_LOOPS, PIECE_PRICE, START_COINS, START_PIECES, START_ROWS } from '../game/tuning';
import { PUZZLES } from '../levels/puzzles';
import { spriteImg } from './art/dom';
import { el } from './el';
import { pieceKey } from './hotkeys';
import { PIECE_ICON } from './palette';
import { ROWS_WAIT, coins, tickRange } from './tips';

const ticks = (n: number) => `${n} tick${n === 1 ? '' : 's'}`;
const ROASTS: Roast[] = ['light', 'medium', 'dark'];
const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const inWords = (n: number) => NUMBER_WORDS[n] ?? String(n);

/** The stool the slots step reads out: a timed regular's tick and the slot that serves it. */
export interface StoolExample {
  tick: number;
  slot: number;
}

export type ShopStepId = 'regular' | 'feeder' | 'slots' | 'pieces' | 'coins' | 'bench' | 'go';
export type BenchStepId = 'lesson' | 'order' | 'floor' | 'pieces' | 'clock' | 'help';

/** How the player plays: by touch or with a mouse and keys, and whether the tabs are in the menu. */
export interface TourWords {
  touch: boolean;
  menu: boolean;
  /** A well is on the floor already, as a new shop has (docs/QUESTIONS.md, Q79). */
  well?: boolean;
}

export interface BenchTourWords {
  touch: boolean;
  menu: boolean;
  /** This bench is lesson `n` of the `of` before the keys (Q80). */
  lesson?: { n: number; of: number };
}

export interface TourText<Id extends string = string> {
  id: Id;
  title: string;
  lines: string[];
  /** One line per piece, in the order a line runs. */
  pieces?: { piece: PieceKind; line: string }[];
}

/** What each piece does, in a sentence. */
const PIECE_LINE: Record<PieceKind, string> = {
  well: `on tick ${WELL_TICK} it puts out a bucket of water on each of its four sides.`,
  plot: `water landing on it grows beans, put out ${ticks(GROWTH)} later.`,
  kettle:
    `brews the beans that land on it into coffee, put out ${ticks(BREW_TIME)} later. ` +
    `The tick they land on sets the roast: ${ROASTS.map((r) => `${tickRange(kettleTicks(r))} ${r}`).join(', ')}.`,
  belt: 'carries an item one tile a tick. Drag to lay a run of them.',
  spring: `a belt that takes ${ticks(SPRING_TICKS)} to cross instead of 1, holding what is on it in a queue.`,
  chute: 'flings an item from its launch over the next tile onto its catch, two tiles on, a tick sooner than belts would.',
  roaster: `holds one batch of beans and lets it out as espresso beans on tick ${ROASTER_TICK}. The less time inside, the lighter the roast.`,
  door: `goes against the right-hand wall. The milkman drops a pail a tick onto the tile it faces, from tick ${MILK_TICK}.`,
  mixer: `coffee and milk landing on one tick make a café au lait, espresso and milk a latte, put out ${ticks(MIX_TIME)} later.`,
  splitter: 'hands each item to the next of its outputs in turn, clockwise from north. The round starts again on tick 0.',
};

/** The belt's line on a touch screen, where the stick lays a run. */
const BELT_TOUCH = 'carries an item one tile a tick. Tap Lay on the stick and move it to lay a run of them; tap Stop to end it.';

const pieceLine = (piece: PieceKind, touch: boolean) => (touch && piece === 'belt' ? BELT_TOUCH : PIECE_LINE[piece]);
const key = (p: PieceKind) => pieceKey(ALL_PIECES.indexOf(p));

/** The first pieces in the order a line runs, from the well to the feeder; then the rest, in palette order. */
const LINE_ORDER: PieceKind[] = ['well', 'plot', 'kettle', 'belt'];
const TOUR_ORDER: PieceKind[] = [...LINE_ORDER, ...ALL_PIECES.filter((p) => !LINE_ORDER.includes(p))];

/** How to put a piece down, on this device. */
const PLACING = {
  mouse: 'Click a piece, or press its number key, then click the floor. Press R to turn it first: a machine puts out on the side it faces. Hover a piece for all its rules.',
  touch:
    'Tap a piece: its ghost appears in the middle of the floor. Move it with the stick at the bottom right, and tap Place to put it down. ' +
    'Turn it first with Turn, at the left of the tool bar: a machine puts out on the side it faces. Press and hold a piece for all its rules.',
};

const clockLines = (touch: boolean) => [
  `The clock counts ${LOOP} ticks, 0 to ${LOOP - 1}, one a second, then goes round again. Everything on the floor happens on a tick.`,
  touch
    ? 'Pause stops it and Step moves it on one tick, so you can watch a line work. You can build while it runs or while it is paused.'
    : 'Space pauses it and . steps one tick, so you can watch a line work. You can build while it runs or while it is paused.',
];

const helpLine = (touch: boolean, menu: boolean) =>
  `${menu ? 'The Help tab, in the menu, has' : 'The Help tab has'} every ${touch ? 'control' : 'key'}, and this tour again. The Guide tab has every rule.`;

/** The words of the bench tour on a puzzle's bench. Pure, so the tests can read them. */
export function benchTourText(def: PuzzleDef, words: BenchTourWords = { touch: false, menu: false }): TourText<BenchStepId>[] {
  const { touch, menu, lesson } = words;
  const board = parseBoard(def.board);
  const offered = new Set(ALL_PIECES.filter((p) => p in def.pieces));
  const bolted = new Set(board.layout.tiles.flatMap((s) => (s && pieceOf(s.kind) ? [pieceOf(s.kind)!] : [])));
  const shown = TOUR_ORDER.filter((p) => offered.has(p) || bolted.has(p));
  return [
    {
      id: 'lesson',
      title: lesson ? `Lesson ${lesson.n} of ${lesson.of}` : 'The workbench',
      lines: [
        'Each puzzle at the workbench is a small floor of its own, with a tray to fill. This card says what to do.',
        lesson ? `Solve all ${lesson.of} lessons and the keys to the shop are yours.` : 'Nothing on the bench touches your shop.',
        'Start over clears the bench of items and starts the clock again from tick 0. Your pieces stay.',
      ],
    },
    {
      id: 'order',
      title: 'The order',
      lines: [
        `The tray wants this every loop. ${touch ? 'Tap' : 'Hover'} the underlined name to see how it is made.`,
        `Fill the order ${BENCH_SOLVE_LOOPS} loops in a row and the puzzle is solved. Under it is what the tray has had this loop, and how the last loop went.`,
      ],
    },
    {
      id: 'floor',
      title: 'The bench',
      lines: [
        'Pieces with brass bolts came with the bench and stay put. The tray takes one item a tick, from any side.',
        board.holes.size > 0
          ? 'The gap is not bench: anything carried onto it spills, as it does off the edge.'
          : 'Anything carried off the edge of the bench spills.',
      ],
    },
    {
      id: 'pieces',
      title: 'Your pieces',
      lines: [
        touch ? PLACING.touch : PLACING.mouse,
        touch
          ? 'Tap a piece on the bench, then Delete, to take it up. Every piece here is free; where there is a limit, the palette says how many are left.'
          : 'Z takes up the piece under the cursor. Every piece here is free; where there is a limit, the palette says how many are left.',
      ],
      pieces: shown.map((piece) => ({
        piece,
        line: offered.has(piece)
          ? `${PIECE_LABEL[piece]}${touch ? '' : `, key ${key(piece)}`}: ${pieceLine(piece, touch)}`
          : `${PIECE_LABEL[piece]}, on the bench: ${pieceLine(piece, touch)}`,
      })),
    },
    { id: 'clock', title: 'The clock', lines: clockLines(touch) },
    {
      id: 'help',
      title: 'Your turn',
      lines: ['The puzzle’s card says what to do. Build, watch a loop or two, and change what needs changing.', helpLine(touch, menu)],
    },
  ];
}

/** The words of the shop tour. Pure, so the tests can read them. */
export function shopTourText(stool: StoolExample, words: TourWords = { touch: false, menu: false }): TourText<ShopStepId>[] {
  const { touch, menu, well } = words;
  const bench = menu ? 'The Workbench tab, in the menu, has' : 'The Workbench tab has';
  return [
    {
      id: 'regular',
      title: 'Your regulars',
      lines: [
        `This card shows the newest regular: what they drink, and the tick they want it on. ${touch ? 'Tap' : 'Hover'} the underlined drink to see how it is made.`,
        `A regular served ${HAPPY_LOOPS} loops in a row is happy. Once everyone is happy, the next regular walks in.`,
      ],
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
      id: 'pieces',
      title: 'Pieces cost coins',
      lines: [
        `The pieces from the workbench work here just as they did there, but each has a price. ${
          touch ? 'Tap a piece, steer its ghost with the stick and tap Place.' : 'Click a piece, or press its number key, then click the floor.'
        }`,
        'A ? is a piece still to come: a regular brings it.',
      ],
      pieces: LINE_ORDER.filter((p) => START_PIECES.includes(p)).map((piece) => ({
        piece,
        line: `${PIECE_LABEL[piece]}${touch ? '' : `, key ${key(piece)}`}, ${coins(PIECE_PRICE[piece])}: ${pieceLine(piece, touch)}`,
      })),
    },
    {
      id: 'coins',
      title: 'Coins',
      lines: [
        `A new shop has ${START_COINS} coins, and regulars pay for their cups.`,
        `Deleting a piece gives back every coin it cost: ${touch ? 'tap it, then Delete' : 'hover it and press Z'}. So try things, and move them about freely.`,
        `Floor rows cost ${FLOOR_ROW_PRICE} and are not given back; buy one from the row for sale at the top of the floor. They are for sale once ${ROWS_WAIT}; the ${START_ROWS} rows you start with are plenty until then.`,
      ],
    },
    {
      id: 'bench',
      title: 'The workbench',
      lines: [
        `${bench} the rest of the basics, a brain teaser and a mastery puzzle, and each new piece a regular brings opens a ladder of puzzles for it, from hands-on to mastery.`,
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
        helpLine(touch, menu),
      ],
    },
  ];
}

/** Steps in each tour, for the offers. */
export const SHOP_TOUR_STEPS = shopTourText({ tick: 0, slot: 0 }).length;
export const BENCH_TOUR_STEPS = benchTourText(PUZZLES[0]).length;

/** What an offer of a tour says. */
export interface OfferText {
  title: string;
  lines: string[];
  /** The aside under it: where to take the tour again. */
  note: string;
}

const again = (menu: boolean) => `You can take it again any time from the Help tab${menu ? ', in the menu' : ''}.`;

/** The dialog on a new shop's first lesson: the keys wait for the lessons (Q80). It offers the bench tour. */
export function keysText(lessons: number, menu = false): OfferText {
  return {
    title: 'The keys to the shop',
    lines: [
      `The old keeper of the coffee shop is hanging up the apron, and the keys are to be yours: a little alchemical shop whose back room runs on a clock of ${LOOP} ticks.`,
      `First, the basics: ${inWords(lessons)} lessons at the workbench out the back, each a small puzzle. Solve them all and the keys are yours, with your first regular at the door.`,
      `A short tour shows you round the workbench in ${BENCH_TOUR_STEPS} quick steps. The clock keeps running while you read.`,
    ],
    note: again(menu),
  };
}

/** The offer of the shop tour: as the keys are handed over, or as a welcome to a save that has not had it. */
export function offerText(kind: 'keys' | 'welcome', newcomer: string, menu: boolean): OfferText {
  if (kind === 'keys') {
    return {
      title: 'The keys are yours',
      lines: [
        `That was the last lesson, and the shop is yours. ${newcomer} is at the door.`,
        `A short tour shows what the shop has that the bench had not, in ${SHOP_TOUR_STEPS} quick steps: regulars, the feeder, slots and coins. The floor keeps running while you read.`,
      ],
      note: again(menu),
    };
  }
  return {
    title: 'Welcome to the shop',
    lines: [
      `New here? A short tour shows how the shop works in ${SHOP_TOUR_STEPS} quick steps: regulars, the feeder, slots, coins and the workbench puzzles. The floor keeps running while you read.`,
    ],
    note: again(menu),
  };
}

/** A box on the page, in CSS pixels from the window's top left. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

type Side = 'left' | 'right' | 'above' | 'below';

/** One step of a tour: its words, what it lights (read again on every frame, so it follows the page), and where the card goes. */
export interface TourStep<Id extends string = string> {
  text: TourText<Id>;
  target(): Box | null;
  /** Where the card goes, if it fits there. */
  side: Side;
}

export const boxOf = (...els: HTMLElement[]): Box | null => {
  const rects = els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  return { left, top, width: Math.max(...rects.map((r) => r.right)) - left, height: Math.max(...rects.map((r) => r.bottom)) - top };
};

/** What the shop tour points at. */
export interface ShopTourTargets {
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
}

export function shopTour(t: ShopTourTargets, stool: StoolExample, words: TourWords): TourStep<ShopStepId>[] {
  const at: Record<ShopStepId, Omit<TourStep, 'text'>> = {
    regular: { target: () => boxOf(t.newcomer), side: 'left' },
    feeder: { target: () => t.floor('feeder'), side: 'right' },
    slots: { target: () => t.floor('counter'), side: 'above' },
    pieces: { target: () => boxOf(...t.pieces()), side: 'above' },
    coins: { target: () => boxOf(t.till()), side: 'above' },
    bench: { target: () => boxOf(t.bench()), side: 'left' },
    go: { target: () => boxOf(t.help()), side: 'left' },
  };
  return shopTourText(stool, words).map((text) => ({ text, ...at[text.id] }));
}

/** What the bench tour points at. */
export interface BenchTourTargets {
  /** The puzzle's card: its name, its brief and the ways out. */
  card: HTMLElement;
  /** The tray's order. */
  order: HTMLElement;
  /** The bench on the floor canvas. */
  floor(): Box | null;
  /** The palette buttons of the pieces on offer. */
  pieces(): HTMLElement[];
  clock: HTMLElement;
  /** Where the Help tab is: its button, or the menu that opens it. */
  help(): HTMLElement;
}

export function benchTour(t: BenchTourTargets, def: PuzzleDef, words: BenchTourWords): TourStep<BenchStepId>[] {
  const at: Record<BenchStepId, Omit<TourStep, 'text'>> = {
    lesson: { target: () => boxOf(t.card), side: 'left' },
    order: { target: () => boxOf(t.order), side: 'left' },
    floor: { target: () => t.floor(), side: 'right' },
    pieces: { target: () => boxOf(...t.pieces()), side: 'above' },
    clock: { target: () => boxOf(t.clock), side: 'left' },
    help: { target: () => boxOf(t.help()), side: 'left' },
  };
  return benchTourText(def, words).map((text) => ({ text, ...at[text.id] }));
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

export class Tour<Id extends string = string> {
  private spot = el('div', { className: 'tour-spot' });
  private card = el('div', { className: 'tour-card' });
  private k = 0;
  private frame = 0;
  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.end();
  };

  /** `prepare` gets the page ready for a step, such as opening the menu that holds its target; null when the tour ends. */
  constructor(
    private readonly steps: TourStep<Id>[],
    private readonly prepare: (step: Id | null) => void,
    private readonly onEnd: () => void = () => {},
  ) {
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
    this.prepare(null);
    this.onEnd();
  }

  private show(k: number): void {
    this.k = k;
    const { text } = this.steps[k];
    this.prepare(text.id);
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

/** Offer a tour: take it now, or skip it. Either way the caller decides whether it is offered again. */
export function offerTour(words: OfferText, choose: { take(): void; skip(): void }, takeLabel = 'Show me around'): void {
  const take = el('button', { className: 'primary', textContent: takeLabel });
  const skip = el('button', { textContent: 'Skip the tour' });
  const card = el(
    'div',
    { className: 'report' },
    el('h2', {}, words.title),
    ...words.lines.map((line) => el('p', {}, line)),
    el('p', { className: 'muted' }, words.note),
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
