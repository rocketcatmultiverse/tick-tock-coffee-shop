# Tick Tock Coffee Shop: rules and spec

Exported from the working doc at revision 354.

## How to read this

The rules are the contract for the simulator: the same layout must give the same result every time. Anything tagged *proposed* is a detail I filled in because we had not settled it; everything else is what we agreed in conversation. Numbers in tuning tables are starting values for the gray box.

One pair of equations carries most of the game. For a single bean line:

```latex
t_{kettle} = b_1 + G + b_2
```

```latex
t_{serve} = t_{kettle} + 1 + b_3 + (s - c)
```

- `b1` is the number of belt tiles between the well and the plot, `b2` between plot and kettle, `b3` between kettle and counter.
- `G` is the plot's growth time in ticks.
- `c` is the counter column the line joins and `s` is the column of the regular's stool (0 is the far left). The line must join at or to the left of the stool.
- The roast is read from `t_kettle mod 12`. The regular is served on `t_serve mod 12`.

With two belts each side of the plot and `G = 4`, beans land on tick 8, so the cup is dark.

Worked example, left to right (this replaces the diagram in the working doc):

| Stage | Rule | Example with b1 = 2, G = 4, b2 = 2, b3 = 3, c = 8, s = 10 |
| --- | --- | --- |
| Well | Pulses on tick 0 | Tick 0 |
| Plot, after `b1` belts | Grows for `G` ticks | Watered tick 2, harvest tick 6 |
| Kettle, after `b2` belts | Reads the roast, brews 1 tick | Beans land tick 8: dark roast |
| Counter, after `b3` belts | Joined at column `c` | Joins tick 12 |
| Stool, `s - c` tiles along | The regular in column `s` takes the cup | At the stool tick 14, which is tick 2 |

Tick 14 is tick 2 of the next loop.

## Rules 1: the clock and the shop floor

The shop runs on one looping clock of 12 ticks, numbered 0 to 11, and everything else is measured against it.

- **Tick.** One tick lasts one second at normal speed. The simulator counts ticks since start as `T`; the clock reads `t = T mod 12`.
- **Floor.** The shop is a grid 12 tiles wide. From top to bottom: the back room, then the counter, with the stools on its far side.
- **Back room.** This is the factory floor. It starts 6 rows deep (*proposed*) and more rows are bought upward. Each tile holds one structure or nothing. The left wall never moves: the floor grows backwards, and may later grow to the right.
- **Counter.** The bottom row of the shop, 12 tiles wide, with a conveyor built into it that flows left to right. The belt is there from the start and cannot be removed or turned. It can be fed from above only, by a belt or straight from a machine's output, and nothing can be built below it or to the left of it.
- **End of the belt.** The shelf sits here. A drink that nobody took by the last tile has reached the counter's end and goes on the shelf.
- **Stools.** Customers sit on the far side of the counter, at most one stool per column. A regular takes their drink from the counter tile in front of their stool, on their tick or within their grace period.
- **One item per tile.** At the end of every tick each belt tile holds at most one item. Nothing queues and nothing waits.

## Rules 2: what happens in one tick

Every tick runs the same six steps in the same order, and each step is worked out from the state at its start, so the order tiles are visited in never changes the result.

1. **Emit.** Every source decides what it puts out this tick and which tile it is aimed at.
    - Wells on tick 0, one bucket to each of the four neighbours.
    - The back door on tick 7, if the till can pay.
    - Plots whose harvest is due, roasters on tick 6 if they hold a batch, and kettles and mixers whose drink is ready.
2. **Move.** Every item that was on a belt at the start of the tick is aimed one tile along its belt, or from a chute's launch to its catch two tiles along. Items emitted in step 1 do not also move this tick.
3. **Land.** Each aimed item arrives, depending on what its target tile is.
    - A belt accepts exactly one item. If several are aimed at it, the priority rules in Rules 3 pick the winner and the rest spill.
    - A machine receives everything aimed at it and applies its intake rule in step 4.
    - An item moving off the right-hand end of the counter belt is held for step 5.
    - Bare floor or a wall spills the item.
