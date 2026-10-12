import './style.css';
import { clockTick, counterIndex, feederSlot, isPresent, itemName, slotOf, splitterNext, splitterOutputs, structureToken, tileIndex } from '../sim';
import { COLS, MILK_TICK } from '../sim/tuning';
import type { Dir, Layout, RegularDef, Roast } from '../sim/types';
import { ALL_PIECES, pieceOf } from '../game/pieces';
import { applyOffline } from '../game/offline';
import { saveShop } from '../game/save';
import { type Progress, type ShopStats, decodeShare, isBehind, progressOf, shopStats, shopTitle, visitShop } from '../game/share';
import { type RowRefund, Shop } from '../game/shop';
import { type StripCell, counterStrip } from '../game/strip';
import { BOWL_COL, BOWL_ROW, HAPPY_LOOPS, PIECE_PRICE, START_COINS, START_PIECES } from '../game/tuning';
import { REGULARS } from '../levels/regulars';
import { catSpot } from './cat';
import { CatCard } from './catCard';
import { RegularsPanel } from './regularsPanel';
import { SpriteBank } from './art/raster';
import { touchFirst } from './device';
import { Editor } from './editor';
import { Geometry, MIN_TILE, MIN_TOUCH_TILE, PAD, type Spot } from './geometry';
import { Guide } from './guide';
import { bindInput } from './input';
import { Joystick, stepSpot } from './joystick';
import { el } from './el';
import { Shell } from './layout';
import { Palette } from './palette';
import { Panel, Tabs, helpPane } from './panel';
import { showMorningReport } from './morningReport';
import { type StoolView, type View, draw } from './render';
import { ShareCard, VisitBanner, leaveVisit, showSpoilerWarning } from './share';
import { downloadSave, showSlotScreen } from './slots';
import { SLOTS, migrateLegacySave, openSlot, writeSave } from './storage';
import { tipContent } from './tips';
import { Toast } from './toast';
import { type ToolId, Tools } from './tools';
import { Tooltip } from './tooltip';
import { type Box, type StoolExample, type TourStepId, TOUR_STEPS, Tour, offerTour } from './tutorial';

/** How often the shop is saved while open, in milliseconds. */
const AUTOSAVE_MS = 2000;
/** Happenings kept in the log. */
const NOTES_KEPT = 30;

const WORD = { justInTime: 'Just in Time', served: 'served', miss: 'missed' } as const;

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** What a shop opens: the player's own, from a save slot, or someone else's from a share link. */
type Opening = { slot: number } | { visit: Shop };

/** What taking back an old save's early rows did, as a line for the happenings; `why` says when rows are for sale. */
function refundNote(r: RowRefund, why: string): string {
  const pieces = r.pieces ? `, with the ${plural(r.pieces, 'piece')} on ${r.rows === 1 ? 'it' : 'them'}` : '';
  const rows = r.rows === 1 ? 'the floor row' : `the ${r.rows} floor rows`;
  return `${why}, so ${rows} bought before then went back, refunded in full${pieces}: ${r.coins} coins.`;
}

/** The line under the palette when nothing on the floor is hovered or tapped. */
const REFUND_HINT = {
  mouse: 'Z deletes the piece under the cursor, with a full refund.',
  touch: 'Tap a piece on the floor to see it. Delete gives back every coin it cost.',
};

