// What the tooltips say. A palette piece's tooltip gives its rules
// (docs/SPEC.md, Rules 3 and 4, and docs/ADDENDUM-01.md); an order's shows
// how the drink is made, as pictures: inputs + machine = drink. Every number
// comes from the tuning files, so the words follow the rules if they change.

import type { Drink, Item, Roast } from '../sim/types';
import { itemName } from '../sim/items';
import {
  BREW_TIME,
  COLS,
  GROWTH,
  LOOP,
  MILK_TICK,
  MIX_TIME,
  ROASTER_LIGHT_MAX_TIME,
  ROASTER_MEDIUM_MAX_TIME,
  ROASTER_TICK,
  SPRING_TICKS,
  WELL_TICK,
} from '../sim/tuning';
import { ALL_PIECES, PIECE_LABEL, type PieceKind } from '../game/pieces';
import { type Ingredient, type RecipeMachine, type RecipeStep, type Term, kettleTicks, recipeFor, roasterTicks, tickRuns } from '../game/recipes';
import { FLOOR_ROW_PRICE, MILK_PAIL_PRICE, PIECE_PRICE, ROWS_FOR_SALE_AFTER_HAPPY, START_ROWS } from '../game/tuning';
import { clockWindowImg, spriteImg } from './art/dom';
import { itemKey } from './art/svg';
import { touchFirst } from './device';
import { pieceKey } from './hotkeys';
import { el } from './el';
import { TOOLS, type ToolId } from './tools';

const ticks = (n: number) => `${n} tick${n === 1 ? '' : 's'}`;
/** "1 coin", "25 coins". */
export const coins = (n: number) => `${n} coin${n === 1 ? '' : 's'}`;
const ROASTS: Roast[] = ['light', 'medium', 'dark'];

/** "0–3", "10–1", "2, 5–6": a set of clock ticks as runs. */
export function tickRange(list: readonly number[]): string {
  return tickRuns(list)
    .map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`))
    .join(', ');
}

/** "0–3 light, 4–7 medium, 8–11 dark": the ticks each roast's input lands on, each kept on one line. */
const byRoast = (window: (r: Roast) => number[]) =>
  ROASTS.map((r) => `${tickRange(window(r)).replace(/–/g, '–\u2060')}\u00a0${r}`).join(', ');

/** Each palette piece's rules, a line each. */
export const PIECE_RULES: Record<PieceKind, string[]> = {
  belt: [
    'Carries an item one tile a tick, the way it points. One item per tile: it never holds or queues.',
    'Takes items from any side. When two arrive at once, one coming along a belt beats one a machine puts out; then north beats east, south and west. The loser spills.',
    'An item carried onto bare floor or a wall spills.',
    'Drag to lay a run of belts that turns to follow the drag.',
  ],
  plot: [
    `A bucket of water landing on it grows beans, put out ${ticks(GROWTH)} later on the side it faces.`,
    'One bucket, one harvest. A bucket landing while it grows spills; one landing on the harvest tick starts the next crop.',
  ],
  kettle: [
    `Brews what lands on it and puts it out ${ticks(BREW_TIME)} later, on the side it faces.`,
    `Plain beans take their roast from the clock tick they land on: ${byRoast(kettleTicks)}.`,
    'Espresso beans keep their roast. Milk becomes warm milk on any tick.',
    'If two inputs land on one tick it takes one, by the belt priority, and the other spills.',
  ],
  well: [
    `On tick ${WELL_TICK} of every loop it puts out a bucket of water on each of its four sides.`,
    'A side with nothing there to take its bucket spills it.',
    'You may own only a few. Some regulars raise the limit when they walk in.',
  ],
  spring: [
    `A belt that takes ${ticks(SPRING_TICKS)} to cross instead of 1, so an item comes out ${ticks(SPRING_TICKS - 1)} later.`,
    `It holds up to ${SPRING_TICKS} items, one a tick, and lets them out in the order they came. It never blocks.`,
    `Swap one belt tile for a spring to move a cup ${SPRING_TICKS - 1} slots later. In the timing it counts as ${SPRING_TICKS} belt tiles.`,
  ],
  chute: [
    'One piece: the launch where you click and the catch two tiles along the way it faces. Both tiles must be free.',
    'An item on the launch lands on the catch one tick later, flying over whatever is in between. It saves a tick.',
    "Both ends otherwise act as belts. An item arriving by chute counts as a belt item from the launch's side.",
  ],
  roaster: [
    'Takes beans on any tick and holds one batch. Beans landing on a full roaster spill.',
    `Lets its batch out as espresso beans on tick ${ROASTER_TICK}, and on no other tick.`,
    `Time inside sets the roast: 1–${ROASTER_LIGHT_MAX_TIME} ticks light, ${ROASTER_LIGHT_MAX_TIME + 1}–${ROASTER_MEDIUM_MAX_TIME} medium, ${ROASTER_MEDIUM_MAX_TIME + 1}–${LOOP} dark. Beans landing on tick ${ROASTER_TICK} itself wait a full ${LOOP}.`,
    `So by the tick beans land on: ${byRoast(roasterTicks)}.`,
  ],
  door: [
    `Goes against the right-hand wall, in column ${COLS - 1}, and faces left. There is only one.`,
    `The milkman drops one pail a tick onto the tile it faces, from tick ${MILK_TICK}: one pail for each milk drinker who has walked in.`,
    `Each pail costs ${MILK_PAIL_PRICE} coins as it arrives, used or not. If the till cannot pay, that pail and the rest of the loop's order stay away.`,
  ],
  mixer: [
    'Needs two ingredients landing on the same tick: espresso and milk make a latte, coffee and milk a café au lait.',
    `The drink keeps the roast of its espresso or coffee, and comes out ${ticks(MIX_TIME)} later on the side it faces.`,
    'Anything arriving alone, and any other pair, spills.',
  ],
  splitter: [
    'Hands each item to the next of its outputs in turn, clockwise from north.',
    'An output is any neighbour that takes items, except a piece pointing at it, a machine putting out into it, and another splitter: put a belt between two.',
    'It costs a tick, like a belt. The round starts again on tick 0. With no output, items spill.',
    'On the floor its sides show yellow for outputs and green for where the next item goes.',
  ],
};