4. **Machines take in.** Plots start growing, kettles record the roast from `t`, roasters start a batch, mixers pair two ingredients, and the cat's bowl takes warm milk if the cat is there. Whatever a machine cannot use spills.
5. **Counter.** Each regular who is at the counter, on their tick or within their grace period, takes their drink if it is on the counter tile in front of their stool. A fussy regular first checks that the tile was empty the tick before. Then a drink that ran off the end of the belt is shelved, shelf cups age, and a walk-in may buy.
6. **Advance.** `T` goes up by one.

Two things follow from the order. A plot that harvests on a tick is already idle when a bucket lands on that same tick, which is the same-tick handoff. And an item appears on a machine's output tile on the tick it is emitted, so every belt tile adds exactly one tick.

## Rules 3: items, belts, spills and merges

Everything that moves is an item, and every item obeys the same belt rules with no special cases.

| Item | Comes from | Used by |
| --- | --- | --- |
| Bucket of water | Well | Plot |
| Beans | Plot | Kettle |
| Coffee (light, medium or dark) | Kettle | Counter, mixer |
| Espresso beans (light, medium or dark) | Roaster | Kettle |
| Espresso (light, medium or dark) | Kettle | Counter, mixer |
| Milk pail | Back door | Mixer, kettle |
| Latte (light, medium or dark) | Mixer | Counter |
| Café au lait (light, medium or dark) | Mixer | Counter |
| Warm milk | Kettle | The cat's bowl |

- **Belts.** A belt tile has one direction and moves its item one tile every tick. It never holds, queues or blocks.
- **Turns and merges.** A turn is a belt pointing a new way. A merge is any belt tile that more than one neighbour feeds; there is no merge piece and no splitter in the gray box.
- **Chutes.** A chute is a launch tile and a catch tile in a straight line with exactly one tile between them. An item on the launch lands on the catch one tick later, passing over whatever sits between: a belt, a machine or nothing. Both ends otherwise behave as belt tiles, and for priority an item arriving by chute counts as a belt item coming from the launch's side. Because it covers two tiles in one tick, a chute also saves a tick. It is expensive.
- **Spills.** A spilled item is removed. It costs nothing, draws a splash, and adds to a per-loop spill count shown in the side panel. Spilling on purpose is a legitimate filter.

When more than one item is aimed at the same belt tile, two rules decide, in this order:

1. **Belt beats machine.** An item arriving by belt wins over an item a machine is putting out.
2. **Clockwise from the top.** Among equals, the item coming from the north wins, then east, south, west.

The losers spill. One consequence to be aware of: a cup joining the counter by belt from above knocks off a cup already passing along it. A machine putting out straight onto the counter loses to the passing cup instead, because belt beats machine.

## Rules 4: machines

There are six machines, and each one takes items from any side and puts its output onto the single tile it faces (the well uses all four sides).

| Machine | Takes | Puts out | When |
| --- | --- | --- | --- |
| Well | Nothing | 4 buckets, one per side | Tick 0, every loop |
| Plot | Bucket | Beans | `G` ticks after the bucket lands; `G = 4` |
| Roaster | Beans | Espresso beans | Tick 6, in any loop it holds beans (proposed) |
| Kettle | Beans, espresso beans or milk | Coffee, espresso or warm milk | 1 tick after its input lands |
| Mixer | Two ingredients on the same tick | Latte or café au lait | 1 tick later |
| Back door | Payment | Milk pail | Tick 7, every loop |

**Well**

- The pulse tick is always 0 and can never be changed. Belt length is the only timing tool.
- A side with no belt or machine next to it spills its bucket.

**Plot**

- A bucket landing on an idle plot starts one growth cycle. One watering gives one harvest.
- A bucket landing on a growing plot spills.
- On the harvest tick the beans go out and the plot is idle again. A bucket landing on that same tick starts the next cycle.

**Kettle**

- The roast is set by the clock tick on which the beans land: 0 to 3 light, 4 to 7 medium, 8 to 11 dark. That is for plain beans only. Espresso takes its roast from the roaster by the opposite logic: time spent inside, not the tick of arrival.
- Espresso beans brew into espresso of the same roast, and milk into warm milk, whatever the tick. The kettle never needs water. If two inputs land on one tick it takes one by the clockwise rule and the other spills.

**Roaster**

