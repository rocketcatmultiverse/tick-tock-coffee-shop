// Mouse and keyboard, turned into editor calls (docs/SPEC.md, Spec 4,
// "Editing keys"). Shift+drag box-selects so a plain drag still lays belts.

import type { Editor } from './editor';
import { type Spot, hitTest } from './geometry';

export interface InputHost {
  editor: Editor;
  rows(): number;
  hover: Spot | null;
  render(): void;
  togglePause(): void;
  stepOnce(): void;
}

export function bindInput(canvas: HTMLCanvasElement, host: InputHost): void {
  const ed = host.editor;
  let down = false;

  const spotAt = (e: MouseEvent): Spot | null => {
    const rect = canvas.getBoundingClientRect();
    return hitTest(host.rows(), e.clientX - rect.left, e.clientY - rect.top);
  };

  canvas.addEventListener('mousemove', (e) => {
    const spot = spotAt(e);
    host.hover = spot;
    if (down && spot) {
      if (ed.selecting) ed.selectTo(spot.row, spot.col);
      else if (spot.row >= 0) ed.dragTo(spot.row, spot.col);
    }
    host.render();
  });

  canvas.addEventListener('mouseleave', () => {
    host.hover = null;
    host.render();
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const spot = spotAt(e);
    if (!spot) return;
    down = true;
    if (e.shiftKey && spot.row >= 0) {
      ed.hand = null;
      ed.beginSelect(spot.row, spot.col);
    } else if (ed.hand) {
      if (spot.row >= 0) ed.press(spot.row, spot.col);
      else ed.message = 'The counter belt is fixed';
    } else {
      ed.selection = null;
    }
    host.render();
  });

  window.addEventListener('mouseup', () => {
    if (!down) return;
    down = false;
    ed.release();
    ed.endSelect();
    host.render();
  });

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    ed.putDown();
    host.render();
  });

  canvas.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault(); // no browser zoom
      ed.wheel(e.deltaY > 0 ? 1 : -1);
      host.render();
    },
    { passive: false },
  );

  window.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    const h = host.hover;
    const hr = h?.row ?? -1;
    const hc = h?.col ?? 0;
    let handled = true;
    if (ctrl && key === 'z' && !e.shiftKey) ed.undo();
    else if (ctrl && (key === 'y' || (key === 'z' && e.shiftKey))) ed.redo();
    else if (ctrl && key === 'x') {
      if (ed.selection) ed.cut('box');
      else ed.message = 'Shift+drag a box first';
    } else if (ctrl && key === 'c') {
      if (ed.selection) ed.copy('box');
      else ed.message = 'Shift+drag a box first';
    } else if (ctrl && key === 'v') ed.pickUpBuffer();
    else if (ctrl) handled = false;
    else if (key === 'z') ed.deleteKey(hr, hc);
    else if (key === 'x') ed.cut('hover', hr, hc);
    else if (key === 'c') ed.copy('hover', hr, hc);
    else if (key === 'r') ed.rotateHand();
    else if (key === 'f') ed.flipHand();
    else if (key === 'escape') ed.putDown();
    else if (key === ' ') host.togglePause();
    else if (key === '.') host.stepOnce();
    else handled = false;
    if (handled) {
      e.preventDefault();
      host.render();
    }
  });
}
