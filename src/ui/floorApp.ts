// A screen built round a floor: the shop's, or a workbench puzzle's bench
// (docs/QUESTIONS.md, Q77). Both build with the same palette, tool bar,
// thumb stick, editing keys and time controls on the same canvas; this class
// holds all of that. The shop (main.ts) and the workbench (bench.ts) add
// their own panels, and say what happens on a tick.

import { clockTick, itemName, splitterNext, splitterOutputs, structureToken, tileIndex } from '../sim';
import type { Dir, Roast, SimEvent } from '../sim/types';
import type { BuildTarget } from '../game/build';
import { pieceOf } from '../game/pieces';
import { PIECE_PRICE } from '../game/tuning';
import { SpriteBank } from './art/raster';
import { touchFirst } from './device';
import { Editor } from './editor';
import { type FloorShape, Geometry, MIN_TILE, MIN_TOUCH_TILE, PAD, type Spot } from './geometry';
import { Guide } from './guide';
import { type InputHost, bindInput } from './input';
import { Joystick, stepSpot } from './joystick';
import { el } from './el';
import type { Shell } from './layout';
import { Palette, type PaletteModel } from './palette';
import { Panel, type Tabs } from './panel';
import { type FloorModel, type View, draw } from './render';
import { tipContent } from './tips';
import { type ToolId, Tools } from './tools';
import { Tooltip } from './tooltip';

/** The floor a screen is built round: what the renderer draws, and what the editor builds on. */
export type Floor = FloorModel & BuildTarget;

const DIR_NAME = { N: 'north', E: 'east', S: 'south', W: 'west' } as const;

export abstract class FloorApp<F extends Floor = Floor> implements InputHost {
  readonly editor: Editor;
  readonly geo: Geometry;
  hover: Spot | null = null;
  inspect: Spot | null = null;
  /** The mouse is over the row for sale above the floor. A bench has none. */
  overRowForSale = false;
  /** On a touch screen, the tile the ghost of what is in hand sits on (Q72). */
  cursor: Spot | null = null;
  selectMode = false;
  running = true;
  speed = 1;
  /** The words for the controls: a finger's, or a mouse's and the keys'. */
  protected readonly touch = touchFirst();
  protected readonly floorArea = el('div', { className: 'floor-area' });
  protected readonly canvas = el('canvas', { className: 'floor' });
  /** Kettle readouts: the tick its input last landed on and the roast that gave. */
  protected readonly readouts = new Map<number, { tick: number; roast: Roast | null }>();
  protected readonly panel: Panel;
  protected readonly palette: Palette;
  protected readonly tools: Tools;
  protected readonly guide = new Guide();
  protected readonly stick = new Joystick({
    step: (dir) => this.stepCursor(dir),
    tap: () => {
      this.placeAtCursor();
      this.render();
    },
  });
  protected readonly tooltip = new Tooltip(tipContent);
  /** Made by each screen with its own panels, before start(). */
  protected shell!: Shell;
  protected tabs!: Tabs;
  /** Sprites are rasterised once and redrawn when they arrive. */
  private readonly sprites = new SpriteBank(() => this.render());
  private readonly ctx: CanvasRenderingContext2D;
  private timer: number | undefined;

  constructor(
    protected readonly floor: F,
    shape: FloorShape,
    refundHint: string,
  ) {
    this.editor = new Editor(floor);
    this.geo = new Geometry(shape);
    this.ctx = this.canvas.getContext('2d')!;
    this.panel = new Panel(
      {
        togglePause: () => this.togglePause(),
        stepOnce: () => this.stepOnce(),
        setSpeed: (n) => {
          this.speed = n;
          this.schedule();
          this.render();
        },
      },
      refundHint,
    );
    this.palette = new Palette((p) => {
      this.editor.pick(p);
      if (this.editor.hand) {
        this.selectMode = false;
        // A finger's ghost may start on the tile last tapped (syncCursor); a mouse has its own hover.
        if (!this.touch) this.inspect = null;
      }
      this.render();
    });
    this.tools = new Tools((id) => {
      this.tool(id);
      this.render();
    });
  }

