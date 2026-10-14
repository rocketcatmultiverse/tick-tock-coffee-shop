// The page's addresses (docs/QUESTIONS.md, Q77): the slots, a slot's shop, or
// a workbench puzzle in it, keeping ?debug.

import { describe, expect, it } from 'vitest';
import { readRoute, routeUrl } from '../../src/ui/route';

describe('Page addresses', () => {
  it('a plain address is the slot screen', () => {
    expect(readRoute('')).toEqual({ debug: false, slot: null, bench: null });
    expect(readRoute('?debug')).toEqual({ debug: true, slot: null, bench: null });
  });

  it('names a slot’s shop, or a puzzle in it', () => {
    expect(readRoute('?slot=2')).toEqual({ debug: false, slot: 2, bench: null });
    expect(readRoute('?debug&slot=1&bench=basics-cup')).toEqual({ debug: true, slot: 1, bench: 'basics-cup' });
  });

  it('a slot that is not one is none, and a puzzle needs a slot', () => {
    for (const bad of ['?slot=0', '?slot=-1', '?slot=1.5', '?slot=x', '?slot=']) expect(readRoute(bad).slot).toBeNull();
    expect(readRoute('?bench=basics-cup')).toEqual({ debug: false, slot: null, bench: null });
  });

  it('writes each back as it reads', () => {
    for (const r of [
      { debug: false, slot: null, bench: null },
      { debug: true, slot: null, bench: null },
      { debug: false, slot: 3, bench: null },
      { debug: true, slot: 2, bench: 'spring-top' },
    ]) {
      const url = routeUrl('/ticktock/', r);
      expect(url.startsWith('/ticktock/')).toBe(true);
      expect(readRoute(url.slice('/ticktock/'.length))).toEqual(r);
    }
    expect(routeUrl('/', { debug: false, slot: null, bench: 'x' })).toBe('/');
  });
});