/** A recipe step as pictured: the palette's plot is shown too, though no drink's recipe goes back that far. */
type PictureMachine = RecipeMachine | 'plot';
type PictureStep = Omit<RecipeStep, 'machine'> & { machine: PictureMachine };

function step(inputs: Item['kind'][], machine: PictureMachine, out: Item['kind']): PictureStep {
  return { inputs: inputs.map((kind) => ({ type: 'item', item: { kind, roast: null } })), machine, out: { kind: out, roast: null } };
}

/** What a machine on the palette makes, as pictures. Belts and the like have none. */
const PIECE_MAKES: Partial<Record<PieceKind, PictureStep[]>> = {
  plot: [step(['water'], 'plot', 'beans')],
  kettle: [step(['beans'], 'kettle', 'coffee'), step(['espressoBeans'], 'kettle', 'espresso'), step(['milk'], 'kettle', 'warmMilk')],
  roaster: [step(['beans'], 'roaster', 'espressoBeans')],
  mixer: [step(['espresso', 'milk'], 'mixer', 'latte'), step(['coffee', 'milk'], 'mixer', 'auLait')],
};

/** The sprite each machine is pictured with, putting out toward the "=". */
const MACHINE_SPRITE: Record<PictureMachine, string> = {
  kettle: 'kettle:E:-',
  roaster: 'roaster:E:1',
  mixer: 'mixer:E',
  plot: 'plot:E:3',
};

const ROASTED: ReadonlySet<Item['kind']> = new Set<Item['kind']>(['coffee', 'espresso', 'espressoBeans', 'latte', 'auLait']);

/** An item's picture. A roasted item with any roast is drawn as medium. */
function ingredientSprite(g: Ingredient): string {
  return itemKey((ROASTED.has(g.kind) ? { kind: g.kind, roast: g.roast ?? 'medium' } : { kind: g.kind }) as Item);
}

/** "dark espresso", "milk pail"; a roasted item with any roast is named without one. */
function ingredientName(g: Ingredient): string {
  return itemName((g.roast ? { kind: g.kind, roast: g.roast } : { kind: g.kind }) as Item);
}

function figure(img: HTMLImageElement, caption: string): HTMLElement {
  return el('span', { className: 'term' }, img, el('span', { className: 'term-name' }, caption));
}

function termFigure(t: Term, size: number): HTMLElement {
  if (t.type === 'clock') return figure(clockWindowImg(t.ticks, t.roast, size), `lands ${tickRange(t.ticks)}`);
  return figure(spriteImg(ingredientSprite(t.item), size), ingredientName(t.item));
}

const op = (s: string) => el('span', { className: 'op' }, s);

/** One step as a row of pictures: inputs + machine = what it makes. */
function equation(s: PictureStep, size: number, className = 'equation'): HTMLElement {
  const row = el('div', { className });
  s.inputs.forEach((t, k) => row.append(...(k ? [op('+')] : []), termFigure(t, size)));
  row.append(op('+'), figure(spriteImg(MACHINE_SPRITE[s.machine], size), s.machine));
  row.append(op('='), termFigure({ type: 'item', item: s.out }, size));
  return row;
}

function header(name: string, aside: string): HTMLElement {
  return el('div', { className: 'tip-head' }, el('span', { className: 'tip-name' }, name), el('span', { className: 'muted' }, aside));
}