  /** Once the screen has made its shell: take input, start the clock and draw. */
  protected start(): void {
    bindInput(this.canvas, this);
    // The floor fills whatever room the panels leave it, and is redrawn when that changes.
    new ResizeObserver(() => this.render()).observe(this.floorArea);
    this.schedule();
    this.render();
    // The canvas draws text in the canvas's own fonts; redraw once they have loaded.
    document.fonts?.ready.then(() => this.render());
  }

  // ---- What each screen says for itself ----------------------------------------------

  /** Run one tick of the floor, and whatever the screen does with it. Returns the tick's events. */
  protected abstract tickFloor(): SimEvent[];
  /** The screen's own parts of the floor's picture: the counter's stools and the row for sale, or a bench's marks. */
  protected abstract floorParts(): Pick<View, 'forSale' | 'stools' | 'cat' | 'bench'>;
  /** The build palette as it stands. */
  protected abstract paletteModel(): PaletteModel;
  /** The line under the palette: what is under the cursor, or was last tapped. */
  protected abstract hoverInfo(): string;
  /** The screen's own panels, after the floor is drawn. */
  protected abstract updatePanels(): void;

  /** A click or a tap on the row for sale above the floor; only the shop has one. */
  buyRow(): void {}

  /** A click or tap with nothing in hand: the tile is the one inspected now. */
  clickFloor(spot: Spot): void {
    this.inspect = spot;
  }

  // ---- The ghost on a touch screen -----------------------------------------------------

  /** A tap holding something. On a touch screen it moves the ghost there, or puts the piece down if the ghost is there already. */
  tapHolding(spot: Spot): void {
    const ed = this.editor;
    if (spot.row < 0) {
      ed.message = 'The counter is fixed';
      return;
    }
    // A touch screen on a computer that has a mouse too: a tap puts the piece down where it lands.
    if (!this.touch) {
      ed.press(spot.row, spot.col);
      ed.release();
      return;
    }
    const c = this.cursor;
    if (c && c.row === spot.row && c.col === spot.col) return this.placeAtCursor();
    this.moveCursor(spot);
  }

  /** The stick moved the ghost one tile. */
  private stepCursor(dir: Dir): void {
    if (!this.cursor || !this.editor.hand) return;
    const to = stepSpot(this.cursor, dir, this.floor.layout.rows, this.geo.cols);
    if (to.row !== this.cursor.row || to.col !== this.cursor.col) this.moveCursor(to);
    else this.keepInView(to);
    this.render();
  }

  /** Move the ghost to a tile, laying belts on the way if a run is being laid, and bring it into view. */
  private moveCursor(to: Spot): void {
    this.cursor = to;
    if (this.editor.dragging) this.editor.dragTo(to.row, to.col);
    this.keepInView(to);
  }

  /**
   * The knob, or a tap on the ghost: put the piece or group down there.
   * Holding a belt, the first tap starts a run that follows the ghost and the
   * next tap ends it, as pressing and releasing the mouse would.
   */
  private placeAtCursor(): void {
    const ed = this.editor;
    const c = this.cursor;
    if (!c || !ed.hand) return;
    const belt = ed.hand.type === 'piece' && ed.hand.piece === 'belt';
    if (belt && ed.dragging) {
      ed.release();
      ed.message = 'Run of belts finished';
      return;
    }
    ed.press(c.row, c.col);
    if (belt && ed.dragging) ed.message = 'Laying belts: move the stick, then tap Stop';
  }

  /** The tile in the middle of the floor in view. */
  private middleSpot(): Spot {
    const g = this.geo;
    const clamp = (n: number, hi: number) => Math.max(0, Math.min(hi, n));
    const col = clamp(Math.floor((g.width / 2 - g.x0) / g.tile), g.cols - 1);
    const row = clamp(Math.floor((g.counterY + g.camY - (PAD + g.counterY) / 2) / g.tile), this.floor.layout.rows - 1);
    return { row, col };
  }

  /** Move the camera just enough to show a back-room tile, with half a tile to spare. */
  private keepInView(spot: Spot): void {
    const g = this.geo;
    const { x, y } = g.tileXY(spot.row, spot.col);
    const spare = g.tile / 2;
    let dx = 0;
    let dy = 0;
    if (x < PAD + spare) dx = PAD + spare - x;
    else if (x + g.tile > g.width - PAD - spare) dx = g.width - PAD - spare - (x + g.tile);
    if (y < PAD + spare) dy = PAD + spare - y;
    else if (y + g.tile > g.counterY - spare) dy = g.counterY - spare - (y + g.tile);
    g.pan(dx, dy);
  }