class App {
  readonly shop: Shop;
  readonly editor: Editor;
  readonly geo = new Geometry();
  hover: Spot | null = null;
  inspect: Spot | null = null;
  /** On a touch screen, the tile the ghost of what is in hand sits on (Q72). */
  cursor: Spot | null = null;
  selectMode = false;
  running = true;
  /** The words for the controls: a finger's, or a mouse's and the keys'. */
  private readonly touch = touchFirst();
  speed = 1;
  private timer: number | undefined;
  private readouts = new Map<number, { tick: number; roast: Roast | null }>();
  private floorArea = el('div', { className: 'floor-area' });
  private canvas = el('canvas', { className: 'floor' });
  /** Sprites are rasterised once and redrawn when they arrive. */
  private sprites = new SpriteBank(() => this.render());
  private ctx: CanvasRenderingContext2D;
  private panel: Panel;
  private palette: Palette;
  private tools: Tools;
  private tabs: Tabs;
  private guide = new Guide();
  private shell: Shell;
  private regularsPanel = new RegularsPanel();
  private stick = new Joystick({
    step: (dir) => this.stepCursor(dir),
    tap: () => {
      this.placeAtCursor();
      this.render();
    },
  });
  private tooltip = new Tooltip(tipContent);
  private notes: string[] = [];
  private catCard = new CatCard({
    getName: () => this.shop.catName,
    setName: (n) => {
      this.shop.catName = n;
    },
    isMad: () => this.catMad(),
    render: () => this.render(),
  });
  /** Steady state is recomputed only when the layout or the seats change. */
  private stripCache: { layout: Layout; seats: number; strip: StripCell[] | null } | null = null;
  private statsCache: { layout: Layout; seats: number; stats: ShopStats } | null = null;
  /** In the player's own shop: the Shop tab's share card. */
  private shareCard: ShareCard | null = null;
  /** In someone else's shop, opened from a share link: the banner with the way back. */
  private visitBanner: VisitBanner | null = null;

  /** The save slot this shop is kept in; null while visiting someone else's. */
  private readonly slot: number | null;
  private leaving = false;
  private tour: Tour | null = null;
  /** Says when a regular walks in, at the top of the floor. */
  private toast: Toast;

