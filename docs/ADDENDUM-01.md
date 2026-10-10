# Tick Tock Coffee Shop: addendum 1, the feeder belt and slots

Exported from the working doc at revision 41, 2026-10-10.

## What changes

One fixed belt down the left wall becomes the only way onto the counter, and every regular wants a different place on it. This comes from the step 4 playtest: the shop was fun, but no single "solution belt" could serve everyone.

1. **The feeder.** A pre-placed belt fills the left column and carries cups onto the counter. Nothing else can put a cup there.
2. **Slots.** A cup on the feeder or the counter rides in one of 12 numbered slots. The player can see the numbers.
3. **The ladder.** Every counter regular wants a different slot, so one full feeder can serve all eleven.
4. **Any-tick regulars.** After a cup, they wait 12 ticks before taking another.
5. **The spring.** A new one-tile piece that delays an item by 3 ticks more than a belt. It unlocks straight after the gargoyle.
6. **The splitter.** A new one-tile piece that hands items to its outputs in turn.
7. **The side door.** The back door becomes one side door on the right-hand wall. The milkman delivers a standing order through it: one pail a tick, one pail for each milk drinker.
8. **The cat's bowl** moves to row 3, column 9. The cat stays the one regular who is not served by the feeder.
9. **The shelf is gone**, and walk-ins with it. A cup nobody takes spills at the end of the counter.

The point is to teach one skill early: build a single belt whose outputs arrive in a set order. Array builds will lean on that skill later.

This addendum overrides `docs/SPEC.md` wherever the two differ. Everything it does not name stands as written. Items marked *proposed* are my choices and are open to change.

## The feeder and the counter

The counter now has exactly one way in: the feeder, a fixed belt in column 0 that runs down the left wall and onto the counter's first tile.

```
row 5   v  .  .  .        v  feeder: fixed, flows toward the counter
row 4   v  .  .  .        .  back room: 11 columns the player builds on
 ...    v  .  .  .        >  counter: fixed, flows right
row 0   v  .  .  .
counter >  >  >  >  ...  >  end: an untaken item spills
        0  1  2  3       11
```

- **Where it is.** The feeder fills column 0 of every back-room row and flows toward the counter. Its bottom tile hands each item to counter column 0.
- **Fixed.** It is pre-placed and free. It cannot be moved, turned, selected, cut, deleted or built over. Buying a row adds one feeder tile at the top.
- **Joining it.** For the belt rules a feeder tile is an ordinary belt tile. It takes items from the feeder tile above and from the tile to its east, which can be a belt or a machine's output. It carries any item, not only drinks.
- **Right of way.** An item already on the feeder beats one joining from the side, and the joining item spills. This needs no new rule: north comes before east, and belt beats machine.
- **The only way in.** The counter accepts an item on column 0 only, and from the feeder only. Anything else aimed at a counter tile spills, as it would at a wall.
- **How it looks.** The feeder and the counter are drawn as one continuous belt in their own colour, clearly unlike the belts the player lays. In the gray box that means a flat colour, direction marks and the slot numbers below.
- **Build area.** The player builds on columns 1 to 11.

This replaces two things in the spec. In Rules 1, the counter is no longer "fed from above only, by a belt or straight from a machine's output". In Rules 3, the paragraph about a cup joining from above knocking off a passing cup no longer applies.

## Slots

A slot is the tick on which a cup steps onto the counter, numbered 0 to 11, and a cup keeps its slot for the whole ride.

```
on the counter, column k:   slot = (tick - k) mod 12
on the feeder, row r:       slot = (tick + r + 1) mod 12
a regular's slot:           slot = (their tick - their stool column) mod 12
```

- **Just in Time** means the cup rides in exactly the regular's slot. Grace `g` means they also accept a cup up to `g` slots later, at the plain price.
- **One cup per slot.** Two regulars who want the same slot can never both be served Just in Time. That is why no single belt could work before, and why the ladder below gives every regular a slot of their own.
- **The timing equations get simpler.** The join column `c` is always 0, and `b3` now counts feeder tiles too. A line that joins the feeder at row `r` rides `r + 1` feeder tiles.

