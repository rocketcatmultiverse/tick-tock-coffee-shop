// The panels around the floor: plain DOM, updated in place on every render.
// The clock and its controls sit top right, the till bottom left, the build
// palette bottom middle; less frequent things live in tabs on the right.

import { roastForTick } from '../sim/items';
import { LOOP } from '../sim/tuning';
import { ALL_PIECES, PIECE_LABEL, type PieceKind } from '../game/pieces';
import { FLOOR_ROW_PRICE, PIECE_PRICE } from '../game/tuning';
import { clockFace, spriteImg } from './art/dom';
import { svgUrl } from './art/raster';
import { el } from './el';
import { pieceKey } from './hotkeys';
import { pieceTipKey } from './tips';


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
  palette: { piece: PieceKind; locked: boolean; note: string }[];
  inHand: PieceKind | 'group' | null;
  message: string;
  hoverInfo: string;
  bufferInfo: string;
  canUndo: boolean;
  canRedo: boolean;
  /** Why no floor row is for sale yet, or null if one is. */
  rowsLocked: string | null;
}

export interface PanelActions {
  togglePause(): void;
  stepOnce(): void;
  setSpeed(n: number): void;
  pick(piece: PieceKind): void;
  buyRow(): void;
  undo(): void;
  redo(): void;
}

/** The bottom line of the build panel when nothing on the floor is hovered. */
const REFUND_HINT = 'Z deletes the piece under the cursor, with a full refund.';

/** The sprite each palette piece is shown with. */
export const PIECE_ICON: Record<PieceKind, string> = {
  belt: 'belt:E',
  plot: 'plot:S:1',
  kettle: 'kettle:S:-',
  well: 'well',
  spring: 'spring:E',
  chute: 'launch:E',
  roaster: 'roaster:S:1',
  door: 'door',
  mixer: 'mixer:S',
  splitter: 'splitter',
};

const ROAST_LEGEND: [string, number, number][] = [
  ['Light', 0, 3],
  ['Medium', 4, 7],
  ['Dark', 8, 11],
];

export class Panel {
  /** Top right: the clock and the time controls. */
  readonly clock: HTMLElement;
  /** Bottom left: the till and how the shop is doing. */
  readonly tillCard: HTMLElement;
  /** Bottom middle: the build palette. */
  readonly build: HTMLElement;

  private dial = el('img', { className: 'dial', width: 104, height: 104, alt: 'The shop clock' });
  private dialTick: number | null | undefined = undefined;
  private tickBig = el('div', { className: 'big' });
  private tickSmall = el('div', { className: 'muted' });
  private playBtn = el('button', { className: 'primary' });
  private stepBtn = el('button', { textContent: 'Step' });
  private speed = el('select');
  private till = el('div', { className: 'big' });
  private gears = el('div', { className: 'muted' });
  private seated = el('div');
  private spills = el('div', { className: 'muted' });
  private milk = el('div', { className: 'muted' });
  private paletteBtns = new Map<PieceKind, { btn: HTMLButtonElement; label: HTMLSpanElement; icon: HTMLImageElement; unknown: HTMLSpanElement; info: HTMLSpanElement }>();
  private rowBtn = el('button', { textContent: `Buy a row · ${FLOOR_ROW_PRICE}` });
  private undoBtn = el('button', { textContent: 'Undo' });
  private redoBtn = el('button', { textContent: 'Redo' });
  private message = el('div', { className: 'message' });
  private hover = el('div', { className: 'hover' });
  private bufferInfo = el('div', { className: 'muted' });

  constructor(actions: PanelActions) {
    this.playBtn.onclick = () => actions.togglePause();
    this.stepBtn.onclick = () => actions.stepOnce();
    for (const n of [1, 2, 4]) this.speed.append(el('option', { value: String(n), textContent: `${n}×` }));
    this.speed.onchange = () => actions.setSpeed(Number(this.speed.value));
    this.rowBtn.onclick = () => actions.buyRow();
    this.undoBtn.onclick = () => actions.undo();
    this.redoBtn.onclick = () => actions.redo();

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
        el('div', { className: 'clock-text' }, el('div', { className: 'muted' }, 'Tick'), this.tickBig, legend, this.tickSmall),
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

    // Each piece shows its number key and, once unlocked, a mark that it has a
    // tooltip; a locked piece is only a question mark. Locked buttons are not
    // disabled, so they still get hover, and a click says why nothing happens.
    const palette = el('div', { className: 'palette' });
    ALL_PIECES.forEach((piece, i) => {
      const label = el('span', { className: 'piece-label' });
      const icon = spriteImg(PIECE_ICON[piece], 40);
      const unknown = el('span', { className: 'piece-unknown', textContent: '?' });
      const info = el('span', { className: 'piece-info', textContent: 'i' });
      const btn = el('button', { className: 'piece' }, el('span', { className: 'piece-key', textContent: pieceKey(i) ?? '' }), info, icon, unknown, label);
      btn.onclick = () => actions.pick(piece);
      this.paletteBtns.set(piece, { btn, label, icon, unknown, info });
      palette.append(btn);
    });
    this.build = el(
      'div',
      { className: 'card build' },
      palette,
      el(
        'div',
        { className: 'build-side' },
        el('div', { className: 'row' }, this.rowBtn, this.undoBtn, this.redoBtn),
        this.message,
        this.hover,
        this.bufferInfo,
      ),
    );
  }

