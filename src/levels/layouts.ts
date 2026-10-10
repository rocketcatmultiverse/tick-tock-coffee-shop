// Reference layouts: saved solutions that the headless simulator must keep
// serving. They are fixtures: tests/levels/referenceLayouts.test.ts runs each
// one and checks every regular it names is served every loop. A rule change
// that breaks one is a finding to report, not something to patch around.
//
// Text format: see src/sim/text.ts. First line is the back row, last line is
// row 0, next to the counter. F is the feeder down column 0 and B the cat's
// bowl at row 3, column 9, both pre-placed by the shop.
//
// Slot equations (docs/ADDENDUM-01.md): a cup that lands on feeder row r on
// tick t rides in slot t + r + 1; a regular on stool s with slot k sees it on
// tick k + s.
//
// The step 1 to 5 layouts joined the counter wherever they liked. Under the
// addendum every cup reaches the counter by the feeder, so they were
// replaced; see docs/QUESTIONS.md (Q48).

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

const E = 'F . . . . . . . . . . .';
const B = 'F . . . . . . . . B . .'; // row 3, with the bowl

export const REFERENCE_LAYOUTS: ReferenceLayout[] = [
  // Places 1 to 4: one line each from the addendum's layout, then all four together.
  {
    // South plot: beans land on 4 (medium), join row 0, slot 7; the lamplighter on stool 4 takes it on 11.
    id: 'lamplighter',
    serves: ['lamplighter'],
    justInTime: [],
    boughtRows: 0,
    rows: [E, E, B, E, 'F . . W . . . . . . . .', 'F < K< P< . . . . . . . .'],
  },
  {
    // North plot: beans land on 8 (dark), join row 3, slot 1; the sweep on stool 11 takes it on 0.
    id: 'sweep',
    serves: ['sweep'],
    justInTime: [],
    boughtRows: 0,
    rows: [E, E, 'F K< < < < . . . . B . .', 'F . . P> ^ . . . . . . .', 'F . . W . . . . . . . .', E],
  },
  {
    // West plot: beans land on 4 (medium), join row 2, slot 9: the clockmaker on stool 0, tick 9.
    id: 'clockmaker',
    serves: ['clockmaker'],
    justInTime: ['clockmaker'],
    boughtRows: 0,
    rows: [E, E, B, 'F < . . . . . . . . . .', 'F K^ P< W . . . . . . . .', E],
  },
  {
    // East plot: beans land on 11 (dark), join row 4, slot 5: the gargoyle on stool 6, tick 11.
    id: 'gargoyle',
    serves: ['gargoyle'],
    justInTime: ['gargoyle'],
    boughtRows: 0,
    rows: [E, 'F K< < < < < . . . . . .', 'F . . . . ^ . . . B . .', 'F . . . . ^ . . . . . .', 'F . . W P> ^ . . . . . .', E],
  },
  {
    // The addendum's layout for places 1 to 4: one well, one line per side.
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

  // Places 5 to 12, one each.
  {
    // Beans land on 4 (medium); six belts after the kettle bring the cup onto the counter in slot 0.
    id: 'postwoman',
    serves: ['postwoman'],
    justInTime: ['postwoman'],
    boughtRows: 0,
    rows: [E, E, B, E, E, 'F < < < < < < K< P< W . .'],
  },
  {
    // Two springs carry the beans past tick 12: light. Joins row 2, slot 4.
    id: 'baker',
    serves: ['baker'],
    justInTime: ['baker'],
    boughtRows: 0,
    rows: [E, E, B, 'F K< S< S< P< W . . . . . .', E, E],
  },
  {
    // As the baker's line, two rows higher: slot 6.
    id: 'apothecary',
    serves: ['apothecary'],
    justInTime: ['apothecary'],
    boughtRows: 0,
    rows: [E, 'F K< S< S< P< W . . . . . .', B, E, E, E],
  },
  {
    // Beans reach the roaster on 10: eight ticks inside, medium. Espresso on 7, a spring and two belts: slot 2.
    id: 'witch',
    serves: ['witch'],
    justInTime: ['witch'],
    boughtRows: 0,
    rows: [E, E, B, E, E, 'F < < S< K< R< < < S< P< W .'],
  },
  {
    // Beans reach the roaster on 6, just missing the release: twelve ticks inside, dark. Slot 11.
    id: 'alchemist',
    serves: ['alchemist'],
    justInTime: ['alchemist'],
    boughtRows: 0,
    rows: [E, E, B, E, E, 'F < < < K< R< < < P< W . .'],
  },
  {
    // The one pail lands on 7, rides a belt, warms in the kettle on 9 and reaches the bowl on 10.
    id: 'cat',
    serves: ['cat'],
    justInTime: ['cat'],
    boughtRows: 0,
    rows: [E, E, 'F . . . . . . . . B < .', 'F . . . . . . . . . K^ .', 'F . . . . . . . . . ^ D', E],
  },
  {
    // Medium coffee and the first pail meet at the mixer on 7; nine belts and the feeder: slot 8.
    id: 'innkeeper',
    serves: ['innkeeper'],
    justInTime: ['innkeeper'],
    boughtRows: 0,
    rows: [
      'F . . . . . . . W P> Kv .',
      'F . . . . . . . . . v .',
      'F . . . . . . . . B v .',
      'F < < < < < < < < < M< D',
      E,
      E,
    ],
  },
  {
    // Dark espresso (twelve ticks in the roaster) and the first pail meet at the mixer on 7: slot 10.
    id: 'mayor',
    serves: ['mayor'],
    justInTime: ['mayor'],
    boughtRows: 0,
    rows: ['F . . . . W P> > > R> Kv .', 'F < < < < < < < < < M< D', B, E, E, E],
  },
  {
    // The addendum's milk corner for places 10 to 12. The splitter sends the
    // three pails of the order down, left, down:
    //   first  -> meets medium coffee at the mixer on tick 1 -> café au lait in slot 8 -> the innkeeper, tick 4
    //   second -> the kettle under the bowl -> warm milk -> your cat, tick 10
    //   third  -> meets dark espresso at the mixer on tick 3 -> latte in slot 10 -> the mayor, tick 11
    // Row 1 carries on as belt to the feeder. Spare buckets from the two wells spill.
    // It works once all three milk drinkers are in; with the cat alone the one
    // pail goes down to the mixer, not to the cat (docs/QUESTIONS.md, Q52).
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

  {
    // All twelve on twelve rows. Every cup rides in its own slot, so cups
    // never meet on the feeder or the corridor.
    //   Rows 0 to 4, left: the layout for places 1 to 4, unchanged.
    //   Right of the bowl: the side door and a splitter whose first output, north,
    //     is the cat's kettle, so the cat is served from the first pail of any order.
    //     Its second and third outputs send pails 2 and 3 up columns 6 and 7, over the
    //     corridor by chute, and into one shared path, pail 3 two ticks behind.
    //   Row 5: a corridor west into the feeder. Well B's kettles (top right) drop the
    //     apothecary's, baker's and postwoman's cups straight into it, and the witch's
    //     espresso comes down column 11.
    //   Top left: well C feeds the innkeeper's kettle, the mayor's roaster and the
    //     alchemist's roaster. Coffee and pail 2 meet at the mixer on 6 (au lait, slot 8);
    //     espresso and pail 3 on 8 (latte, slot 10). The alchemist's espresso joins feeder row 6.
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
    justInTime: ['clockmaker', 'gargoyle', 'postwoman', 'baker', 'apothecary', 'witch', 'alchemist', 'cat', 'innkeeper', 'mayor'],
    boughtRows: 6,
    settlesWithin: 5,
    rows: [
      'F < M< S< < < < . . P> S> v',
      'F . ^ K< P< . ^ v P< W Pv v',
      'F . K^ R< W Pv ^ > v Pv v Rv',
      'F . . S^ P< Sv ^ . Sv Sv v Kv',
      'F v < v K< R< ^ < Sv Sv v v',
      'F S< ^ < . . C^ C^ Kv Kv Kv v',
      'F < < < < < < < < < < <',
      'F K< < < < < L^ L^ . . . .',
      'F K< < < < ^ ^ S^ < B K< .',
      'F < . P> ^ ^ ^ < ^ < ^ .',
      'F K^ P< W P> ^ . ^ < ^ Y D',
      'F < K< P< . . . . ^ < < .',
    ],
  },
];
