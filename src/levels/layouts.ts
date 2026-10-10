// Reference layouts: saved solutions that the headless simulator must keep
// serving. They are fixtures: tests/levels/referenceLayouts.test.ts runs each
// one and checks every regular it names is served every loop. A rule change
// that breaks one is a finding to report, not something to patch around.
//
// Text format: see src/sim/text.ts. First line is the back row, last line is
// row 0, next to the counter. F is the feeder down column 0 and B the cat's
// bowl at row 3, column 9, both pre-placed by the shop.
//
// The step 1 to 5 layouts joined the counter wherever they liked. Under
// docs/ADDENDUM-01.md every cup reaches the counter by the feeder, so they
// were replaced; see docs/QUESTIONS.md.

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
    // The addendum's layout for places 1 to 4: one well, one line per side.
    //   south plot -> beans land tick 4, medium, join row 0, slot 7 -> the lamplighter, tick 11
    //   west plot  -> beans land tick 4, medium, join row 2, slot 9 -> the clockmaker, tick 9, Just in Time
    //   north plot -> beans land tick 8, dark,   join row 3, slot 1 -> the chimney sweep, tick 0
    //   east plot  -> beans land tick 11, dark,  join row 4, slot 5 -> the gargoyle, tick 11, Just in Time
    id: 'all-four',
    serves: ['lamplighter', 'sweep', 'clockmaker', 'gargoyle'],
    justInTime: ['clockmaker', 'gargoyle'],
    boughtRows: 0,
    rows: [
      'F . . . . . . . . . . .',
      'F K< < < < < . . . . . .',
      'F K< < < < ^ . . . B . .',
      'F < . P> ^ ^ . . . . . .',
      'F K^ P< W P> ^ . . . . . .',
      'F < K< P< . . . . . . . .',
    ],
  },
  {
    // The addendum's milk corner for places 10 to 12. The splitter sends the
    // three pails of the order down, left, down:
    //   first  -> meets medium coffee at the mixer on tick 1 -> café au lait in slot 8 -> the innkeeper, tick 4
    //   second -> the kettle under the bowl -> warm milk -> your cat, tick 10
    //   third  -> meets dark espresso at the mixer on tick 3 -> latte in slot 10 -> the mayor, tick 11
    // Row 1 carries on as belt to the feeder. Spare buckets from the two wells spill.
    id: 'milk-corner',
    serves: ['cat', 'innkeeper', 'mayor'],
    justInTime: ['cat', 'innkeeper', 'mayor'],
    boughtRows: 0,
    rows: [
      'F . . . . Pv < < < W . .',
      'F . . . . Kv . . . . . .',
      'F . . . . Sv . . . B . .',
      'F . . . . v . . . K^ Y D',
      'F < < < < M< < < < < < W',
      'F . . . . S^ S< K< R< < < P<',
    ],
  },
];
