// Reference layouts: one solution per regular, one that serves regulars 1 to 4,
// and one that serves all twelve at once.
// They are fixtures: tests/levels/referenceLayouts.test.ts runs each one
// headless and checks the regular is served every loop. A rule change that
// breaks one is a finding to report, not something to patch around.
//
// Text format: see src/sim/text.ts. First line is the back row, last line is
// row 0, next to the counter. B is the cat's bowl, pre-placed at row 5.
//
// The all-four layout: all four lines share the one well at row 2, column 5 (one regular per side):
//   west  -> lamplighter  medium, joins column 3 on tick 7
//   east  -> sweep        dark,   joins column 8 on tick 10, at column 9 on tick 11
//   south -> clockmaker   medium, straight onto column 5 on tick 5 (Just in Time)
//   north -> gargoyle     dark,   a long run over the top, at column 11 on tick 11 (Just in Time)

export interface ReferenceLayout {
  id: string;
  /** Regular ids this layout must serve every loop. */
  serves: string[];
  /** Of those, the ones it serves Just in Time every loop. */
  justInTime: string[];
  /** Floor rows bought beyond the starting six. */
  boughtRows: number;
  /** Loops from an empty floor before the cycle starts; 3 unless stated. */
  settlesWithin?: number;
  rows: string[];
}