- Like the well, the roaster runs on the clock: it puts out on tick 6 and on no other tick (*proposed*, subject to change).
- Beans can go in on any tick. The longer they sit before tick 6, the darker the roast: 1 to 4 ticks light, 5 to 8 medium, 9 to 12 dark (*proposed*).
- Beans that land on tick 6 itself have just missed the release and roast for a full 12 ticks.
- It holds one batch. Beans landing on a roaster that already holds a batch spill.
- This splits an espresso line in two: the belts before the roaster choose the roast, and the belts after it choose the serve tick, counted from tick 6.

**Mixer**

- It needs two ingredients landing on the same tick: espresso and milk make a latte, coffee and milk make a café au lait. Anything arriving alone, and any other pair, spills.
- A café au lait keeps its coffee's roast, and a latte keeps its espresso's.

**Back door**

- It can only be placed in the leftmost column of the back room, against the left wall, and it always faces right.
- Each pail is charged when it is delivered, whether or not it is used. If the till cannot cover it, no pail arrives that loop.
- Picking the door up cancels the standing order.
- You can place more than one door. Each brings one pail a loop and is charged for it.

**Unlocks**

Pieces are unlocked by regulars: a piece appears in the palette when the regular who needs it walks in. The schedule below is a first proposal.

| When | You can now build |
| --- | --- |
| Start | Belt, plot, kettle, and 1 well |
| Regular 5 walks in | A second well |
| Regular 6 walks in | Chute |
| Regular 8 walks in | Roaster |
| Regular 9 walks in | A third well |
| The cat starts asking for milk (slot 10) | Back door |
| Regular 11 walks in | Mixer |

- A locked piece cannot be placed or pasted.
- Wells are limited in number, and the limit only rises with the regulars above. One well waters four plots, so it serves four regulars: when a well's sides run out there is no buying another until the next one unlocks.
- An unlock happens when the regular walks in, not when they are seated, because the new piece is what serves them.

## Rules 5: the counter

A regular takes their drink straight off the counter belt as it passes: it must reach the tile in front of their stool on their tick, or within a short grace period after it.

**Regulars**

- A regular has an order, which is always exactly one drink, a stool, a tick and a grace period of 0 to 3 ticks. They arrive on their tick and stay for the grace period. The first right drink to reach the counter tile in front of their stool while they are there is theirs. On their exact tick it is Just in Time and pays a bonus; during the grace period it pays the plain price. Patient regulars allow 3 ticks, impatient ones 1 or none (proposed: the grace runs after their tick, never before it).
- A drink that is wrong, or that passes when they are not there, stays on the belt and carries on. A regular takes one cup per visit.
- A **fussy** regular checks the counter first. If anything at all was on the tile in front of their stool on the tick before their own, they refuse their cup, even when it is the right one, and it carries on down the belt. The alchemist is the only fussy regular so far, and he also has no grace: his cup must arrive on his exact tick.
- One regular per stool. Stools are never bought: one is added for free when the next regular is unlocked, at a column that regular brings with them.
- The first two regulars accept any tick and stay at the counter all loop: they take the first matching cup to pass their stool each loop, at the plain price.
- Regulars show up strictly in order through the twelve slots, with your cat as slot 10. The next one does not appear until the one before has received at least one cup, and then walks in with their stool. Being served once is what seats a regular.
- If a loop passes without their cup, a seated regular is *waiting*: they stop paying, nothing else is lost, and the next correct cup seats them again. This is what makes rebuilding safe.

**Shelf**

- A drink that nobody takes runs off the right-hand end of the counter belt and goes on the shelf.
- The shelf holds 3 cups. A drink arriving at a full shelf spills.
- A shelf cup goes stale and spills after 6 ticks (*proposed*).
- Anything that is not a drink spills at the end of the belt.

**Walk-ins**

- Walk-ins only come while the game is open. Each tick there is a 1 in 6 chance (*proposed*) that one buys the oldest shelf cup at half price.
- This is the only randomness that affects play. It uses a seeded generator and never touches the factory, so layouts stay exactly periodic. The cat's moods are random too, but purely cosmetic.

**Your cat**