```
t_kettle = b1 + G + b2
slot     = (t_kettle + 1 + b3) mod 12
t_serve  = slot + s
```

**What the player sees**

- Every feeder and counter tile shows the number of the slot passing over it, and the numbers move with the belt.
- Every stool shows the slot its regular wants. The counter strip shows it beside the tick.
- An any-tick regular's stool shows "any", then the slot they last took a cup from.

One naming change: the spec used "slot" for a regular's position in the queue, as in "your cat as slot 10". That is now a *place*. *Slot* means only the 12 positions on the belt.

## Any-tick regulars

The lamplighter and the chimney sweep now take one cup and then nothing for the next 12 ticks.

- **The rule.** An any-tick regular is at the counter all the time. They take the first matching cup to reach their stool, at the plain price. For the 12 ticks after that they let every cup pass. A cup that arrives exactly 12 ticks later is taken.
- **What it does.** On a steady belt they lock onto one slot and take that cup every loop. If that cup stops coming, they take the next matching cup and lock onto its slot instead.
- **Where they sit.** Each sits to the right of every timed regular who drinks the same thing. Timed regulars take their cups first, and the any-tick regular gets what is left. If a new timed regular starts taking the cup they were living on, they move to the next matching cup by themselves.
- **Waiting.** An any-tick regular counts as waiting once 24 ticks have passed since their last cup (*proposed*).

This replaces the Rules 5 line that they "take the first matching cup to pass their stool each loop". That reset on tick 0, so a regular could take a cup on tick 11 and another on tick 0.

## The ladder

Every counter regular now has a stool column, and no two timed regulars want the same slot. Only two ticks change from the spec: the clockmaker moves from tick 5 to tick 9, and the mayor from tick 7 to tick 11. All of this table is *proposed*.

| Place | Regular | Drink | When | Stool column | Slot |
| --- | --- | --- | --- | --- | --- |
| 1 | The lamplighter | Medium coffee | Any tick | 4 | Free; 7 expected |
| 2 | The chimney sweep | Dark coffee | Any tick | 11 | Free; 1 or 3 expected |
| 3 | The clockmaker | Medium coffee | Tick 9, grace 2 | 0 | 9 |
| 4 | The gargoyle | Dark coffee | Tick 11, grace 3 | 6 | 5 |
| 5 | The postwoman | Medium coffee | Tick 3, grace 2 | 3 | 0 |
| 6 | The baker | Light coffee | Tick 1, grace 2 | 9 | 4 |
| 7 | The apothecary | Light coffee | Tick 8, grace 2 | 2 | 6 |
| 8 | The witch | Medium espresso | Tick 0, grace 3 | 10 | 2 |
| 9 | The alchemist | Dark espresso; fussy | Tick 6, grace 0 | 7 | 11 |
| 10 | Your cat | Warm milk | Tick 10, grace 3 | At its bowl | Not on the counter |
| 11 | The innkeeper | Medium café au lait | Tick 4, grace 2 | 8 | 8 |
| 12 | The mayor | Dark latte | Tick 11, grace 1 | 1 | 10 |

The counter from left to right:

```
column  0    1    2    3    4    5    6    7    8    9    10   11
stool   Clo  May  Apo  Pos  Lam  .    Gar  Alc  Inn  Bak  Wit  Swe
slot    9    10   6    0    any  .    5    11   8    4    2    any
```

**Why these slots**

