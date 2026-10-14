// The build palette, in pages when it does not all fit (docs/QUESTIONS.md,
// Q71). Each piece shows its number key and, once unlocked, a mark that it has
// a tooltip; a locked piece is only a question mark. Locked buttons are not
// disabled, so they still get hover, and a click says why nothing happens.
// Arrows, or a swipe across the pieces, turn the page; picking a piece by its
// key turns to its page. A workbench puzzle shows only the pieces it offers,
// with how many are left in place of a price (docs/QUESTIONS.md, Q77).

import { ALL_PIECES, PIECE_LABEL, type PieceKind } from '../game/pieces';
import { PIECE_PRICE } from '../game/tuning';
import { icon } from './art/icons';
import { spriteImg } from './art/dom';
import { el } from './el';
import { pieceKey } from './hotkeys';
import { pieceTipKey } from './tips';

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

/** A swipe across the pieces this long turns the page. */
const SWIPE = 40;

export interface PaletteFit {
  /** Pieces on a page. */
  perPage: number;
  /** Whether the page arrows show. */
  arrows: boolean;
}

/**
 * How many of `n` pieces, each `piece` pixels square with `gap` between them,
 * a box `w` wide fits on a page: in one row, or in as many rows as fit `h`
 * when `fill` is set. Arrows `arrow` wide go either side once they do not all fit.
 */
export function paletteFit(n: number, w: number, h: number, piece: number, gap: number, arrow: number, fill: boolean): PaletteFit {
  const across = (room: number) => Math.max(1, Math.floor((room + gap) / (piece + gap)));
  const rows = fill ? across(h) : 1;
  if (across(w) * rows >= n) return { perPage: n, arrows: false };
  return { perPage: Math.min(n, across(w - 2 * (arrow + gap)) * rows), arrows: true };
}

export function pageCount(n: number, perPage: number): number {
  return Math.max(1, Math.ceil(n / Math.max(1, perPage)));
}

export interface PaletteModel {
  /** The pieces shown, in palette order; any other is left out. */
  palette: { piece: PieceKind; locked: boolean; note: string }[];
  inHand: PieceKind | 'group' | null;
  /** Show each piece's number key. */
  keys: boolean;
  /** Building costs nothing here: no prices. */
  free?: boolean;
}

interface PieceButton {
  btn: HTMLButtonElement;
  label: HTMLSpanElement;
  icon: HTMLImageElement;
  unknown: HTMLSpanElement;
  info: HTMLSpanElement;
  key: HTMLSpanElement;
}

export class Palette {
  readonly root = el('div', { className: 'palette-wrap' });
  private grid = el('div', { className: 'palette' });
  private prev = el('button', { className: 'page-arrow' }, icon('prev', 20));
  private next = el('button', { className: 'page-arrow' }, icon('next', 20));
  private pageNote = el('span', { className: 'page-note' });
  private btns = new Map<PieceKind, PieceButton>();
  private fit: PaletteFit = { perPage: ALL_PIECES.length, arrows: false };
  private page = 0;
  /** The pieces shown, in palette order. */
  private shown: PieceKind[] = [...ALL_PIECES];
  private held: PieceKind | 'group' | null = null;
  /** A swipe just turned the page: the click it ends in picks nothing. */
  private swiped = false;

  constructor(pick: (piece: PieceKind) => void) {
    this.prev.setAttribute('aria-label', 'Previous pieces');
    this.next.setAttribute('aria-label', 'More pieces');
    this.prev.onclick = () => this.turn(-1);
    this.next.onclick = () => this.turn(1);
    ALL_PIECES.forEach((piece, i) => {
      const label = el('span', { className: 'piece-label' });
      const img = spriteImg(PIECE_ICON[piece], 40);
      const unknown = el('span', { className: 'piece-unknown', textContent: '?' });
      const info = el('span', { className: 'piece-info', textContent: 'i' });
      const key = el('span', { className: 'piece-key', textContent: pieceKey(i) ?? '' });
      const btn = el('button', { className: 'piece' }, key, info, img, unknown, label);
      btn.onclick = () => {
        if (this.swiped) return;
        pick(piece);
      };
      this.btns.set(piece, { btn, label, icon: img, unknown, info, key });
      this.grid.append(btn);
    });
    this.root.append(this.prev, this.grid, this.next, this.pageNote);
    // The stylesheet sizes the palette to fit them all where it can.
    this.root.style.setProperty('--pieces', String(ALL_PIECES.length));
    this.swipes();
    new ResizeObserver(() => this.layout()).observe(this.root);
  }