- The cat is yours, not a customer. It is in the shop from the start, walking a fixed 12-tick route around the back room, one tile a tick. It steps over belts and machines and touches nothing.
- Its bowl is a pre-placed back-room tile (*proposed*: against the right-hand wall, in the back row you start with). The bowl is free and cannot be moved or removed. It takes items from any side, like a machine.
- Once regular 9 is seated, the cat takes the tenth place in the queue: it starts asking for warm milk, and the back door unlocks. From then on its route brings it to the bowl on tick 10, and it waits there for 3 ticks.
- Warm milk landing in the bowl while the cat is there is drunk, and the cat counts as served. Warm milk landing at any other time spills.
- Plain milk that has not been through a kettle makes the cat freak out: it bolts, and it refuses the bowl for the rest of that loop.
- The cat pays nothing. Serving it once is what lets regular 11 walk in.
- Clicking the cat lets you name it or pet it. Petting shows a heart over it, unless it's mad at you. Also it randomly doesn't care for your affection.

## Rules 6: money, loyalty and offline

Money only moves while the game is open; being away earns loyalty and nothing else.

- **Money in.** Regulars pay full price for a drink taken within their grace period, plus a Just in Time bonus when it lands on their exact tick. Walk-ins pay half price from the shelf.
- **Money out.** Structures, floor rows and milk. Stools cost nothing.
- **Removing a structure** refunds it in full during the gray box, so experimenting is free.

Every value below is a starting guess to tune in the gray box. You begin with 80 coins in the till.

| Thing | Coins |
| --- | --- |
| The till | Free: pre-placed, cannot be removed |
| The cat's bowl | Free: pre-placed, cannot be removed |
| Coffee, any roast | 5 |
| Warm milk, sold from the shelf only | 6 |
| Espresso | 8 |
| Café au lait | 10 |
| Latte | 12 |
| Just in Time bonus, coffee | 3 |
| Just in Time bonus, espresso | 4 |
| Just in Time bonus, café au lait | 5 |
| Just in Time bonus, latte | 6 |
| Belt tile | 1 |
| Chute, launch and catch together | 30 |
| Plot | 10 |
| Kettle | 15 |
| Roaster | 20 |
| Well | 25 |
| Mixer | 20 |
| Back door | 20 |
| Milk pail, each loop | 2 |
| Stool | Free: added with each new regular |
| Floor row | 50 |

**Loyalty**

- Each regular has a counter that goes up by one for every loop they are served, whether the game is open or not.
- It is flavour only for now: the gargoyle's "four hundred mornings" is this number.

**Gears**

- The clockmaker pays in gears instead of coins. Each cup he takes adds one gear to a counter beside the till, or two when it is Just in Time (*proposed*).
- Gears buy nothing and nothing depends on them. They are counted quietly, online and offline, purely for fun, and the morning report mentions the total.

**Offline**

- On return, loops away = seconds away divided by 12, rounded down and capped at 3 real days, which is 21,600 loops.
- Each regular's loyalty goes up by loops away times their serves per loop in steady state. The till does not change.
- The morning report lists those counts per regular.

**Steady state**

- Run the layout headless from an empty floor until the state at tick 0 repeats. The stretch between the two matching states is the cycle.
- Serves per loop is serves in the cycle divided by loops in the cycle. Most layouts settle to a one-loop cycle within two or three loops.

## Spec 1: gray box scope

The gray box is one grid, one 12-tick clock and the first twelve orders (eleven regulars and your cat), built to answer a single question: is it fun?

**In**

- The 12-tick clock, the back room grid, the counter with its built-in belt, the stools and the shelf.
- The six machines, belts and chutes, and all nine items.
- Eleven regulars, each with their own stool, and your cat with its bowl, arriving one at a time, plus money, unlocks and floor rows.
- Building directly on the live shop, with pause and single-step.
- Save and load in the browser, and the morning report, built last.

**Out, for later**

- Longer clocks (24, 60, 420) and the 5-tick and 7-tick plants.
- The round-robin turnstile merge, splitters and pipes.
- The brewer that needs water, the shared delivery belt, and design mode (a sandbox copy of the layout).
- The day cycle, loyalty unlocks, prestige and anything multiplayer.
- Final art and sound. The gray box uses flat coloured tiles; the visuals canvas is the target for the art pass.

## Spec 2: stack and architecture

