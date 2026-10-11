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
`src/sim/step.ts`, test in `tests/sim/backDoor.test.ts`. *Superseded by ADDENDUM-01: there is one side door, and `milkPails` replaced `canPayMilk` (Q42).*

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
`src/sim/step.ts`; new `SimState.blocked` field. *Superseded: with no grace a fussy regular is only ever at the counter on their own tick (Q61); the check stands.*

**Q7. The cat's window crosses tick 0.** "Waits there for 3 ticks" with grace
3 means, by the grace rule, the cat is at the bowl on ticks 10, 11, 0 and 1.
"Refuses the bowl for the rest of that loop" would then end at tick 11 and
let it drink again on tick 0. *Assumed:* the refusal lasts for the rest of
that visit (through tick 1). Plain milk only makes the cat bolt while it is
at the bowl; at any other time it just spills. Same `blocked` field; test in
`tests/sim/bowl.test.ts`. *Superseded: the cat is at the bowl on tick 10 only (Q61).*

**Q8. Windows wrap at the very start.** A visit that crosses tick 0 (the
gargoyle's 11 to 2, the cat's 10 to 1) is treated as periodic from T = 0, so
on the first tick of a new game such a regular already counts as present,
partway through a visit. This keeps every layout exactly periodic.
`visitOffset` in `src/sim/state.ts`. *Superseded: with no grace, no timed visit crosses tick 0 (Q61).*

**Q9. When does an any-tick regular's loop start?** "They take the first
matching cup to pass their stool each loop". *Assumed:* the loop is clock
ticks 0 to 11. Their visit resets on tick 0, and at the end of tick 11 an
unserved seated regular goes to waiting. `visitOffset` in
`src/sim/state.ts`. *Superseded by ADDENDUM-01: any-tick regulars no longer reset on tick 0; they wait ANY_TICK_WAIT ticks after each cup.*

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
read as its full price, so a walk-in pays 3. `src/game/tuning.ts`. *Superseded by ADDENDUM-01: the shelf and walk-ins are gone, and warm milk has no price.*

**Q15. Shelf staleness counting.** *Assumed:* a cup shelved on tick T can be
bought on ticks T to T+5 and spills on T+6. *Superseded by ADDENDUM-01: the shelf is gone.*

**Q16. The till is not a tile.** "Pre-placed, cannot be removed" reads like a
floor piece, but nothing else places it. *Assumed:* it lives in the side
panel. The bowl is a real tile at row 5, column 11. *Superseded by ADDENDUM-01: the bowl is at row 3, column 9.*

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
10 or 11. Proven by the fixtures in `src/levels/layouts.ts`. *Superseded by ADDENDUM-01: stool columns and ticks come from the ladder table.*

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
when the layout or the seats change. `src/game/strip.ts`, `src/ui/strip.ts`. *Superseded by ADDENDUM-01: the strip also shows each stool's slot (Q51).* *Superseded: the strip is drawn in the stool band on the floor canvas, with Just in Time, served (any tick) and missed (Q61, Q63).*

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
number of ticks played. *Superseded by ADDENDUM-01: the walk-in generator is gone.*

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
- nothing passes the fussy alchemist's tile on tick 5. *Superseded by ADDENDUM-01: stool columns come from the ladder table.*

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
Just in Time and the rest within grace. *Superseded by ADDENDUM-01: that layout broke under the feeder rule (Q48); the new one is in Q54.*

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
`src/game/save.ts`. *Superseded by ADDENDUM-01: there is no shelf to save.*

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

## Addendum 1: the feeder belt and slots

**Q37. Where is the visuals canvas?** The brief describes it as `canvas.json`
and `*.dc.html` artboards. Neither exists anywhere in the repo. What arrived is
`docs/Tick Tock Coffee Shop visuals.html` (a single bundled export) and a PDF
render beside it. *Assumed:* those two files are the canvas; CLAUDE.md points
at them. Palette and look only, never rules.