  /**
   * Opens the player's own shop from a save slot (a new one if the slot is
   * empty), or someone else's shop from a share link, which plays as usual
   * and is never saved.
   */
  constructor(root: HTMLElement, debug: boolean, opening: Opening, notice = '') {
    const visit = 'visit' in opening ? opening.visit : null;
    this.slot = 'slot' in opening ? opening.slot : null;
    const loaded = this.slot === null ? null : openSlot(REGULARS, debug, this.slot);
    this.shop = visit ?? loaded?.shop ?? new Shop({ defs: REGULARS, debug });
    if (visit) this.notes.push(`Visiting ${shopTitle(visit.shopName)}: the floor starts empty and fills within a loop or two. Nothing here is saved.`);
    else this.notes.push(loaded ? 'Welcome back. The floor starts empty and fills again within a loop or two.' : `${REGULARS[0].name} walks in: "${REGULARS[0].intro}"`);
    this.editor = new Editor(this.shop);
    if (loaded) this.fixOldSave();
    if (notice) this.notes.unshift(notice);
    const report = loaded ? applyOffline(this.shop, loaded.lastSeen, Date.now()) : null;
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
        buyRow: () => {
          this.editor.message = this.shop.buyRow() ?? 'Bought a floor row';
          this.render();
        },
      },
      this.touch ? REFUND_HINT.touch : REFUND_HINT.mouse,
    );
    this.palette = new Palette((p) => {
      this.editor.pick(p);
      if (this.editor.hand) {
        this.selectMode = false;
        this.inspect = null;
      }
      this.render();
    });
    this.tools = new Tools((id) => {
      this.tool(id);
      this.render();
    });
    const catHint = el('p', { className: 'muted' }, `${this.touch ? 'Tap' : 'Click'} your cat on the floor to name it or pet it.`);
    let shopPane: Node[];
    if (visit) {
      this.visitBanner = new VisitBanner(visit);
      const note = 'You are visiting a shared shop. Sharing, exporting and the save slots are in your own shops.';
      shopPane = [el('p', { className: 'muted' }, note), this.catCard.root, catHint];
    } else {
      this.shareCard = new ShareCard(this.shop, () => this.stats());
      shopPane = [this.shareCard.root, this.saveCard(), this.catCard.root, catHint];
    }
    this.tabs = new Tabs(
      [
        { id: 'regulars', label: 'Regulars', content: [this.regularsPanel.list] },
        { id: 'log', label: 'Happenings', content: [this.regularsPanel.log] },
        { id: 'guide', label: 'Guide', content: [this.guide.root] },
        { id: 'help', label: 'Help', content: helpPane(() => this.startTour(), this.touch) },
        { id: 'shop', label: 'Shop', content: shopPane },
      ],
      () => this.tooltip.refresh(),
    );
    this.toast = new Toast(this.touch, (def) => this.lookAtSeat(def));
    this.floorArea.append(this.canvas, this.toast.root);
    this.shell = new Shell(
      root,
      {
        title: el('h1', {}, 'Tick Tock Coffee Shop', debug ? el('span', { className: 'badge' }, 'debug') : ''),
        visit: this.visitBanner?.root ?? null,
        clock: this.panel.clock,
        coins: this.panel.coins,
        next: this.regularsPanel.next,
        till: this.panel.tillCard,
        tabs: this.tabs.root,
        floor: this.floorArea,
        tools: this.tools.root,
        palette: this.palette.root,
        info: this.panel.info,
        stick: this.stick.root,
      },
      () => this.render(),
    );
    bindInput(this.canvas, this);
    // The floor fills whatever room the panels leave it, and is redrawn when that changes.
    new ResizeObserver(() => this.render()).observe(this.floorArea);
    // A visit is never saved, so it can never overwrite the player's own shop.
    if (!visit) {
      this.save();
      window.setInterval(() => this.save(), AUTOSAVE_MS);
      window.addEventListener('pagehide', () => this.save());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.save();
      });
    }
    // A shop of the player's own that has not had the tour offered gets it, after any morning report.
    const offer = !visit && !this.shop.tutorialSeen ? () => this.offerTour() : () => {};
    if (report) {
      // The clock waits while the morning report is read.
      this.running = false;
      const loyalty = new Map(this.shop.regulars.map((r) => [r.id, r.loyalty]));
      showMorningReport(report, loyalty, () => {
        this.togglePause();
        offer();
      });
    } else offer();
    this.schedule();
    this.render();
    // The canvas draws text in the canvas's own fonts; redraw once they have loaded.
    document.fonts?.ready.then(() => this.render());
  }

  private save(): void {
    if (!this.leaving && this.slot !== null) writeSave(this.shop, this.slot);
  }

  /**
   * An old save may have bought floor rows before its first regular was
   * happy, which can leave it too poor to build a first line: those rows are
   * taken back and refunded. Then a till and pieces worth less than a new
   * shop's till are topped up to it.
   */
  private fixOldSave(): void {
    const rows = this.shop.refundEarlyRows();
    if (rows) this.notes.unshift(refundNote(rows, this.shop.rowsLocked() ?? 'Floor rows wait for a happy regular'));
    const added = this.shop.topUp();
    if (added) this.notes.unshift(`Topped up the till by ${added} coins: your till and your pieces are worth the ${START_COINS} a new shop starts with.`);
    if (!rows && !added) return;
    const said = [rows ? `${rows.coins} coins back for floor rows bought early` : '', added ? `${added} coins added to the till` : ''];
    this.editor.message = `${said.filter(Boolean).join(', and ')}. See Happenings.`;
    this.save();
  }

  /** The Shop tab's card for this shop's save: export it, or go back to the slots. */
  private saveCard(): HTMLElement {
    const exportBtn = el('button', { textContent: 'Export save' });
    exportBtn.onclick = () => downloadSave(saveShop(this.shop, Date.now()));
    const slots = el('button', { textContent: 'Back to save slots' });
    slots.onclick = () => this.toSlots();
    return el(
      'div',
      { className: 'card save-card' },
      el('div', { className: 'card-name' }, 'Your save'),
      el('div', { className: 'muted' }, `This shop is saved in slot ${this.slot} as you play. Export it to keep a copy, or to move it to another browser.`),
      el('div', { className: 'row' }, exportBtn, slots),
    );
  }

  /** Save, and go back to the save slots. */
  private toSlots(): void {
    this.save();
    this.leaving = true;
    location.reload();
  }

  private offerTour(): void {
    offerTour(
      TOUR_STEPS,
      {
        take: () => {
          this.tourSeen();
          this.startTour();
        },
        skip: () => this.tourSeen(),
      },
      this.shell.compact,
    );
  }

  private tourSeen(): void {
    this.shop.tutorialSeen = true;
    this.save();
  }

  startTour(): void {
    this.tour?.end();
    this.tour = new Tour(
      {
        clock: this.panel.clock,
        newcomer: this.regularsPanel.next,
        pieces: () => this.palette.pieceButtons(START_PIECES),
        till: () => (this.shell.compact ? this.panel.coins : this.panel.tillCard),
        help: () => (this.shell.compact ? this.shell.menu : this.tabs.button('help')),
        floor: (part) => this.floorBox(part),
        prepare: (step) => this.prepareTour(step),
      },
      this.stoolExample(),
      { touch: this.touch, menu: this.shell.compact },
      () => {
        this.tour = null;
      },
    );
    this.tour.start();
  }

  /** In a narrow window the newest regular is in the drawer: open it for that step, and close it for the rest. */
  private prepareTour(step: TourStepId | null): void {
    if (step === 'regular') this.shell.openDrawer();
    else this.shell.closeDrawer();
    // The feeder is the left-hand column: bring it into view.
    if (step === 'feeder' || step === 'slots') this.pan(this.geo.camX, 0);
  }

  /** The newest timed regular at a stool, for the tour to read their stool out. */
  private stoolExample(): StoolExample {
    const timed = this.shop.regulars.map((_, i) => this.shop.defs[i]).filter((d) => !d.bowl && d.order.tick !== 'any');
    const def = timed.at(-1) ?? REGULARS[0];
    const tick = def.order.tick === 'any' ? 0 : def.order.tick;
    return { tick, slot: slotOf(tick, def.col) };
  }

  /** The feeder column, or the counter with its stools, in page pixels, cut to what is in view. */
  private floorBox(part: 'feeder' | 'counter'): Box | null {
    const c = this.canvas.getBoundingClientRect();
    const g = this.geo;
    if (c.width === 0) return null;
    const left = Math.max(g.x0, 0);
    const right = Math.min(part === 'counter' ? g.x0 + g.floorW : g.x0 + g.tile, g.width);
    if (right <= left) return null;
    if (part === 'counter') return { left: c.left + left, top: c.top + g.counterY, width: right - left, height: g.bandY + g.band - g.counterY };
    const top = Math.max(PAD, g.counterY - g.rows * g.tile + g.camY);
    return { left: c.left + left, top: c.top + top, width: right - left, height: g.counterY + g.tile - top };
  }

  /** The cat's seat, once it has started asking for milk. */
  private catSeat(): number {
    return this.shop.regulars.findIndex((_, i) => this.shop.defs[i].bowl);
  }

  private catMad(): boolean {
    const i = this.catSeat();
    return i >= 0 && this.shop.sim.blocked[i] === true;
  }

  private catAt(): Spot {
    return catSpot(Math.max(0, this.shop.T - 1), this.catSeat() >= 0);
  }

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
    const to = stepSpot(this.cursor, dir, this.shop.layout.rows);
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
    const col = clamp(Math.floor((g.width / 2 - g.x0) / g.tile), COLS - 1);
    const row = clamp(Math.floor((g.counterY + g.camY - (PAD + g.counterY) / 2) / g.tile), this.shop.layout.rows - 1);
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
   * one where a piece was just cut or copied from, else in the middle of the
   * floor in view.
   */
  private syncCursor(): void {
    if (!this.editor.hand) {
      this.cursor = null;
      return;
    }
    if (!this.touch || (this.cursor && this.cursor.row < this.shop.layout.rows)) return;
    const from = this.inspect && this.inspect.row >= 0 ? this.inspect : null;
    this.cursor = from ?? this.middleSpot();
    this.inspect = null;
    this.keepInView(this.cursor);
  }

  clickFloor(spot: Spot): void {
    this.inspect = spot;
    const cat = this.catAt();
    if (spot.row === cat.row && spot.col === cat.col) {
      this.tabs.select('shop');
      this.catCard.open();
      this.shell.openDrawer();
    }
  }

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
  private openGuide(key: string): void {
    this.tabs.select('guide');
    this.shell.openDrawer();
    this.render();
    requestAnimationFrame(() => this.guide.open(key));
  }

  rows(): number {
    return this.shop.layout.rows;
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

  private schedule(): void {
    window.clearInterval(this.timer);
    if (this.running) this.timer = window.setInterval(() => this.advance(), 1000 / this.speed);
  }

  private advance(): void {
    const report = this.shop.tick();
    for (const e of report.events) {
      if (e.type === 'brew') this.readouts.set(e.at, { tick: e.tick, roast: 'roast' in e.item ? e.item.roast : null });
    }
    this.notes = [...report.notes.map((n) => `${report.T % 12}: ${n}`).reverse(), ...this.notes].slice(0, NOTES_KEPT);
    if (report.walkedIn) this.toast.walkIn(report.walkedIn);
    this.render();
  }

  /** Bring a regular's stool into view, or the cat's bowl. */
  private lookAtSeat(def: RegularDef): void {
    if (def.bowl) this.geo.centerOn(BOWL_ROW, BOWL_COL);
    else this.geo.centerOn(null, def.col);
    this.shell.closeDrawer();
    this.render();
  }

  private hoverInfo(): string {
    const h = this.hover ?? (this.editor.hand ? this.cursor : this.inspect);
    if (!h) return '';
    const { layout, sim } = this.shop;
    if (h.row === -2) return this.stoolInfo(h.col);
    if (h.row === -1) {
      const item = sim.belts[counterIndex(layout, h.col)];
      const ticks = this.strip()?.[h.col].cupTicks ?? [];
      const steady = ticks.length ? `in steady state a cup sits here on ticks ${ticks.join(', ')}` : 'no cup here in steady state';
      return `Counter, column ${h.col}, slot ${slotOf(this.shop.T - 1, h.col)} passing${item ? ': ' + itemName(item) : ''} · ${steady}`;
    }
    const i = tileIndex(h.row, h.col);
    const s = layout.tiles[i];
    const item = sim.belts[i];
    const parts = [`Row ${h.row}, column ${h.col}`];
    if (s) parts.push(`${s.kind} (${structureToken(s)})`);
    const piece = s ? pieceOf(s.kind) : null;
    if (piece) parts.push(this.touch ? `Delete gives all ${PIECE_PRICE[piece]} back` : `Z deletes it, all ${PIECE_PRICE[piece]} back`);
    if (item) parts.push(`holding ${itemName(item)}`);
    if (s?.kind === 'bowl') parts.push(this.catSeat() >= 0 ? 'the cat wants warm milk here on tick 10' : 'the cat is not asking yet');
    if (s?.kind === 'feeder') parts.push(`the only way onto the counter; slot ${feederSlot(this.shop.T - 1, h.row)} is passing`);
    if (s?.kind === 'splitter') parts.push(this.splitterInfo(i));
    const cat = this.catAt();
    if (cat.row === h.row && cat.col === h.col) parts.push(`${this.shop.catName || 'your cat'} (${this.touch ? 'tap' : 'click'} to name or pet)`);
    const ro = this.readouts.get(i);
    if (s?.kind === 'kettle' && ro) parts.push(`last input landed on tick ${ro.tick}${ro.roast ? `: ${ro.roast}` : ''}`);
    return parts.join(' · ');
  }

  /** A splitter's round: its outputs in order, what has passed since tick 0, and where the next item goes. */
  private splitterInfo(i: number): string {
    const name = { N: 'north', E: 'east', S: 'south', W: 'west' } as const;
    const outs = splitterOutputs(this.shop.layout, i);
    if (outs.length === 0) return 'no outputs: whatever lands here spills';
    const passed = clockTick(this.shop.T) === 0 ? 0 : (this.shop.sim.splitters[i] ?? 0);
    const next = splitterNext(this.shop.layout, this.shop.sim, i)!;
    return `outputs ${outs.map((d) => name[d]).join(', ')}, in that order; ${passed} item${passed === 1 ? '' : 's'} passed since tick 0, whatever they were; the next goes ${name[next]}`;
  }

  /** What the counter strip says about the stool in column `col`. */
  private stoolInfo(col: number): string {
    const cell = this.strip()?.[col];
    const ticks = cell?.cupTicks.length ? `cup in front of it on ticks ${cell.cupTicks.join(', ')}` : 'no cup here in steady state';
    const s = cell?.stool;
    if (!s) return `Column ${col}: no stool · ${ticks}`;
    const on = s.tick !== null ? ` on tick ${s.tick}` : '';
    const slot = s.slot !== null ? ` · slot ${s.slot}` : '';
    const happy = this.shop.happiness(s.seat);
    const mood = happy >= HAPPY_LOOPS ? 'happy' : `${happy} of ${HAPPY_LOOPS} loops in a row`;
    return `${s.def.name}: ${WORD[s.result]}${on}${s.item ? `, ${itemName(s.item)}` : ''}${slot} · ${mood} · ${ticks}`;
  }

  /** "t9 · s9" for a timed stool; "any · s7" for an any-tick one, with the slot it last took a cup from. */
  private stoolLabel(i: number): string {
    const seat = this.shop.seats()[i];
    if (seat.tick !== 'any') return `t${seat.tick} · s${slotOf(seat.tick, seat.col)}`;
    const last = this.shop.sim.lastServedAt[i];
    return last === null ? 'any' : `any · s${slotOf(last, seat.col)}`;
  }

  /** How the regulars are doing: how many are happy, and how many are in. */
  private seatedInfo(): string {
    const n = this.shop.regulars.length;
    const happy = this.shop.regulars.filter((_, i) => this.shop.isHappy(i)).length;
    return `${happy} of ${n} regular${n === 1 ? '' : 's'} happy${n < this.shop.defs.length ? '' : ' · everyone is in'}`;
  }

  /** The milk order: how many pails, and from which tick. */
  private milkInfo(): string {
    const n = this.shop.milkOrder();
    if (n === 0) return 'Milk order: none yet';
    const ticks = n === 1 ? `tick ${MILK_TICK}` : `ticks ${MILK_TICK}–${MILK_TICK + n - 1}`;
    return `Milk: ${n} pail${n === 1 ? '' : 's'} a loop, ${ticks}`;
  }

  private strip(): StripCell[] | null {
    const seats = this.shop.seats();
    const c = this.stripCache;
    if (c && c.layout === this.shop.layout && c.seats === seats.length) return c.strip;
    const strip = counterStrip(this.shop.layout, seats, this.shop.defs);
    this.stripCache = { layout: this.shop.layout, seats: seats.length, strip };
    return strip;
  }

  /** Rows bought, cost and regulars kept happy: what a share link shows. */
  private stats(): ShopStats {
    const seats = this.shop.regulars.length;
    const c = this.statsCache;
    if (c && c.layout === this.shop.layout && c.seats === seats) return c.stats;
    const stats = shopStats(this.shop.layout, seats, this.shop.defs);
    this.statsCache = { layout: this.shop.layout, seats, stats };
    return stats;
  }

  private stools(): StoolView[] {
    const strip = this.strip();
    return this.shop
      .seats()
      .map((seat, i) => ({ seat, i }))
      .filter(({ seat }) => seat.bowl === undefined)
      .map(({ seat, i }) => {
        const cell = strip?.[seat.col].stool;
        return {
          col: seat.col,
          id: this.shop.defs[i].id,
          label: this.stoolLabel(i),
          // The floor shows the tick just run, so presence is read for that tick.
          present: this.shop.T > 0 && isPresent(seat, this.shop.T - 1),
          servedNow: this.shop.lastEvents.some((e) => e.type === 'serve' && e.seat === i),
          status: this.shop.regulars[i].status,
          happy: this.shop.happiness(i),
          result: cell?.result ?? null,
          cup: cell?.item ?? null,
        };
      });
  }

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
    this.geo.fit(w, h, this.shop.layout.rows, this.touch ? MIN_TOUCH_TILE : MIN_TILE);
    this.syncCursor();
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const view: View = {
      shop: this.shop,
      editor: this.editor,
      geo: this.geo,
      // A finger's hand shows its ghost where the stick has put it.
      hover: this.cursor ?? this.hover,
      ghostCursor: this.cursor !== null,
      inspect: this.inspect,
      panHint: this.touch ? 'drag to look' : 'right-drag or scroll',
      readouts: this.readouts,
      stools: this.stools(),
      cat: { spot: this.catAt(), heart: this.catCard.heart, mad: this.catMad() },
      sprites: this.sprites,
      dpr,
    };
    draw(this.ctx, view);
    const rights = this.shop.rights();
    const wells = this.shop.layout.tiles.filter((s) => s?.kind === 'well').length;
    const hand = this.editor.hand;
    this.panel.update({
      T: this.shop.T,
      running: this.running,
      speed: this.speed,
      till: this.shop.till,
      gears: this.shop.gears,
      spillsThisLoop: this.shop.spillsThisLoop,
      spillsLastLoop: this.shop.spillsLastLoop,
      milk: this.milkInfo(),
      seated: this.seatedInfo(),
      message: this.editor.message,
      hoverInfo: this.hoverInfo(),
      bufferInfo: this.editor.buffer.entries.length
        ? `Paste buffer: ${this.editor.buffer.entries.length} entr${this.editor.buffer.entries.length === 1 ? 'y' : 'ies'}`
        : '',
      rowsLocked: this.shop.rowsLocked(),
    });
    this.palette.update({
      palette: ALL_PIECES.map((piece) => ({
        piece,
        locked: !rights.unlocked.has(piece),
        note: piece === 'well' && Number.isFinite(rights.wellLimit) ? `${wells}/${rights.wellLimit}` : '',
      })),
      inHand: hand ? (hand.type === 'piece' ? hand.piece : 'group') : null,
      keys: !this.touch,
    });
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
    this.guide.update({
      unlocked: rights.unlocked,
      rowsLocked: this.shop.rowsLocked() !== null,
      regulars: this.shop.regulars.map((_, i) => this.shop.defs[i]),
    });
    this.regularsPanel.update(
      this.shop.defs,
      this.shop.regulars,
      this.shop.regulars.map((_, i) => this.shop.happiness(i)),
      this.shop.newcomer(),
      this.notes,
    );
    this.visitBanner?.update(this.stats());
    // The share card's numbers need steady state, so they are worked out only while it shows.
    if (this.tabs.current === 'shop') this.shareCard?.update();
    this.tooltip.refresh();
  }
}

