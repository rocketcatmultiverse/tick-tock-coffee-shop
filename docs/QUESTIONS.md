# Questions and assumptions

Where the spec was ambiguous, contradictory or looked wrong, the most literal
reading was taken, written down here, and the build carried on. Each entry
gives the question, what was assumed, and where it lives in the code.

## Housekeeping

**Q0. Where is the spec?** CLAUDE.md points at `docs/SPEC.md`, but the file was
at the repo root. *Assumed:* moved it to `docs/SPEC.md` unchanged.

**Q1. Steady-state detection is built too late in the build order.** Spec 7
puts it in step 6 (persistence), but Spec 6's whole-system tests and the
step-3 counter strip ("what is on the counter ... in steady state") both need
it. *Assumed:* built in step 1. `src/sim/steady.ts`.

## Simulator (Rules 1 to 5)

**Q2. Several back doors and `canPayMilk`.** Each door is charged for its own
pail, but `canPayMilk` is one boolean, so "the till covers one pail but not
two" has no answer. *Assumed:* `canPayMilk` may also be a number, the count of
pails the till can cover; doors are paid in tile-index order and the rest
deliver nothing. `StepOpts` in `src/sim/types.ts`, `doorPaid` in
`src/sim/step.ts`, test in `tests/sim/backDoor.test.ts`.

**Q3. Three or more items reaching a mixer on one tick.** Only "two
ingredients" and "anything alone, and any other pair" are covered.
*Assumed:* the mixer takes the highest-priority milk pail and the
highest-priority espresso or coffee (belt beats machine, then N, E, S, W) and
spills everything else. `takeIn`, case `mixer`, in `src/sim/step.ts`.

**Q4. A kettle hit by two items when only one is usable.** "If two inputs land
on one tick it takes one by the clockwise rule". *Assumed:* "inputs" means
items the kettle can use, so water landing beside beans does not block the
beans; it spills. The full priority (belt beats machine first) picks among
usable inputs. `takeIn`, case `kettle`.

**Q5. Chute tie.** A chute item counts as "a belt item coming from the launch's
side", but the tile between launch and catch can also be a belt pointing into
the catch from that same side, so the two tie. *Assumed:* the chute item
wins. `byPriority` in `src/sim/step.ts`, test in `tests/sim/chute.test.ts`.

**Q6. What does a fussy regular check, and when?** Rules 2 says "the tile was
empty the tick before"; Rules 5 says "on the tick before their own". They
differ for a fussy regular with grace. *Assumed:* the check happens once,
when they arrive on their own tick, against what the tile held at the end
of the tick before (after any cup taken there was removed). If it was busy,
they refuse the right cup for the whole visit. Seats arriving block in
`src/sim/step.ts`; new `SimState.blocked` field.

**Q7. The cat's window crosses tick 0.** "Waits there for 3 ticks" with grace
3 means, by the grace rule, the cat is at the bowl on ticks 10, 11, 0 and 1.
"Refuses the bowl for the rest of that loop" would then end at tick 11 and
let it drink again on tick 0. *Assumed:* the refusal lasts for the rest of
that visit (through tick 1). Plain milk only makes the cat bolt while it is
at the bowl; at any other time it just spills. Same `blocked` field; test in
`tests/sim/bowl.test.ts`.

**Q8. Windows wrap at the very start.** A visit that crosses tick 0 (the
gargoyle's 11 to 2, the cat's 10 to 1) is treated as periodic from T = 0, so
on the first tick of a new game such a regular already counts as present,
partway through a visit. This keeps every layout exactly periodic.
`visitOffset` in `src/sim/state.ts`.

**Q9. When does an any-tick regular's loop start?** "They take the first
matching cup to pass their stool each loop". *Assumed:* the loop is clock
ticks 0 to 11. Their visit resets on tick 0, and at the end of tick 11 an
unserved seated regular goes to waiting. `visitOffset` in
`src/sim/state.ts`.

**Q10. The data model needed a few more pieces.** `SimState.blocked` (per seat,
for fussy refusals and the bolted cat). Events: `water` (a plot started
growing), `brew` now carries the clock tick its input landed on (the kettle
readout needs it), `roast`, `release`, `mix`, `refuse`, `bolt`, and an `at`
tile on `serve`. `RegularDef` lives in `src/sim/types.ts` so that
`src/levels/` can import it as a type.

**Q11. Open Questions vs Rules 3 on right of way.** Open Questions says "north
wins everywhere", but Rules 3 lists "belt beats machine" first and explains
that a machine putting out onto the counter loses to the passing cup.
*Assumed:* Rules 3 wins, so a machine to the north loses to a belt item from
any side. Test in `tests/sim/priority.test.ts`.

**Q12. Items stranded by a live edit.** Live building can leave an item on a
tile that is no longer a belt. *Assumed:* `adaptState` drops it when the
layout changes, so the simulator never sees one. If one does slip through,
`step` spills it. `src/sim/state.ts`.

## Game layer

**Q13. Do new and waiting regulars pay?** *Assumed:* yes. A regular's first cup
pays the normal price, and so does the cup that re-seats a waiting regular.
"They stop paying" is read as "while there are no cups".

**Q14. Half price of an odd price.** A coffee is 5. *Assumed:* walk-ins pay half,
rounded down (2 for a coffee). Warm milk's 6 "sold from the shelf only" is
read as its full price, so a walk-in pays 3. `src/game/tuning.ts`.

**Q15. Shelf staleness counting.** *Assumed:* a cup shelved on tick T can be
bought on ticks T to T+5 and spills on T+6.

**Q16. The till is not a tile.** "Pre-placed, cannot be removed" reads like a
floor piece, but nothing else places it. *Assumed:* it lives in the side
panel. The bowl is a real tile at row 5, column 11.

**Q17. Teaching notes for regulars 2 and 4.** With one well and one plot per
cup, each of regulars 1 to 4 needs their own line. So regular 2 is the first
"second line onto the counter", not regular 4 as the table says. Nothing to
change in the rules. It is a note for the fun check.