The game is a static TypeScript site with no backend, split into three layers so the simulator can be tested without a browser.

- **Stack.** TypeScript, Vite, Vitest. Canvas 2D for the floor, plain DOM for the side panel. No UI framework.
- **Hosting.** A static build deployed to GitHub Pages. All state lives in `localStorage`.

| Folder | Holds | May import |
| --- | --- | --- |
| `src/sim/` | The tick rules: `step()`, steady-state detection, a text renderer for debugging | Nothing |
| `src/game/` | Till, regulars, unlocks, shelf, walk-ins, loyalty, gears, the cat, save and load | `sim` |
| `src/ui/` | Canvas renderer, input, paste buffer and undo history, side panel | `game`, `sim` |
| `src/levels/` | Regular definitions and one reference layout per regular | `sim` types |

Three constraints on `sim` keep it deterministic:

- No DOM, no `Date`, no `Math.random`. Time is the tick counter and nothing else.
- `step()` is a pure function: it returns a new state and a list of events, and never mutates its input.
- The events (spill, harvest, brew, serve) are the only thing the renderer and the tests read. Splashes and assertions come from the same list.

## Spec 3: data model

A layout is plain data, the simulator state is small, and the save file is the two together plus the shop's books. These types are a first draft for the agent to refine.

```ts
type Dir = 'N' | 'E' | 'S' | 'W';
type Roast = 'light' | 'medium' | 'dark';
type Drink = 'coffee' | 'espresso' | 'warmMilk' | 'auLait' | 'latte';

type Item =
  | { kind: 'water' }
  | { kind: 'beans' }
  | { kind: 'espressoBeans'; roast: Roast }
  | { kind: 'milk' }
  | { kind: 'coffee'; roast: Roast }
  | { kind: 'espresso'; roast: Roast }
  | { kind: 'warmMilk' }
  | { kind: 'auLait'; roast: Roast }
  | { kind: 'latte'; roast: Roast };

type Structure =
  | { kind: 'belt'; dir: Dir }
  | { kind: 'launch'; dir: Dir }      // chute: its item lands on the catch two tiles along
  | { kind: 'catch'; dir: Dir }       // the other end; carries on like a belt
  | { kind: 'well' }
  | { kind: 'plot'; out: Dir }
  | { kind: 'roaster'; out: Dir }
  | { kind: 'kettle'; out: Dir }
  | { kind: 'mixer'; out: Dir }
  | { kind: 'bowl' }                  // the cat's bowl: pre-placed, cannot be removed
  | { kind: 'door' };                 // leftmost column only, always faces right

// Back room only, row-major. Row 0 is the row next to the counter, so buying rows never renumbers tiles.
// The counter row is implicit and always present.
interface Layout {
  cols: 12;
  rows: number;
  tiles: (Structure | null)[];
}

// A regular at their stool. An order is always exactly one drink, so there is one seat per regular.
interface Seat {
  col: number;                                // counter column the stool faces
  drink: Drink;
  roast: Roast | 'any';
  tick: number | 'any';                       // 'any' = the first matching cup each loop
  grace: number;                              // ticks they stay after their own tick, 0 to 3
  fussy?: boolean;                            // refuses their cup if anything was on their counter tile the tick before
  bowl?: number;                              // the cat only: back-room tile of its bowl, used instead of col
}

interface SimState {
  T: number;                                  // ticks since start
  belts: (Item | null)[];                     // back room tiles, then the 12 counter tiles
  plots: Record<number, { harvestAt: number } | null>;   // by tile index; null = idle
  pending: Record<number, { item: Item; readyAt: number } | null>;       // kettle and mixer output, by tile index
  roasting: Record<number, { since: number } | null>;      // roaster batches: the tick the beans landed
  servedThisVisit: boolean[];                  // per seat: set when they take a cup, cleared when they leave
}

type SimEvent =
  | { type: 'spill'; at: number; item: Item }
  | { type: 'harvest'; at: number }
  | { type: 'brew'; at: number; item: Item }
  | { type: 'milk'; at: number }               // a pail was delivered; the game layer charges for it
  | { type: 'serve'; seat: number; item: Item; justInTime: boolean } // taken off the counter at a stool
  | { type: 'end'; item: Item };               // ran off the end of the counter untaken

declare function step(
  layout: Layout,
  state: SimState,
  opts: { seats: Seat[]; canPayMilk: boolean }
): { next: SimState; events: SimEvent[] };

interface RegularDef {
  id: string;
  name: string;
  intro: string;                               // one line shown when they walk in
  col: number;                                 // counter column where their stool appears
  order: {                                     // always exactly one drink
    drink: Drink;
    roast: Roast | 'any';
    tick: number | 'any';                      // 'any' for the first two regulars
    grace: 0 | 1 | 2 | 3;                          // ticks they stay after their own tick
    fussy?: boolean;                           // as on Seat
  };
  unlocks?: Structure['kind'][];               // pieces added to the palette when they walk in
  wellLimit?: number;                          // raises the number of wells you may own
  paysIn?: 'coins' | 'gears' | 'nothing';                  // coins unless stated: the clockmaker pays in gears, the cat nothing
}

interface Save {
  version: 1;
  layout: Layout;
  till: number;
  catName: string;                             // chosen by the player
  gears: number;                               // paid by the clockmaker; buys nothing
  regulars: { id: string; status: 'new' | 'seated' | 'waiting'; loyalty: number }[];
  lastSeen: number;                            // epoch ms, read only by the game layer
}
```

