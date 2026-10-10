// The side panel: plain DOM, rebuilt in place on every render. Laid out as on
// the visuals canvas: title, clock, controls, the till and the regulars, then
// the build palette.

import { roastForTick } from '../sim/items';
import { LOOP } from '../sim/tuning';
import { ALL_PIECES, PIECE_LABEL, type PieceKind } from '../game/pieces';
import { FLOOR_ROW_PRICE, PIECE_PRICE } from '../game/tuning';
import { clockFace, spriteImg } from './art/dom';
import { svgUrl } from './art/raster';

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of children) node.append(c);
  return node;
}

export interface PanelModel {
  T: number;
  running: boolean;
  speed: number;
  till: number;
  gears: number;
  debug: boolean;
  spillsThisLoop: number;
  spillsLastLoop: number;
  milk: string;
  /** "3 seated", "all seated" and the like. */
  seated: string;
  palette: { piece: PieceKind; locked: boolean; note: string }[];
  inHand: PieceKind | 'group' | null;
  message: string;
  hoverInfo: string;
  bufferInfo: string;
  canUndo: boolean;
  canRedo: boolean;
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

/** The sprite each palette piece is shown with. */
const ICON: Record<PieceKind, string> = {
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
  readonly root: HTMLElement;
  private dial = el('img', { className: 'dial', width: 120, height: 120, alt: 'The shop clock' });
  private dialTick: number | null | undefined = undefined;
  private tickBig = el('div', { className: 'big' });
  private tickSmall = el('div', { className: 'muted' });
  private playBtn = el('button', { className: 'primary' });
  private stepBtn = el('button', { textContent: 'Step' });
  private speed = el('select');
  private till = el('div', { className: 'big' });
  private gears = el('div', { className: 'muted' });
  private seated = el('div', { className: 'big' });
  private spills = el('div', { className: 'muted' });
  private milk = el('div', { className: 'muted' });
  private paletteBtns = new Map<PieceKind, { btn: HTMLButtonElement; label: HTMLSpanElement }>();
  private rowBtn = el('button', { textContent: `Buy a floor row · ${FLOOR_ROW_PRICE}` });
  private undoBtn = el('button', { textContent: 'Undo' });
  private redoBtn = el('button', { textContent: 'Redo' });
  private message = el('div', { className: 'message' });
  private hover = el('div', { className: 'hover' });
  private bufferInfo = el('div', { className: 'muted' });
  /** Slot for the counter's own sections (regulars), filled by the app. */
  readonly extra = el('div', { className: 'extra' });

  constructor(actions: PanelActions, debug: boolean) {
    this.playBtn.onclick = () => actions.togglePause();
    this.stepBtn.onclick = () => actions.stepOnce();
    for (const n of [1, 2, 4]) this.speed.append(el('option', { value: String(n), textContent: `${n}×` }));
    this.speed.onchange = () => actions.setSpeed(Number(this.speed.value));
    this.rowBtn.onclick = () => actions.buyRow();
    this.undoBtn.onclick = () => actions.undo();
    this.redoBtn.onclick = () => actions.redo();
    const palette = el('div', { className: 'palette' });
    for (const piece of ALL_PIECES) {
      const label = el('span', { className: 'piece-label' });
      const btn = el('button', { className: 'piece' }, spriteImg(ICON[piece], 40), label);
      btn.onclick = () => actions.pick(piece);
      this.paletteBtns.set(piece, { btn, label });
      palette.append(btn);
    }
    const legend = el(
      'div',
      { className: 'legend' },
      ...ROAST_LEGEND.map(([name, a, b]) => {
        const swatch = el('span', { className: `swatch ${name.toLowerCase()}` });
        return el('div', {}, swatch, `${name} ${a}–${b}`);
      }),
    );
    this.root = el(
      'aside',
      { className: 'panel' },
      el('h1', {}, 'Tick Tock Coffee Shop', debug ? el('span', { className: 'badge' }, 'debug') : ''),
      el('div', { className: 'card clock' }, this.dial, el('div', { className: 'clock-text' }, el('div', { className: 'muted' }, 'Tick'), this.tickBig, legend, this.tickSmall)),
      el('div', { className: 'controls' }, this.playBtn, this.stepBtn, this.speed),
      el(
        'div',
        { className: 'stats' },
        el('div', { className: 'card' }, el('div', { className: 'muted' }, 'Till'), this.till, this.gears),
        el('div', { className: 'card' }, el('div', { className: 'muted' }, 'Regulars'), this.seated, this.spills),
      ),
      this.milk,
      el('div', { className: 'card build' }, el('div', { className: 'muted' }, 'Build'), palette, el('div', { className: 'row' }, this.rowBtn, this.undoBtn, this.redoBtn), this.bufferInfo),
      this.message,
      this.hover,
      this.extra,
      el(
        'details',
        { className: 'card keys-card' },
        el('summary', {}, 'Keys'),
        el(
          'ul',
          { className: 'keys' },
          ...[
            'Click a palette piece, then click the floor. Drag to lay belts.',
            'R turn · F flip · Esc or right-click put down',
            'Z delete · X cut · C copy (the tile under the cursor)',
            'Shift+drag box select, then Z, Ctrl+X, Ctrl+C',
            'Ctrl+V pick up the buffer · Ctrl+wheel older entries',
            'Ctrl+Z undo · Ctrl+Y redo',
            'Space pause · . step one tick',
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
      ),
    );
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
    this.gears.textContent = `${m.gears.toLocaleString()} gear${m.gears === 1 ? '' : 's'} by the till`;
    this.seated.textContent = m.seated;
    this.spills.textContent = `spills this loop ${m.spillsThisLoop} · last ${m.spillsLastLoop}`;
    this.milk.textContent = m.milk;
    for (const p of m.palette) {
      const { btn, label } = this.paletteBtns.get(p.piece)!;
      label.textContent = `${PIECE_LABEL[p.piece]} · ${PIECE_PRICE[p.piece]}${p.note ? ' · ' + p.note : ''}`;
      btn.disabled = p.locked;
      btn.title = p.locked ? 'Locked: a regular still to come brings this one' : '';
      btn.classList.toggle('active', m.inHand === p.piece);
    }
    this.undoBtn.disabled = !m.canUndo;
    this.redoBtn.disabled = !m.canRedo;
    this.bufferInfo.textContent = m.bufferInfo;
    this.message.textContent = m.message;
    this.hover.textContent = m.hoverInfo;
  }
}