/** How far the player has got: their furthest shop, or a new shop's progress if they have none. */
function ownProgress(debug: boolean): Progress {
  const shops = SLOTS.map((n) => openSlot(REGULARS, debug, n)?.shop ?? null).filter((s): s is Shop => s !== null);
  const all = shops.map((s) => progressOf(s, REGULARS));
  return all.reduce((best, p) => (isBehind(best, p) ? p : best), progressOf(null, REGULARS));
}

/**
 * Open the shop the URL names. A share link in the fragment opens someone
 * else's shop as a visit; a player whose furthest shop is behind it is warned
 * of spoilers first. Anything else shows the save slots, to open one of the
 * player's own shops or start a new one.
 */
function open(root: HTMLElement, debug: boolean): void {
  // Pasting another link into the address bar reopens the page on what it names.
  window.addEventListener('hashchange', () => location.reload());
  // The one save from before there were slots moves into the first empty slot.
  migrateLegacySave(debug);
  const fragment = location.hash.slice(1);
  const shared = fragment ? decodeShare(fragment, REGULARS) : null;
  const start = (opening: Opening, notice = '') => {
    const app = new App(root, debug, opening, notice);
    // Dev builds only: lets the console inspect the shop.
    if (import.meta.env.DEV) (window as unknown as { ticktock: App }).ticktock = app;
  };
  const slots = (notice = '') => showSlotScreen({ defs: REGULARS, debug, notice, open: (slot) => start({ slot }) });
  if (!shared) {
    if (!fragment) return slots();
    // A link that does not open a shop: drop it, and show the player's own.
    history.replaceState(null, '', location.pathname + location.search);
    return slots('That share link could not be opened, so here are your own shops.');
  }
  const visit = visitShop(shared, REGULARS, debug)!;
  const stats = shopStats(shared.layout, shared.walkedIn, REGULARS);
  const own = ownProgress(debug);
  if (!isBehind(own, stats)) return start({ visit });
  showSpoilerWarning(shared.name, stats, own, { open: () => start({ visit }), back: leaveVisit });
}

open(document.getElementById('app')!, new URLSearchParams(location.search).has('debug'));
