// Regulars 1 to 4, the playable part of the gray box (docs/SPEC.md, Spec 5).
// Stool columns were picked when the reference layouts were built; see
// src/levels/layouts.ts and docs/QUESTIONS.md (Q18).

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
];