/** A piece's number key, where there is a keyboard to press it on. */
const keyNote = (piece: PieceKind) => {
  const k = pieceKey(ALL_PIECES.indexOf(piece));
  return k && !touchFirst() ? ` · key ${k}` : '';
};

/** How to delete a piece on the floor, in the words for this device. */
export const deleteHint = (touch: boolean) =>
  touch ? 'Tap one on the floor, then Delete, for a full refund.' : 'Hover one on the floor and press Z to delete it, for a full refund.';

/** A piece's tooltip under its name: what it makes, its rules, and how to get its coins back. */
export function pieceBody(piece: PieceKind): HTMLElement[] {
  return [
    ...(PIECE_MAKES[piece] ?? []).map((s) => equation(s, 30)),
    el('ul', { className: 'tip-rules' }, ...PIECE_RULES[piece].map((line) => el('li', {}, line))),
    el('div', { className: 'tip-foot' }, deleteHint(touchFirst())),
  ];
}

function pieceTip(piece: PieceKind): HTMLElement {
  return el('div', {}, header(PIECE_LABEL[piece], `${coins(PIECE_PRICE[piece])}${keyNote(piece)}`), ...pieceBody(piece));
}

/** What the Buy a row button says: a row is never refunded, and is for sale only once a regular is happy. */
export const ROW_RULES: string[] = [
  'Adds one more row at the back of the floor, with its own feeder tile.',
  'Unlike a piece, a row cannot be deleted, so its coins never come back.',
];

export const ROW_LOCKED = `Floor rows are for sale once ${
  ROWS_FOR_SALE_AFTER_HAPPY === 1 ? 'your first regular is' : `your first ${ROWS_FOR_SALE_AFTER_HAPPY} regulars are`
} happy. The ${START_ROWS} rows you start with are plenty until then.`;

/** The Buy a row tooltip under its name. */
export function rowBody(locked: boolean): HTMLElement[] {
  return [
    ...(locked ? [el('div', { className: 'muted' }, ROW_LOCKED)] : []),
    el('ul', { className: 'tip-rules' }, ...ROW_RULES.map((line) => el('li', {}, line))),
  ];
}

function rowTip(locked: boolean): HTMLElement {
  return el('div', {}, header('Buy a row', locked ? 'not for sale yet' : coins(FLOOR_ROW_PRICE)), ...rowBody(locked));
}

export const LOCKED_LINE = 'A regular still to come brings this piece.';

function lockedTip(piece: PieceKind): HTMLElement {
  return el('div', {}, header('?', `not unlocked yet${keyNote(piece)}`), el('div', { className: 'muted' }, LOCKED_LINE));
}

/** How a drink is made, as pictures: the last step big, then the steps that make its ingredients. */
export function orderBody(want: Ingredient): HTMLElement[] {
  const [last, ...before] = recipeFor(want);
  return [...(last ? [equation(last, 40)] : []), ...before.map((s) => equation(s, 30, 'equation sub'))];
}

/** "Medium coffee", "Latte": a drink's name as a title. */
export function drinkTitle(want: Ingredient): string {
  const name = ingredientName(want);
  return name[0].toUpperCase() + name.slice(1);
}

/** The picture of a drink, any roast drawn as medium. */
export const drinkSprite = (want: Ingredient) => ingredientSprite(want);

function orderTip(want: Ingredient): HTMLElement {
  return el('div', {}, header(drinkTitle(want), ''), ...orderBody(want));
}

/** A tool's name, its key where there is a keyboard, and what it does. */
function toolTip(id: ToolId): HTMLElement {
  const t = TOOLS[id];
  const touch = touchFirst();
  return el('div', {}, header(t.label, touch ? '' : t.key), el('div', {}, touch ? (t.touchLine ?? t.line) : t.line));
}

/** The data-tip key for an order, and for a palette piece. A tool's is `tool:<id>`. */
export const orderTipKey = (drink: Drink, roast: Roast | 'any') => `order:${drink}:${roast}`;
export const pieceTipKey = (piece: PieceKind, locked: boolean) => `${locked ? 'locked' : 'piece'}:${piece}`;

/** The body of the tooltip a data-tip key names, or null if it names none. */
export function tipContent(key: string): HTMLElement | null {
  const [kind, a, b] = key.split(':');
  if ((kind === 'piece' || kind === 'locked') && (ALL_PIECES as readonly string[]).includes(a)) {
    return kind === 'piece' ? pieceTip(a as PieceKind) : lockedTip(a as PieceKind);
  }
  if (kind === 'row') return rowTip(a === 'locked');
  if (kind === 'order') return orderTip({ kind: a as Drink, roast: b === 'any' ? null : (b as Roast) });
  if (kind === 'tool' && a in TOOLS) return toolTip(a as ToolId);
  return null;
}