- **Three slots are unassigned:** 1, 3 and 7. The lamplighter's and the sweep's cups settle into two of them, and one stays empty.
- **Short lines.** Each timed regular's slot is 2 to 7 ticks after the earliest slot their drink can reach, shown in the next table.
- **Well-mates share odd or even.** Without a chute or a spring, every route from one well to the counter is the same length, odd or even. A detour moves a cup by 2 slots, never by 1. So all four cups from a well land on odd slots, or all on even ones.
    - Well 1 serves places 1 to 4 on odd slots: 9 and 5, plus the free 1, 3 and 7.
    - Well 2 serves places 5 to 7 on even slots: 0, 4 and 6.
    - The other drinks pass through a roaster or a mixer, which restarts the count.
    - From place 5 the spring can shift any line by 3, so the rule stops binding.
- **The milk drinks.** The innkeeper's slot 8 and the mayor's slot 10 sit two apart. They match the first and third pails of the milk order, which a splitter sends down one belt to one mixer. The cat gets the pail between.
- **The fussy alchemist.** Slot 10, just ahead of his slot 11, is the mayor's, and the mayor sits to his left. That cup is gone before it reaches him. Until the mayor arrives, the player has to keep slot 10 empty.

| Drink | Earliest slot | The shortest line |
| --- | --- | --- |
| Medium coffee | 6 | Well, plot and kettle side by side, next to the feeder in row 0 |
| Café au lait or latte | 6 | The first pail, on tick 7, into a mixer beside the side door, then straight along row 0 |
| Espresso, any roast | 8 | The roaster releases on tick 6 into a kettle next to the feeder |
| Dark coffee | 10 | As medium, with 4 belt tiles or one spring before the kettle |
| Light coffee | 2 | As medium, with 8 belt tiles or two springs before the kettle |

Joining the feeder one row higher adds 1 to the slot. So does each later pail of the milk order.

**What has been checked**

- Checked by script: the slots are all different, and each of the two layouts below works on its own, every loop.
- Not checked: all twelve places together on one floor. Step 5 still owes places 5 to 12 a reference layout each.

**A layout for places 1 to 4**

```
        0   1   2   3   4   5
row 5   v   .   .   .   .   .
row 4   v   K<  <   <   <   <
row 3   v   K<  <   <   <   ^
row 2   v   <   .   P>  ^   ^
row 1   v   K^  P<  W   P>  ^
row 0   v   <   K<  P<  .   .

v feeder   W well   P plot   K kettle   < ^ belts
The mark after P or K is the way it puts out.
```

| Line | Beans land | Joins the feeder | Slot | Taken by |
| --- | --- | --- | --- | --- |
| South plot | Tick 4, medium | Row 0 | 7 | The lamplighter, tick 11 |
| West plot | Tick 4, medium | Row 2 | 9 | The clockmaker, tick 9, Just in Time |
| North plot | Tick 8, dark | Row 3 | 1 | The chimney sweep, tick 0 |
| East plot | Tick 11, dark | Row 4 | 5 | The gargoyle, tick 11, Just in Time |

**A milk corner for places 10 to 12**

```
        4   5   6   7   8   9   10  11
row 5   .   Pv  <   <   <   W   .   .
row 4   .   Kv  .   .   .   .   .   .
row 3   .   Sv  .   .   .   B   .   .
row 2   .   v   .   .   .   K^  Y   D
row 1   <   M<  <   <   <   <   <   W
row 0   .   S^  S<  K<  R<  <   <   P<

D side door   Y splitter   M mixer   S spring   R roaster   B the cat's bowl
Row 1 carries on as belt to the feeder. Spare buckets from the two wells spill.
```

| Pail | Leaves the splitter | Meets | Becomes | Taken by |
| --- | --- | --- | --- | --- |
| First | Down, onto row 1 | Medium coffee at the mixer, tick 1 | Café au lait in slot 8 | The innkeeper, tick 4, Just in Time |
| Second | Left, toward the bowl | The kettle under the bowl, fed straight from the splitter | Warm milk | Your cat, tick 10, on the dot |
| Third | Down, onto row 1 | Dark espresso at the mixer, tick 3 | Latte in slot 10 | The mayor, tick 11, Just in Time |

