// The page's addresses (docs/QUESTIONS.md, Q77). Plain, the page shows the
// save slots. ?slot=2 opens slot 2's shop straight away, as on coming back
// from the workbench; ?slot=2&bench=basics-cup opens a workbench puzzle with
// that shop's progress. ?debug stays on every address. A share link is the
// fragment, as before (Q68).

export interface Route {
  debug: boolean;
  /** The save slot to open, or null for the slot screen. */
  slot: number | null;
  /** The workbench puzzle to open in that slot's shop, or null for the shop itself. */
  bench: string | null;
}

/** What a page address's query asks for. A slot that is not a whole number above 0 is none. */
export function readRoute(search: string): Route {
  const q = new URLSearchParams(search);
  const n = Number(q.get('slot'));
  const slot = Number.isInteger(n) && n > 0 ? n : null;
  return { debug: q.has('debug'), slot, bench: slot === null ? null : q.get('bench') || null };
}

/** The address of the page at `path` that opens a slot's shop, a puzzle in it, or the slots. */
export function routeUrl(path: string, to: Route): string {
  const q: string[] = [];
  if (to.debug) q.push('debug');
  if (to.slot !== null) q.push(`slot=${to.slot}`);
  if (to.slot !== null && to.bench) q.push(`bench=${encodeURIComponent(to.bench)}`);
  return path + (q.length ? `?${q.join('&')}` : '');
}
