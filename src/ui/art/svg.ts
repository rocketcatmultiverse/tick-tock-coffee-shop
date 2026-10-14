// Sprites for the floor, as SVG source. Shapes, colours and the wobbly ink
// line come from the visuals canvas (docs/Tick Tock Coffee Shop visuals.html).
// Every sprite is drawn on a 60 by 60 tile; raster.ts turns it into pixels.
// The canvas predates docs/ADDENDUM-01.md, so the feeder, spring, splitter,
// side door, roaster, chute, bowl and cat are drawn here in the same style.
// Pure: no DOM, so the set of sprites can be checked in tests.

import type { Dir, Item, Roast, Structure } from '../../sim/types';

/** Colours from the visuals canvas. */
export const PAL = {
  night: '#241c26', // page background
  panel: '#32283a', // cards
  track: '#3a2e3f', // the counter's strip
  stools: '#2e2433', // where the regulars sit
  line: '#e9dcc6', // card borders
  cream: '#f3e6d0', // text
  muted: '#cdbdb0',
  gold: '#e6b450',
  ink: '#2b2130', // outlines
  floor: '#e0c39a',
  floorLine: '#cfae82',
  belt: '#5a4a52',
  chevron: '#a8929c',
  wood: '#8a5a3c',
  woodTop: '#a66f4a',
  shelfWood: '#c9a06a',
  copper: '#c9713a',
  copperDark: '#a55a2c',
  teal: '#3d8f86',
  aqua: '#58c9b9',
  water: '#62b6d0',
  deepWater: '#2f6f8a',
  stone: '#8d86a8',
  soil: '#6b4631',
  soilEdge: '#8a5a3c',
  furrow: '#553624',
  leaf: '#7cab5a',
  leafDark: '#4f7d3e',
  cherry: '#c8553d',
  door: '#3b5f8a',
  glass: '#a9cfe6',
  cup: '#fbf3e4',
} as const;

/** Roast colours: the kettle dial and the clock windows. */
export const ROAST_WINDOW: Record<Roast, string> = { light: '#d9a868', medium: '#9a6234', dark: '#573320' };
/** The top of a cup of coffee, by roast. */
const COFFEE_TOP: Record<Roast, string> = { light: '#c08a4e', medium: '#8a5a2e', dark: '#3a2010' };

/** The canvas's wobble: a gentle displacement of every edge plus a fine grain. */
export function wobbleFilter(id: string, seed: number, scale = 4): string {
  return (
    `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="${seed}" result="n"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="n" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="d"/>` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="g"/>` +
    `<feColorMatrix in="g" type="matrix" values="0 0 0 0 0.17 0 0 0 0 0.13 0 0 0 0 0.19 0 0 0 -1.5 0.8" result="gm"/>` +
    `<feComposite in="gm" in2="d" operator="in" result="gi"/>` +
    `<feMerge><feMergeNode in="d"/><feMergeNode in="gi"/></feMerge></filter>`
  );
}

/** A whole SVG document for one sprite: the body inside the inked, wobbly group. */
export function svgDoc(body: string, size: number, viewBox = 60, seed = 11): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${viewBox} ${viewBox}">` +
    `<defs>${wobbleFilter('w', seed)}</defs>` +
    `<g filter="url(#w)" stroke="${PAL.ink}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`
  );
}

const ANGLE: Record<Dir, number> = { E: 0, S: 90, W: 180, N: -90 };
/** Turn a sprite drawn facing east to face `d`. */
const turn = (d: Dir, body: string) => `<g transform="rotate(${ANGLE[d]} 30 30)">${body}</g>`;

// ---- Belts and the pieces shaped like them -----------------------------------