## Spec 4: screens and controls

There is one screen with the floor on the left and a side panel on the right, and for the gray box there is only one mode: the live shop.

**The live shop**

- The clock runs at one tick a second, regulars pay and walk-ins buy.
- You build directly on the live floor while it runs. Each piece is paid for as it is placed and refunded in full when removed.
- A half-built line simply spills until it is finished. Regulars it stops serving go to waiting and come back with the next correct cup.

**Design** *mode: left out of the gray box*

- The idea: a free sandbox copy of the layout with its own clock, step back and go to tick N, applied to the live shop in one go.
- It comes back only if building live proves too punishing in the fun check.

**Build tools and time controls**

- Place a piece from the palette, turning it with R first. Drag to lay a run of belts.
- A chute is placed as one piece: the launch where you click and the catch two tiles along the way it faces. Both tiles must be free; the tile between can hold anything.
- Pause and step forward one tick. While paused nothing moves and nothing is earned, but you can still build.
- A roast readout on every kettle: the tick its beans last landed on and the roast that gave. Roasters show how long their batch has been in.
- A spill count per loop.

**Editing keys**

| Key | What it does |
| --- | --- |
| Z, hovering | Delete the tile under the cursor |
| X, hovering | Cut the tile under the cursor |
| C, hovering | Copy the tile under the cursor |
| Z, with a box selected | Delete everything in the box |
| Ctrl+X | Cut the box selection |
| Ctrl+C | Copy the box selection |
| R | Turn the piece or group in hand a quarter turn |
| F | Flip the group in hand left to right |
| Ctrl+mouse wheel | Step through the paste buffer history |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |

- **Box select.** Drag a box over the floor to select everything in it (*proposed*: Shift+drag, so a plain drag still lays belts).
- **Paste buffer.** Everything cut, copied or deleted goes into the buffer as one entry, deletions included. The buffer keeps a history, newest first, of the last 10 entries (*proposed*).
- **Pasting.** The current entry rides on the cursor as a ghost and a click places it (*proposed*: Ctrl+V picks the buffer back up, Esc puts it down).
- **Groups.** One entry can hold several machines and belts. R and F turn and mirror the whole group, including the way each piece faces.
- **Money.** Pasting pays for each piece placed; cutting and deleting refund in full. A paste that overlaps something, uses a piece not yet unlocked, or costs more than the till holds is refused and the ghost shows why (*proposed*).
- **Fixed pieces.** The counter belt, the till and the cat's bowl cannot be selected, cut or deleted.
- **Undo and redo.** They step through build actions and put the money back. They do not rewind the clock, so items that were riding a deleted belt are not restored.
- **Tests.** Rotate and flip are pure functions on a buffer entry: four quarter turns, or two flips, must give back the original.

**The counter strip**

