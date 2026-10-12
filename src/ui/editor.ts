// Build tools: the piece or group in hand, box selection, the paste buffer
// and undo/redo. No DOM here; input.ts turns mouse and keys into these calls.

import type { Dir, Structure } from '../sim/types';
import { colOf, rowOf, stepFrom, tileIndex, turnClockwise, flipDir } from '../sim/grid';
import { type BuildPlan, type TileChange, chutePartner, planBuild } from '../game/build';
import { PIECE_LABEL, type PieceKind, isFixed } from '../game/pieces';
import { BUFFER_HISTORY } from '../game/tuning';
import type { Shop } from '../game/shop';
import {
  type BufferHistory,
  type Entry,
  entryFromTiles,
  flip,
  normalize,
  pasteChanges,
  pushEntry,
  rotate,
  stepBuffer,
} from './buffer';

export type Hand = { type: 'piece'; piece: PieceKind; dir: Dir } | { type: 'group'; entry: Entry } | null;

/** Pieces that face no way: turning or flipping one changes nothing. */
const FACELESS: ReadonlySet<PieceKind> = new Set<PieceKind>(['well', 'door', 'splitter']);

/** Inclusive rectangle of back-room tiles. */
export interface Rect {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

type AppliedPlan = Extract<BuildPlan, { ok: true }>;

/** One undo step: each tile it touched, as it was before and after. */
type Action = Map<number, { before: Structure | null; after: Structure | null }>;

export interface Ghost {
  changes: TileChange[];
  /** Why the click would be refused, or null if it would go through. */
  reason: string | null;
  cost: number;
}

export class Editor {
  hand: Hand = null;
  selection: Rect | null = null;
  buffer: BufferHistory = { entries: [], current: 0 };
  message = '';
  private undoStack: Action[] = [];
  private redoStack: Action[] = [];
  private drag: { action: Action; last: number; placed: Set<number> } | null = null;
  private selectFrom: { row: number; col: number } | null = null;

  constructor(private readonly shop: Shop) {}

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** A run of belts is being laid: press() began it and release() has not yet ended it. */
  get dragging(): boolean {
    return this.drag !== null;
  }

  // ---- The hand -------------------------------------------------------------

  pick(piece: PieceKind): void {
    if (!this.shop.rights().unlocked.has(piece)) {
      this.message = 'Not unlocked yet: a regular still to come brings it';
      return;
    }
    // A run of belts being laid ends here, as one undo step.
    this.release();
    const dir = this.hand?.type === 'piece' ? this.hand.dir : piece === 'belt' ? 'E' : 'S';
    this.hand = { type: 'piece', piece, dir };
    this.selection = null;
    this.message = '';
  }

  /** Esc: put down whatever is in hand, and drop the selection. A run of belts being laid is kept, as one undo step. */
  putDown(): void {
    this.release();
    this.hand = null;
    this.selection = null;
    this.selectFrom = null;
  }

  rotateHand(): void {
    if (this.hand?.type === 'piece') this.hand = { ...this.hand, dir: turnClockwise(this.hand.dir) };
    else if (this.hand?.type === 'group') this.hand = { type: 'group', entry: rotate(this.hand.entry) };
  }

  flipHand(): void {
    if (this.hand?.type === 'piece') this.hand = { ...this.hand, dir: flipDir(this.hand.dir) };
    else if (this.hand?.type === 'group') this.hand = { type: 'group', entry: flip(this.hand.entry) };
  }

  /** Whether a flip would change what is in hand: a piece facing east or west, or a group that is not its own mirror image. */
  get canFlip(): boolean {
    const h = this.hand;
    if (h?.type === 'piece') return !FACELESS.has(h.piece) && flipDir(h.dir) !== h.dir;
    if (h?.type === 'group') return JSON.stringify(flip(h.entry)) !== JSON.stringify(normalize(h.entry));
    return false;
  }

  /** Ctrl+V: pick the current buffer entry back up. */
  pickUpBuffer(): void {
    const entry = this.buffer.entries[this.buffer.current];
    if (entry) this.hand = { type: 'group', entry };
    else this.message = 'The paste buffer is empty';
  }

  /** Ctrl+wheel: step through the buffer history and hold that entry. */
  wheel(by: number): void {
    if (this.buffer.entries.length === 0) {
      this.message = 'The paste buffer is empty';
      return;
    }
    // While an entry is already in hand the wheel moves on; otherwise it picks up the current one.
    if (this.hand?.type === 'group') this.buffer = stepBuffer(this.buffer, by);
    this.pickUpBuffer();
    this.message = `Paste buffer ${this.buffer.current + 1} of ${this.buffer.entries.length}`;
  }

  // ---- Placing --------------------------------------------------------------