export const REFERENCE_LAYOUTS: ReferenceLayout[] = [
  {
    id: 'lamplighter',
    serves: ['lamplighter'],
    justInTime: [],
    boughtRows: 0,
    rows: [
      '. . . . . . . . . . . B',
      '. . . . . . . . . . . .',
      '. . . . . . . . . . . .',
      '. . . Kv P< W . . . . . .',
      '. . . v . . . . . . . .',
      '. . . v . . . . . . . .',
    ],
  },
  {
    id: 'sweep',
    serves: ['sweep'],
    justInTime: [],
    boughtRows: 0,
    rows: [
      '. . . . . . . . . . . B',
      '. . . . . . . . . . . .',
      '. . . . . . . . . . . .',
      '. . . . . W > > P> v . .',
      '. . . . . . . . Kv < . .',
      '. . . . . . . . v . . .',
    ],
  },
  {
    id: 'clockmaker',
    serves: ['clockmaker'],
    justInTime: ['clockmaker'],
    boughtRows: 0,
    rows: [
      '. . . . . . . . . . . B',
      '. . . . . . . . . . . .',
      '. . . . . . . . . . . .',
      '. . . . . W . . . . . .',
      '. . . . . Pv . . . . . .',
      '. . . . . Kv . . . . . .',
    ],
  },
  {
    id: 'gargoyle',
    serves: ['gargoyle'],
    justInTime: ['gargoyle'],
    boughtRows: 0,
    rows: [
      '. . . . > v . . . . . B',
      '. . > K> ^ > > > > > v .',
      '. . ^ < < P< . . . . v .',
      '. . . . . W . . . . v .',
      '. . . . . . . . . . v .',
      '. . . . . . . . . . v .',
    ],
  },
  {
    id: 'all-four',
    serves: ['lamplighter', 'sweep', 'clockmaker', 'gargoyle'],
    justInTime: ['clockmaker', 'gargoyle'],
    boughtRows: 0,
    rows: [
      '. . . . > v . . . . . B',
      '. . > K> ^ > > > > > v .',
      '. . ^ < < P< . . . . v .',
      '. . . Kv P< W > > P> v v .',
      '. . . v . Pv . . Kv < v .',
      '. . . v . Kv . . v . v .',
    ],
  },
  {
    // Medium needs no delay before the kettle; ten belts after it bring the cup to tick 3.
    id: 'postwoman',
    serves: ['postwoman'],
    justInTime: ['postwoman'],
    boughtRows: 2,
    rows: [
      '. . . W . . . . . . . .',
      '. . Kv P< . . . . . . . .',
      '. . v . . . . . . . . B',
      '. . > v . . . . . . . .',
      '. . v < . . . . . . . .',
      '. . v . . . . . . . . .',
      '. . > v . . . . . . . .',
      '. . v < . . . . . . . .',
    ],
  },
  {
    // Light: eight belts carry the beans past tick 12; the kettle sits on the counter.
    id: 'baker',
    serves: ['baker'],
    justInTime: ['baker'],
    boughtRows: 1,
    rows: [
      '. . . . . . . . W . . .',
      '. . . . . . . . Pv . . B',
      '. . . . . . . . > v . .',
      '. . . . . . . . v < . .',
      '. . . . . . . . v . . .',
      '. . . . . . . . > v . .',
      '. . . . . . . . Kv < . .',
    ],
  },
  {
    id: 'apothecary',
    serves: ['apothecary'],
    justInTime: ['apothecary'],
    boughtRows: 5,
    rows: [
      '. . . . . . . . W . . .',
      '. . . . . . . v P< . . .',
      '. . . . . . . v . . . .',
      '. . . . . . . > v . . .',
      '. . . . . . . v < . . .',
      '. . . . . . . v . . . B',
      '. . . . . . . > Kv . . .',
      '. . . . . . . v < . . .',
      '. . . . . . . v . . . .',
      '. . . . . . . > v . . .',
      '. . . . . . . v < . . .',
    ],
  },
  {
    // Beans reach the roaster on tick 10 and sit 8 ticks: medium. Released on 6, served on 0.
    id: 'witch',
    serves: ['witch'],
    justInTime: ['witch'],
    boughtRows: 3,
    rows: [
      '. . . . W . . . . . . .',
      '. . . . P> v . . . . . .',
      '. . . . v < . . . . . .',
      '. . . . v . . . . . . B',
      '. . . . > v . . . . . .',
      '. . . . Kv R< . . . . . .',
      '. . . . v . . . . . . .',
      '. . . . > v . . . . . .',
      '. . . . v < . . . . . .',
    ],
  },
  {
    // Beans reach the roaster on tick 6, just missing the release: 12 ticks inside, dark.
    id: 'alchemist',
    serves: ['alchemist'],
    justInTime: ['alchemist'],
    boughtRows: 5,
    rows: [
      '. . . . . . . . . . W .',
      '. . . . . . . . . . Pv .',
      '. . . . . . . . . . v .',
      '. . . . . . . . . Rv < .',
      '. . . . . . . . . K> v .',
      '. . . . . . . . . . v B',
      '. . . . . . . . . v < .',
      '. . . . . . . . . > v .',
      '. . . . . . . . . . v .',
      '. . . . . . . . . v < .',
      '. . . . . . . . . > v .',
    ],
  },
  {
    // The pail arrives on tick 7, warms on 8, and a bump makes the walk to the bowl 14 belts: tick 10.
    id: 'cat',
    serves: ['cat'],
    justInTime: ['cat'],
    boughtRows: 0,
    rows: [
      '. . . . . . . . . . . B',
      '. . . . . . . . . . . ^',
      '. . . . > v . . . . . ^',
      'D K> > > ^ > > > > > > ^',
      '. . . . . . . . . . . .',
      '. . . . . . . . . . . .',
    ],
  },
  {
    // Coffee lands in the kettle on 6 and reaches the mixer on 7 with the pail. Joins column 1, rides to 6.
    id: 'innkeeper',
    serves: ['innkeeper'],
    justInTime: ['innkeeper'],
    boughtRows: 0,
    rows: [
      '. v P< < W . . . . . . B',
      '. Kv . . . . . . . . . .',
      'D Mv . . . . . . . . . .',
      '. v . . . . . . . . . .',
      '. v . . . . . . . . . .',
      '. v . . . . . . . . . .',
    ],
  },
  {
    // Roaster, kettle and mixer stacked over the door; the latte snakes 11 belts to column 1.
    id: 'mayor',
    serves: ['mayor'],
    justInTime: ['mayor'],
    boughtRows: 0,
    rows: [
      '. Rv < P< < W . . . . . B',
      '. Kv . . . . . . . . . .',
      'D M> > > v . . . . . . .',
      '. v < . v . . . . . . .',
      '. v ^ < < . . . . . . .',
      '. v . . . . . . . . . .',
    ],
  },
  {
    // All twelve. Every cup rides one bus down column 6, crosses the cat's line
    // by the chute at column 1 and joins the counter there, each on its own tick
    // of the loop, then rides to its stool. The cat's line runs along row 1.
    // Found with a search script; see docs/QUESTIONS.md (Q30).
    id: 'all-twelve',
    serves: [
      'lamplighter',
      'sweep',
      'clockmaker',
      'gargoyle',
      'postwoman',
      'baker',
      'apothecary',
      'witch',
      'alchemist',
      'cat',
      'innkeeper',
      'mayor',
    ],
    justInTime: ['clockmaker', 'baker', 'alchemist', 'innkeeper', 'mayor'],
    boughtRows: 18,
    settlesWithin: 5,
    rows: [
      '. > > v . > v . . . . .',
      '. ^ v < > ^ v . . . . .',
      '. ^ > > ^ K> v . . . . .',
      '. ^ < < > ^ v . . . . .',
      '. . P> K^ ^ < v . . . . .',
      'Pv < W P> v ^ v . . . . .',
      'v . P> v > ^ v . . . . .',
      '> Rv . > v . v < < . . .',
      '. Kv . . > K> v > ^ . . .',
      'D M> > > > > v ^ < < v <',
      '. > > v . . v < . ^ K< ^',
      '. ^ . v . . v ^ v K< P< ^',
      '. ^ P< R> Kv . v ^ < Pv W P^',
      '. . W Pv v . v . v K< Pv .',
      '. v P< v > > v . v . > v',
      '. v . v . > v < < . . v',
      '. Kv . > R> K^ v < . . v <',
      'D M> > > > > v ^ . . v .',
      '. . . . . . v ^ . v < B',
      '. . . . . . v ^ < K< . ^',
      '. v < < < < < . . . . ^',
      '. Lv . . . . . . . . . ^',
      'D K> > > > > > > > > v ^',
      '. Cv . . . . . . . . > ^',
    ],
  },
];
