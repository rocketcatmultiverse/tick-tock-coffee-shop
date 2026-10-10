// Sprites for the side panel and the counter strip: the same SVG as the
// floor, handed to the browser as images so they stay crisp at any size.

import { LOOP } from '../../sim/tuning';
import { roastForTick } from '../../sim/items';
import { portraitBody } from './portraits';
import { svgDocument, svgUrl } from './raster';
import { PAL, ROAST_WINDOW, arc, spriteBody } from './svg';

const urls = new Map<string, string>();

function cached(key: string, make: () => string): string {
  let u = urls.get(key);
  if (!u) {
    u = make();
    urls.set(key, u);
  }
  return u;
}

/** An <img> of a floor sprite. */
export function spriteImg(key: string, size: number, className = 'sprite'): HTMLImageElement {
  const img = new Image(size, size);
  img.className = className;
  img.alt = '';
  img.src = cached(`s:${key}:${size}`, () => svgUrl(svgDocument({ body: spriteBody(key), viewBox: 60 }, size * 2)));
  return img;
}

/** An <img> of a regular's portrait. */
export function portraitImg(id: string, size: number, className = 'portrait'): HTMLImageElement {
  const img = new Image(size, size);
  img.className = className;
  img.alt = '';
  img.src = cached(`p:${id}:${size}`, () => svgUrl(svgDocument({ body: portraitBody(id), viewBox: 160, seed: 23 }, size * 2)));
  return img;
}

/**
 * The shop clock as on the canvas: the three roast windows round the rim,
 * twelve marks, and the hand on clock tick `t` (or no hand before the start).
 */
export function clockFace(t: number | null): string {
  const marks = Array.from({ length: LOOP }, (_, k) => {
    const a = (k / LOOP) * Math.PI * 2 - Math.PI / 2;
    const p = (r: number) => `${(100 + Math.cos(a) * r).toFixed(2)} ${(100 + Math.sin(a) * r).toFixed(2)}`;
    return `M${p(72)}L${p(88)}`;
  }).join('');
  const windows = [0, 4, 8].map((from) => arc(100, 100, 80, from, from + 4, ROAST_WINDOW[roastForTick(from)], 16)).join('');
  let hand = '';
  if (t !== null) {
    const a = (t / LOOP) * Math.PI * 2 - Math.PI / 2;
    hand = `<path d="M100 100L${(100 + Math.cos(a) * 62).toFixed(2)} ${(100 + Math.sin(a) * 62).toFixed(2)}" stroke="${PAL.cream}" stroke-width="6" stroke-linecap="round"/>`;
  }
  return svgDocument(
    {
      viewBox: 200,
      seed: 4,
      body:
        `<circle cx="100" cy="100" r="94" fill="none" stroke="${PAL.gold}" stroke-width="3"/>` +
        windows +
        `<path d="${marks}" stroke="${PAL.panel}" stroke-width="3"/>` +
        hand +
        `<circle cx="100" cy="100" r="9" fill="${PAL.gold}" stroke-width="3"/>`,
    },
    150,
  );
}