- A row of 12 cells, one per counter column, always visible.
- A cell with a stool shows its regular, the tick they want, and what is on the counter in front of them on that tick in steady state.
- Just in Time, within grace, a miss and an empty stool read differently by shape as well as colour. This strip is how a player sees at a glance whether a layout works.
- Hovering a counter tile lists the ticks on which a cup sits on it.

**Other panels**

- The clock dial with the three roast windows, the till with its gear counter, and the build palette, as on the visuals canvas.
- Regulars are drawn at their stool only while they are there: in the gray box they fade in on their tick and fade out when they leave.
- The cat is always on the floor, moving along its route. Clicking it opens a small card to name it or pet it; petting shows a heart over it. In the gray box the cat can be a plain marker.
- A card for the next regular: name, order and one line of introduction.
- The morning report, shown once on load when the player has been away.

## Spec 5: the first twelve regulars

Each regular is the next puzzle: they arrive in order, and the next one does not appear until the one before has been served at least once. None of the twelve has been checked as solvable yet: every one needs a reference layout that passes in the headless simulator before it ships.

| # | Regular | Order | What it teaches |
| --- | --- | --- | --- |
| 1 | The lamplighter | Medium, any tick | The chain: well, belt, plot, kettle, counter |
| 2 | The chimney sweep | Dark, any tick | Belt length is delay: snake until the beans land on ticks 8 to 11 |
| 3 | The clockmaker | Medium, tick 5, grace 2; pays in gears | The serve tick: the cup must be in front of his stool on tick 5 |
| 4 | The gargoyle | Dark, tick 11, grace 3 | A second line onto the counter, and the first collision |
| 5 | The postwoman | Medium, tick 3, grace 2 | A second well: all four sides of the first are in use |
| 6 | The baker | Light, tick 1, grace 2 | Wrap-around: the beans must land after the clock passes 12 |
| 7 | The apothecary | Light, tick 8, grace 2 | The spare sides of the second well: the third does not unlock until regular 9 |
| 8 | The witch | Medium espresso, tick 0, grace 3 | The roaster: it releases on tick 6, and time inside sets the roast |
| 9 | The alchemist | Dark espresso, tick 6, grace 0; fussy | A clear counter: nothing may be in front of him on tick 5, so other lines must be re-timed or join further along |
| 10 | Your cat | Warm milk in its bowl, tick 10, grace 3 | The back door: a second heartbeat on tick 7, and a delivery inside the back room instead of over the counter |
| 11 | The innkeeper | Medium café au lait, tick 4, grace 2 | The mixer: coffee and milk must land on the same tick |
| 12 | The mayor | Dark latte, tick 7, grace 1 | The capstone: roaster, back door and mixer in one line, with everyone else still served |

Every order is exactly one drink. Slot 10 is your cat, which is served at its bowl in the back room rather than at a stool. Each reads drink, tick, then grace, which is the number of ticks the regular waits after their own. Names, ticks and grace are first suggestions. Each regular's stool column is chosen when their reference layout is built: for regulars 1 to 4 the building agent picks the column and proves it with a layout that passes in the simulator.

Why medium comes first: with `G = 4`, beans cannot land before tick 4, so a short line gives medium, a longer one dark, and light needs at least 8 belt tiles to carry the beans past tick 12. That makes medium the natural first order and light the wrap-around puzzle.

After regular 12 a traveller orders a drink made from a 5-tick bean, which is where the longer clock begins. That is outside the gray box.

## Spec 6: tests and the verify loop

One command, `npm run verify`, runs the type check, the tests and the build, and the agent runs it after every change.

**Rule tests, one per rule**

