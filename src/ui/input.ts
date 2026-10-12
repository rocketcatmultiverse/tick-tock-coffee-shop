// Mouse, touch and keyboard, turned into editor calls (docs/SPEC.md, Spec 4,
// "Editing keys"; docs/QUESTIONS.md, Q71, for touch).
//
// The mouse: a click places what is in hand and a drag lays belts. Shift+drag,
// or a drag with the Select tool on, box-selects. Right-drag, middle-drag and
// the wheel move the camera; a right-click that does not move puts down what
// is in hand. The number keys pick from the build palette (hotkeys.ts).
//
// A finger: a drag looks around, and with the Select tool on draws the box.
// A tap with nothing in hand inspects the tile (or names the cat); holding
// something, it moves the ghost there, or puts the piece down if the ghost is
// already there. The thumb stick does the rest (joystick.ts, Q72). Two
// fingers always look around and pinch to zoom, and cancel whatever one
// finger had started.
//
// While a drag that builds or selects nears the edge of the floor, the camera
// moves on by itself, so a run of belts can go past what is in view.

import type { Editor } from './editor';
import { type Geometry, PAD, type Spot } from './geometry';
import { pieceForKey } from './hotkeys';

export interface InputHost {
  editor: Editor;
  geo: Geometry;
  hover: Spot | null;
  /** The tile last tapped or clicked with nothing in hand. */
  inspect: Spot | null;
  /** The Select tool: a plain drag draws a box. */
  selectMode: boolean;
  render(): void;
  togglePause(): void;
  stepOnce(): void;
  /** Move the camera by a drag of (dx, dy) pixels. */
  pan(dx: number, dy: number): void;
  /** Pinch: zoom by `factor` about the canvas pixel (x, y). */
  zoom(x: number, y: number, factor: number): void;
  /** A click or tap with nothing in hand: inspect the tile, and things on the floor such as the cat. */
  clickFloor(spot: Spot): void;
  /** A tap holding something: move its ghost there, or put it down. */
  tapHolding(spot: Spot): void;
}

/** Pixels a press may move before it counts as a drag, not a click or a tap. */
const DRAG_SLOP = 4;
const TOUCH_SLOP = 10;
/** How near the floor's edge a building drag starts the camera moving, and its top speed in pixels a frame. */
const EDGE_ZONE = 28;
const EDGE_SPEED = 9;

type Point = { x: number; y: number };

/**
 * One finger's gesture. `pending` has not yet moved far enough to be a drag;
 * `spent` waits for the fingers left over from a two-finger gesture to lift.
 */
type TouchGesture =
  | { kind: 'none' }
  | { kind: 'pending'; start: Point; last: Point }
  | { kind: 'look'; last: Point }
  | { kind: 'select' }
  | { kind: 'two'; mid: Point; dist: number }
  | { kind: 'spent' };

