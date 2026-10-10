// The first twelve orders (docs/SPEC.md, Spec 5): eleven regulars and your cat.
// Stool columns were picked when the reference layouts were built; see
// src/levels/layouts.ts and docs/QUESTIONS.md (Q18, Q28).

import type { RegularDef } from '../sim/types';

export const REGULARS: RegularDef[] = [
  {
    id: 'lamplighter',
    name: 'The lamplighter',
    intro: 'Up before the lamps go out. Anything medium, whenever it is ready.',
    col: 3,
    order: { drink: 'coffee', roast: 'medium', tick: 'any', grace: 0 },
  },
  {
    id: 'sweep',
    name: 'The chimney sweep',
    intro: 'Something as dark as a flue, please. I am not particular about when.',
    col: 9,
    order: { drink: 'coffee', roast: 'dark', tick: 'any', grace: 0 },
  },
  {
    id: 'clockmaker',
    name: 'The clockmaker',
    intro: 'Medium, in front of me on the fifth tick. I pay in gears, which are better than coins.',
    col: 5,
    order: { drink: 'coffee', roast: 'medium', tick: 5, grace: 2 },
    paysIn: 'gears',
  },
  {
    id: 'gargoyle',
    name: 'The gargoyle',
    intro: 'Dark, on the eleventh tick. I have waited four hundred mornings; I can wait three ticks more.',
    col: 11,
    order: { drink: 'coffee', roast: 'dark', tick: 11, grace: 3 },
  },
  {
    id: 'postwoman',
    name: 'The postwoman',
    intro: 'Medium, on the third tick. The letters will not wait, and neither will I.',
    col: 2,
    order: { drink: 'coffee', roast: 'medium', tick: 3, grace: 2 },
    wellLimit: 2,
  },
  {
    id: 'baker',
    name: 'The baker',
    intro: 'Light, on the first tick. I have been up since the dough rose.',
    col: 8,
    order: { drink: 'coffee', roast: 'light', tick: 1, grace: 2 },
    unlocks: ['launch', 'catch'],
  },
  {
    id: 'apothecary',
    name: 'The apothecary',
    intro: 'Light, on the eighth tick, measured to the grain.',
    col: 7,
    order: { drink: 'coffee', roast: 'light', tick: 8, grace: 2 },
  },
  {
    id: 'witch',
    name: 'The witch',
    intro: 'A medium espresso as the loop turns over. Roasted in the dark, like all the best things.',
    col: 4,
    order: { drink: 'espresso', roast: 'medium', tick: 0, grace: 3 },
    unlocks: ['roaster'],
  },
  {
    id: 'alchemist',
    name: 'The alchemist',
    intro: 'Dark espresso on the sixth tick precisely. And keep my place clear the tick before.',
    col: 10,
    order: { drink: 'espresso', roast: 'dark', tick: 6, grace: 0, fussy: true },
    wellLimit: 3,
  },
  {
    id: 'cat',
    name: 'Your cat',
    intro: 'Mrrp. (Warm milk, in the bowl, at ten.)',
    col: 11,
    order: { drink: 'warmMilk', roast: 'any', tick: 10, grace: 3 },
    bowl: true,
    unlocks: ['door'],
    paysIn: 'nothing',
  },
  {
    id: 'innkeeper',
    name: 'The innkeeper',
    intro: 'A medium café au lait on the fourth tick. Something soft after a long night.',
    col: 6,
    order: { drink: 'auLait', roast: 'medium', tick: 4, grace: 2 },
    unlocks: ['mixer'],
  },
  {
    id: 'mayor',
    name: 'The mayor',
    intro: 'A dark latte on the seventh tick, if you please. The whole town is watching.',
    col: 1,
    order: { drink: 'latte', roast: 'dark', tick: 7, grace: 1 },
  },
];
