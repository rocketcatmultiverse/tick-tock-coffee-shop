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

## Build tools and screens (steps 2 and 3)

**Q18. Stool columns for regulars 1 to 4.** Spec 5 leaves them to the build.
*Chosen:* lamplighter 3, chimney sweep 9, clockmaker 5, gargoyle 11
(`src/levels/regulars.ts`). With one well, each regular takes one side of it.
The clockmaker's column sits right under the obvious south line, so tick 5
falls out of a well, a plot and a kettle in a column (the "aha" for serve
ticks). The gargoyle's column 11 is to the right of the sweep's 9, so a
timed dark cup cannot be stolen by the any-tick sweep if it joins at column
10 or 11. Proven by the fixtures in `src/levels/layouts.ts`.

**Q19. Cut, copy, delete and the hand.** *Assumed:* cut and copy put the new
buffer entry straight into the hand; delete only adds it to the buffer.
Ctrl+V picks the current entry up again. Ctrl+wheel picks up the current
entry first, then steps to older ones. Esc or right-click puts the hand down.
`src/ui/editor.ts`.

**Q20. Placing over things.** *Assumed:* a placement or paste never overwrites
a tile. A belt drag lays belts on empty tiles only. It turns the belts it
has just laid so they point along the drag, including the last one, which
points into whatever machine the drag ends on.

**Q21. Undo when the till cannot pay.** Undoing a delete re-buys the pieces.
*Assumed:* if the till cannot cover that, the undo is refused with a
message and stays on the stack. Undo never rewinds the clock.

**Q22. Which tick does the clock show?** The floor shows the result of the tick
just run. *Assumed:* the dial, the regulars at their stools and the cat all
read that tick (`T - 1`), not the next one.

**Q23. Counter strip details.** *Assumed:* the four readings are ● Just in
Time, ◐ within grace (also used for any-tick regulars, who always pay the
plain price), ✕ a miss, and a faint dot for a column with no stool. For an
any-tick regular the cell shows the tick their cup arrives. Steady state is
computed with every walked-in regular seated and milk always paid, and only
when the layout or the seats change. `src/game/strip.ts`, `src/ui/strip.ts`.

**Q24. Small extras.** "One tick lasts one second at normal speed" implies
other speeds, so there is a 1×/2×/4× selector. Space toggles pause and
`.` steps one tick. A "Buy floor row" button exists (Rules 1 and Rules 6
price a row at 50) but is not needed by any reference layout.

**Q25. Chutes as one piece.** *Assumed:* both ends must be back-room tiles (the
catch cannot be on the counter). Deleting, cutting or selecting either end
takes both. A layout with a lone launch or catch is refused.
`brokenChute` in `src/game/build.ts`.

**Q26. Walk-in generator.** *Assumed:* it rolls once every tick that runs, even
with an empty shelf, so the sequence depends only on the seed and the
number of ticks played.

**Q27. Debug flag.** `?debug` unlocks every piece, lifts the well limit and
starts the till at 9,999. Regulars still arrive in order.

## The rest of the ladder (step 5)

**Q28. Stool columns for regulars 5 to 12.** *Chosen:* mayor 1, postwoman 2,
witch 4, innkeeper 6, apothecary 7, baker 8, alchemist 10. Column 0 has no
stool. `src/levels/regulars.ts`. They were chosen so that, with every cup
joining the counter at column 1 and riding to its stool (the all-twelve
layout):
- no medium coffee passes the lamplighter before his own cup each loop, and
  no dark coffee passes the sweep before his;
- the two light-coffee regulars never see each other's cup inside their
  windows;
- nothing passes the fussy alchemist's tile on tick 5.

**Q29. The cat as slot 10.** *Assumed:* the cat is a regular definition with
`bowl: true`, served at the bowl instead of a stool, paying nothing. It
"walks in" (starts asking) once regular 9 is seated, through the normal
queue, and that is when the back door unlocks. Its walk is cosmetic: before
it asks it loops the back corner; once asking it waits at the bowl on ticks
10, 11, 0 and 1. Clicking it opens a card to name or pet it. Petting shows a
heart, unless it bolted from plain milk this visit (it is mad), and 30% of
the time it does not care. Both moods are cosmetic and use `Math.random` in
`src/ui/catCard.ts`. The name is kept on the shop for saving.

**Q30. The all-twelve layout.** Spec 6 asks for one layout serving all twelve.
It exists, so the gray-box ladder is solvable as written, but it took a
search script, not hand design. Its structure: every cup feeds one bus belt
down column 6. The bus crosses the cat's milk line with a single chute at
column 1 and joins the counter there. Each cup arrives on a different tick of
the loop, so cups never collide on the shared bus, and each rides to its own
stool. It uses 3 wells, 3 back doors, 2 roasters, 2 mixers and 1 chute, and
buys 18 floor rows (24 rows deep). Five of the nine timed regulars are served
Just in Time and the rest within grace.

**Q31. Fixture checks.** Each reference layout now states how many floor rows
it buys and which regulars it serves Just in Time. The test also builds it
through the normal build rules with only the pieces and wells unlocked by
that point in the ladder. The step-3 tests that meant "regulars 1 to 4" now
use the first four definitions explicitly, since the list has grown to
twelve.

## Persistence (step 6)

**Q32. What a load restores.** The save (Spec 3) holds the layout, till, gears,
cat's name and regulars, but no floor state. *Assumed:* a loaded shop starts
on tick 0 with an empty floor. Lines refill within a loop or two. The shelf
is not saved, and the walk-in generator starts again from its seed.
`src/game/save.ts`.

**Q33. When it saves.** *Assumed:* every 2 seconds while the page is open,
and when it is hidden or closed. `lastSeen` is the time of the last save.
`?debug` uses its own save slot so it never touches the real shop. A "Start
a new shop" button clears the save; the spec has no way to start over, and
play-testing needs one. `src/ui/storage.ts`, `src/ui/main.ts`.

**Q34. Milk while away.** The till does not move offline, so pails are never
charged. *Assumed:* steady state for offline progress lets as many doors
deliver as the till could have paid for when you left. `src/game/offline.ts`.

**Q35. Offline counts.** *Assumed:* each regular gains `floor(loops away ×
serves per loop)` loyalty. The clockmaker's gears use the cycle's own split
of Just in Time (2) and plain (1) cups. Regulars' statuses do not change
while away, even if the layout would serve a waiting one.

**Q36. The morning report** pauses the clock until it is dismissed, so
nothing happens unseen on the first ticks back.