**Q38. Where does an item aimed at the counter by anything but the feeder
spill?** "Spills, as it would at a wall". *Assumed:* on its source tile, as a
wall spill does. `aim` and `feedsCounter` in `src/sim/step.ts`.

**Q39. What runs off the end of the counter.** "An item that runs off the end
still raises the `end` event". *Assumed:* unchanged from before: a drink raises
`end`, anything else raises `spill`. The game counts both as spills, and the
renderer splashes both. `src/sim/step.ts`, `Shop.tick`.

**Q40. Splitter edge cases.** *Assumed:* a chute launch whose direction faces
the splitter is not an output, since it "points at the splitter" (its item
would jump over it anyway). The cat's bowl is an output: it takes items like a
machine. The counter never is: it takes items from the feeder only. The count
restarts at the start of the tick whose clock reads 0, so an item leaving on
tick 0 goes to the first output. An item that spills for want of an output is
not counted. `splitterOutputs` and the move step in `src/sim/step.ts`.

**Q41. Where a spring keeps its items.** In `SimState.springs`, one place per
tick of delay, never in `belts`. An empty spring is stored as nothing, so
equal floors compare equal for steady state. `src/sim/step.ts`.

**Q42. Paying for the milk order.** *Assumed:* each pail is decided on its own
tick. If the till cannot cover it, that pail and the rest of the loop's order
do not come, even if coins arrive later in the loop. The order counts milk
drinkers who have walked in (the cat, the innkeeper, the mayor), in `?debug`
too. `Shop.milkPails` in `src/game/shop.ts`. Offline progress lets the door
deliver as many pails of the order as the till could pay for when you left.

**Q43. When an any-tick regular starts waiting.** "Once 24 ticks have passed
since their last cup". *Assumed:* at the end of the first tick T with
T - lastCup >= 24 (`ANY_TICK_WAITING` in `src/game/tuning.ts`). The simulator
records `lastServedAt` for every seat; only any-tick seats use it.

**Q44. Steady state with the new state.** The any-tick wait only asks whether
ANY_TICK_WAIT ticks have passed, so the state key caps each seat's age there
(exactly equivalent). Splitter counts are left out of the key: states are only
compared on tick 0, where the counts restart. `stateKey` in `src/sim/steady.ts`.

**Q45. "The same drink" for any-tick seating.** *Assumed:* the same drink and
roast, since a regular only takes their own roast. The lamplighter (medium)
sits right of the clockmaker and the postwoman; the sweep (dark) right of the
gargoyle. `tests/levels/slots.test.ts`. *Superseded: no regular on the ladder takes any tick now (Q64).*

**Q46. The cat's `col`.** `RegularDef` needs one, and the ladder table says "at
its bowl". *Assumed:* the bowl's column, 9. Nothing reads it.

**Q47. Saves from before the addendum.** Their layouts have no feeder and the
bowl at row 5, column 11. *Assumed:* the loader refuses them and a new shop
starts; the save version stays 1. Persistence was only changed so it still
compiles and validates the new pieces. `src/game/save.ts`.

**Q48. Fixtures broken by the addendum.** CLAUDE.md treats a broken fixture as
a finding. Every step 1 to 5 reference layout breaks under the addendum:
- the side door: the cat, innkeeper, mayor and all-twelve layouts all used a
  back door on the left wall;
- counter intake: every other layout (lamplighter, sweep, clockmaker, gargoyle,
  all-four, postwoman, baker, apothecary, witch, alchemist) put its cups on the
  counter away from column 0, never through a feeder.
The addendum replaces them. Its layout for places 1 to 4 is the fixture for
all four, and the milk corner is the fixture for the order. Step 5 rebuilt
the rest (Q53 to Q55).

**Q49. Intro lines.** The clockmaker's and the mayor's intros named their old
ticks. *Changed:* "ninth" and "eleventh". Text only.

