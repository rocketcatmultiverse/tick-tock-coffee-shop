# Tick Tock Coffee Shop

A browser puzzle-automation game for a two-week game jam: a cozy alchemical coffee shop whose factory floor runs on a looping 12-tick clock. It is a static TypeScript site with no backend.

## Read first

- `docs/SPEC.md` is the source of truth. Its "Rules" sections are a contract: implement them exactly as written.
- If the spec is ambiguous, contradicts itself, or a rule looks wrong, do not guess silently. Take the most literal reading, record it in `docs/QUESTIONS.md` (the question, what you assumed, where in the code), and carry on.
- Anything tagged *proposed*, and every number in a tuning table, is provisional. Keep all such values in `src/sim/tuning.ts` or `src/game/tuning.ts`. Never write them inline.

## Commands

- `npm run dev` starts the local server.
- `npm test` runs Vitest.
- `npm run verify` runs the type check, the tests and the production build. Run it after every change. Never report work as done while it fails.

## Architecture rules

- `src/sim/` imports nothing outside itself. No DOM, no `Date`, no `Math.random`, no timers.
- `step()` is pure. It returns a new state and a list of events and never mutates its input.
- `src/game/` may import `sim`. `src/ui/` may import `game` and `sim`. `src/levels/` holds data and may import `sim` types only.
- The renderer and the tests read the simulator's events. Do not re-derive what happened from state.
- Walk-in randomness lives in `game` and uses a seeded generator. Cosmetic randomness, such as the cat's moods, lives in `ui`.

## Conventions

- Columns count from 0 at the left wall.
- Back-room rows count from 0 at the row next to the counter and grow away from it, so buying a row never renumbers a tile.
- North is away from the counter. South is toward it.
- A back-room tile's index is `row * 12 + col`. The 12 counter tiles are stored after the back-room tiles.
- The clock reads `t = T mod 12`, where `T` is ticks since start.

## Tests

- One test file per rule in "Spec 6", named after the rule. Write the test before the rule.
- When a simulator test fails, print the floor with the text renderer so the failure shows the tick and the tiles.
- Never weaken, skip or delete a test to make it pass. If a test and the spec disagree, the spec wins. If the spec is wrong, log it in `docs/QUESTIONS.md`.
- Reference layouts in `src/levels/` are fixtures. A rule change that breaks one is a finding to report, not something to patch around.

## Scope discipline

- Build in the order of "Spec 7: build order" and stop at the step you were asked to stop at.
- This is a gray box: flat coloured tiles and plain text labels. No art, no sound, no animation polish, and no features that are not in the spec.
- Dependencies are TypeScript, Vite and Vitest. Ask before adding anything else.
- Target a desktop browser with mouse and keyboard. No mobile work.

## Git

- Commit after each passing step with a short message.
- Do not push or deploy unless asked.
