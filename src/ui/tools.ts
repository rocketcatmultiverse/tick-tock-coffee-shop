// The tool bar: every editing key as a button, for a finger or a mouse
// (docs/SPEC.md, Spec 4, "Editing keys"; docs/QUESTIONS.md, Q71). It shows
// what fits the hand: turn, put down and flip while holding something; select,
// delete, cut, copy and paste while not; undo and redo always, except beside
// the thumb stick, which takes their place (Q73).

import { type IconName, icon } from './art/icons';
import { el } from './el';

export type ToolId = 'turn' | 'flip' | 'drop' | 'older' | 'newer' | 'info' | 'select' | 'delete' | 'cut' | 'copy' | 'paste' | 'undo' | 'redo';

/** When a tool shows: holding anything, a group from the buffer, a piece, an empty hand, or always. */
type When = 'held' | 'group' | 'piece' | 'empty' | 'always';

export interface ToolInfo {
  label: string;
  /** The key or mouse move that does the same, if any. */
  key: string;
  /** What it does, for its tooltip. Touch and mouse wording where they differ. */
  line: string;
  touchLine?: string;
  when: When;
}

export const TOOLS: Record<ToolId, ToolInfo> = {
  turn: { label: 'Turn', key: 'R', line: 'Turns the piece or group in hand a quarter turn clockwise. A machine puts out on the side it faces.', when: 'held' },
  flip: { label: 'Flip', key: 'F', line: 'Mirrors the piece or group in hand left to right.', when: 'held' },
  drop: {
    label: 'Put down',
    key: 'Esc or right-click',
    line: 'Empties your hand.',
    touchLine: 'Empties your hand and puts its ghost away.',
    when: 'held',
  },
  older: { label: 'Older', key: 'Ctrl+wheel', line: 'Holds the next older entry in the paste buffer instead.', when: 'group' },
  newer: { label: 'Newer', key: 'Ctrl+wheel', line: 'Holds the next newer entry in the paste buffer instead.', when: 'group' },
  info: { label: 'Rules', key: '', line: 'Opens the Guide at the piece in hand: what it does and what it makes.', when: 'piece' },
  select: {
    label: 'Select',
    key: 'Shift+drag',
    line: 'While it is on, a drag draws a box over the floor. Then Delete, Cut and Copy work on everything in the box.',
    when: 'empty',
  },
  delete: {
    label: 'Delete',
    key: 'Z',
    line: 'Deletes the box, or else the piece under the cursor or last clicked, for a full refund. It goes into the paste buffer too.',
    touchLine: 'Deletes the box, or else the piece you last tapped, for a full refund. It goes into the paste buffer too.',
    when: 'empty',
  },
  cut: {
    label: 'Cut',
    key: 'X',
    line: 'Takes the box, or else the piece under the cursor or last clicked, into your hand to put down elsewhere. Refunded now, paid again when it goes down.',
    touchLine: 'Takes the box, or else the piece you last tapped, into your hand to put down elsewhere. Refunded now, paid again when it goes down.',
    when: 'empty',
  },
  copy: {
    label: 'Copy',
    key: 'C',
    line: 'Copies the box, or else the piece under the cursor or last clicked, into your hand.',
    touchLine: 'Copies the box, or else the piece you last tapped, into your hand.',
    when: 'empty',
  },
  paste: { label: 'Paste', key: 'Ctrl+V', line: 'Picks up the newest entry in the paste buffer: whatever was last cut, copied or deleted.', when: 'empty' },
  undo: { label: 'Undo', key: 'Ctrl+Z', line: 'Takes back the last build action, and its coins. The clock does not go back.', when: 'always' },
  redo: { label: 'Redo', key: 'Ctrl+Y', line: 'Does again what Undo took back.', when: 'always' },
};

/** Turn first and Put down next, under a left thumb, while the right works the stick (Q72). */
const ORDER: ToolId[] = ['turn', 'drop', 'flip', 'older', 'newer', 'info', 'select', 'delete', 'cut', 'copy', 'paste', 'undo', 'redo'];

const ICON: Record<ToolId, IconName> = {
  turn: 'turn',
  flip: 'flip',
  drop: 'drop',
  older: 'older',
  newer: 'newer',
  info: 'info',
  select: 'select',
  delete: 'delete',
  cut: 'cut',
  copy: 'copy',
  paste: 'paste',
  undo: 'undo',
  redo: 'redo',
};

export interface ToolModel {
  hand: 'none' | 'piece' | 'group';
  selectMode: boolean;
  /** Entries in the paste buffer. */
  buffer: number;
  canUndo: boolean;
  canRedo: boolean;
  /** Whether a flip would change what is in hand; Flip is greyed out when not. */
  canFlip: boolean;
  /** The thumb stick shares the tool bar's row: only Turn, Put down, Flip and the buffer's steps show. */
  stick: boolean;
}

/** Beside the thumb stick there is room for what steers the ghost and nothing else. */
const BESIDE_STICK: ReadonlySet<ToolId> = new Set<ToolId>(['turn', 'drop', 'flip', 'older', 'newer']);

/** The tools that show for this hand, in bar order. */
export function toolsFor(m: Pick<ToolModel, 'hand' | 'buffer'> & { stick?: boolean }): ToolId[] {
  const shows = (w: When) =>
    w === 'always' ||
    (w === 'held' && m.hand !== 'none') ||
    (w === 'group' && m.hand === 'group' && m.buffer > 1) ||
    (w === 'piece' && m.hand === 'piece') ||
    (w === 'empty' && m.hand === 'none');
  return ORDER.filter((id) => shows(TOOLS[id].when) && (!m.stick || BESIDE_STICK.has(id)));
}

export class Tools {
  readonly root = el('div', { className: 'tools' });
  private buttons = new Map<ToolId, HTMLButtonElement>();
  private badge = el('span', { className: 'tool-badge' });
  private shown = '';

  constructor(act: (id: ToolId) => void) {
    this.root.setAttribute('role', 'toolbar');
    this.root.setAttribute('aria-label', 'Tools');
    for (const id of ORDER) {
      const b = el('button', { className: `tool tool-${id}` }, icon(ICON[id]), el('span', { className: 'tool-label', textContent: TOOLS[id].label }));
      b.setAttribute('aria-label', TOOLS[id].label);
      b.dataset.tip = `tool:${id}`;
      b.onclick = () => act(id);
      this.buttons.set(id, b);
      this.root.append(b);
    }
    this.buttons.get('paste')!.append(this.badge);
  }

  /** A tool's button, for the tour. */
  button(id: ToolId): HTMLButtonElement {
    return this.buttons.get(id)!;
  }

  update(m: ToolModel): void {
    const show = toolsFor(m);
    const key = show.join(',');
    if (key !== this.shown) {
      this.shown = key;
      for (const [id, b] of this.buttons) b.hidden = !show.includes(id);
    }
    const select = this.buttons.get('select')!;
    select.classList.toggle('active', m.selectMode);
    select.setAttribute('aria-pressed', String(m.selectMode));
    this.buttons.get('flip')!.disabled = !m.canFlip;
    this.buttons.get('undo')!.disabled = !m.canUndo;
    this.buttons.get('redo')!.disabled = !m.canRedo;
    this.badge.textContent = m.buffer ? String(m.buffer) : '';
    this.badge.hidden = m.buffer === 0;
  }
}