**Q50. What the ghost says over the feeder.** *Assumed:* "The feeder is fixed"
for a piece or a paste that would land on it, and for any change to column 0.

**Q51. How slots are shown.** Feeder and counter tiles show the slot passing
over them on the tick just run, which is the tick the clock shows (Q22). Under
each stool: "slot N", or "any·N" for an any-tick regular, with N the slot of
the last cup they actually took. The strip reads "t9 s9", or "any s7" with
the any-tick slot from steady state.

## The rest of the ladder under addendum 1 (step 5 again)

**Q52. The milk corner only works once all three milk drinkers are in.**
*Finding.* The addendum's splitter has two outputs, down then left, so the
first pail of every loop goes down to the mixer. At place 10 the order is one
pail (the cat alone), so that pail meets nothing at the mixer and spills, and
the cat is never served. In play the innkeeper would then never walk in. With
two or three pails it works as drawn, and it passes as a fixture for the full
order (Q48). The all-twelve layout (Q54) avoids the trap: its splitter has
three outputs and the first, north, is the cat's. *Not changed:* the rule and
the corner stand as written. If the corner is meant to be built at place 10,
the splitter's first output has to be the cat's.

**Q53. One reference layout per regular.** The coverage test from step 5 asks
for one per regular plus one for all twelve, and it stands unchanged. Places 1
to 4 each have a single line taken from the addendum's layout. Places 5 to 12
each have their own layout, and every one fits the starting six rows with
every cup Just in Time. No regular needed more rows, so there is no "nearest
slot" to log. `src/levels/layouts.ts`.

**Q54. The all-twelve layout.** It needs 12 rows (6 bought) and serves all
twelve every loop. Ten are Just in Time; the any-tick lamplighter and sweep
take slots 7 and 1. Every cup rides in its ladder slot, so no two cups ever
meet on the feeder. The only spill is well C's spare bucket, which lands in a
roaster. Built at the start of a `?debug` shop, it seats all twelve strictly
in order in play while the milk order grows from one pail to three
(`tests/game/ladder.test.ts`). It settles within 5 loops from an empty floor,
not 3. Its shape:
- rows 0 to 4: the addendum's layout for places 1 to 4, unchanged;
- the side door and a three-output splitter by the bowl. Pail 1 goes north
  to the cat's kettle. Pails 2 and 3 climb columns 6 and 7, cross the row 5
  corridor by chute, and merge with pail 3 two ticks behind;
- row 5: a corridor west into the feeder. Well B's kettles (top right) drop
  the apothecary's, baker's and postwoman's cups into it, and the witch's
  espresso comes down column 11;
- top left: well C feeds the innkeeper's kettle and two roasters. One mixer
  makes both milk drinks: coffee meets pail 2 on tick 6 (au lait, slot 8)
  and espresso meets pail 3 on tick 8 (latte, slot 10).
It was laid out with a throwaway routing script (not in the repo) that fills
in belt and spring runs of an exact length between hand-placed machines.

**Q55. Steps 5 and 6 were already built.** This brief treats step 5 as not yet
done and says to stop before step 6, but both were committed before the
addendum. Step 5 was redone under the addendum as above. Step 6 (save and
load, offline loyalty, the morning report) was only touched so it compiles
and validates the new pieces (Q47). Nothing was added to it.

## Art pass (step 7, art only)

**Q56. How much of step 7.** Spec 7 puts art, sound and the submission page
in step 7; the request was an art pass. *Done:* the art. Sound and the
submission page are not started.

**Q57. Where the sprites come from.** The visuals canvas is a bundled export.
Its art is plain SVG on a 60-unit tile with a wobbly ink line, so the pass
reuses it rather than tracing it: belts, well, plot stages, kettle, mixer,
door, items and four portraits are the canvas's own shapes and colours.
Sprites are SVG strings (`src/ui/art/svg.ts`, `portraits.ts`) rasterised once
per size at the screen's pixel density (`raster.ts`). The floor stays a
Canvas 2D and the renderer still reads only state and events.

