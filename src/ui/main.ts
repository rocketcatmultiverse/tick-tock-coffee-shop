import './style.css';
import { counterIndex, feederSlot, isPresent, itemName, slotOf, tileIndex } from '../sim';
import { COLS, MILK_TICK } from '../sim/tuning';
import type { Layout, RegularDef, SimEvent } from '../sim/types';
import { ALL_PIECES } from '../game/pieces';
import { applyOffline } from '../game/offline';
import { saveShop } from '../game/save';
import { type Progress, type ShopStats, decodeShare, isBehind, progressOf, shopStats, shopTitle, visitShop } from '../game/share';
import { type RowRefund, Shop } from '../game/shop';
import { type StripCell, counterStrip } from '../game/strip';
import { BOWL_COL, BOWL_ROW, FLOOR_ROW_PRICE, HAPPY_LOOPS, START_COINS, START_PIECES, START_ROWS } from '../game/tuning';
import { PUZZLES } from '../levels/puzzles';
import { REGULARS } from '../levels/regulars';
import { openBench } from './bench';
import { BenchList } from './benchList';
import { catSpot } from './cat';
import { CatCard } from './catCard';
import { RegularsPanel } from './regularsPanel';
import { touchFirst } from './device';
import { FloorApp } from './floorApp';
import { PAD, type Spot } from './geometry';
import { drinksOrdered } from './guide';
import { el } from './el';
import { Shell } from './layout';
import type { PaletteModel } from './palette';
import { Tabs, helpPane } from './panel';
import { showMorningReport } from './morningReport';
import type { StoolView, View } from './render';
import { readRoute, routeUrl } from './route';
import { ShareCard, VisitBanner, leaveVisit, showSpoilerWarning } from './share';
import { downloadSave, showSlotScreen } from './slots';
import { AUTOSAVE_MS, SLOTS, migrateLegacySave, openSlot, writeSave } from './storage';
import { ROWS_WAIT } from './tips';
import { Toast } from './toast';
import { type Box, type StoolExample, type TourStepId, TOUR_STEPS, Tour, offerTour } from './tutorial';

/** How long after a first click on the row for sale a second one buys it. */
const ROW_ASK_MS = 4000;
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