- Well: four buckets on tick 0 and on no other tick; a side with no neighbour spills.
- Belt: an item moves exactly one tile per tick; an item run onto bare floor spills.
- Priority: belt beats machine output; north beats east beats south beats west.
- Plot: harvest `G` ticks after watering; a bucket on a growing plot spills; the same-tick handoff works.
- Kettle: roast at every window edge (ticks 3 and 4, 7 and 8, 11 and 0); coffee out one tick later; espresso beans give espresso of the same roast and milk gives warm milk on any tick.
- Roaster: it puts out on tick 6 only; the roast is right at each window edge (4 and 5 ticks, 8 and 9 ticks); beans landing on tick 6 roast for 12; beans landing on a full roaster spill.
- Chute: an item on the launch is on the catch one tick later, whatever sits on the tile between; that tile's own item is untouched; an item arriving by chute takes priority as a belt item from the launch's side.
- Unlocks: a locked piece cannot be placed or pasted; the well limit holds until the regular who raises it walks in.
- Mixer: espresso and milk give a latte with the espresso's roast; coffee and milk give a café au lait with the coffee's roast; anything alone, and any other pair, spills.
- Back door: a pail on tick 7; no pail when `canPayMilk` is false.
- Counter belt: a cup joining at column `c` is in front of column `s` exactly `s - c` ticks later, and runs off the end `12 - c` ticks after joining.
- Stool: a regular takes the right drink on their tick (Just in Time, with the bonus) or within their grace period (plain price), once per visit; a wrong drink, or one that passes outside that window, goes by untouched; an untaken drink reaches the shelf.
- Fussy: with grace 0 the cup is taken only on the exact tick; if any item was on their counter tile the tick before, the right cup is refused and carries on untouched.
- Bowl: warm milk landing while the cat is there is drunk; warm milk at any other time spills; plain milk makes the cat refuse the bowl for the rest of that loop.

**Whole-system tests**

- Determinism: the same layout run twice gives an identical event list.
- The timing equations as a property test: random `b1`, `b2`, `b3`, `c` and `s`, built as a real layout, must give the predicted roast and serve tick.
- Steady state: detection finds the cycle, and serves per loop matches a hand count.
- Reference layouts: for each regular, the saved solution serves that regular every loop. One more layout serves all twelve at once and guards against rule changes breaking old puzzles.

**Debugging aid**

- A text renderer that prints any state as a grid of characters, so a failing test shows the floor at the tick it failed.

## Spec 7: build order

Build the simulator first, reach the fun check as early as possible, and add persistence last.

1. **Simulator.** `src/sim/` with every rule test passing, headless. Done when the timing property test is green.
2. **Stepper.** The floor renderer, build tools, pause and step, in flat grey boxes. Done when regular 1's line can be built and stepped tick by tick.
3. **Counter.** Stools, regulars 1 to 4, the till, the counter strip, and the cat's bowl in place but inert. Done when all four can be seated in one sitting.
4. **Fun check.** You play it. This is the gate: if placing and timing lines is not fun here, change the rules before building more.
5. **The rest of the ladder.** Regulars 5 to 12 and your cat, with unlocks, the chute, roaster, back door and mixer, each with a reference layout.
6. **Persistence.** Save and load, steady-state detection, loyalty and the morning report.
7. **Art and sound.** Hand-drawn sprites from the visuals canvas, then the submission page.

## Open questions

The ticked items are settled and kept as a record. What is still open is tagged proposed in the text, and gathered in the last item.

- [x] **Who places the stool?** Settled: nobody does. A stool is added for free when the next regular is unlocked, at a column set by that regular.
- [x] **Growth time.** `G = 4` makes medium the easy roast and light the wrap-around puzzle. A different value changes which roast comes first.
- [x] **Right of way on the counter.** Settled: north wins everywhere, so a cup joining from above beats a cup already on the belt.
- [x] **What makes spent grounds necessary?** Settled: nothing does, so spent grounds are cut from the game. Regular 8 is now the first espresso order.
- [x] **The picky regular.** "Nothing on the tick before" is now a rule in Rules 5: a fussy regular refuses their cup if anything was in front of them the tick before.
- [x] **Latte roast.** Settled: a latte is espresso plus milk and keeps the espresso's roast, set by time in the roaster. Espresso comes from espresso beans, which a roaster makes from plain beans.
- [x] **Refunds.** Settled: full refund on removal, so rebuilding costs nothing.
- [x] **Names and orders** are now drafted for all twelve in Spec 5. They are suggestions and none is tested yet.
- [x] **After the gray box:** wells pulse once a loop, so a 5-tick plant does not by itself force a 60-tick clock. It needs something that repeats every 5 ticks, such as a plant that keeps fruiting once watered.
- [x] **Still to tune in the gray box.** Starting floor depth, the roaster's tick and roast windows, shelf staleness, walk-in chance, gears per cup, the editing keys marked proposed, the unlock schedule, the bowl's position, and every price.
