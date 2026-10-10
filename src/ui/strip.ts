// The counter strip: one cell per counter column, under the floor. Just in
// Time, served (any tick), a miss and no stool differ by shape as well as colour.

import { itemName } from '../sim/items';
import type { StripCell } from '../game/strip';
import { portraitImg, spriteImg } from './art/dom';
import { itemKey } from './art/svg';
import { PAD, TILE } from './geometry';
import { el } from './panel';

const SHAPE = { justInTime: '●', served: '◐', miss: '✕' } as const;
const WORD = { justInTime: 'Just in Time', served: 'served', miss: 'missed' } as const;

export function shortName(name: string): string {
  const word = name.replace(/^(The|Your) /, '');
  return word[0].toUpperCase() + word.slice(1, 4);
}

export class StripView {
  readonly root = el('div', { className: 'strip' });
  private cells: HTMLDivElement[] = [];

  constructor() {
    this.root.style.marginLeft = `${PAD}px`;
    for (let c = 0; c < 12; c++) {
      const cell = el('div', { className: 'cell' });
      cell.style.width = `${TILE}px`;
      this.cells.push(cell);
      this.root.append(cell);
    }
  }

  update(strip: StripCell[] | null): void {
    this.cells.forEach((cell, col) => {
      const data = strip?.[col];
      cell.className = 'cell';
      cell.replaceChildren();
      const ticks = data?.cupTicks.length ? `Cup here on ticks ${data.cupTicks.join(', ')}` : 'No cup here in steady state';
      if (!data?.stool) {
        cell.classList.add('none');
        cell.append(el('div', { className: 'shape' }, '·'));
        cell.title = `Column ${col}: no stool. ${ticks}`;
        return;
      }
      const s = data.stool;
      cell.classList.add(s.result);
      // Wanted tick and slot; an any-tick regular shows "any", then the slot they last took from.
      const wants =
        s.def.order.tick === 'any' ? `any${s.slot !== null ? ' s' + s.slot : ''}` : `t${s.def.order.tick} s${s.slot}`;
      cell.append(
        portraitImg(s.def.id, 30),
        el('div', { className: 'who' }, shortName(s.def.name)),
        el('div', {}, wants),
        el('div', { className: 'shape' }, SHAPE[s.result]),
        s.item ? spriteImg(itemKey(s.item), 26, 'cup') : el('div', { className: 'cup' }, '—'),
      );
      const on = s.tick !== null ? ` on tick ${s.tick}` : '';
      const slot = s.slot !== null ? ` Slot ${s.slot}.` : '';
      cell.title = `${s.def.name}: ${WORD[s.result]}${on}${s.item ? `, ${itemName(s.item)}` : ''}.${slot} ${ticks}`;
    });
  }
}