  /**
   * Keep the ghost in step with the hand: none while the hand is empty; a new
   * one on the tile last tapped, if it is still in view (so a cut or a copy
   * starts where the piece was), else in the middle of the floor in view (Q75).
   */
  private syncCursor(): void {
    if (!this.editor.hand) {
      this.cursor = null;
      return;
    }
    const rows = this.floor.layout.rows;
    if (!this.touch || (this.cursor && this.cursor.row < rows)) return;
    const t = this.inspect;
    const from = t && t.row >= 0 && t.row < rows && this.geo.shows(t.row, t.col) ? t : null;
    this.cursor = from ?? this.middleSpot();
    this.inspect = null;
    this.keepInView(this.cursor);
  }

  // ---- The tool bar ------------------------------------------------------------------

  /** A button in the tool bar. */
  private tool(id: ToolId): void {
    const ed = this.editor;
    // Anything but turning or reading the rules ends a run of belts being laid, as one undo step.
    if (id !== 'turn' && id !== 'flip' && id !== 'info') ed.release();
    const target = this.inspect && this.inspect.row >= 0 ? this.inspect : null;
    // Delete, cut and copy work on the box if there is one, else on the tile last tapped.
    const onTiles = (box: () => void, tile: (r: number, c: number) => void) => {
      if (ed.selection) box();
      else if (target) tile(target.row, target.col);
      else if (this.selectMode) ed.message = 'Drag a box over the floor first';
      else ed.message = this.touch ? 'Tap a piece on the floor first' : 'Click a piece on the floor first';
      if (!ed.selection) this.selectMode = false;
    };
    switch (id) {
      case 'turn':
        return ed.rotateHand();
      case 'flip':
        return ed.flipHand();
      case 'drop':
        ed.putDown();
        this.inspect = null;
        return;
      case 'older':
        return ed.wheel(1);
      case 'newer':
        return ed.wheel(-1);
      case 'info':
        if (ed.hand?.type === 'piece') this.openGuide(`piece:${ed.hand.piece}`);
        return;
      case 'select':
        this.selectMode = !this.selectMode;
        ed.selection = null;
        ed.message = this.selectMode ? `Drag a box over the floor${this.touch ? '' : ' (or Shift+drag at any time)'}` : '';
        return;
      case 'delete':
        return onTiles(
          () => ed.deleteKey(0, 0),
          (r, c) => ed.deleteKey(r, c),
        );
      case 'cut':
        return onTiles(
          () => ed.cut('box'),
          (r, c) => ed.cut('hover', r, c),
        );
      case 'copy':
        return onTiles(
          () => ed.copy('box'),
          (r, c) => ed.copy('hover', r, c),
        );
      case 'paste':
        return ed.pickUpBuffer();
      case 'undo':
        return ed.undo();
      case 'redo':
        return ed.redo();
    }
  }

  /** Show the Guide tab at an entry, opening the drawer in a narrow window. */
  protected openGuide(key: string): void {
    this.tabs.select('guide');
    this.shell.openDrawer();
    this.render();
    requestAnimationFrame(() => this.guide.open(key));
  }

  // ---- The camera and the clock ------------------------------------------------------

  rows(): number {
    return this.floor.layout.rows;
  }

  /** Move the camera over the back room. */
  pan(dx: number, dy: number): void {
    this.geo.pan(dx, dy);
    this.render();
  }

  /** Zoom the floor about a point on the canvas. */
  zoom(x: number, y: number, factor: number): void {
    this.geo.zoomAt(x, y, factor);
    this.render();
  }

  togglePause(): void {
    this.running = !this.running;
    this.schedule();
    this.render();
  }

  stepOnce(): void {
    if (this.running) return;
    this.advance();
  }

  protected schedule(): void {
    window.clearInterval(this.timer);
    if (this.running) this.timer = window.setInterval(() => this.advance(), 1000 / this.speed);
  }

  /** Stop the clock for good, as the page is about to be left. */
  protected stop(): void {
    this.running = false;
    window.clearInterval(this.timer);
  }

