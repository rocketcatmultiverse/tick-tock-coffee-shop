import { describe, expect, it } from 'vitest';
import { planBuild, rightsAfter, type TileChange } from '../../src/game/build';
import { emptyLayout, tileIndex } from '../../src/sim/grid';
import type { RegularDef } from '../../src/sim/types';

const order = { drink: 'coffee', roast: 'any', tick: 'any', grace: 0 } as const;
const DEFS: RegularDef[] = [
  { id: 'a', name: 'A', intro: '', col: 3, order },
  { id: 'b', name: 'B', intro: '', col: 5, order, wellLimit: 2 },
  { id: 'c', name: 'C', intro: '', col: 7, order, unlocks: ['launch', 'catch'] },
  { id: 'd', name: 'D', intro: '', col: 9, order, unlocks: ['roaster'] },
];

const layout = emptyLayout(6);
const TILL = 1000;

describe('Unlocks', () => {
  it('starts with belt, plot, kettle and one well', () => {
    const rights = rightsAfter(DEFS, 1);
    expect([...rights.unlocked].sort()).toEqual(['belt', 'kettle', 'plot', 'well']);
    expect(rights.wellLimit).toBe(1);
  });

  it('a locked piece cannot be placed', () => {
    const rights = rightsAfter(DEFS, 3);
    const plan = planBuild(layout, [{ index: tileIndex(2, 2), to: { kind: 'roaster', out: 'E' } }], rights, TILL);
    expect(plan).toEqual({ ok: false, reason: 'Roaster is locked' });
  });

  it('a locked piece cannot be pasted, and the whole paste is refused', () => {
    const rights = rightsAfter(DEFS, 3);
    const paste: TileChange[] = [
      { index: tileIndex(2, 1), to: { kind: 'belt', dir: 'E' } },
      { index: tileIndex(2, 2), to: { kind: 'roaster', out: 'E' } },
      { index: tileIndex(2, 3), to: { kind: 'belt', dir: 'E' } },
    ];
    expect(planBuild(layout, paste, rights, TILL).ok).toBe(false);
    expect(layout.tiles.every((t) => t === null)).toBe(true);
  });

  it('a piece unlocks when its regular walks in', () => {
    const chute: TileChange[] = [
      { index: tileIndex(2, 1), to: { kind: 'launch', dir: 'E' } },
      { index: tileIndex(2, 3), to: { kind: 'catch', dir: 'E' } },
    ];
    expect(planBuild(layout, chute, rightsAfter(DEFS, 2), TILL).ok).toBe(false);
    expect(planBuild(layout, chute, rightsAfter(DEFS, 3), TILL).ok).toBe(true);
    const roaster: TileChange[] = [{ index: tileIndex(2, 2), to: { kind: 'roaster', out: 'E' } }];
    expect(planBuild(layout, roaster, rightsAfter(DEFS, 3), TILL).ok).toBe(false);
    expect(planBuild(layout, roaster, rightsAfter(DEFS, 4), TILL).ok).toBe(true);
  });

  it('the well limit holds until the regular who raises it walks in', () => {
    const oneWell = planBuild(layout, [{ index: tileIndex(1, 1), to: { kind: 'well' } }], rightsAfter(DEFS, 1), TILL);
    expect(oneWell.ok).toBe(true);
    if (!oneWell.ok) return;
    const second: TileChange[] = [{ index: tileIndex(4, 8), to: { kind: 'well' } }];
    expect(planBuild(oneWell.layout, second, rightsAfter(DEFS, 1), TILL)).toEqual({
      ok: false,
      reason: 'Well limit reached (1)',
    });
    expect(planBuild(oneWell.layout, second, rightsAfter(DEFS, 2), TILL).ok).toBe(true);
    // Two wells in one paste are refused too.
    const both: TileChange[] = [
      { index: tileIndex(1, 1), to: { kind: 'well' } },
      { index: tileIndex(4, 8), to: { kind: 'well' } },
    ];
    expect(planBuild(layout, both, rightsAfter(DEFS, 1), TILL).ok).toBe(false);
  });

  it('debug unlocks everything', () => {
    const rights = rightsAfter(DEFS, 1, true);
    const plan = planBuild(
      layout,
      [
        { index: tileIndex(0, 11), to: { kind: 'door' } },
        { index: tileIndex(1, 1), to: { kind: 'mixer', out: 'S' } },
        { index: tileIndex(2, 2), to: { kind: 'well' } },
        { index: tileIndex(3, 3), to: { kind: 'well' } },
      ],
      rights,
      TILL,
    );
    expect(plan.ok).toBe(true);
  });
});