The splitter here has two outputs, down and left, so the pails go down, left, down.

## The spring

The spring is a one-tile delay: an item takes 4 ticks to cross it instead of a belt's 1, so it comes out 3 ticks later.

- **What it is.** A belt-shaped piece with one direction. An item that lands on it on tick `t` lands on the next tile on tick `t + 4`.
- **It never blocks.** It holds up to four items at once, one for each tick of the delay, and they leave in the order they came. Joining it follows the belt rules.
- **Why 3.** A detour already shifts a line by 2. A shift of 3 is odd, so a spring with one detour fewer moves a cup by exactly 1. This is why the crossing takes 4 ticks: a tile that took 3 would shift by 2, which a detour already does.
- **What it saves.** One spring between plot and kettle turns medium into dark. Two turn it into light, where a belt needs 8 tiles.
- **In the equations** a spring counts as 4 belt tiles.
- **Unlock and price.** It unlocks when place 5 walks in, straight after the gargoyle, and costs 8 coins (*proposed*).

## The splitter

The splitter is a one-tile piece that hands each item to the next of its outputs in turn.

- **Outputs.** Every neighbouring piece that can take an item is an output: a belt, a spring, either end of a chute, the feeder or a machine. So it has 1 to 3. Two things are not: a piece that points at the splitter, and a machine that puts out into it. Wells and the side door take nothing, so they never count. Nor does another splitter: put a belt between two. With no output, the item spills.
- **Inputs.** It takes items as a belt tile does: one a tick, from any belt or machine aimed at it, by the usual priority rules.
- **Round robin.** The first item goes to the first output clockwise from the top, the next item to the next output, and so on round (*proposed* order).
- **A fresh round each loop.** The count restarts on tick 0. Every loop then plays out the same, whatever was built or removed in the one before (*proposed*).
- **Timing.** It costs one tick, as a belt tile does. An item that lands on it on tick `t` lands on its output on tick `t + 1`.
- **Unlock and price.** It unlocks when place 11 walks in, alongside the mixer, because that is when the milk order grows to two pails. It costs 15 coins (*proposed*).

This replaces the Rules 3 line that there is no splitter in the gray box.

## The side door and the milk order

The back door becomes a single side door on the right-hand wall, and the milkman delivers a standing order through it.

- **The side door.** There is only one. It goes in column 11, against the right-hand wall, and faces left. It still unlocks when the cat starts asking for milk.
- **The order.** Every loop the milkman drops `N` pails onto the tile the door faces, one a tick, starting on tick 7 (*proposed*). With `N = 3` they land on ticks 7, 8 and 9.
- **How N grows.** `N` is the number of milk drinkers who have walked in: 1 for the cat, 2 with the innkeeper, 3 with the mayor. The player does not set it.
- **Paying.** Each pail costs 2 coins on delivery, used or not. If the till cannot cover a pail, that pail and the rest of that loop's order do not come (*proposed*).
- **Sharing the pails.** Belts cannot split, so the splitter does it. Milk that reaches a mixer alone still spills, as in the spec.
- **What it teaches.** The order arrives as a train, one pail a tick, and each pail has to be met on its own tick. The milk corner above shows it.

This replaces the back door rules in Rules 4, including "you can place more than one door".

## The cat's bowl, the shelf and other knock-ons

The bowl moves next to the milk, and the shelf goes.

