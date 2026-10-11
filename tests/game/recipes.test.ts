// The recipes the order tooltips show, checked against the simulator itself:
// every step, fed its inputs on every tick of its window, must make what it
// says, and on every other tick must not.

import { describe, expect, it } from 'vitest';
import { type Ingredient, type RecipeStep, kettleTicks, recipeFor, roasterTicks, tickRuns } from '../../src/game/recipes';
import { tileIndex } from '../../src/sim/grid';
import type { Item, Roast } from '../../src/sim/types';
import { REGULARS } from '../../src/levels/regulars';
import { EMPTY, allOf, floor, runTo, start } from '../helpers';

const ROASTS: Roast[] = ['light', 'medium', 'dark'];
const TOKEN = { kettle: 'K>', roaster: 'R>', mixer: 'M>' } as const;
/** Inputs arrive from the west and the north; the machine puts out east. */
const WEST = tileIndex(1, 4);
const NORTH = tileIndex(2, 5);
const MACHINE = tileIndex(1, 5);

const asItem = (g: Ingredient): Item => (g.roast ? { kind: g.kind, roast: g.roast } : { kind: g.kind }) as Item;

/** Feed a step's inputs so they land on clock tick `t`, and return what the machine makes of them. */
function make(step: RecipeStep, t: number) {
  const run = start(['. . . . . v . . . . . .', `. . . . > ${TOKEN[step.machine]} > > > > > .`, EMPTY]);
  const landT = 12 + t;
  runTo(run, landT);
  const items = step.inputs.flatMap((term) => (term.type === 'item' ? [asItem(term.item)] : []));
  [WEST, NORTH].forEach((at, k) => (run.state.belts[at] = items[k] ?? null));
  runTo(run, landT + 14);
  const made = [...allOf(run, 'brew'), ...allOf(run, 'mix'), ...allOf(run, 'release')].filter((e) => e.at === MACHINE);
  const spills = allOf(run, 'spill').filter((e) => e.at === MACHINE);
  return { run, made: made.map((e) => e.item), spills };
}

const WANTED: Ingredient[] = [
  { kind: 'warmMilk', roast: null },
  ...ROASTS.flatMap((roast): Ingredient[] =>
    (['coffee', 'espressoBeans', 'espresso', 'auLait', 'latte'] as const).map((kind) => ({ kind, roast })),
  ),
];

describe('Recipes', () => {
  for (const want of WANTED) {
    it(`every step for ${want.roast ?? ''} ${want.kind} makes what it says, on its ticks and no others`, () => {
      const steps = recipeFor(want);
      expect(steps[0].out).toEqual(want);
      for (const step of steps) {
        const clock = step.inputs.find((term) => term.type === 'clock');
        const window = clock?.type === 'clock' ? clock.ticks : null;
        for (let t = 0; t < 12; t++) {
          const { run, made, spills } = make(step, t);
          expect(spills, floor(run)).toEqual([]);
          expect(made.length, floor(run)).toBe(1);
          if (!window || window.includes(t)) expect(made[0], `landing on tick ${t}${floor(run)}`).toEqual(asItem(step.out));
          else expect(made[0], `landing on tick ${t}${floor(run)}`).not.toEqual(asItem(step.out));
        }
      }
    });
  }

  it('each chain starts from water, beans or milk: every made ingredient has a step of its own', () => {
    for (const want of WANTED) {
      const steps = recipeFor(want);
      const made = new Set(steps.map((s) => JSON.stringify(s.out)));
      for (const step of steps) {
        for (const term of step.inputs) {
          if (term.type !== 'item') continue;
          const raw = ['water', 'beans', 'milk'].includes(term.item.kind);
          expect(raw || made.has(JSON.stringify(term.item)), `${want.kind}: ${term.item.kind}`).toBe(true);
        }
      }
    }
  });

  it('every regular on the ladder orders something with a recipe', () => {
    for (const def of REGULARS) {
      const roast = def.order.roast === 'any' ? null : def.order.roast;
      expect(recipeFor({ kind: def.order.drink, roast }).length, def.id).toBeGreaterThan(0);
    }
  });

  it('a latte is espresso and milk at the mixer, and the espresso comes from the roaster by way of a kettle', () => {
    const [mix, brew, roast] = recipeFor({ kind: 'latte', roast: 'dark' });
    expect(mix.machine).toBe('mixer');
    expect(mix.inputs).toEqual([
      { type: 'item', item: { kind: 'espresso', roast: 'dark' } },
      { type: 'item', item: { kind: 'milk', roast: null } },
    ]);
    expect(brew.machine).toBe('kettle');
    expect(roast.machine).toBe('roaster');
  });

  it('the clock windows: the kettle by landing tick, the roaster by time inside before tick 6', () => {
    expect(kettleTicks('light')).toEqual([0, 1, 2, 3]);
    expect(kettleTicks('dark')).toEqual([8, 9, 10, 11]);
    expect(roasterTicks('dark')).toEqual([6, 7, 8, 9]);
    expect(roasterTicks('medium')).toEqual([0, 1, 10, 11]);
    expect(tickRuns(roasterTicks('medium'))).toEqual([[10, 1]]);
    expect(tickRuns(kettleTicks('medium'))).toEqual([[4, 7]]);
    expect(tickRuns([0, 2, 3, 11])).toEqual([[2, 3], [11, 0]]);
    expect(tickRuns([])).toEqual([]);
  });
});