  /** The palette buttons of these pieces, on the page that shows the first of them. */
  pieceButtons(pieces: readonly PieceKind[]): HTMLElement[] {
    if (pieces.length) this.showPage(this.pageOf(pieces[0]));
    return pieces.map((p) => this.btns.get(p)!.btn);
  }

  update(m: PaletteModel): void {
    const shown = m.palette.map((p) => p.piece);
    if (shown.join() !== this.shown.join()) {
      this.shown = shown;
      this.root.style.setProperty('--pieces', String(shown.length));
      this.layout();
    }
    for (const p of m.palette) {
      const { btn, label, icon: img, unknown, info, key } = this.btns.get(p.piece)!;
      const price = m.free ? '' : ` · ${PIECE_PRICE[p.piece]}`;
      label.textContent = p.locked ? '' : `${PIECE_LABEL[p.piece]}${price}${p.note ? ' · ' + p.note : ''}`;
      img.hidden = p.locked;
      info.hidden = p.locked;
      unknown.hidden = !p.locked;
      key.hidden = !m.keys;
      btn.classList.toggle('locked', p.locked);
      btn.setAttribute('aria-disabled', String(p.locked));
      btn.setAttribute('aria-label', p.locked ? 'A piece not unlocked yet' : PIECE_LABEL[p.piece]);
      btn.dataset.tip = pieceTipKey(p.piece, p.locked, m.free);
      btn.classList.toggle('active', m.inHand === p.piece);
    }
    // A piece newly in hand, by its key, turns to its page.
    if (m.inHand !== this.held) {
      this.held = m.inHand;
      if (m.inHand && m.inHand !== 'group') this.showPage(this.pageOf(m.inHand));
    }
  }

  private pageOf(piece: PieceKind): number {
    return Math.floor(Math.max(0, this.shown.indexOf(piece)) / this.fit.perPage);
  }

  private turn(by: number): void {
    this.showPage(this.page + by);
  }

  private showPage(page: number): void {
    const pages = pageCount(this.shown.length, this.fit.perPage);
    this.page = Math.max(0, Math.min(pages - 1, page));
    const from = this.page * this.fit.perPage;
    for (const [piece, b] of this.btns) {
      const i = this.shown.indexOf(piece);
      b.btn.hidden = i < 0 || i < from || i >= from + this.fit.perPage;
    }
    this.root.classList.toggle('paged', this.fit.arrows);
    this.prev.hidden = this.next.hidden = this.pageNote.hidden = !this.fit.arrows;
    this.prev.disabled = this.page === 0;
    this.next.disabled = this.page === pages - 1;
    this.pageNote.textContent = `${this.page + 1} / ${pages}`;
  }

  /** Work out the page size from the room the palette has, which its stylesheet sets. */
  private layout(): void {
    const css = getComputedStyle(this.root);
    // The size of a piece as drawn: the stylesheet's own may be a clamp() the page has to work out.
    const shown = this.grid.querySelector<HTMLElement>('button.piece:not([hidden])');
    const piece = shown?.offsetWidth || parseFloat(css.getPropertyValue('--piece')) || 76;
    const gap = parseFloat(css.getPropertyValue('--piece-gap')) || 6;
    const arrow = parseFloat(css.getPropertyValue('--arrow')) || 28;
    const fill = css.getPropertyValue('--palette-fill').trim() === '1';
    const w = this.root.clientWidth;
    const h = this.root.clientHeight;
    if (w === 0) return;
    const fit = paletteFit(this.shown.length, w, h, piece, gap, arrow, fill);
    const first = this.page * this.fit.perPage;
    this.fit = fit;
    // Keep the piece in hand in view, or else the first piece that was showing.
    const held = this.held && this.held !== 'group' ? this.pageOf(this.held) : null;
    this.showPage(held ?? Math.floor(first / fit.perPage));
  }

  /** A finger swiped across the pieces turns the page. */
  private swipes(): void {
    let from: { x: number; y: number; id: number } | null = null;
    this.grid.addEventListener('pointerdown', (e) => {
      this.swiped = false;
      if (e.pointerType === 'touch') from = { x: e.clientX, y: e.clientY, id: e.pointerId };
    });
    this.grid.addEventListener('pointerup', (e) => {
      if (!from || from.id !== e.pointerId || !this.fit.arrows) return;
      const dx = e.clientX - from.x;
      const dy = e.clientY - from.y;
      from = null;
      if (Math.abs(dx) < SWIPE || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      this.swiped = true;
      this.turn(dx < 0 ? 1 : -1);
    });
    this.grid.addEventListener('pointercancel', () => {
      from = null;
    });
  }
}