class App extends FloorApp<Shop> {
  /** When the row for sale was first clicked or tapped: a second, soon after, buys it (Q76). */
  private rowAskedAt: number | null = null;
  private readonly debug: boolean;
  private regularsPanel = new RegularsPanel();
  private notes: string[] = [];
  private catCard = new CatCard({
    getName: () => this.shop.catName,
    setName: (n) => {
      this.shop.catName = n;
    },
    isMad: () => this.catMad(),
    render: () => this.render(),
  });
  /** The ladders of workbench puzzles, in the Workbench tab (Q77). */
  private benchList = new BenchList(PUZZLES, (id) => this.toBench(id));
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
    const slot = 'slot' in opening ? opening.slot : null;
    const loaded = slot === null ? null : openSlot(REGULARS, debug, slot);
    const shop = visit ?? loaded?.shop ?? new Shop({ defs: REGULARS, debug });
    super(shop, { cols: COLS, counter: true }, touchFirst() ? REFUND_HINT.touch : REFUND_HINT.mouse);
    this.debug = debug;
    this.slot = slot;
    if (visit) this.notes.push(`Visiting ${shopTitle(visit.shopName)}: the floor starts empty and fills within a loop or two. Nothing here is saved.`);
    else this.notes.push(loaded ? 'Welcome back. The floor starts empty and fills again within a loop or two.' : `${REGULARS[0].name} walks in: "${REGULARS[0].intro}"`);
    if (loaded) this.fixOldSave();
    if (notice) this.notes.unshift(notice);
    const report = loaded ? applyOffline(this.shop, loaded.lastSeen, Date.now()) : null;
    const catHint = el('p', { className: 'muted' }, `${this.touch ? 'Tap' : 'Click'} your cat on the floor to name it or pet it.`);
    let shopPane: Node[];
    let benchPane: Node[];
    if (visit) {
      this.visitBanner = new VisitBanner(visit);
      const note = 'You are visiting a shared shop. Sharing, exporting and the save slots are in your own shops.';
      shopPane = [el('p', { className: 'muted' }, note), this.catCard.root, catHint];
      benchPane = [el('p', { className: 'muted' }, 'The workbench puzzles are in your own shops.')];
    } else {
      this.shareCard = new ShareCard(this.shop, () => this.stats());
      shopPane = [this.shareCard.root, this.saveCard(), this.catCard.root, catHint];
      benchPane = [this.benchList.root];
    }
    this.tabs = new Tabs(
      [
        { id: 'regulars', label: 'Regulars', content: [this.regularsPanel.list] },
        { id: 'log', label: 'Happenings', content: [this.regularsPanel.log] },
        { id: 'bench', label: 'Workbench', content: benchPane },
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
    this.start();
  }

  /** The shop this screen runs. */
  get shop(): Shop {
    return this.floor;
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
    slots.onclick = () => this.leave(null);
    return el(
      'div',
      { className: 'card save-card' },
      el('div', { className: 'card-name' }, 'Your save'),
      el('div', { className: 'muted' }, `This shop is saved in slot ${this.slot} as you play. Export it to keep a copy, or to move it to another browser.`),
      el('div', { className: 'row' }, exportBtn, slots),
    );
  }

  /** Save, and leave the shop: for the save slots, or for a workbench puzzle (Q77), which counts as time away. */
  private leave(bench: string | null): void {
    this.save();
    this.leaving = true;
    this.stop();
    location.assign(routeUrl(location.pathname, { debug: this.debug, slot: bench ? this.slot : null, bench }));
  }

  /** Go to the workbench for a puzzle. The shop is saved as it stands, and the time there is time away. */
  private toBench(id: string): void {
    if (this.slot !== null) this.leave(id);
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
        bench: () => (this.shell.compact ? this.shell.menu : this.tabs.button('bench')),
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

  tapHolding(spot: Spot): void {
    this.rowAskedAt = null;
    super.tapHolding(spot);
  }

  /**
   * A click or tap on the row for sale. A row is never refunded and the strip
   * is where pieces go down, so the first asks and a second, soon after, buys.
   */
  buyRow(): void {
    const ed = this.editor;
    const locked = this.shop.rowsLocked();
    const asked = this.rowAsked();
    this.rowAskedAt = null;
    if (locked) ed.message = `${locked}.`;
    else if (this.shop.till < FLOOR_ROW_PRICE) ed.message = `A floor row costs ${FLOOR_ROW_PRICE} coins`;
    else if (asked) ed.message = this.shop.buyRow() ?? 'Bought a floor row';
    else {
      this.rowAskedAt = performance.now();
      ed.message = `A row costs ${FLOOR_ROW_PRICE} and is never refunded. ${this.touch ? 'Tap' : 'Click'} it again to buy it.`;
      // The strip stops asking when the time is up, even with the clock paused.
      window.setTimeout(() => this.render(), ROW_ASK_MS + 50);
    }
  }

  /** Whether the row for sale was asked about, recently enough for a second click to buy it. */
  private rowAsked(): boolean {
    return this.rowAskedAt !== null && performance.now() - this.rowAskedAt < ROW_ASK_MS;
  }

  /** The row for sale's words and look on the floor. */
  private forSale(): NonNullable<View['forSale']> {
    const hot = this.overRowForSale;
    if (this.shop.rowsLocked()) return { look: 'locked', hot, label: `Rows for sale once ${ROWS_WAIT}` };
    if (this.rowAsked()) return { look: 'armed', hot, label: `Buy a row for ${FLOOR_ROW_PRICE}? ${this.touch ? 'Tap' : 'Click'} again` };
    return { look: 'open', hot, label: `+ Buy a row · ${FLOOR_ROW_PRICE}` };
  }

  clickFloor(spot: Spot): void {
    super.clickFloor(spot);
    this.rowAskedAt = null;
    const cat = this.catAt();
    if (spot.row === cat.row && spot.col === cat.col) {
      this.tabs.select('shop');
      this.catCard.open();
      this.shell.openDrawer();
    }
  }

  protected tickFloor(): SimEvent[] {
    const report = this.shop.tick();
    this.notes = [...report.notes.map((n) => `${report.T % 12}: ${n}`).reverse(), ...this.notes].slice(0, NOTES_KEPT);
    if (report.walkedIn) this.toast.walkIn(report.walkedIn);
    return report.events;
  }

  /** Bring a regular's stool into view, or the cat's bowl. */
  private lookAtSeat(def: RegularDef): void {
    if (def.bowl) this.geo.centerOn(BOWL_ROW, BOWL_COL);
    else this.geo.centerOn(null, def.col);
    this.shell.closeDrawer();
    this.render();
  }

  protected hoverInfo(): string {
    if (this.overRowForSale) {
      const locked = this.shop.rowsLocked();
      return locked ? `${locked}. The ${START_ROWS} rows you start with are plenty until then.` : `A row for ${FLOOR_ROW_PRICE} coins: one more row at the back of the floor, with its own feeder tile. Never refunded.`;
    }
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
    const parts = this.tileInfo(h);
    const s = layout.tiles[tileIndex(h.row, h.col)];
    if (s?.kind === 'bowl') parts.push(this.catSeat() >= 0 ? 'the cat wants warm milk here on tick 10' : 'the cat is not asking yet');
    if (s?.kind === 'feeder') parts.push(`the only way onto the counter; slot ${feederSlot(this.shop.T - 1, h.row)} is passing`);
    const cat = this.catAt();
    if (cat.row === h.row && cat.col === h.col) parts.push(`${this.shop.catName || 'your cat'} (${this.touch ? 'tap' : 'click'} to name or pet)`);
    return parts.join(' · ');
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

  protected floorParts(): Pick<View, 'forSale' | 'stools' | 'cat' | 'bench'> {
    return {
      forSale: this.forSale(),
      stools: this.stools(),
      cat: { spot: this.catAt(), heart: this.catCard.heart, mad: this.catMad() },
      bench: null,
    };
  }

  protected paletteModel(): PaletteModel {
    const rights = this.shop.rights();
    const wells = this.shop.layout.tiles.filter((s) => s?.kind === 'well').length;
    const hand = this.editor.hand;
    return {
      palette: ALL_PIECES.map((piece) => ({
        piece,
        locked: !rights.unlocked.has(piece),
        note: piece === 'well' && Number.isFinite(rights.wellLimit) ? `${wells}/${rights.wellLimit}` : '',
      })),
      inHand: hand ? (hand.type === 'piece' ? hand.piece : 'group') : null,
      keys: !this.touch,
    };
  }

  protected updatePanels(): void {
    const rights = this.shop.rights();
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
      bufferInfo: this.bufferInfo(),
    });
    const walkedIn = this.shop.regulars.map((_, i) => this.shop.defs[i]);
    this.guide.update({ unlocked: rights.unlocked, rowsLocked: this.shop.rowsLocked() !== null, drinks: drinksOrdered(walkedIn) });
    this.regularsPanel.update(
      this.shop.defs,
      this.shop.regulars,
      this.shop.regulars.map((_, i) => this.shop.happiness(i)),
      this.shop.newcomer(),
      this.notes,
    );
    this.benchList.update(rights.unlocked, new Set(this.shop.bench.solved));
    this.visitBanner?.update(this.stats());
    // The share card's numbers need steady state, so they are worked out only while it shows.
    if (this.tabs.current === 'shop') this.shareCard?.update();
  }
}

/** How far the player has got: their furthest shop, or a new shop's progress if they have none. */
function ownProgress(debug: boolean): Progress {
  const shops = SLOTS.map((n) => openSlot(REGULARS, debug, n)?.shop ?? null).filter((s): s is Shop => s !== null);
  const all = shops.map((s) => progressOf(s, REGULARS));
  return all.reduce((best, p) => (isBehind(best, p) ? p : best), progressOf(null, REGULARS));
}

/**
 * Open what the address names. A share link in the fragment opens someone
 * else's shop as a visit; a player whose furthest shop is behind it is warned
 * of spoilers first. A slot in the query opens that slot's shop, or one of
 * its workbench puzzles (Q77). Anything else shows the save slots, to open
 * one of the player's own shops or start a new one.
 */
function open(root: HTMLElement): void {
  const route = readRoute(location.search);
  const debug = route.debug;
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
  if (!fragment && route.slot !== null && SLOTS.includes(route.slot)) {
    if (route.bench) {
      const why = openBench(root, debug, route.slot, route.bench);
      if (why === null) return;
      history.replaceState(null, '', routeUrl(location.pathname, { debug, slot: null, bench: null }));
      return slots(why);
    }
    // Straight into the shop, as on coming back from the workbench. A reload from here shows the slots, as ever.
    history.replaceState(null, '', routeUrl(location.pathname, { debug, slot: null, bench: null }));
    return start({ slot: route.slot });
  }
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

open(document.getElementById('app')!);
