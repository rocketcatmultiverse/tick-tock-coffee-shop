// Reference layouts: one solution per regular, plus one that serves all four.
// They are fixtures: tests/levels/referenceLayouts.test.ts runs each one
// headless and checks the regular is served every loop. A rule change that
// breaks one is a finding to report, not something to patch around.
//
// Text format: see src/sim/text.ts. First line is the back row (row 5), last
// line is row 0, next to the counter. B is the cat's bowl, pre-placed.
//
// All four lines share the one well at row 2, column 5 (one regular per side):
//   west  -> lamplighter  medium, joins column 3 on tick 7
//   east  -> sweep        dark,   joins column 8 on tick 10, at column 9 on tick 11
//   south -> clockmaker   medium, straight onto column 5 on tick 5 (Just in Time)
//   north -> gargoyle     dark,   a long run over the top, at column 11 on tick 11 (Just in Time)

export interface ReferenceLayout {
  id: string;
  /** Regular ids this layout must serve every loop. */
  serves: string[];
  rows: string[];
}

export const REFERENCE_LAYOUTS: ReferenceLayout[] = [
  {
    id: 'lamplighter',
    serves: ['lamplighter'],
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
    rows: [
      '. . . . > v . . . . . B',
      '. . > K> ^ > > > > > v .',
      '. . ^ < < P< . . . . v .',
      '. . . Kv P< W > > P> v v .',
      '. . . v . Pv . . Kv < v .',
      '. . . v . Kv . . v . v .',
    ],
  },
];
