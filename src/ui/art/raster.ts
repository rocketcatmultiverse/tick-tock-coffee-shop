// Turns sprite SVG into pixels once per size and keeps them. Loading is
// asynchronous: until a sprite is ready, get() returns null and the caller
// draws nothing there; when sprites arrive, one redraw is requested.

import { PAL, wobbleFilter } from './svg';

export interface SpriteSource {
  body: string;
  /** Size of the drawing's own coordinate box (square). */
  viewBox: number;
  seed?: number;
}

/** A complete SVG document, sized in pixels. */
export function svgDocument(src: SpriteSource, w: number, h = w): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${src.viewBox} ${(src.viewBox * h) / w}">` +
    `<defs>${wobbleFilter('w', src.seed ?? 11)}</defs>` +
    `<g filter="url(#w)" stroke="${PAL.ink}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${src.body}</g></svg>`
  );
}

export const svgUrl = (doc: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(doc)}`;

export class SpriteBank {
  private ready = new Map<string, HTMLCanvasElement>();
  private loading = new Set<string>();
  private redrawQueued = false;

  constructor(private readonly redraw: () => void) {}

  /**
   * The sprite `name` rasterised at w by h device pixels, or null while it loads.
   * `source` is only called the first time a name and size is asked for.
   */
  get(name: string, w: number, h: number, source: () => SpriteSource): HTMLCanvasElement | null {
    const key = `${name}@${w}x${h}`;
    const hit = this.ready.get(key);
    if (hit) return hit;
    if (this.loading.has(key)) return null;
    this.loading.add(key);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      this.ready.set(key, c);
      this.loading.delete(key);
      this.queueRedraw();
    };
    img.onerror = () => this.loading.delete(key);
    img.src = svgUrl(svgDocument(source(), w, h));
    return null;
  }

  private queueRedraw(): void {
    if (this.redrawQueued) return;
    this.redrawQueued = true;
    requestAnimationFrame(() => {
      this.redrawQueued = false;
      this.redraw();
    });
  }
}