**Q58. Things the canvas does not draw.** It predates the addendum, so these
are new, drawn in its style:
- the feeder and counter: one fixed belt, gold-trimmed with gold chevrons, so
  it never reads as a belt you laid (the addendum asks for its own colour);
- the spring (a brass coil), the splitter (a hub with an arrow on every
  side), the chute (a ramp and a funnel, with a dashed hop between), the
  roaster, the bowl and the cat;
- the side door: the canvas's back door, set against the right-hand wall;
- espresso beans, espresso, warm milk and café au lait. A latte became a tall
  layered glass and an au lait a wide bowl, so the three cups differ by shape
  as well as by colour;
- portraits for the lamplighter, sweep, postwoman, apothecary, alchemist,
  innkeeper, mayor and the cat.
*Not used:* the canvas's trunk row, shelf, left-wall back door, the
traveller and the milkman (not regulars), and its text (the clockmaker on
"tick 5", the witch's "first latte"). None of it is a rule.

**Q59. What the sprites show.** A plot shows bare soil, a sprout, a bush, then
ripe cherries as it grows (thresholds on `GROWTH`). A kettle's needle points
to the clock tick its last input landed on, inside the dial's roast windows,
which is the Spec 4 readout. A roaster's window shows beans while it holds a
batch. Machines show a spout on the side they put out on. Spills show the
canvas's splash in the spilled item's colour.

**Q60. Fonts.** The canvas uses Caveat Brush and Patrick Hand; their Latin
files are copied from the canvas export into `src/ui/art/fonts/` rather than
loaded from Google at run time. Both are under the SIL Open Font License,
which asks for the licence to travel with the fonts. The official OFL files
are in `public/licenses/` (copied into the build) and linked from the Keys
card. Fonts are assets, not dependencies; nothing was added to package.json.

## Design changes from play-testing

**Q61. Grace is gone.** *Your decision, from play-testing:* grace was
distracting and did not lead towards the final solutions. A timed regular,
the cat included, is at the counter (or the bowl) on their own tick only and
takes the right cup only if it is in front of them then. That is always Just
in Time, so a timed regular always pays the price plus the bonus. Any-tick
regulars are unchanged and pay the plain price. This overrides Rules 5 (the
grace period and its plain price), the `grace` field in Spec 3 and in the
addendum's ladder table, Spec 5's grace column, and the cat's three ticks at
the bowl in Rules 5. The gargoyle's intro no longer promises three more
ticks. Every reference layout already served its timed regulars Just in
Time, so none changed. `visitOffset` in `src/sim/state.ts`; the strip now
reads Just in Time, served (any tick) or missed.

**Q62. Newcomers wait for everyone to be happy.** *Your decision, from
play-testing:* a lucky cup (a later newcomer served by a downstream any-tick
line) brought newcomers before the current puzzle was solved, twice in a row.
Now a regular is *happy* after `HAPPY_LOOPS` (3, from "2 to 3 full cycles")
full loops in a row in which they had their cup. A loop without one starts the
count again. The next regular walks in only at the end of a loop in which
every regular already in the shop is happy, and their own count starts on the
next, full loop. This replaces Rules 5's "the next one does not appear until
the one before has received at least one cup". *Seated* and *waiting* still
mean what they did. The panel's "next regular" is now the newest regular who
is not yet happy, with a meter of pips. *Assumed:* happiness is not saved
(the save format is unchanged), so after a load everyone earns it again
before the next newcomer. `Shop.tick` in `src/game/shop.ts`.

**Q63. One screen at 1080p.** *Your request:* no page scrolling at 1080p, a
bigger floor, the till bottom left, the build palette bottom middle, panels on
the right with tabs for less frequent things, and the clock top right.
*Done as:*
- the page is a full-window grid that never scrolls. The floor canvas fills
  the top left; the till card and the build palette (one row of ten pieces,
  with buy a row, undo, redo, messages and hover text) run along the bottom;
  the right column holds the clock with its controls, the newest regular,
  then tabs: Regulars, Happenings, Keys and Shop (the cat's card and "Start a
  new shop"). Only a tab's own content scrolls;
- the floor is sized to show all its rows, so a new six-row shop is drawn
  large and zooms out as rows are bought. From the thirteenth row the size
  stops shrinking and a camera moves over the back room: right-drag or
  middle-drag, or the mouse wheel. A right-click that does not move still puts
  down what is in hand, and Ctrl+wheel still steps the paste buffer. Hints
  at the edges count the rows out of view, and a slim bar beside the floor
  shows where the camera is;
- the counter, its wooden edge and the stools stay pinned at the bottom
  while the back room moves. The counter strip moved into the stool band:
  each stool shows its regular's portrait (dimmed when they are not at the
  counter), the tick and slot they want, the strip's verdict and cup, and
  their happiness pips. Hovering a stool gives the strip's full reading.
At 1920 by 960 (a 1080p screen less the browser's bars) the twelve-row
all-twelve layout fits with no camera movement. `src/ui/geometry.ts`,
`src/ui/input.ts`, `src/ui/main.ts`.

**Q64. No any-tick regulars on the ladder.** *Your decision, from
play-testing:* adapting a design late, when the floor is boxed in, to an
any-tick regular whose cup was taken by a newcomer was more annoying than
early flexibility was worth. The lamplighter and the sweep now want set ticks,
in the two open slots their usual lines already land on:
- the lamplighter: medium coffee on tick 11 at stool 4, slot 7. That is the
  plainest first line: well, plot, kettle and one belt into feeder row 0;
- the sweep: dark coffee on tick 0 at stool 11, slot 1.
Slot 3 is now the only slot nobody wants. Both are served Just in Time like
everyone else, so they pay the bonus too. Their intros name their ticks. This
overrides Spec 5's "any tick" and Rules 5's first two regulars, and the
addendum's "Free; 7 expected" and "1 or 3 expected". Every reference layout
already put their cups in those slots, so none changed. The simulator and
the game still support `tick: 'any'` (its rule tests stand); no regular
uses it. `src/levels/regulars.ts`.

**Q65. The spring unlocks after the chimney sweep.** *Your decision:* the
spring now comes with the clockmaker (place 3), the regular straight after
the sweep, instead of with the postwoman (place 5). Read "after the chimney
sweep" the way the addendum's "straight after the gargoyle" meant place 5.
The postwoman still brings the second well. No reference layout changed: a
layout may only use pieces unlocked by its place, and the spring is now
available earlier, never later. `src/levels/regulars.ts`.

**Q66. A splitter's round and the tick-0 restart.** *Finding, from your save:*
splitters work as the addendum says. Each item goes to the next output
clockwise from the top, counting every item since tick 0, and the round
restarts on tick 0. In your layout pails 2 and 3 reach the second splitter on
ticks 11 and 0, either side of the restart. So in the first loop both go north;
from then on pail 3 restarts the round on tick 0 (north) and pail 2, on tick
11, is that round's second item (west). For a fixed split, items that should
share a round must pass the splitter within one loop of the clock. *Added:* the
floor marks each splitter's sides (yellow for outputs, green for where the next
item goes, red where the item on it would spill), and hovering one names its
outputs in order, how many items passed since tick 0, and where the next goes.
`splitterNext` and `canTake` in `src/sim/step.ts` give the renderer the
simulator's own answer.

**Q67. Hotkeys and tooltips.** *Your request, on the tooltips-and-helpers
branch:* number keys pick from the build palette, locked pieces show as a
question mark, unlocked pieces have a tooltip with their rules, and every
drink a regular orders is underlined with a tooltip that shows how it is made
in pictures. *Done as:*
- keys 1 to 9 pick the first nine palette pieces in order and 0 the tenth.
  The palette shows each piece's key. Picking a locked piece, by key or by
  click, is refused with a message and leaves the hand as it was;
  `Editor.pick` now checks, where before only a disabled button did;
- a locked piece is only a "?" and its key. Its button is no longer disabled,
  so it still gets hover (a short "not unlocked yet" tooltip) and a click
  says why nothing happens;
- an unlocked piece has a small "i" mark. Hovering the piece shows its price,
  its key, what it makes as pictures (plot, kettle, roaster, mixer), and its
  rules from Rules 3 and 4 and the addendum. Every number in the words comes
  from the tuning files;
- the drink in the newest regular's card and in the Regulars tab has a dotted
  underline. Its tooltip reads inputs + machine = drink. Where the roast
  depends on time, a small clock shows only the ticks the input must land on:
  a light coffee is beans + (ticks 0 to 3) + kettle.
*Assumed:* your latte example read "dark espresso bean + milk + mixer = dark
latte", but a mixer takes espresso, not espresso beans (Rules 4, Mixer), so
the first line reads dark espresso + milk + mixer. Below it come the steps
that make each ingredient that is itself made: dark espresso beans + kettle =
dark espresso, then beans + (ticks 6 to 9) + roaster = dark espresso beans.
Water, beans and milk end the chain. The roaster's clock shows the ticks
beans land on, as the kettle's does; 6 to 9 is what 9 to 12 ticks inside
before the release on tick 6 comes to. The stools on the floor are drawn on
the canvas and keep their hover text, with no underline. The recipes are
checked against the simulator on every tick of the clock
(`tests/game/recipes.test.ts`). `src/game/recipes.ts`, `src/ui/tips.ts`,
`src/ui/tooltip.ts`, `src/ui/hotkeys.ts`.

**Q68. Sharing a shop by link.** *Your request, on the share-solution branch:*
name your shop and make a share link under the Shop tab; a player who is
behind the shared shop is warned of spoilers and may go on anyway; the shared
shop plays but never overwrites the player's save and is never saved; a button
returns to their own shop at any time; the link shows rows bought, solution
cost and regulars happy. *Done as:*
- the link carries the shop in its fragment (`#name=...&floor=...`), since the
  site has no backend: the shop and cat names, regulars walked in, till,
  gears, and the floor at one character a tile. Not carried: loyalty,
  statuses (everyone starts seated) and happiness, which is earned again, as
  after a load (Q62). The shop name is kept in the save; older saves have none;
- *assumed, solution cost:* every piece on the floor at its price, plus every
  row bought at the row price. It is what the floor costs to build from
  scratch, with full refunds (Spec 4) making it the same however you got there;
- *assumed, regulars happy:* regulars the floor serves on every loop of its
  steady state, with the whole milk order paid for, as the counter strip
  reads it. Not the live count in the till card, which starts again from 0 on
  every load, so a link made just after a load would undersell the floor.
  Both sides count from the floor itself;
- *assumed, behind:* fewer regulars walked in than the shared shop, or as many
  and fewer of them happy in steady state. A player with no save counts as a
  new shop. The warning names no regulars and shows nothing of the floor;
- *assumed, the embed:* a static page cannot give each link its own preview
  card, since chat apps read one `index.html` for every link. So the three
  numbers are written near the start of the link itself
  (`happy=12-of-12&rows=6&cost=982`), and "Copy with scores" copies them as a
  sentence before the link. Opening a link ignores the numbers it claims and
  counts again;
- a visit can be played and built on, with the sharer's till; "Start a new
  shop" is not offered there. `writeSave` refuses a visiting shop as well, so
  no path can write one over the player's save (`tests/ui/storage.test.ts`).
  "Back to my shop" drops the link and reopens the page, so the visit counts
  as time away for the morning report. Opening the link again opens the
  shared shop again.
`src/game/share.ts`, `src/ui/share.ts`, `src/ui/main.ts`, `src/ui/storage.ts`.

