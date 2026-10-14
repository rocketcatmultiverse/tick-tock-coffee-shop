// Workbench puzzles (docs/QUESTIONS.md, Q77): a ladder for the basics, open
// from the start, and one for each piece a regular brings. On each ladder the
// rungs go from hands-on teaching through a brain teaser to mastery, and a
// rung opens once the one below it is solved.
//
// Text format: see src/sim/text.ts and parseBoard in src/game/bench.ts. The
// first line is the back row. T is the tray, # a tile that is not bench, and
// every piece written on the bench comes with it and stays put. A puzzle may
// offer only pieces unlocked by the time its ladder opens.
//
// Each puzzle has a reference solution, which tests/levels/puzzles.test.ts
// runs. They are fixtures: a rule change that breaks one is a finding to
// report, not something to patch around. The repo is public, so they are
// kept out of it, in the git-ignored puzzle-solutions/ folder
// (docs/QUESTIONS.md, Q78).

import type { PuzzleDef } from '../sim/types';

export const PUZZLES: PuzzleDef[] = [
  // ---- The basics: belt, plot, kettle and well. ----
  {
    id: 'basics-water',
    name: 'A bucket for the bench',
    ladder: 'basics',
    tier: 'tutorial',
    brief: 'The well puts out a bucket on every side at the top of the loop. Lay belts to carry one round the gap and into the tray.',
    board: ['. . . . .', 'W . # . T', '. . . . .'],
    pieces: { belt: null },
    wants: [{ kind: 'water' }],
  },
  {
    id: 'basics-beans',
    name: 'Something growing',
    ladder: 'basics',
    tier: 'tutorial',
    brief: 'A bucket landing on a plot grows beans, which come out on the side the plot faces. The tray wants beans.',
    board: ['. . . . . .', 'W . . . . T', '. . . . . .'],
    pieces: { belt: null, plot: 1 },
    wants: [{ kind: 'beans' }],
  },
  {
    id: 'basics-cup',
    name: 'First cup',
    ladder: 'basics',
    tier: 'tutorial',
    brief: 'Beans landing on a kettle brew coffee, and the tick they land on sets the roast. Plot, kettle, then belts up to the tray.',
    board: ['. . . . T .', '. . . . . .', 'W . . . . .'],
    pieces: { belt: null, plot: 1, kettle: 1 },
    wants: [{ kind: 'coffee', roast: 'medium' }],
  },
  {
    id: 'basics-dark',
    name: 'Darker',
    ladder: 'basics',
    tier: 'tutorial',
    brief: 'The later the beans reach the kettle, the darker the roast. Take the long way round.',
    board: ['. . . . .', '. . . . .', 'W . . . T'],
    pieces: { belt: null, plot: 1, kettle: 1 },
    wants: [{ kind: 'coffee', roast: 'dark' }],
  },
  {
    id: 'basics-nine',
    name: 'On the ninth tick',
    ladder: 'basics',
    tier: 'tutorial',
    brief: 'This cup must land in the tray on tick 9 exactly. Every belt it rides makes it a tick later.',
    board: ['. . . . .', 'W . . . .', '. . . . T'],
    pieces: { belt: null, plot: 1, kettle: 1 },
    wants: [{ kind: 'coffee', roast: 'medium', tick: 9 }],
  },
  {
    id: 'basics-light',
    name: 'Light, on three',
    ladder: 'basics',
    tier: 'teaser',
    brief: 'A light roast means beans that reach the kettle after the clock has come round to the top again. You have ten belts.',
    board: ['. . . .', '. . . .', '. . . .', 'W . . T'],
    pieces: { belt: 10, plot: 1, kettle: 1 },
    wants: [{ kind: 'coffee', roast: 'light', tick: 3 }],
  },
  {
    id: 'basics-three',
    name: 'Three roasts',
    ladder: 'basics',
    tier: 'mastery',
    brief: 'Three lines from one well, three roasts, and one tray tucked in the corner. Seventeen belts.',
    board: ['. . . . . .', '. . . . . .', '. . W . . .', '. . . . . .', '. . . . . T'],
    pieces: { belt: 17, plot: 3, kettle: 3 },
    wants: [
      { kind: 'coffee', roast: 'light', tick: 3 },
      { kind: 'coffee', roast: 'medium', tick: 7 },
      { kind: 'coffee', roast: 'dark', tick: 11 },
    ],
  },

  // ---- Springs, with the clockmaker. ----
  {
    id: 'spring-wind',
    name: 'Wind it up',
    ladder: 'spring',
    tier: 'tutorial',
    brief: 'No room for the long way round. A spring holds each item back as long as a run of belts would.',
    board: ['W . . . T'],
    pieces: { plot: 1, kettle: 1, spring: 1 },
    wants: [{ kind: 'coffee', roast: 'dark' }],
  },
  {
    id: 'spring-even',
    name: 'Even it out',
    ladder: 'spring',
    tier: 'teaser',
    brief: 'Medium, on tick 10. The short way comes too early, and no longer way of belts lands on 10.',
    board: ['. . . . .', 'W . . . .', '. . . . T'],
    pieces: { belt: null, plot: 1, kettle: 1, spring: 1 },
    wants: [{ kind: 'coffee', roast: 'medium', tick: 10 }],
  },
  {
    id: 'spring-top',
    name: 'Round the top',
    ladder: 'spring',
    tier: 'mastery',
    brief: 'Three cups in a row as the clock goes over the top, each a different roast, from one well.',
    board: ['. . . . . . . .', '. . . . . . . .', '. . W . . . . T', '. . . . . . . .'],
    pieces: { belt: 9, plot: 3, kettle: 3, spring: 3 },
    wants: [
      { kind: 'coffee', roast: 'medium', tick: 11 },
      { kind: 'coffee', roast: 'dark', tick: 0 },
      { kind: 'coffee', roast: 'light', tick: 1 },
    ],
  },

  // ---- Chutes, with the baker. ----
  {
    id: 'chute-gap',
    name: 'Over the gap',
    ladder: 'chute',
    tier: 'tutorial',
    brief: 'A chute flings an item over the next tile, gap or not, and lands it two tiles on. Get a cup across.',
    board: ['W . . . # . T'],
    pieces: { plot: 1, kettle: 1, chute: 1 },
    wants: [{ kind: 'coffee', roast: 'medium' }],
  },
  {
    id: 'chute-spare',
    name: 'A tick to spare',
    ladder: 'chute',
    tier: 'teaser',
    brief: 'Dark, on tick 11. A spring makes it dark; something has to win back the time.',
    board: ['W . . . . . . T'],
    pieces: { belt: null, plot: 1, kettle: 1, spring: 1, chute: 1 },
    wants: [{ kind: 'coffee', roast: 'dark', tick: 11 }],
  },
  {
    id: 'chute-fence',
    name: 'Over the fence',
    ladder: 'chute',
    tier: 'mastery',
    brief: 'The water line is fixed, and the tray is on its far side. Where does all that water go?',
    board: ['# # # T # # #', '# # # . # # #', 'W > > > > > .', '. . . . . . .', '. . . . . . .', '. . . . . . .'],
    pieces: { belt: null, plot: 2, kettle: 2, chute: 1 },
    wants: [
      { kind: 'coffee', roast: 'dark', tick: 2 },
      { kind: 'coffee', roast: 'medium', tick: 8 },
    ],
  },

  // ---- Roasters, with the witch. ----
  {
    id: 'roaster-drum',
    name: 'Into the drum',
    ladder: 'roaster',
    tier: 'tutorial',
    brief: 'A roaster lets its beans out on one tick of the loop only. The less time they spend inside, the lighter the roast.',
    board: ['W . . T'],
    pieces: { plot: 1, roaster: 1 },
    wants: [{ kind: 'espressoBeans', roast: 'light' }],
  },
  {
    id: 'roaster-witch',
    name: "The witch's hour",
    ladder: 'roaster',
    tier: 'teaser',
    brief: 'A medium espresso as the loop turns over. What comes before the roaster sets the roast; what comes after sets the tick.',
    board: ['. . . . . . .', 'W . . . . . .', '. . . . . . T'],
    pieces: { belt: null, plot: 1, roaster: 1, kettle: 1, spring: null },
    wants: [{ kind: 'espresso', roast: 'medium', tick: 0 }],
  },
  {
    id: 'roaster-two',
    name: 'Two roasts, one kettle',
    ladder: 'roaster',
    tier: 'mastery',
    brief: 'Two roasters let out together, but one kettle brews one thing a tick.',
    board: ['. . W . .', '. . . . .', '. . T . .'],
    pieces: { belt: null, plot: 2, roaster: 2, kettle: 1 },
    wants: [
      { kind: 'espresso', roast: 'dark', tick: 7 },
      { kind: 'espresso', roast: 'light', tick: 9 },
    ],
  },

  // ---- The side door, with your cat. ----
  {
    id: 'door-warm',
    name: 'Warm milk',
    ladder: 'door',
    tier: 'tutorial',
    brief: 'The side door goes against the right-hand wall, and the milkman brings a pail through it every loop. Warm it in a kettle.',
    board: ['T . . . .'],
    pieces: { belt: null, kettle: 1, door: 1 },
    wants: [{ kind: 'warmMilk' }],
    milkPails: 1,
  },
  {
    id: 'door-knock',
    name: 'One pail too many',
    ladder: 'door',
    tier: 'teaser',
    brief: 'Two pails come through the door, one a tick, and the tray wants a single cup of warm milk.',
    board: ['W . . . . . .', '. . . . . . .', 'T . . . . . D'],
    pieces: { belt: null, kettle: 1 },
    wants: [{ kind: 'warmMilk' }],
    milkPails: 2,
  },
  {
    id: 'door-three',
    name: 'Three from one kettle',
    ladder: 'door',
    tier: 'mastery',
    brief: 'The kettle is fixed in place. Dark coffee, then warm milk, then warm milk, one a tick.',
    board: ['# # W . . .', 'T K< . . . D', '# # . . . .'],
    pieces: { belt: null, plot: 1, chute: 1 },
    wants: [
      { kind: 'coffee', roast: 'dark', tick: 9 },
      { kind: 'warmMilk', tick: 10 },
      { kind: 'warmMilk', tick: 11 },
    ],
    milkPails: 2,
  },

  // ---- Mixers, with the innkeeper. ----
  {
    id: 'mixer-aulait',
    name: 'Café au lait',
    ladder: 'mixer',
    tier: 'tutorial',
    brief: 'A mixer needs coffee and milk landing on the same tick. Meet the pail.',
    board: ['. . . . . T', 'W . . . . .', '. . . . . D'],
    pieces: { belt: null, plot: 1, kettle: 1, mixer: 1 },
    wants: [{ kind: 'auLait', roast: 'medium' }],
    milkPails: 1,
  },
  {
    id: 'mixer-latte',
    name: 'A latte for the mayor',
    ladder: 'mixer',
    tier: 'teaser',
    brief: 'A dark latte as the loop turns over: the espresso and the pail meet at the mixer.',
    board: ['W . . . . .', '. . . . . D', 'T . . . . .'],
    pieces: { belt: null, plot: 1, roaster: 1, kettle: 1, mixer: 1 },
    wants: [{ kind: 'latte', roast: 'dark', tick: 0 }],
    milkPails: 1,
  },
  {
    id: 'mixer-two',
    name: 'Two from one mixer',
    ladder: 'mixer',
    tier: 'mastery',
    brief: 'Two pails, one kettle, one mixer: a café au lait, and a latte the tick after.',
    board: ['. . . . . . .', '. . . . . . .', '. . W . . . D', '. . . . . T .'],
    pieces: { belt: null, plot: 2, roaster: 1, kettle: 1, mixer: 1 },
    wants: [
      { kind: 'auLait', roast: 'medium', tick: 8 },
      { kind: 'latte', roast: 'dark', tick: 9 },
    ],
    milkPails: 2,
  },

  // ---- Splitters, with the innkeeper. ----
  {
    id: 'splitter-each',
    name: 'One each way',
    ladder: 'splitter',
    tier: 'tutorial',
    brief: 'A splitter hands what lands on it to each of its outputs in turn. One pail cold, one warm.',
    board: ['. . . . .', 'T . . . .', '. . . . D'],
    pieces: { belt: null, kettle: 1, splitter: 1 },
    wants: [{ kind: 'milk' }, { kind: 'warmMilk' }],
    milkPails: 2,
  },
  {
    id: 'splitter-wcw',
    name: 'Warm, cold, warm',
    ladder: 'splitter',
    tier: 'teaser',
    brief: 'Three pails: warm, cold, warm, one a tick.',
    board: ['T . . . . .', '. . . . . D'],
    pieces: { belt: null, kettle: 1, splitter: 1 },
    wants: [
      { kind: 'warmMilk', tick: 0 },
      { kind: 'milk', tick: 1 },
      { kind: 'warmMilk', tick: 2 },
    ],
    milkPails: 3,
  },
  {
    id: 'splitter-corner',
    name: 'The milk corner',
    ladder: 'splitter',
    tier: 'mastery',
    brief: 'Three pails, three drinks, one tray: a café au lait, warm milk, then a latte, one a tick.',
    board: ['. . . . . . . . D', '. . . T . . . . .', '. . W . . . . . .', '. . . . . . . . .'],
    pieces: { belt: null, plot: 2, roaster: 1, kettle: 3, mixer: 1, splitter: 1 },
    wants: [
      { kind: 'auLait', roast: 'medium', tick: 0 },
      { kind: 'warmMilk', tick: 1 },
      { kind: 'latte', roast: 'dark', tick: 2 },
    ],
    milkPails: 3,
  },
];