  /** The palette buttons of these pieces, for the tour to point at. */
  pieceButtons(pieces: readonly PieceKind[]): HTMLElement[] {
    return pieces.map((p) => this.paletteBtns.get(p)!.btn);
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
    this.playBtn.textContent = m.running ? 'Pause' : 'Play';
    this.stepBtn.disabled = m.running;
    this.speed.value = String(m.speed);
    this.till.textContent = `${m.till.toLocaleString()} coins`;
    this.gears.textContent = `· ${m.gears.toLocaleString()} gear${m.gears === 1 ? '' : 's'}`;
    this.seated.textContent = m.seated;
    this.spills.textContent = `Spills: ${m.spillsThisLoop} this loop, ${m.spillsLastLoop} last loop`;
    this.milk.textContent = m.milk;
    for (const p of m.palette) {
      const { btn, label, icon, unknown, info } = this.paletteBtns.get(p.piece)!;
      label.textContent = p.locked ? '' : `${PIECE_LABEL[p.piece]} · ${PIECE_PRICE[p.piece]}${p.note ? ' · ' + p.note : ''}`;
      icon.hidden = p.locked;
      info.hidden = p.locked;
      unknown.hidden = !p.locked;
      btn.classList.toggle('locked', p.locked);
      btn.setAttribute('aria-disabled', String(p.locked));
      btn.setAttribute('aria-label', p.locked ? 'A piece not unlocked yet' : PIECE_LABEL[p.piece]);
      btn.dataset.tip = pieceTipKey(p.piece, p.locked);
      btn.classList.toggle('active', m.inHand === p.piece);
    }
    // A row not for sale yet is not disabled, so it still gets its tooltip, and a click says why.
    this.rowBtn.classList.toggle('locked', m.rowsLocked !== null);
    this.rowBtn.setAttribute('aria-disabled', String(m.rowsLocked !== null));
    this.rowBtn.dataset.tip = m.rowsLocked === null ? 'row' : 'row:locked';
    this.undoBtn.disabled = !m.canUndo;
    this.redoBtn.disabled = !m.canRedo;
    this.bufferInfo.textContent = m.bufferInfo;
    this.message.textContent = m.message;
    this.hover.textContent = m.hoverInfo || REFUND_HINT;
  }
}

/** A card with a row of tabs; one pane shows at a time and scrolls on its own. */
export class Tabs {
  readonly root = el('div', { className: 'card tabs' });
  private buttons = new Map<string, HTMLButtonElement>();
  private panes = new Map<string, HTMLElement>();

  constructor(tabs: { id: string; label: string; content: Node[] }[]) {
    const bar = el('div', { className: 'tab-bar' });
    const body = el('div', { className: 'tab-body' });
    for (const t of tabs) {
      const b = el('button', { className: 'tab', textContent: t.label });
      b.onclick = () => this.select(t.id);
      this.buttons.set(t.id, b);
      bar.append(b);
      const pane = el('div', { className: 'pane' }, ...t.content);
      this.panes.set(t.id, pane);
      body.append(pane);
    }
    this.root.append(bar, body);
    this.select(tabs[0].id);
  }

  /** The tab showing. */
  current = '';

  /** A tab's button, for the tour to point at. */
  button(id: string): HTMLElement {
    return this.buttons.get(id)!;
  }

  select(id: string): void {
    this.current = id;
    for (const [k, b] of this.buttons) b.classList.toggle('active', k === id);
    for (const [k, p] of this.panes) p.hidden = k !== id;
  }
}

/** The tour, the keys, and credits for the fonts. */
export function helpPane(startTour: () => void): HTMLElement[] {
  const tour = el('button', { className: 'primary', textContent: 'Take the tour' });
  tour.onclick = startTour;
  return [
    el('div', { className: 'help-tour' }, tour, el('span', { className: 'muted' }, 'A few short steps: the clock, slots and your first four pieces.')),
    el(
      'ul',
      { className: 'keys' },
      ...[
        'Click a palette piece, or press its number key (1 to 9, then 0), then click the floor. Drag to lay belts.',
        'Hover a palette piece for its rules, and an underlined drink for how it is made',
        'R turn · F flip · Esc or right-click put down',
        'Z delete, with a full refund · X cut · C copy (the tile under the cursor)',
        'Shift+drag box select, then Z, Ctrl+X, Ctrl+C',
        'Ctrl+V pick up the buffer · Ctrl+wheel older entries',
        'Ctrl+Z undo · Ctrl+Y redo',
        'Space pause · . step one tick',
        'Right-drag, middle-drag or the mouse wheel: look around a tall floor',
        'Splitter edges: yellow outputs, green where the next item goes, red where it would spill',
      ].map((t) => el('li', {}, t)),
    ),
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