export function bindInput(canvas: HTMLCanvasElement, host: InputHost): void {
  const ed = host.editor;

  const local = (e: { clientX: number; clientY: number }): Point => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const spotAt = (p: Point): Spot | null => host.geo.hitTest(p.x, p.y);
  /** Keep a drag's moves coming to the canvas when it leaves; a pointer already gone cannot be held. */
  const capture = (id: number) => {
    try {
      canvas.setPointerCapture(id);
    } catch {
      // Lifted already.
    }
  };
  const holdingBelt = () => ed.hand?.type === 'piece' && ed.hand.piece === 'belt';

  // ---- Moving on past the edge of the floor ---------------------------------

  /** Where the pointer of a building drag is, and what to do with it as the camera moves. */
  let edgeAt: Point | null = null;
  let edgeFrame = 0;
  let edgeMove: (p: Point) => void = () => {};

  const edgeVelocity = (p: Point): Point => {
    const g = host.geo;
    const push = (d: number) => (d < EDGE_ZONE ? Math.ceil(((EDGE_ZONE - Math.max(0, d)) / EDGE_ZONE) * EDGE_SPEED) : 0);
    const dx = push(p.x) - push(g.width - p.x);
    // Up toward the back of the floor, or down toward the counter.
    const dy = push(p.y - PAD) - push(g.counterY - p.y);
    return { x: g.maxCamX > 0 ? dx : 0, y: g.maxCamY > 0 && p.y < g.counterY + g.tile ? dy : 0 };
  };

  const edgeTick = () => {
    edgeFrame = 0;
    if (!edgeAt) return;
    const v = edgeVelocity(edgeAt);
    if (v.x === 0 && v.y === 0) return;
    const before = { x: host.geo.camX, y: host.geo.camY };
    host.pan(v.x, v.y);
    if (host.geo.camX === before.x && host.geo.camY === before.y) return;
    edgeMove(edgeAt);
    host.render();
    edgeFrame = requestAnimationFrame(edgeTick);
  };

  /** A building drag is at `p`: move the camera on while it is near an edge. */
  const nearEdge = (p: Point, move: (p: Point) => void) => {
    edgeAt = p;
    edgeMove = move;
    if (!edgeFrame) edgeFrame = requestAnimationFrame(edgeTick);
  };

  const stopEdge = () => {
    edgeAt = null;
    cancelAnimationFrame(edgeFrame);
    edgeFrame = 0;
  };

  // ---- The mouse (and a pen, which hovers like one) ----------------------------

  let down = false;
  /** A camera drag in progress: where the pointer was, and whether it has moved enough to count. */
  let panning: { x: number; y: number; button: number; moved: boolean } | null = null;

  /** The left button is down over the floor: lay belts or grow the box as it moves. */
  const mouseDrag = (p: Point) => {
    const spot = spotAt(p);
    host.hover = spot;
    if (spot && spot.row >= 0) {
      if (ed.selecting) ed.selectTo(spot.row, spot.col);
      else ed.dragTo(spot.row, spot.col);
    }
  };

  const mouseMove = (e: PointerEvent) => {
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
    const p = local(e);
    if (down) {
      mouseDrag(p);
      if (ed.selecting || holdingBelt()) nearEdge(p, mouseDrag);
    } else host.hover = spotAt(p);
    host.render();
  };

  const mouseDown = (e: PointerEvent) => {
    if (e.button === 1 || e.button === 2) {
      e.preventDefault(); // no autoscroll, no menu
      panning = { x: e.clientX, y: e.clientY, button: e.button, moved: false };
      capture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const spot = spotAt(local(e));
    if (!spot) return;
    down = true;
    capture(e.pointerId);
    if ((e.shiftKey || host.selectMode) && spot.row >= 0) {
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
  };

  const mouseUp = (e: PointerEvent) => {
    if (panning && e.button === panning.button) {
      // A right-click that did not move puts down whatever is in hand.
      if (panning.button === 2 && !panning.moved) {
        ed.putDown();
        host.inspect = null;
      }
      panning = null;
      host.render();
      return;
    }
    if (!down) return;
    down = false;
    stopEdge();
    ed.release();
    ed.endSelect();
    host.render();
  };

  // ---- Fingers --------------------------------------------------------------------

  const fingers = new Map<number, Point>();
  let gesture: TouchGesture = { kind: 'none' };

  const twoFingers = (): { mid: Point; dist: number } => {
    const [a, b] = [...fingers.values()];
    return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist: Math.hypot(a.x - b.x, a.y - b.y) };
  };

  /** A finger drawing the box is at `p`. */
  const fingerSelect = (p: Point) => {
    const spot = spotAt(p);
    if (spot && spot.row >= 0) ed.selectTo(spot.row, spot.col);
  };

  /** A second finger landed, or the gesture was cancelled: stop what one finger was doing. */
  const dropOneFinger = () => {
    stopEdge();
    if (gesture.kind === 'select') ed.endSelect();
  };

  const touchDown = (e: PointerEvent) => {
    capture(e.pointerId);
    const p = local(e);
    fingers.set(e.pointerId, p);
    if (fingers.size === 2) {
      dropOneFinger();
      gesture = { kind: 'two', ...twoFingers() };
    } else if (fingers.size === 1) {
      gesture = { kind: 'pending', start: p, last: p };
    }
    host.render();
  };

  const touchMove = (e: PointerEvent) => {
    if (!fingers.has(e.pointerId)) return;
    const p = local(e);
    fingers.set(e.pointerId, p);
    if (gesture.kind === 'two' && fingers.size === 2) {
      const now = twoFingers();
      host.pan(now.mid.x - gesture.mid.x, now.mid.y - gesture.mid.y);
      if (gesture.dist > 0 && now.dist > 0) host.zoom(now.mid.x, now.mid.y, now.dist / gesture.dist);
      gesture = { kind: 'two', ...now };
      return;
    }
    if (gesture.kind === 'pending') {
      if (Math.hypot(p.x - gesture.start.x, p.y - gesture.start.y) <= TOUCH_SLOP) return;
      const start = spotAt(gesture.start);
      if (host.selectMode) {
        if (start && start.row >= 0) {
          ed.hand = null;
          ed.beginSelect(start.row, start.col);
        }
        gesture = { kind: 'select' };
      } else {
        gesture = { kind: 'look', last: gesture.start };
      }
    }
    if (gesture.kind === 'look') {
      host.pan(p.x - gesture.last.x, p.y - gesture.last.y);
      gesture = { kind: 'look', last: p };
      return;
    }
    if (gesture.kind === 'select') {
      fingerSelect(p);
      nearEdge(p, fingerSelect);
      host.render();
    }
  };

  const touchUp = (e: PointerEvent, cancelled: boolean) => {
    const p = fingers.get(e.pointerId);
    if (!p) return;
    fingers.delete(e.pointerId);
    if (gesture.kind === 'two' || gesture.kind === 'spent') {
      gesture = fingers.size > 0 ? { kind: 'spent' } : { kind: 'none' };
      return;
    }
    const spot = spotAt(local(e));
    stopEdge();
    if (cancelled) {
      dropOneFinger();
    } else if (gesture.kind === 'pending' && spot) {
      // A tap.
      if (ed.hand) host.tapHolding(spot);
      else {
        ed.selection = null;
        host.clickFloor(spot);
      }
    } else if (gesture.kind === 'select') {
      ed.endSelect();
    }
    gesture = { kind: 'none' };
    host.render();
  };

  // ---- Wiring ------------------------------------------------------------------------

  const isTouch = (e: PointerEvent) => e.pointerType === 'touch';

  canvas.addEventListener('pointerdown', (e) => (isTouch(e) ? touchDown(e) : mouseDown(e)));
  canvas.addEventListener('pointermove', (e) => (isTouch(e) ? touchMove(e) : mouseMove(e)));
  canvas.addEventListener('pointerup', (e) => (isTouch(e) ? touchUp(e, false) : mouseUp(e)));
  canvas.addEventListener('pointercancel', (e) => {
    if (isTouch(e)) return touchUp(e, true);
    // The browser took the mouse away: stop whatever it was doing, keeping what it built.
    panning = null;
    if (down) {
      down = false;
      stopEdge();
      ed.release();
      ed.endSelect();
    }
    host.render();
  });
  canvas.addEventListener('pointerleave', (e) => {
    if (isTouch(e) || down || panning) return;
    host.hover = null;
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
    // The tile under the cursor, or else the one last clicked.
    const h = host.hover ?? host.inspect;
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
    else if (key === 'escape') {
      ed.putDown();
      host.inspect = null;
      host.selectMode = false;
    } else if (key === ' ') host.togglePause();
    else if (key === '.') host.stepOnce();
    else if (!e.altKey && pieceForKey(key)) ed.pick(pieceForKey(key)!);
    else handled = false;
    if (handled) {
      e.preventDefault();
      host.render();
    }
  });
}
