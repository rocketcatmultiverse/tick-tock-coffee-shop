// The side panel: plain DOM, rebuilt in place on every render.

import { roastForTick } from '../sim/items';
import { LOOP } from '../sim/tuning';
import { ALL_PIECES, PIECE_LABEL, type PieceKind } from '../game/pieces';
import { FLOOR_ROW_PRICE, PIECE_PRICE } from '../game/tuning';
import { itemColor } from './render';

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

export class Panel {
  readonly root: HTMLElement;
  private dial = el('canvas', { width: 120, height: 120, className: 'dial' });
  private clockText = el('div', { className: 'clock-text' });
  private playBtn = el('button');
  private stepBtn = el('button', { textContent: 'Step ▸|' });
  private speed = el('select');
  private till = el('div', { className: 'till' });
  private spills = el('div');
  private milk = el('div', { className: 'muted' });
  private palette = el('div', { className: 'palette' });
  private paletteBtns = new Map<PieceKind, HTMLButtonElement>();
  private rowBtn = el('button', { textContent: `Buy floor row (${FLOOR_ROW_PRICE})` });
  private undoBtn = el('button', { textContent: 'Undo' });
  private redoBtn = el('button', { textContent: 'Redo' });
  private message = el('div', { className: 'message' });
  private hover = el('div', { className: 'hover' });
  private bufferInfo = el('div', { className: 'muted' });
  /** Slot for the counter's own sections (regulars), filled by the app. */
  readonly extra = el('div');

  constructor(actions: PanelActions, debug: boolean) {
    this.playBtn.onclick = () => actions.togglePause();
    this.stepBtn.onclick = () => actions.stepOnce();
    for (const n of [1, 2, 4]) this.speed.append(el('option', { value: String(n), textContent: `${n}×` }));
    this.speed.onchange = () => actions.setSpeed(Number(this.speed.value));
    this.rowBtn.onclick = () => actions.buyRow();
    this.undoBtn.onclick = () => actions.undo();
    this.redoBtn.onclick = () => actions.redo();
    for (const piece of ALL_PIECES) {
      const b = el('button', { className: 'piece' });
      b.onclick = () => actions.pick(piece);
      this.paletteBtns.set(piece, b);
      this.palette.append(b);
    }
    this.root = el(
      'aside',
      { className: 'panel' },
      el('h1', {}, 'Tick Tock Coffee Shop', debug ? el('span', { className: 'badge' }, 'debug') : ''),
      el('div', { className: 'clock' }, this.dial, this.clockText),
      el('div', { className: 'row' }, this.playBtn, this.stepBtn, this.speed),
      this.till,
      this.spills,
      this.milk,
      el('h2', {}, 'Build'),
      this.palette,
      el('div', { className: 'row' }, this.rowBtn, this.undoBtn, this.redoBtn),
      this.bufferInfo,
      this.message,
      this.hover,
      this.extra,
      el(
        'details',
        {},
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
      ),
    );
  }

  update(m: PanelModel): void {
    // The floor shows the result of the last tick run, so the clock names that tick.
    const shown = m.T - 1;
    const t = shown >= 0 ? shown % LOOP : -1;
    this.drawDial(t);
    this.clockText.textContent = shown >= 0 ? `tick ${t}   (T = ${shown})` : 'not started';
    this.playBtn.textContent = m.running ? 'Pause ❚❚' : 'Play ▶';
    this.stepBtn.disabled = m.running;
    this.speed.value = String(m.speed);
    this.till.textContent = `Till: ${m.till} coins   ·   Gears: ${m.gears}`;
    this.spills.textContent = `Spills this loop: ${m.spillsThisLoop}   (last loop: ${m.spillsLastLoop})`;
    this.milk.textContent = m.milk;
    for (const p of m.palette) {
      const b = this.paletteBtns.get(p.piece)!;
      b.textContent = `${PIECE_LABEL[p.piece]} · ${PIECE_PRICE[p.piece]}${p.note ? ' · ' + p.note : ''}`;
      b.disabled = p.locked;
      b.title = p.locked ? 'Locked' : '';
      b.classList.toggle('active', m.inHand === p.piece);
    }
    this.undoBtn.disabled = !m.canUndo;
    this.redoBtn.disabled = !m.canRedo;
    this.bufferInfo.textContent = m.bufferInfo;
    this.message.textContent = m.message;
    this.hover.textContent = m.hoverInfo;
  }

  private drawDial(t: number): void {
    const ctx = this.dial.getContext('2d');
    if (!ctx) return;
    const c = 60;
    const r = 52;
    ctx.clearRect(0, 0, 120, 120);
    for (let k = 0; k < LOOP; k++) {
      const a0 = ((k - 0.5) / LOOP) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((k + 0.5) / LOOP) * Math.PI * 2 - Math.PI / 2;
      ctx.fillStyle = itemColor({ kind: 'coffee', roast: roastForTick(k) });
      ctx.globalAlpha = k === t ? 1 : 0.55;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, r, a0, a1);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      const am = (k / LOOP) * Math.PI * 2 - Math.PI / 2;
      ctx.fillStyle = roastForTick(k) === 'light' ? '#222' : '#fff';
      ctx.font = k === t ? 'bold 12px sans-serif' : '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(k), c + Math.cos(am) * (r - 11), c + Math.sin(am) * (r - 11));
    }
    const a = (t / LOOP) * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = '#d0021b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c + Math.cos(a) * (r - 22), c + Math.sin(a) * (r - 22));
    ctx.stroke();
    ctx.lineWidth = 1;
  }
}