  private pieceChanges(piece: PieceKind, dir: Dir, row: number, col: number): TileChange[] | string {
    const layout = this.shop.layout;
    if (row < 0 || row >= layout.rows) return 'Off the floor';
    const index = tileIndex(row, col);
    if (layout.tiles[index]?.kind === 'feeder') return 'The feeder is fixed';
    if (layout.tiles[index]) return 'Occupied';
    let s: Structure;
    switch (piece) {
      case 'belt':
        s = { kind: 'belt', dir };
        break;
      case 'well':
        s = { kind: 'well' };
        break;
      case 'door':
        s = { kind: 'door' };
        break;
      case 'splitter':
        s = { kind: 'splitter' };
        break;
      case 'spring':
        s = { kind: 'spring', dir };
        break;
      case 'chute': {
        const far = stepFrom(layout, index, dir, 2);
        if (far === null || far >= layout.rows * 12) return 'The catch would be off the floor';
        if (layout.tiles[far]) return 'Both ends of a chute must be free';
        return [
          { index, to: { kind: 'launch', dir } },
          { index: far, to: { kind: 'catch', dir } },
        ];
      }
      default:
        s = { kind: piece, out: dir };
    }
    return [{ index, to: s }];
  }

  /** What a click on (row, col) would do with the hand as it is. */
  ghost(row: number, col: number): Ghost | null {
    if (!this.hand) return null;
    const changes =
      this.hand.type === 'piece'
        ? this.pieceChanges(this.hand.piece, this.hand.dir, row, col)
        : pasteChanges(this.shop.layout, this.hand.entry, row, col);
    if (typeof changes === 'string') return { changes: [], reason: changes, cost: 0 };
    const plan = this.preview(changes);
    return { changes, reason: plan.ok ? null : plan.reason, cost: plan.ok ? plan.cost : 0 };
  }

  private preview(changes: TileChange[]): BuildPlan {
    return planBuild(this.shop.layout, changes, this.shop.rights(), this.shop.till);
  }

  /** Click with something in hand. Belts start a drag; see dragTo. */
  press(row: number, col: number): void {
    if (!this.hand) return;
    if (this.hand.type === 'piece' && this.hand.piece === 'belt') {
      this.drag = { action: new Map(), last: -1, placed: new Set() };
      this.layBelt(row, col, this.hand.dir);
      if (row >= 0 && row < this.shop.layout.rows) this.drag.last = tileIndex(row, col);
      return;
    }
    const g = this.ghost(row, col);
    if (!g) return;
    if (g.reason) {
      this.message = g.reason;
      return;
    }
    this.commit(g.changes);
    if (this.hand.type === 'group') this.message = `Pasted ${g.changes.length} piece(s) for ${g.cost}`;
  }

  /** Dragging a belt: each new tile gets a belt, and the belt before it turns to point at it. */
  dragTo(row: number, col: number): void {
    const drag = this.drag;
    if (!drag || drag.last < 0 || this.hand?.type !== 'piece') return;
    if (row < 0 || row >= this.shop.layout.rows) return;
    let r = rowOf(drag.last);
    let c = colOf(drag.last);
    while (r !== row || c !== col) {
      const d: Dir = c < col ? 'E' : c > col ? 'W' : r < row ? 'N' : 'S';
      c += d === 'E' ? 1 : d === 'W' ? -1 : 0;
      r += d === 'N' ? 1 : d === 'S' ? -1 : 0;
      if (drag.placed.has(drag.last)) this.apply([{ index: drag.last, to: { kind: 'belt', dir: d } }], drag.action);
      this.hand = { ...this.hand, dir: d };
      this.layBelt(r, c, d);
      drag.last = tileIndex(r, c);
    }
  }

  release(): void {
    if (this.drag && this.drag.action.size > 0) this.record(this.drag.action);
    this.drag = null;
  }

  private layBelt(row: number, col: number, dir: Dir): void {
    const changes = this.pieceChanges('belt', dir, row, col);
    if (typeof changes === 'string' || !this.drag) return;
    if (this.apply(changes, this.drag.action)) {
      this.drag.placed.add(changes[0].index);
      this.drag.last = changes[0].index;
    }
  }

  // ---- Selecting, deleting, cutting, copying --------------------------------

  beginSelect(row: number, col: number): void {
    this.selectFrom = { row, col };
    this.selectTo(row, col);
  }

  selectTo(row: number, col: number): void {
    if (!this.selectFrom) return;
    const rows = this.shop.layout.rows;
    const clampR = (r: number) => Math.max(0, Math.min(rows - 1, r));
    this.selection = {
      r0: clampR(Math.min(this.selectFrom.row, row)),
      r1: clampR(Math.max(this.selectFrom.row, row)),
      c0: Math.min(this.selectFrom.col, col),
      c1: Math.max(this.selectFrom.col, col),
    };
  }

  endSelect(): void {
    this.selectFrom = null;
  }

  get selecting(): boolean {
    return this.selectFrom !== null;
  }

