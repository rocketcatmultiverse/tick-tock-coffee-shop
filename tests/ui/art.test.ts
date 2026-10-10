// The art pass: every piece, item and regular has a sprite, so nothing on
// the floor or the panel is drawn as a blank.

import { describe, expect, it } from 'vitest';
import { REGULARS } from '../../src/levels/regulars';
import { PORTRAITS, portraitBody } from '../../src/ui/art/portraits';
import { itemKey, splashKey, spriteBody, structureKey } from '../../src/ui/art/svg';
import type { Dir, Item, Roast, Structure } from '../../src/sim/types';

const DIRS: Dir[] = ['N', 'E', 'S', 'W'];
const ROASTS: Roast[] = ['light', 'medium', 'dark'];

const STRUCTURES: Structure[] = [
  ...DIRS.flatMap((dir): Structure[] => [
    { kind: 'belt', dir },
    { kind: 'spring', dir },
    { kind: 'launch', dir },
    { kind: 'catch', dir },
    { kind: 'plot', out: dir },
    { kind: 'kettle', out: dir },
    { kind: 'roaster', out: dir },
    { kind: 'mixer', out: dir },
  ]),
  { kind: 'well' },
  { kind: 'door' },
  { kind: 'bowl' },
  { kind: 'feeder' },
  { kind: 'splitter' },
];

const ITEMS: Item[] = [
  { kind: 'water' },
  { kind: 'beans' },
  { kind: 'milk' },
  { kind: 'warmMilk' },
  ...ROASTS.flatMap((roast): Item[] => [
    { kind: 'coffee', roast },
    { kind: 'espresso', roast },
    { kind: 'espressoBeans', roast },
    { kind: 'latte', roast },
    { kind: 'auLait', roast },
  ]),
];

describe('Art', () => {
  it('every structure, facing every way, has a sprite of its own', () => {
    const keys = STRUCTURES.map((s) => structureKey(s));
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(spriteBody(k), k).toMatch(/^</);
  });

  it('plots, kettles and roasters change with what they are doing', () => {
    const plot: Structure = { kind: 'plot', out: 'S' };
    const stages = ([0, 1, 2, 3] as const).map((plotStage) => structureKey(plot, { plotStage }));
    expect(new Set(stages).size).toBe(4);
    const kettle: Structure = { kind: 'kettle', out: 'S' };
    const ticks = [null, ...Array.from({ length: 12 }, (_, t) => t)].map((kettleTick) => structureKey(kettle, { kettleTick }));
    expect(new Set(ticks).size).toBe(13);
    for (const k of [...stages, ...ticks]) expect(spriteBody(k), k).toMatch(/^</);
    const roaster: Structure = { kind: 'roaster', out: 'S' };
    expect(structureKey(roaster, { roasterFull: true })).not.toBe(structureKey(roaster, { roasterFull: false }));
  });

  it('every item, in every roast, has a sprite and a splash, and roasts look different', () => {
    const keys = ITEMS.map(itemKey);
    expect(new Set(keys).size).toBe(keys.length);
    const bodies = ITEMS.map((it) => spriteBody(itemKey(it)));
    expect(new Set(bodies).size).toBe(bodies.length);
    for (const it of ITEMS) expect(spriteBody(splashKey(it))).toMatch(/^</);
  });

  it('the cat on the floor and the fixed belt have sprites', () => {
    for (const k of ['cat', 'fixed:E', 'fixed:S']) expect(spriteBody(k), k).toMatch(/^</);
  });

  it('every regular, the cat included, has a portrait', () => {
    for (const def of REGULARS) expect(portraitBody(def.id), def.id).toMatch(/^<circle/);
    expect(Object.keys(PORTRAITS).sort()).toEqual(REGULARS.map((d) => d.id).sort());
  });
});