- **The cat's bowl.** It is pre-placed at row 3, column 9, and still cannot be moved or removed. The cat stays the one exception to the feeder: its warm milk is delivered in the back room.
- **No shelf.** An item that reaches the end of the counter spills and adds to the spill count. Walk-ins go with the shelf, since buying shelf cups was all they did. Warm milk no longer has a price.
- **No randomness in play.** The seeded generator for walk-ins is no longer needed. The cat's moods stay random and cosmetic.
- **Unlock table.** Place 5 now unlocks the spring as well as the second well, and place 11 the splitter as well as the mixer. The cat asking for milk unlocks the side door. "Slot 10" there reads "place 10".
- **Teaching notes.** Spec 5's notes hold with "counter" read as "feeder". Place 3 now teaches the slot: the clockmaker's cup must ride in slot 9. Place 5 adds the spring. Place 9 teaches keeping slot 10 empty. Place 10 teaches the order.
- **Visuals canvas.** It still draws a separate trunk row and a shelf. It needs the feeder, the spring, the splitter and the side door before step 7.

## Changes for the build

Apply this before step 5, tests first. Steps 1 to 3 are already built, so each item below edits working code.

**Simulator**

- **Feeder.** Add the `feeder` structure. `step()` treats it as a belt that faces the counter.
- **Counter.** It takes an item on column 0 only, from the feeder tile in row 0 only. Any other item aimed at a counter tile spills. An item that runs off the end still raises the `end` event, and the game counts it as a spill.
- **Any-tick seats.** One takes a matching cup only if it has never been served, or its last cup was at least `ANY_TICK_WAIT` ticks ago.
- **Spring.** Add the `spring` structure. An item that lands on it is aimed at the next tile `SPRING_TICKS` ticks later.
- **Splitter.** Add the `splitter` structure. An item that lands on it is aimed, one tick later, at the next of its outputs, taken clockwise from the top. The count restarts on tick 0.
- **Side door.** On each of the ticks `MILK_TICK` to `MILK_TICK + milkPails - 1` it puts one pail on the tile it faces. `milkPails` replaces `canPayMilk` in the options.
- **Tuning.** `ANY_TICK_WAIT = 12`, `SPRING_TICKS = 4` and `MILK_TICK = 7` live in `src/sim/tuning.ts`. The prices of the spring and the splitter live in `src/game/tuning.ts`.
- **Removed.** The shelf, walk-ins, their seeded generator and the price of warm milk.
- Timed seats and the mixer are unchanged.

**Data model**

```ts
type Structure =
  // ...the pieces in Spec 3, plus:
  | { kind: 'feeder' }             // column 0 only, pre-placed in every row, flows toward the counter, cannot be removed
  | { kind: 'spring'; dir: Dir }   // an item crosses it in SPRING_TICKS ticks instead of 1
  | { kind: 'splitter' }           // hands each item to the next of its outputs (any neighbour that takes items), clockwise from the top
  | { kind: 'door' };              // the side door: column 11 only, faces left, at most one

interface Seat {
  // ...
  tick: number | 'any';            // 'any' = takes the first matching cup, then nothing for ANY_TICK_WAIT ticks
}

interface SimState {
  // ...
  lastServedAt: (number | null)[];           // per seat: T of their last cup; drives the any-tick wait
  springs: Record<number, (Item | null)[]>;  // by tile index: the items inside, one place per tick of delay
  splitters: Record<number, number>;         // by tile index: items passed since tick 0; picks the next output
}

declare function step(
  layout: Layout,
  state: SimState,
  opts: { seats: Seat[]; milkPails: number }  // pails the side door delivers this loop; the game layer works it out
): { next: SimState; events: SimEvent[] };

// (tick - col) mod 12. Derived wherever it is needed, never stored.
declare function slotOf(tick: number, col: number): number;
```

- A new layout has a feeder tile in column 0 of every row and the cat's bowl at row 3, column 9. Buying a row adds one feeder tile. Feeder tiles cost nothing and refund nothing.

**Tests, one file per rule**