  /** Back-room tiles holding something movable, with both ends of any chute. */
  private gather(indices: number[]): number[] {
    const layout = this.shop.layout;
    const out = new Set<number>();
    for (const i of indices) {
      const s = layout.tiles[i];
      if (!s || isFixed(s)) continue;
      out.add(i);
      const p = chutePartner(layout, i);
      if (p !== null) out.add(p);
    }
    return [...out].sort((a, b) => a - b);
  }

  private hovered(row: number, col: number): number[] {
    if (row < 0 || row >= this.shop.layout.rows) return [];
    return this.gather([tileIndex(row, col)]);
  }

  private selected(): number[] {
    const sel = this.selection;
    if (!sel) return [];
    const out: number[] = [];
    for (let r = sel.r0; r <= sel.r1; r++) for (let c = sel.c0; c <= sel.c1; c++) out.push(tileIndex(r, c));
    return this.gather(out);
  }

  /** Z: delete the box if there is one, else the tile under the cursor. */
  deleteKey(row: number, col: number): void {
    const tiles = this.selection ? this.selected() : this.hovered(row, col);
    if (this.remove(tiles, 'Deleted')) this.selection = null;
  }

  /** X hovering, or Ctrl+X on the box: remove into the buffer and hold it. */
  cut(tiles: 'hover' | 'box', row = 0, col = 0): void {
    const list = tiles === 'box' ? this.selected() : this.hovered(row, col);
    if (this.remove(list, 'Cut')) {
      this.selection = null;
      this.pickUpBuffer();
    }
  }

  /** C hovering, or Ctrl+C on the box: copy into the buffer and hold it. */
  copy(tiles: 'hover' | 'box', row = 0, col = 0): void {
    const list = tiles === 'box' ? this.selected() : this.hovered(row, col);
    if (list.length === 0) {
      this.message = 'Nothing to copy';
      return;
    }
    this.buffer = pushEntry(this.buffer, entryFromTiles(this.shop.layout, list), BUFFER_HISTORY);
    this.selection = null;
    this.pickUpBuffer();
    this.message = `Copied ${list.length} piece(s)`;
  }

  private remove(tiles: number[], verb: string): boolean {
    if (tiles.length === 0) {
      this.message = 'Nothing there';
      return false;
    }
    const entry = entryFromTiles(this.shop.layout, tiles);
    const plan = this.commit(tiles.map((index) => ({ index, to: null })));
    if (!plan) return false;
    this.buffer = pushEntry(this.buffer, entry, BUFFER_HISTORY);
    this.message = `${verb} ${tiles.length} piece(s): ${-plan.cost} coins back, a full refund`;
    return true;
  }

  // ---- Undo and redo --------------------------------------------------------

  undo(): void {
    const action = this.undoStack.pop();
    if (!action) return;
    if (!this.replay(action, 'before')) {
      this.undoStack.push(action);
      return;
    }
    this.redoStack.push(action);
  }

  redo(): void {
    const action = this.redoStack.pop();
    if (!action) return;
    if (!this.replay(action, 'after')) {
      this.redoStack.push(action);
      return;
    }
    this.undoStack.push(action);
  }

  private replay(action: Action, side: 'before' | 'after'): boolean {
    const changes = [...action.entries()].map(([index, v]) => ({ index, to: v[side] }));
    const plan = this.shop.build(changes);
    if (!plan.ok) {
      this.message = `Cannot ${side === 'before' ? 'undo' : 'redo'}: ${plan.reason}`;
      return false;
    }
    this.message = side === 'before' ? 'Undone' : 'Redone';
    return true;
  }

  // ---- Applying edits -------------------------------------------------------

  /** Apply an edit as one undo step. */
  private commit(changes: TileChange[]): AppliedPlan | null {
    const action: Action = new Map();
    const plan = this.apply(changes, action);
    if (plan) this.record(action);
    return plan;
  }

  /** Apply an edit to the live shop, folding it into `action`. */
  private apply(changes: TileChange[], action: Action): AppliedPlan | null {
    const plan = this.shop.build(changes);
    if (!plan.ok) {
      this.message = plan.reason;
      return null;
    }
    changes.forEach((ch, i) => {
      const prev = action.get(ch.index);
      action.set(ch.index, { before: prev ? prev.before : plan.before[i], after: ch.to });
    });
    if (plan.cost > 0) this.message = `${describe(changes)} for ${plan.cost}`;
    return plan;
  }

  private record(action: Action): void {
    this.undoStack.push(action);
    this.redoStack = [];
  }
}

function describe(changes: TileChange[]): string {
  const first = changes[0]?.to;
  if (changes.length === 1 && first) return `Placed ${first.kind}`;
  if (changes.length === 2 && first?.kind === 'launch') return `Placed ${PIECE_LABEL.chute.toLowerCase()}`;
  return `Placed ${changes.length} pieces`;
}