const chevron = (color: string) =>
  `<path d="M24 20l12 10-12 10" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;

export function belt(d: Dir): string {
  return turn(d, `<rect x="4" y="4" width="52" height="52" rx="8" fill="${PAL.belt}"/>${chevron(PAL.chevron)}`);
}

/** The feeder and the counter: one fixed belt, gold-marked so it never reads as a belt you laid. */
export function fixedBelt(d: Dir): string {
  return turn(
    d,
    `<rect x="2" y="2" width="56" height="56" rx="6" fill="#4a3a4f" stroke="${PAL.gold}" stroke-width="2"/>` +
      `<path d="M16 22l8 8-8 8M30 22l8 8-8 8" fill="none" stroke="${PAL.gold}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  );
}

/** The spring: a brass coil along the way the item travels. */
export function spring(d: Dir): string {
  const loops = [16, 22, 28, 34, 40].map((x) => `<ellipse cx="${x}" cy="30" rx="4" ry="13" fill="none" stroke="${PAL.gold}" stroke-width="3"/>`).join('');
  return turn(
    d,
    `<rect x="4" y="4" width="52" height="52" rx="8" fill="${PAL.belt}"/>` +
      `<path d="M8 30h4M44 30h4" stroke="${PAL.gold}" stroke-width="3"/>` +
      loops +
      `<path d="M48 22l5 8-5 8" fill="none" stroke="${PAL.chevron}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  );
}

/** The splitter: a brass hub that hands items out on every side in turn. */
export function splitter(): string {
  const arms = (['E', 'S', 'W', 'N'] as Dir[])
    .map((d) => turn(d, `<path d="M46 23l7 7-7 7" fill="none" stroke="${PAL.cream}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`))
    .join('');
  return (
    `<rect x="4" y="4" width="52" height="52" rx="8" fill="${PAL.belt}"/>` +
    arms +
    `<circle cx="30" cy="30" r="15" fill="${PAL.teal}"/>` +
    `<path d="M30 19v22M19 30h22" stroke="${PAL.gold}" stroke-width="3"/>` +
    `<circle cx="30" cy="30" r="5" fill="${PAL.gold}"/>`
  );
}

/** A chute's launch: a ramp that flings the item over the next tile. */
export function launch(d: Dir): string {
  return turn(
    d,
    `<rect x="4" y="4" width="52" height="52" rx="8" fill="${PAL.belt}"/>` +
      `<path d="M8 48H52V20Q30 26 8 48z" fill="${PAL.aqua}"/>` +
      `<path d="M14 30q10-18 30-16" fill="none" stroke="${PAL.cream}" stroke-width="3.5"/>` +
      `<path d="M38 8l7 6-7 7" fill="none" stroke="${PAL.cream}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  );
}

/** A chute's catch: a funnel open to the chute, narrowing onto the way out. */
export function catcher(d: Dir): string {
  return turn(
    d,
    `<rect x="4" y="4" width="52" height="52" rx="8" fill="${PAL.belt}"/>` +
      `<path d="M6 8L32 22V38L6 52z" fill="${PAL.aqua}"/>` +
      `<path d="M38 20l10 10-10 10" fill="none" stroke="${PAL.chevron}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  );
}

// ---- Machines -------------------------------------------------------------------

export function well(): string {
  return (
    `<circle cx="30" cy="30" r="25" fill="${PAL.stone}"/><circle cx="30" cy="30" r="17" fill="${PAL.deepWater}"/>` +
    `<circle cx="27" cy="27" r="9" fill="${PAL.water}"/>` +
    `<rect x="25" y="0" width="10" height="8" rx="2" fill="${PAL.copper}"/><rect x="25" y="52" width="10" height="8" rx="2" fill="${PAL.copper}"/>` +
    `<rect x="0" y="25" width="8" height="10" rx="2" fill="${PAL.copper}"/><rect x="52" y="25" width="8" height="10" rx="2" fill="${PAL.copper}"/>`
  );
}

/** A small spout on the side a machine puts out on. Drawn under the body. */
const spout = (d: Dir, color: string) => turn(d, `<rect x="48" y="24" width="12" height="12" rx="3" fill="${color}"/>`);

/** Plot growth: 0 bare soil, 1 sprout, 2 bush, 3 ripe cherries. */
export type PlotStage = 0 | 1 | 2 | 3;

export function plot(out: Dir, stage: PlotStage): string {
  const soil = `<rect x="5" y="5" width="50" height="50" rx="8" fill="${PAL.soil}" stroke="${PAL.soilEdge}" stroke-width="3"/>`;
  const growth = [
    `<path d="M14 22h32M14 38h32" stroke="${PAL.furrow}" stroke-width="3" stroke-linecap="round"/>`,
    `<path d="M30 42V29" stroke="${PAL.leafDark}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M30 31q-11-2-11-11 11 0 11 11zM30 31q11-2 11-11-11 0-11 11z" fill="${PAL.leaf}"/>`,
    `<circle cx="30" cy="30" r="17" fill="${PAL.leafDark}"/><circle cx="24" cy="25" r="8" fill="${PAL.leaf}"/><circle cx="37" cy="35" r="7" fill="${PAL.leaf}"/>`,
    `<circle cx="30" cy="30" r="19" fill="${PAL.leafDark}"/><circle cx="23" cy="24" r="8" fill="${PAL.leaf}"/><circle cx="38" cy="36" r="7" fill="${PAL.leaf}"/>` +
      `<circle cx="21" cy="38" r="5" fill="${PAL.cherry}"/><circle cx="36" cy="22" r="5" fill="${PAL.cherry}"/><circle cx="30" cy="32" r="5" fill="${PAL.cherry}"/>`,
  ][stage];
  return spout(out, PAL.wood) + soil + growth;
}

/** Where a kettle's needle points for a clock tick, matching the clock face. */
function needle(tick: number, length: number): string {
  const a = (tick / 12) * Math.PI * 2 - Math.PI / 2;
  const x = 30 + Math.cos(a) * length;
  const y = 30 + Math.sin(a) * length;
  return `<path d="M30 30L${x.toFixed(1)} ${y.toFixed(1)}" stroke="${PAL.ink}" stroke-width="3" stroke-linecap="round"/>`;
}

/** The kettle: a copper pot with a roast dial; the needle shows the tick its last input landed on. */
export function kettle(out: Dir, tick: number | null): string {
  const dial =
    `<circle cx="30" cy="30" r="16" fill="${PAL.cream}" stroke="${PAL.gold}" stroke-width="2.5"/>` +
    arc(30, 30, 11, 0, 4, ROAST_WINDOW.light, 4) +
    arc(30, 30, 11, 4, 8, ROAST_WINDOW.medium, 4) +
    arc(30, 30, 11, 8, 12, ROAST_WINDOW.dark, 4);
  return (
    spout(out, PAL.copperDark) +
    `<circle cx="30" cy="30" r="25" fill="${PAL.copper}"/>` +
    dial +
    (tick === null ? '' : needle(tick, 12)) +
    `<circle cx="30" cy="30" r="3" fill="${PAL.ink}"/>`
  );
}

/** An arc of the clock between two ticks, as on the canvas's dials. */
export function arc(cx: number, cy: number, r: number, from: number, to: number, color: string, width: number): string {
  const at = (t: number) => {
    const a = (t / 12) * Math.PI * 2 - Math.PI / 2;
    return `${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`;
  };
  const large = to - from > 6 ? 1 : 0;
  return `<path d="M${at(from)}A${r} ${r} 0 ${large} 1 ${at(to)}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
}

/** The roaster: a drum with a window onto the beans. Not on the canvas; drawn to match the kettle. */
export function roaster(out: Dir, full: boolean): string {
  return (
    spout(out, PAL.copperDark) +
    `<rect x="7" y="9" width="46" height="42" rx="14" fill="#8c3b2e"/>` +
    `<rect x="7" y="25" width="46" height="9" fill="${PAL.copper}"/>` +
    `<circle cx="30" cy="30" r="11" fill="${full ? '#5a3220' : PAL.night}" stroke="${PAL.gold}" stroke-width="2.5"/>` +
    (full ? `<ellipse cx="27" cy="28" rx="3" ry="4" fill="#8a5a34"/><ellipse cx="33" cy="32" rx="3" ry="4" fill="#6b3f22"/>` : '') +
    `<path d="M20 9V4h6v5" fill="${PAL.copperDark}"/>`
  );
}

export function mixer(out: Dir): string {
  return (
    spout(out, '#2c6b64') +
    `<circle cx="30" cy="30" r="25" fill="${PAL.teal}"/><circle cx="30" cy="30" r="16" fill="#d9b48a"/>` +
    `<path d="M21 31q9-11 18 0" fill="none" stroke="${PAL.cup}" stroke-width="3" stroke-linecap="round"/>`
  );
}

/** The side door on the right-hand wall, as the canvas's back door, mirrored to face into the room. */
export function door(): string {
  return (
    `<rect x="52" y="0" width="8" height="60" fill="${PAL.track}"/>` +
    `<rect x="4" y="2" width="48" height="56" rx="4" fill="${PAL.door}"/>` +
    `<rect x="14" y="10" width="28" height="18" rx="2" fill="${PAL.glass}"/>` +
    `<circle cx="44" cy="38" r="3.5" fill="${PAL.gold}"/>`
  );
}

/** The cat's bowl: a teal dish on a little mat. */
export function bowl(): string {
  return (
    `<ellipse cx="30" cy="38" rx="25" ry="12" fill="${PAL.panel}"/>` +
    `<path d="M10 30h40q-3 16-20 16T10 30z" fill="${PAL.aqua}"/>` +
    `<ellipse cx="30" cy="30" rx="20" ry="6" fill="${PAL.cup}"/>` +
    `<path d="M24 38q6 4 12 0M33 36l4 2-4 2" fill="none" stroke="${PAL.teal}" stroke-width="2"/>`
  );
}

/** The tray a workbench puzzle's items are handed in on: wood with a gold rim, a napkin, and a bell to ring. */
export function tray(): string {
  return (
    `<rect x="3" y="9" width="54" height="42" rx="9" fill="${PAL.wood}" stroke="${PAL.gold}" stroke-width="3"/>` +
    `<rect x="11" y="16" width="38" height="28" rx="5" fill="${PAL.shelfWood}"/>` +
    `<path d="M15 20l14 4-3 14-12-6z" fill="${PAL.cup}"/>` +
    `<path d="M33 37a9 9 0 0 1 18 0z" fill="${PAL.gold}"/><path d="M31 38h22" stroke-width="3"/><circle cx="42" cy="26" r="2.5" fill="${PAL.gold}"/>`
  );
}

/** Your cat, sitting. Not on the canvas; drawn in its style. */
export function cat(): string {
  return (
    `<path d="M46 50q10-2 8-14" fill="none" stroke="#d9823f" stroke-width="5"/>` +
    `<path d="M16 54c0-14 6-22 14-22s14 8 14 22z" fill="#e89a52"/>` +
    `<path d="M18 22l-2-14 10 8zM42 22l2-14-10 8z" fill="#e89a52"/>` +
    `<circle cx="30" cy="25" r="13" fill="#e89a52"/>` +
    `<path d="M22 18l4 3M38 18l-4 3M30 13v4" fill="none" stroke="#b8642c" stroke-width="2"/>` +
    `<circle cx="25" cy="25" r="2.2" fill="${PAL.ink}"/><circle cx="35" cy="25" r="2.2" fill="${PAL.ink}"/>` +
    `<path d="M28 30l2 2 2-2" fill="#cf7a5a" stroke-width="1.5"/>`
  );
}

// ---- Items ------------------------------------------------------------------------

/** The canvas's cup, with a deeper fill so the roast shows at play size. */
const cupBody = (top: string, extra = '') =>
  `<path d="M41 25h4a4 4 0 0 1 0 8h-4" fill="none" stroke="${PAL.cup}" stroke-width="3"/>` +
  `<path d="M19 22h22v10a11 11 0 0 1-22 0z" fill="${PAL.cup}"/>` +
  `<ellipse cx="30" cy="22" rx="11" ry="4.5" fill="${top}"/>` +
  extra;

/** A latte: a tall glass, espresso at the bottom, milk above, foam and a dot of art on top. */
const latteGlass = (roast: Roast) =>
  `<path d="M21 12h18l-2 34H23z" fill="#f4ead8"/>` +
  `<path d="M22.4 34h15.2l-0.6 12H23z" fill="${COFFEE_TOP[roast]}" stroke="none"/>` +
  `<path d="M21 12h18l-2 34H23z" fill="none"/>` +
  `<ellipse cx="30" cy="12" rx="9" ry="3" fill="#ffffff"/>` +
  `<circle cx="30" cy="12" r="1.6" fill="${COFFEE_TOP[roast]}" stroke="none"/>`;

/** A café au lait: a wide bowl, coffee and milk swirled together. */
const auLaitBowl = (roast: Roast) =>
  `<path d="M12 28h36q-2 18-18 18T12 28z" fill="${PAL.cup}"/>` +
  `<ellipse cx="30" cy="28" rx="18" ry="5" fill="${LATTE_TOP[roast]}"/>` +
  `<path d="M20 28q10-5 20 0" fill="none" stroke="${COFFEE_TOP[roast]}" stroke-width="2.5"/>` +
  `<path d="M14 38h32" fill="none" stroke="${PAL.gold}" stroke-width="2"/>`;

const LATTE_TOP: Record<Roast, string> = { light: '#e6cfa8', medium: '#d9b48a', dark: '#b8936a' };
const ESPRESSO_BEAN: Record<Roast, [string, string]> = {
  light: ['#a8743c', '#c08a4e'],
  medium: ['#6b3f22', '#8a5a34'],
  dark: ['#2e180c', '#4a2a16'],
};

export function item(it: Item): string {
  switch (it.kind) {
    case 'water':
      return (
        `<path d="M19 22q11-17 22 0" fill="none" stroke="#6d7480" stroke-width="2.5"/>` +
        `<path d="M19 22h22l-3 21H22z" fill="#c3c9d2"/><ellipse cx="30" cy="22" rx="11" ry="4" fill="${PAL.water}"/>`
      );
    case 'milk':
      return (
        `<path d="M19 22q11-17 22 0" fill="none" stroke="#6d7480" stroke-width="2.5"/>` +
        `<path d="M19 22h22l-3 21H22z" fill="#f4f1ea"/><path d="M20 30h20l-1 6H21z" fill="${PAL.door}"/>` +
        `<ellipse cx="30" cy="22" rx="11" ry="4" fill="#ffffff"/>`
      );
    case 'beans':
      return (
        `<ellipse cx="23" cy="31" rx="6" ry="8" fill="#7a4a2a" transform="rotate(-20 23 31)"/>` +
        `<ellipse cx="36" cy="27" rx="6" ry="8" fill="#8a5a34" transform="rotate(25 36 27)"/>` +
        `<ellipse cx="32" cy="39" rx="6" ry="8" fill="#6b3f22" transform="rotate(70 32 39)"/>`
      );
    case 'espressoBeans': {
      // Roasted beans: the roast's colour, with a shine.
      const [a, b] = ESPRESSO_BEAN[it.roast];
      return (
        `<ellipse cx="23" cy="31" rx="6" ry="8" fill="${a}" transform="rotate(-20 23 31)"/>` +
        `<ellipse cx="36" cy="27" rx="6" ry="8" fill="${b}" transform="rotate(25 36 27)"/>` +
        `<ellipse cx="32" cy="39" rx="6" ry="8" fill="${a}" transform="rotate(70 32 39)"/>` +
        `<path d="M21 27q2-3 4-2M34 23q2-3 4-1" fill="none" stroke="${PAL.cup}" stroke-width="1.5"/>`
      );
    }
    case 'coffee':
      return cupBody(COFFEE_TOP[it.roast]);
    case 'espresso':
      // A small cup with a ring of crema.
      return (
        `<path d="M38 30h3a3 3 0 0 1 0 6h-3" fill="none" stroke="${PAL.cup}" stroke-width="2.5"/>` +
        `<path d="M22 28h16v6a8 8 0 0 1-16 0z" fill="${PAL.cup}"/>` +
        `<ellipse cx="30" cy="28" rx="8" ry="2.6" fill="${COFFEE_TOP[it.roast]}"/>` +
        `<path d="M18 44h24" stroke="${PAL.cup}" stroke-width="3"/>`
      );
    case 'latte':
      return latteGlass(it.roast);
    case 'auLait':
      return auLaitBowl(it.roast);
    case 'warmMilk':
      return cupBody('#ffffff', `<path d="M25 15q-3-4 0-8M33 15q-3-4 0-8" fill="none" stroke="${PAL.muted}" stroke-width="2"/>`);
  }
}

/** The splash a spill leaves: the canvas's three droplets, in the item's colour. */
export function splash(it: Item): string {
  const color = it.kind === 'water' ? PAL.water : it.kind === 'milk' || it.kind === 'warmMilk' ? '#ffffff' : '#8a5a2e';
  return (
    `<circle cx="22" cy="34" r="5" fill="${color}"/><circle cx="34" cy="24" r="4" fill="${color}"/>` +
    `<circle cx="40" cy="38" r="3" fill="${color}"/><circle cx="18" cy="22" r="2.5" fill="${color}"/>`
  );
}

// ---- Keys --------------------------------------------------------------------------

/** What the renderer knows about a tile when it picks its sprite. */
export interface TileLook {
  plotStage?: PlotStage;
  kettleTick?: number | null;
  roasterFull?: boolean;
}

/** A stable name for a structure's sprite, so each one is drawn and rasterised once. */
export function structureKey(s: Structure, look: TileLook = {}): string {
  switch (s.kind) {
    case 'belt':
    case 'spring':
    case 'launch':
    case 'catch':
      return `${s.kind}:${s.dir}`;
    case 'plot':
      return `plot:${s.out}:${look.plotStage ?? 0}`;
    case 'kettle':
      return `kettle:${s.out}:${look.kettleTick ?? '-'}`;
    case 'roaster':
      return `roaster:${s.out}:${look.roasterFull ? 1 : 0}`;
    case 'mixer':
      return `mixer:${s.out}`;
    case 'feeder':
      return 'fixed:S';
    case 'well':
    case 'door':
    case 'bowl':
    case 'splitter':
    case 'tray':
      return s.kind;
  }
}

/** The sprite body for a key made by structureKey, itemKey or the fixed names below. */
export function spriteBody(key: string): string {
  const [kind, a, b] = key.split(':');
  const d = a as Dir;
  switch (kind) {
    case 'belt':
      return belt(d);
    case 'spring':
      return spring(d);
    case 'launch':
      return launch(d);
    case 'catch':
      return catcher(d);
    case 'fixed':
      return fixedBelt(d);
    case 'plot':
      return plot(d, Number(b) as PlotStage);
    case 'kettle':
      return kettle(d, b === '-' ? null : Number(b));
    case 'roaster':
      return roaster(d, b === '1');
    case 'mixer':
      return mixer(d);
    case 'well':
      return well();
    case 'door':
      return door();
    case 'bowl':
      return bowl();
    case 'splitter':
      return splitter();
    case 'tray':
      return tray();
    case 'cat':
      return cat();
    case 'item':
      return item(JSON.parse(decodeURIComponent(a)) as Item);
    case 'splash':
      return splash(JSON.parse(decodeURIComponent(a)) as Item);
    default:
      throw new Error(`No sprite called ${key}`);
  }
}

export const itemKey = (it: Item) => `item:${encodeURIComponent(JSON.stringify(it))}`;
export const splashKey = (it: Item) => `splash:${encodeURIComponent(JSON.stringify(it))}`;
