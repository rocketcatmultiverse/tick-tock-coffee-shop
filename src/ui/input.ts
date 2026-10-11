// Mouse and keyboard, turned into editor calls (docs/SPEC.md, Spec 4,
// "Editing keys"). Shift+drag box-selects so a plain drag still lays belts.
// The number keys pick from the build palette (hotkeys.ts).
// The camera: right-drag or middle-drag moves it, and so does the mouse wheel;
// a right-click that does not move still puts down what is in hand.

import type { Editor } from './editor';
import type { Geometry, Spot } from './geometry';
import { pieceForKey } from './hotkeys';

export interface InputHost {
  editor: Editor;
  geo: Geometry;
  hover: Spot | null;
  render(): void;
  togglePause(): void;
  stepOnce(): void;
  /** Move the camera by a drag of (dx, dy) pixels. */
  pan(dx: number, dy: number): void;
  /** A click with nothing in hand, for things on the floor such as the cat. */
  clickFloor(spot: Spot): void;
}

/** Pixels a right-button press may move before it counts as a drag, not a click. */
const DRAG_SLOP = 4;

export function bindInput(canvas: HTMLCanvasElement, host: InputHost): void {
  const ed = host.editor;
  let down = false;
  /** A camera drag in progress: where the pointer was, and whether it has moved enough to count. */
  let panning: { x: number; y: number; button: number; moved: boolean } | null = null;

  const spotAt = (e: MouseEvent): Spot | null => {
    const rect = canvas.getBoundingClientRect();
    return host.geo.hitTest(e.clientX - rect.left, e.clientY - rect.top);
  };

  canvas.addEventListener('mousemove', (e) => {
    if (panning) {
      const dx = e.clientX - panning.x;
      const dy = e.clientY - panning.y;
      if (panning.moved || Math.abs(dx) + Math.abs(dy) > DRAG_SLOP) {
        panning.moved = true;
        panning.x = e.clientX;
        panning.y = e.clientY;
        host.pan(dx, dy);
      }
      return;
    }
    const spot = spotAt(e);
    host.hover = spot;
    if (down && spot && spot.row >= 0) {
      if (ed.selecting) ed.selectTo(spot.row, spot.col);
      else ed.dragTo(spot.row, spot.col);
    }
    host.render();
  });

  canvas.addEventListener('mouseleave', () => {
    host.hover = null;
    host.render();
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1 || e.button === 2) {
      e.preventDefault(); // no autoscroll, no menu
      panning = { x: e.clientX, y: e.clientY, button: e.button, moved: false };
      return;
    }
    if (e.button !== 0) return;
    const spot = spotAt(e);
    if (!spot) return;
    down = true;
    if (e.shiftKey && spot.row >= 0) {
      ed.hand = null;
      ed.beginSelect(spot.row, spot.col);
    } else if (ed.hand) {
      if (spot.row >= 0) ed.press(spot.row, spot.col);
      else ed.message = 'The counter is fixed';
    } else {
      ed.selection = null;
      host.clickFloor(spot);
    }
    host.render();
  });

  window.addEventListener('mouseup', (e) => {
    if (panning && e.button === panning.button) {
      // A right-click that did not move puts down whatever is in hand.
      if (panning.button === 2 && !panning.moved) ed.putDown();
      panning = null;
      host.render();
      return;
    }
    if (!down) return;
    down = false;
    ed.release();
    ed.endSelect();
    host.render();
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault(); // no page scroll, no browser zoom
      if (e.ctrlKey) {
        ed.wheel(e.deltaY > 0 ? 1 : -1);
        host.render();
        return;
      }
      // Rolling the wheel down shows lower rows, toward the counter.
      const lines = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? host.geo.roomH : 1;
      host.pan(-e.deltaX * lines, -e.deltaY * lines);
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
    else if (!e.altKey && pieceForKey(key)) ed.pick(pieceForKey(key)!);
    else handled = false;
    if (handled) {
      e.preventDefault();
      host.render();
    }
  });
}
