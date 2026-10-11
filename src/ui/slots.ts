// The first screen: the save slots. Each holds one shop to open, export,
// replace with an imported file or delete; an empty one starts a new shop.
// An exported save is the save itself, as a JSON file.

import type { RegularDef } from '../sim/types';
import { type Save, exportText, importText } from '../game/save';
import { shopTitle } from '../game/share';
import { START_COINS } from '../game/tuning';
import { portraitImg } from './art/dom';
import { el } from './el';
import { SLOTS, type SlotState, canSave, clearSlot, readSlot, writeSlot } from './storage';

/** The largest file the import will read: a twelve-row save is a few kilobytes. */
const IMPORT_MAX_BYTES = 1_000_000;

/** Hand the player a file to keep. */
export function downloadText(text: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = el('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** "tick-tock-the-night-owl-2026-10-11.json". */
export function saveFileName(shopName: string | undefined, now = new Date()): string {
  const slug =
    (shopName ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'shop';
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `tick-tock-${slug}-${day}.json`;
}

export function downloadSave(save: Save): void {
  downloadText(exportText(save), saveFileName(save.shopName));
}

/** "2 hours ago": how long since a shop was last open. */
function ago(then: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - then) / 60_000);
  const n = (k: number, unit: string) => `${k} ${unit}${k === 1 ? '' : 's'} ago`;
  if (minutes < 1) return 'just now';
  if (minutes < 60) return n(minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return n(hours, 'hour');
  return n(Math.floor(hours / 24), 'day');
}

export interface SlotScreenOptions {
  defs: readonly RegularDef[];
  debug: boolean;
  /** Shown above the slots, such as a share link that could not be opened. */
  notice?: string;
  /** Open the shop in a slot; an empty slot opens a new shop. */
  open(slot: number): void;
}

export function showSlotScreen(opts: SlotScreenOptions): void {
  const { defs, debug } = opts;
  const slots = el('div', { className: 'slots' });
  const status = el('div', { className: 'slot-status', role: 'status' });
  const file = el('input', { type: 'file', accept: '.json,application/json', hidden: true });
  const screen = el(
    'div',
    { className: 'slots-screen' },
    el('h1', {}, 'Tick Tock Coffee Shop', debug ? el('span', { className: 'badge' }, 'debug') : ''),
    el('p', { className: 'slots-lead' }, 'Choose a shop'),
    opts.notice ? el('p', { className: 'slots-notice' }, opts.notice) : '',
    slots,
    status,
    el(
      'p',
      { className: 'muted slots-foot' },
      canSave()
        ? 'Shops are saved in this browser as you play. Export one to keep a copy, or to move it to another browser, then import it here.'
        : 'This browser is not keeping saves (a private window, or storage is blocked). You can still play, but the shop is gone when the page closes.',
    ),
    file,
  );
  let importSlot = 0;

  const say = (text: string) => {
    status.textContent = text;
  };

  const open = (slot: number) => {
    screen.remove();
    opts.open(slot);
  };

  const importInto = (slot: number) => {
    importSlot = slot;
    file.value = '';
    file.click();
  };

  file.onchange = async () => {
    const f = file.files?.[0];
    if (!f) return;
    const save = f.size <= IMPORT_MAX_BYTES ? importText(await f.text(), defs) : null;
    if (!save) {
      say(`${f.name} is not a Tick Tock Coffee Shop save, so nothing was imported.`);
      return;
    }
    const was = readSlot(defs, debug, importSlot);
    const into = shopTitle(save.shopName ?? '');
    if (was.kind !== 'empty' && !window.confirm(`Replace what is in slot ${importSlot} with ${into}? Export it first if you may want it back.`)) return;
    if (!writeSlot(debug, importSlot, save)) {
      say('This browser would not store the save.');
      return;
    }
    say(`Imported ${into} into slot ${importSlot}.`);
    draw();
  };

  const remove = (slot: number, title: string) => {
    if (!window.confirm(`Delete ${title} from slot ${slot}? This cannot be undone. Export it first to keep a copy.`)) return;
    clearSlot(debug, slot);
    say(`Slot ${slot} is empty.`);
    draw();
  };

  const button = (text: string, onclick: () => void, className = '') => {
    const b = el('button', { textContent: text, className });
    b.onclick = onclick;
    return b;
  };

  function card(slot: number, state: SlotState, now: number): { root: HTMLElement; main: HTMLButtonElement } {
    const top = el('div', { className: 'slot-top' }, el('span', {}, `Slot ${slot}`));
    const root = el('div', { className: `card slot ${state.kind}` }, top);
    const importBtn = button('Import', () => importInto(slot));
    if (state.kind === 'empty') {
      const main = button('New shop', () => open(slot));
      root.append(
        el('div', { className: 'card-name' }, 'Empty'),
        el('div', { className: 'muted slot-text' }, `A new shop: ${START_COINS} coins, a bare floor and its first regular at the door.`),
        main,
        el('div', { className: 'row slot-actions' }, importBtn),
      );
      return { root, main };
    }
    if (state.kind === 'unreadable') {
      const main = button('Export', () => downloadText(state.raw, `tick-tock-slot-${slot}-unreadable.json`));
      root.append(
        el('div', { className: 'card-name' }, 'Cannot be read'),
        el(
          'div',
          { className: 'muted slot-text' },
          'This save may come from a newer version of the game, or be damaged. It is kept as it is: export it to keep a copy, or delete it to free the slot.',
        ),
        el('div', { className: 'row slot-actions' }, main, importBtn, button('Delete', () => remove(slot, 'the unreadable save'))),
      );
      return { root, main };
    }
    const save = state.save;
    const title = shopTitle(save.shopName ?? '');
    const newest = defs[save.regulars.length - 1];
    top.append(el('span', {}, ago(save.lastSeen, now)));
    const coins = `${save.till.toLocaleString()} coin${save.till === 1 ? '' : 's'}`;
    const gears = save.gears ? ` · ${save.gears.toLocaleString()} gear${save.gears === 1 ? '' : 's'}` : '';
    const main = button('Open', () => open(slot));
    root.append(
      el(
        'div',
        { className: 'slot-body' },
        newest ? portraitImg(newest.id, 64, 'portrait') : '',
        el(
          'div',
          { className: 'slot-text' },
          el('div', { className: 'card-name' }, title),
          el('div', { className: 'muted' }, `${save.regulars.length} of ${defs.length} regulars in`),
          newest ? el('div', { className: 'muted' }, `Newest: ${newest.name.toLowerCase()}`) : '',
          el('div', { className: 'muted' }, coins + gears),
          save.catName ? el('div', { className: 'muted' }, `Cat: ${save.catName}`) : '',
        ),
      ),
      main,
      el(
        'div',
        { className: 'row slot-actions' },
        button('Export', () => downloadSave(save)),
        importBtn,
        button('Delete', () => remove(slot, title)),
      ),
    );
    return { root, main };
  }

  function draw(): void {
    const now = Date.now();
    const cards = SLOTS.map((slot) => ({ slot, state: readSlot(defs, debug, slot) })).map(({ slot, state }) => ({ state, ...card(slot, state, now) }));
    slots.replaceChildren(...cards.map((c) => c.root));
    // Enter carries on with the shop open most recently, or starts one in the first empty slot.
    const saved = cards.filter((c) => c.state.kind === 'save');
    const latest = saved.sort((a, b) => lastSeen(b.state) - lastSeen(a.state))[0];
    const first = latest ?? cards.find((c) => c.state.kind === 'empty');
    first?.main.classList.add('primary');
    first?.main.focus();
  }

  document.body.append(screen);
  draw();
}

const lastSeen = (s: SlotState) => (s.kind === 'save' ? s.save.lastSeen : 0);
