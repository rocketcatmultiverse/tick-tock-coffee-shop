// The thumb stick for building on a touch screen (docs/QUESTIONS.md, Q72).
// While a finger's hand holds something, its ghost sits on one tile of the
// floor. The stick, bottom right of the floor, moves the ghost a tile at a
// time, and keeps moving it while held, faster the further it is pushed. A tap
// on the knob puts the piece down. A quick push on the ring moves one tile.

import type { Dir } from '../sim/types';
import { COLS } from '../sim/tuning';
import { el } from './el';
import type { Spot } from './geometry';

/** How far, as a share of its reach, the knob must be pushed before the ghost moves. */
export const DEAD_ZONE = 0.35;
/** After the first step, a held push waits this long before it repeats. */
const REPEAT_DELAY_MS = 320;
/** A held push repeats this often: slowest just past the dead zone, fastest at the rim. */
const SLOWEST_MS = 220;
const FASTEST_MS = 70;
/** A press shorter than this that never leaves the dead zone is a tap. */
const TAP_MS = 450;

/** The way a push of (dx, dy) screen pixels points, on a stick that reaches `reach` pixels; null inside the dead zone. Up the screen is north. */
export function stickDir(dx: number, dy: number, reach: number): Dir | null {
  if (Math.hypot(dx, dy) < DEAD_ZONE * reach) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'E' : 'W';
  return dy < 0 ? 'N' : 'S';
}

/** Milliseconds between steps for a push of `amount` of the reach, 0 to 1. */
export function stepEvery(amount: number): number {
  const t = Math.max(0, Math.min(1, (amount - DEAD_ZONE) / (1 - DEAD_ZONE)));
  return Math.round(SLOWEST_MS + (FASTEST_MS - SLOWEST_MS) * t);
}

/** The back-room tile one step from `spot` the way `dir` points, kept on a floor of `rows` rows. */
export function stepSpot(spot: Spot, dir: Dir, rows: number): Spot {
  const row = spot.row + (dir === 'N' ? 1 : dir === 'S' ? -1 : 0);
  const col = spot.col + (dir === 'E' ? 1 : dir === 'W' ? -1 : 0);
  return { row: Math.max(0, Math.min(rows - 1, row)), col: Math.max(0, Math.min(COLS - 1, col)) };
}

export class Joystick {
  readonly root = el('div', { className: 'stick', hidden: true });
  private knob = el('div', { className: 'stick-knob' });
  private press: { id: number; at: number; moved: boolean } | null = null;
  private dir: Dir | null = null;
  private amount = 0;
  private timer: number | undefined;

  constructor(private readonly on: { step(dir: Dir): void; tap(): void }) {
    this.root.setAttribute('role', 'group');
    this.root.setAttribute('aria-label', 'Move the piece in hand; tap the middle to put it down');
    for (const d of ['n', 'e', 's', 'w']) this.root.append(el('span', { className: `stick-arrow ${d}` }));
    this.root.append(this.knob);
    this.root.addEventListener('pointerdown', (e) => this.down(e));
    this.root.addEventListener('pointermove', (e) => this.move(e));
    this.root.addEventListener('pointerup', (e) => this.up(e, true));
    this.root.addEventListener('pointercancel', (e) => this.up(e, false));
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Show the stick, with what a tap on the knob does, or hide it. */
  set(visible: boolean, label: string): void {
    if (this.knob.textContent !== label) this.knob.textContent = label;
    if (visible === !this.root.hidden) return;
    this.root.hidden = !visible;
    if (!visible) this.reset();
  }

  /** How far the knob may travel from the middle, in pixels. */
  private get reach(): number {
    return Math.max(1, (this.root.clientWidth - this.knob.offsetWidth) / 2);
  }

  private down(e: PointerEvent): void {
    if (this.press) return;
    e.preventDefault();
    try {
      this.root.setPointerCapture(e.pointerId);
    } catch {
      // Lifted already.
    }
    this.press = { id: e.pointerId, at: performance.now(), moved: false };
    this.aim(e);
  }

  private move(e: PointerEvent): void {
    if (this.press?.id === e.pointerId) this.aim(e);
  }

  private up(e: PointerEvent, lifted: boolean): void {
    const press = this.press;
    if (press?.id !== e.pointerId) return;
    this.reset();
    if (lifted && !press.moved && performance.now() - press.at < TAP_MS) this.on.tap();
  }

  /** Follow the thumb: move the knob, and start, turn or stop the ghost's steps. */
  private aim(e: PointerEvent): void {
    const r = this.root.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const reach = this.reach;
    const far = Math.hypot(dx, dy);
    if (far > reach) {
      dx = (dx / far) * reach;
      dy = (dy / far) * reach;
    }
    this.knob.style.transform = `translate(${Math.round(dx)}px, ${Math.round(dy)}px)`;
    this.amount = Math.min(1, far / reach);
    const dir = stickDir(dx, dy, reach);
    if (dir === this.dir) return;
    this.dir = dir;
    window.clearTimeout(this.timer);
    if (!dir) return;
    this.press!.moved = true;
    this.on.step(dir);
    this.timer = window.setTimeout(() => this.repeat(), REPEAT_DELAY_MS);
  }

  private repeat(): void {
    if (!this.dir) return;
    this.on.step(this.dir);
    this.timer = window.setTimeout(() => this.repeat(), stepEvery(this.amount));
  }

  private reset(): void {
    window.clearTimeout(this.timer);
    this.press = null;
    this.dir = null;
    this.amount = 0;
    this.knob.style.transform = '';
  }
}