  private advance(): void {
    for (const e of this.tickFloor()) {
      if (e.type === 'brew') this.readouts.set(e.at, { tick: e.tick, roast: 'roast' in e.item ? e.item.roast : null });
    }
    this.render();
  }

  // ---- What the line under the palette says -------------------------------------------

  /** A back-room tile: where it is, what stands and lies on it, and how to take it up. */
  protected tileInfo(h: Spot): string[] {
    const { layout, sim } = this.floor;
    const i = tileIndex(h.row, h.col);
    const s = layout.tiles[i];
    const item = sim.belts[i];
    const parts = [`Row ${h.row}, column ${h.col}`];
    if (s) parts.push(`${s.kind} (${structureToken(s)})`);
    const piece = s ? pieceOf(s.kind) : null;
    const fixed = this.floor.rights().board?.fixed.has(i);
    if (piece && fixed) parts.push('fixed to the bench');
    else if (piece && this.floor.free) parts.push(this.touch ? 'Delete takes it up' : 'Z takes it up');
    else if (piece) parts.push(this.touch ? `Delete gives all ${PIECE_PRICE[piece]} back` : `Z deletes it, all ${PIECE_PRICE[piece]} back`);
    if (item) parts.push(`holding ${itemName(item)}`);
    if (s?.kind === 'splitter') parts.push(this.splitterInfo(i));
    const ro = this.readouts.get(i);
    if (s?.kind === 'kettle' && ro) parts.push(`last input landed on tick ${ro.tick}${ro.roast ? `: ${ro.roast}` : ''}`);
    return parts;
  }

  /** A splitter's round: its outputs in order, what has passed since tick 0, and where the next item goes. */
  private splitterInfo(i: number): string {
    const { layout, sim } = this.floor;
    const outs = splitterOutputs(layout, i);
    if (outs.length === 0) return 'no outputs: whatever lands here spills';
    const passed = clockTick(sim.T) === 0 ? 0 : (sim.splitters[i] ?? 0);
    const next = splitterNext(layout, sim, i)!;
    return `outputs ${outs.map((d) => DIR_NAME[d]).join(', ')}, in that order; ${passed} item${passed === 1 ? '' : 's'} passed since tick 0, whatever they were; the next goes ${DIR_NAME[next]}`;
  }

  // ---- Drawing ----------------------------------------------------------------------

  render(): void {
    // The Select tool is for an empty hand: whatever put something in hand (a key, a cut, a paste) turns it off.
    if (this.editor.hand) this.selectMode = false;
    // The canvas fills the floor area, at the screen's own pixel density so the lines stay crisp.
    const w = this.floorArea.clientWidth;
    const h = this.floorArea.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;
    }
    this.geo.fit(w, h, this.floor.layout.rows, this.touch ? MIN_TOUCH_TILE : MIN_TILE);
    this.syncCursor();
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(this.ctx, {
      floor: this.floor,
      editor: this.editor,
      geo: this.geo,
      // A finger's hand shows its ghost where the stick has put it.
      hover: this.cursor ?? this.hover,
      ghostCursor: this.cursor !== null,
      inspect: this.inspect,
      panHint: this.touch ? 'drag to look' : 'right-drag or scroll',
      readouts: this.readouts,
      sprites: this.sprites,
      dpr,
      ...this.floorParts(),
    });
    const hand = this.editor.hand;
    this.palette.update(this.paletteModel());
    const belt = hand?.type === 'piece' && hand.piece === 'belt';
    const steering = this.cursor !== null;
    this.stick.set(steering, belt ? (this.editor.dragging ? 'Stop' : 'Lay') : 'Place');
    this.shell.setHolding(steering);
    this.tools.update({
      hand: hand ? hand.type : 'none',
      canFlip: this.editor.canFlip,
      // Beside the stick, in a narrow window, only what steers the ghost fits.
      stick: steering && this.shell.compact,
      selectMode: this.selectMode,
      buffer: this.editor.buffer.entries.length,
      canUndo: this.editor.canUndo,
      canRedo: this.editor.canRedo,
    });
    this.updatePanels();
    this.tooltip.refresh();
  }

  /** "Paste buffer: 3 entries", or nothing while it is empty. */
  protected bufferInfo(): string {
    const n = this.editor.buffer.entries.length;
    return n ? `Paste buffer: ${n} entr${n === 1 ? 'y' : 'ies'}` : '';
  }
}