- **Feeder.** An item on the feeder in row 0 is on counter column 0 one tick later. An item joins from the east. An item coming down the feeder beats one joining from the east, belt or machine.
- **Counter intake.** An item aimed at any counter tile by anything but the feeder spills.
- **Counter belt.** This replaces the old test. A cup that steps onto column 0 on tick `e` is in front of column `s` on tick `e + s`. Untaken, it runs off the end on tick `e + 12` and spills.
- **Any-tick.** They take the first matching cup. A matching cup 1 to 11 ticks later passes. One exactly 12 ticks later is taken. After a gap they take the next matching cup on any tick.
- **Spring.** An item that lands on a spring on tick `t` is on the next tile on tick `t + 4`. Items that enter on consecutive ticks leave on consecutive ticks, in order. Swapping one belt tile for a spring moves a cup 3 slots later.
- **Side door.** With an order of `N`, pails land on ticks 7 to `7 + N - 1` and on no others. Fewer `milkPails` deliver only that many. A door outside column 11, or a second door, is refused.
- **Splitter.** With three output belts, three items in a row leave by the top one first, then clockwise. With two outputs they alternate. With one it acts as a turn. With none the item spills. A belt that points at the splitter is never an output. A machine or a chute launch beside it is an output, unless it puts out into the splitter. Another splitter is not. The round restarts on tick 0.
- **Mixer.** Unchanged: milk alone still spills.
- **Slots.** Over the ladder data: all timed regulars' slots differ. The slot before a fussy regular's is unassigned, or owned by a regular seated to their left. Each any-tick regular sits to the right of every timed regular with the same drink.
- **Timing property test.** Drop `c`. Random `b1`, `b2`, `b3`, join row and `s` must give the predicted roast, slot and serve tick, with each spring counted as 4 belt tiles.
- **Fixed pieces.** The feeder cannot be selected, cut, deleted or pasted over. Buying a row adds a feeder tile.
- **Removed.** The shelf and walk-in tests.

**Levels**

- Replace the stool columns and ticks with the ladder table. This overrides the columns picked earlier for places 1 to 4.
- The layout for places 1 to 4 becomes their reference fixture: four serves a loop, two of them Just in Time, no spills.
- The milk corner becomes a fixture for the order: the cat, the innkeeper and the mayor are each served on their own tick. Spare buckets from its two wells spill, which is fine.
- Places 5 to 12 get reference layouts in step 5, as planned. If no layout can be found for one of them on 8 rows or fewer (*proposed*), do not bend a rule. Log it in `docs/QUESTIONS.md` with the nearest slot that does work.

**Screen**

- Draw the feeder and the counter as one belt in its own colour, with the slot number on every tile, updated each tick.
- Show the wanted slot on every stool and in the counter strip. An any-tick stool shows "any", then the slot it last took from.
- Show the milk order in the side panel: how many pails, and from which tick.
- Refuse building or pasting on column 0, a door outside column 11, and a second door. The ghost says why.
- Add the feeder to the fixed pieces in Spec 4, and the spring and the splitter to the palette.
- Remove the shelf from the screen.

## Decisions still open

Everything below is settled. Numbers still marked proposed elsewhere are tuning values and live in the tuning files.

- [x] **Feeder length.** The whole left column, growing with every row bought.
- [x] **Side door and bowl.** One side door on the right-hand wall, and the bowl at row 3, column 9.
- [x] **Odd and even.** The spring goes in now.
- [x] **Splitting the milk order.** A splitter piece shares the pails out, round robin over its output belts.
- [x] **The splitter's numbers.** Outputs are any neighbour that takes items, such as belts, springs, chutes and machines, but not another splitter. They are taken clockwise from the top. The round restarts on tick 0. Unlocked at place 11, for 15 coins.
- [x] **The spring's numbers.** Four ticks to cross, so the shift is 3. Unlocked at place 5, for 8 coins.
- [x] **The ladder numbers.** The clockmaker on tick 9 and the mayor on tick 11. The lamplighter in column 4 and the sweep in column 11.
- [x] **Walk-ins.** They went with the shelf. Say so if you want them kept in some other form.

Not in this addendum: bulk orders and the trap door, the cellar, and multiplayer. They are still brainstorm only.
