// Sprites for the side panel and the counter strip: the same SVG as the
// floor, handed to the browser as images so they stay crisp at any size.

import type { Roast } from '../../sim/types';
import { tickRuns } from '../../game/recipes';
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
 * A small clock in the kettle dial's style that shows only `ticks`, in the
 * colour of `roast`: the ticks an input must land on to come out at that roast.
 */
export function clockWindowImg(ticks: readonly number[], roast: Roast, size: number): HTMLImageElement {
  const img = new Image(size, size);
  img.className = 'sprite';
  img.alt = '';
  img.src = cached(`c:${ticks.join(',')}:${roast}:${size}`, () => {
    const at = (t: number, r: number) => {
      const a = (t / LOOP) * Math.PI * 2 - Math.PI / 2;
      return `${(30 + Math.cos(a) * r).toFixed(2)} ${(30 + Math.sin(a) * r).toFixed(2)}`;
    };
    const marks = Array.from({ length: LOOP }, (_, k) => `M${at(k, 19)}L${at(k, 23)}`).join('');
    // A wedge per run of ticks, from the centre to the rim, so it reads at icon size.
    const windows = tickRuns(ticks)
      .map(([a, b]) => {
        const to = b >= a ? b + 1 : b + 1 + LOOP;
        return `<path d="M30 30L${at(a, 23)}A23 23 0 ${to - a > LOOP / 2 ? 1 : 0} 1 ${at(to, 23)}z" fill="${ROAST_WINDOW[roast]}" stroke-width="1.5"/>`;
      })
      .join('');
    const body =
      `<circle cx="30" cy="30" r="26" fill="${PAL.cream}" stroke="${PAL.gold}" stroke-width="3"/>` +
      windows +
      `<path d="${marks}" stroke="${PAL.ink}" stroke-width="2"/>` +
      `<circle cx="30" cy="30" r="3" fill="${PAL.ink}"/>`;
    return svgUrl(svgDocument({ body, viewBox: 60, seed: 4 }, size * 2));
  });
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
