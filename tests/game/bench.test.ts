// Workbench puzzles (docs/QUESTIONS.md, Q77): a fixed bench with pieces
// already on it, a few pieces to place for free, and a tray that wants the
// same things every loop. Solved after BENCH_SOLVE_LOOPS loops in a row that
// fill the order, once the headless simulator agrees the floor settles there.

import { describe, expect, it } from 'vitest';
import { LADDERS, Workbench, judgeLoop, laddersOpen, parseBoard, puzzleOpen, type Delivery } from '../../src/game/bench';
import { BENCH_SOLVE_LOOPS } from '../../src/game/tuning';
import { tileIndex } from '../../src/sim/grid';
import { renderFloor } from '../../src/sim/text';
import type { Item, PieceKind, PuzzleDef, Structure } from '../../src/sim/types';

const DEF: PuzzleDef = {
  id: 'test',
  name: 'Test',
  ladder: 'basics',
  tier: 'tutorial',
  brief: 'A bucket for the tray.',
  board: [
    '. . . . #', //
    'W . . . T',
    '. . . . .',
  ],
  pieces: { belt: 3, plot: null },
  wants: [{ kind: 'water' }],
};

const belt = (dir: 'N' | 'E' | 'S' | 'W'): Structure => ({ kind: 'belt', dir });
const at = (row: number, col: number) => tileIndex(row, col);
const water: Item = { kind: 'water' };
const coffee = (roast: 'light' | 'medium' | 'dark'): Item => ({ kind: 'coffee', roast });
const got = (...xs: [number, Item][]): Delivery[] => xs.map(([tick, item]) => ({ tick, item }));

/** Run whole loops, returning the verdicts and whether it was solved on each. */
function loops(bench: Workbench, n: number): { ok: boolean; solvedNow: boolean }[] {
  const out: { ok: boolean; solvedNow: boolean }[] = [];
  for (let k = 0; k < n * 12; k++) {
    const r = bench.tick();
    if (r.verdict) out.push({ ok: r.verdict.ok, solvedNow: r.solvedNow });
  }
  return out;
}

describe('Workbench: the bench', () => {
  it('takes its size from the text, with holes, fixed pieces and the tray', () => {
    const b = parseBoard(DEF.board);
    expect(b.cols).toBe(5);
    expect(b.layout.rows).toBe(3);
    expect(b.layout.cols).toBe(12);
    expect([...b.holes]).toEqual([at(2, 4)]);
    expect([...b.fixed].sort((x, y) => x - y)).toEqual([at(1, 0), at(1, 4)]);
    expect(b.tray).toBe(at(1, 4));
    expect(b.layout.tiles[at(1, 0)]).toEqual({ kind: 'well' });
    expect(b.layout.tiles[at(1, 4)]).toEqual({ kind: 'tray' });
    // Everything past the bench's width is bare.
    expect(b.layout.tiles.filter((s, i) => s && i % 12 >= 5)).toEqual([]);
  });

  it('refuses a ragged bench, one wider than the shop, and one with no tray', () => {
    expect(() => parseBoard(['. . T', '. .'])).toThrow();
    expect(() => parseBoard(['. . . . . . . . . . . . T'])).toThrow();
    expect(() => parseBoard(['. . W'])).toThrow();
  });
});

describe('Workbench: building', () => {
  it('costs nothing: there is no till to run dry', () => {
    const bench = new Workbench(DEF);
    expect(bench.free).toBe(true);
    for (let row = 0; row < 3; row++) expect(bench.build([{ index: at(row, 2), to: { kind: 'plot', out: 'S' } }]).ok).toBe(true);
  });

  it('builds only on the bench: not past its width, nor on a hole', () => {
    const bench = new Workbench(DEF);
    expect(bench.build([{ index: at(0, 5), to: belt('E') }])).toEqual({ ok: false, reason: 'Off the bench' });
    expect(bench.build([{ index: at(2, 4), to: belt('E') }])).toEqual({ ok: false, reason: 'Off the bench' });
  });

  it('keeps the pieces it came with: they cannot be moved, deleted or built over', () => {
    const bench = new Workbench(DEF);
    expect(bench.build([{ index: at(1, 0), to: null }])).toEqual({ ok: false, reason: 'Fixed to the bench' });
    expect(bench.build([{ index: at(1, 4), to: null }])).toEqual({ ok: false, reason: 'The tray is fixed' });
    expect(bench.build([{ index: at(1, 0), to: belt('E') }]).ok).toBe(false);
  });

  it('offers only its own pieces, as many as it says', () => {
    const bench = new Workbench(DEF);
    expect(bench.build([{ index: at(0, 1), to: { kind: 'kettle', out: 'S' } }])).toEqual({ ok: false, reason: 'Kettle is not in this puzzle' });
    for (const col of [1, 2, 3]) expect(bench.build([{ index: at(1, col), to: belt('E') }]).ok).toBe(true);
    expect(bench.build([{ index: at(0, 1), to: belt('E') }])).toEqual({ ok: false, reason: 'Only 3 belts in this puzzle' });
    // Taking one up frees it again, and turning one in place is not a fourth.
    expect(bench.build([{ index: at(1, 3), to: belt('N') }]).ok).toBe(true);
    expect(bench.build([{ index: at(1, 3), to: null }]).ok).toBe(true);
    expect(bench.build([{ index: at(0, 1), to: belt('E') }]).ok).toBe(true);
    expect(bench.left('belt')).toBe(0);
    expect(bench.left('plot')).toBeNull();
  });

  it('puts the side door against the bench’s own right-hand wall', () => {
    const def: PuzzleDef = { ...DEF, board: ['. . . . .', '. . . . T'], pieces: { door: 1 } };
    const bench = new Workbench(def);
    expect(bench.build([{ index: at(1, 2), to: { kind: 'door' } }])).toEqual({ ok: false, reason: 'The side door goes against the right-hand wall' });
    expect(bench.build([{ index: at(0, 4), to: { kind: 'door' } }])).toEqual({ ok: false, reason: 'The tray is fixed' });
    expect(bench.build([{ index: at(1, 4), to: { kind: 'door' } }]).ok).toBe(true);
  });

  it('puts back the pieces a save kept, leaving out any that no longer fit', () => {
    const bench = new Workbench(DEF, [
      [at(1, 1), belt('E')],
      [at(1, 2), belt('E')],
      [at(0, 7), belt('E')], // off the bench
      [at(1, 0), belt('E')], // where the well is
      [at(2, 1), { kind: 'kettle', out: 'S' }], // not in this puzzle
    ]);
    expect(bench.placed()).toEqual([
      [at(1, 1), belt('E')],
      [at(1, 2), belt('E')],
    ]);
  });
});

describe('Workbench: judging a loop at the tray', () => {
  it('passes exactly what the order wants, and says what is wrong otherwise', () => {
    const wants = [{ kind: 'coffee' as const, roast: 'medium' as const, tick: 9 }];
    expect(judgeLoop(wants, got([9, coffee('medium')])).ok).toBe(true);
    expect(judgeLoop(wants, got()).why).toBe('Nothing reached the tray.');
    expect(judgeLoop(wants, got([5, coffee('medium')])).why).toBe('A medium coffee came on tick 5; the order wants it on tick 9.');
    expect(judgeLoop(wants, got([9, coffee('dark')])).why).toBe('On tick 9 the tray got a dark coffee, which the order does not want.');
    expect(judgeLoop(wants, got([9, coffee('medium')], [10, coffee('medium')])).why).toBe('2 came, and the order wants 1.');
  });

  it('takes any roast and any tick when the order names none', () => {
    const wants = [{ kind: 'coffee' as const }];
    for (const roast of ['light', 'medium', 'dark'] as const) for (const t of [0, 6, 11]) expect(judgeLoop(wants, got([t, coffee(roast)])).ok).toBe(true);
    expect(judgeLoop(wants, got([3, { kind: 'beans' }])).why).toBe('On tick 3 the tray got beans, which the order does not want.');
  });

  it('reads a sequence round the loop: it may start anywhere, but keeps its order', () => {
    const wants = [{ kind: 'coffee' as const, roast: 'light' as const }, { kind: 'coffee' as const, roast: 'medium' as const }, { kind: 'coffee' as const, roast: 'dark' as const }];
    expect(judgeLoop(wants, got([1, coffee('light')], [4, coffee('medium')], [8, coffee('dark')]))).toMatchObject({ ok: true, rotations: [0] });
    // Dark on tick 2, light on 5, medium on 9: the same order, read from the dark one.
    expect(judgeLoop(wants, got([2, coffee('dark')], [5, coffee('light')], [9, coffee('medium')]))).toMatchObject({ ok: true, rotations: [2] });
    expect(judgeLoop(wants, got([1, coffee('medium')], [4, coffee('light')], [8, coffee('dark')])).why).toBe('Everything came, but not in the order wanted.');
    expect(judgeLoop(wants, got([1, coffee('light')], [4, coffee('medium')])).why).toBe('Only 2 of the 3 came.');
  });

  it('holds a ticked want to its tick wherever it falls in the order', () => {
    const wants = [{ kind: 'water' as const, tick: 3 }, { kind: 'water' as const }];
    expect(judgeLoop(wants, got([3, water], [7, water])).ok).toBe(true);
    expect(judgeLoop(wants, got([1, water], [3, water])).ok).toBe(true);
    expect(judgeLoop(wants, got([1, water], [7, water])).why).toBe('A bucket of water came on tick 1; the order wants it on tick 3.');
  });
});

describe('Workbench: running', () => {
  const solve = (bench: Workbench) => {
    for (const col of [1, 2, 3]) expect(bench.build([{ index: at(1, col), to: belt('E') }]).ok).toBe(true);
  };

  it('counts what lands in the tray each loop, and judges it at the loop’s end', () => {
    const bench = new Workbench(DEF);
    solve(bench);
    for (let k = 0; k < 11; k++) expect(bench.tick().verdict, renderFloor(bench.layout, bench.sim)).toBeNull();
    expect(bench.delivered).toEqual(got([3, water]));
    const end = bench.tick();
    expect(end.verdict?.ok, renderFloor(bench.layout, bench.sim)).toBe(true);
    expect(bench.delivered).toEqual([]);
    expect(bench.streak).toBe(1);
  });

  it(`is solved after ${BENCH_SOLVE_LOOPS} loops in a row that fill the order, and stays solved`, () => {
    const bench = new Workbench(DEF);
    solve(bench);
    const run = loops(bench, BENCH_SOLVE_LOOPS + 1);
    expect(run.map((r) => r.ok)).toEqual(new Array(BENCH_SOLVE_LOOPS + 1).fill(true));
    expect(run.map((r) => r.solvedNow)).toEqual([...new Array(BENCH_SOLVE_LOOPS - 1).fill(false), true, false]);
    expect(bench.solved).toBe(true);
    // Breaking the floor afterwards does not take it back.
    bench.build([{ index: at(1, 2), to: null }]);
    expect(loops(bench, 1)[0].ok).toBe(false);
    expect(bench.solved).toBe(true);
  });

  it('starts the count again after a loop that misses', () => {
    const bench = new Workbench({ ...DEF, wants: [{ kind: 'water', tick: 3 }] });
    solve(bench);
    loops(bench, 1);
    expect(bench.streak).toBe(1);
    bench.build([{ index: at(1, 3), to: null }]);
    expect(loops(bench, 1)).toEqual([{ ok: false, solvedNow: false }]);
    expect(bench.streak).toBe(0);
    expect(bench.lastVerdict?.why).toBe('Nothing reached the tray.');
  });

  it('is not fooled by items still in flight from a floor that was taken apart', () => {
    // A line of springs carries buckets for more than four loops: with it cut at
    // the well, the tray still gets them for a while, but the floor no longer works.
    const def: PuzzleDef = {
      ...DEF,
      board: ['W . . . . . . . . . . .', '. . . . . . . . . . . .', 'T . . . . . . . . . . .'],
      pieces: { belt: null, spring: null },
      wants: [{ kind: 'water' }],
    };
    const bench = new Workbench(def);
    const line: [number, Structure][] = [
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((c): [number, Structure] => [at(2, c), { kind: 'spring', dir: 'E' }]),
      [at(2, 11), belt('S')],
      [at(1, 11), belt('S')],
      ...[11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((c): [number, Structure] => [at(0, c), belt('W')]),
    ];
    for (const [index, to] of line) expect(bench.build([{ index, to }]).ok).toBe(true);
    // Run until one more good loop would solve it, then cut the line at the well.
    for (let k = 0; k < 240 && bench.streak < BENCH_SOLVE_LOOPS - 1; k++) bench.tick();
    expect(bench.streak, renderFloor(bench.layout, bench.sim)).toBe(BENCH_SOLVE_LOOPS - 1);
    bench.build([{ index: at(2, 1), to: null }]);
    const after = loops(bench, BENCH_SOLVE_LOOPS + 1);
    expect(after[0].ok, renderFloor(bench.layout, bench.sim)).toBe(true);
    expect(after.some((r) => r.solvedNow)).toBe(false);
    expect(bench.solved).toBe(false);
  });

  it('starts over on an empty floor at tick 0', () => {
    const bench = new Workbench(DEF);
    solve(bench);
    loops(bench, 1);
    for (let k = 0; k < 2; k++) bench.tick();
    bench.restart();
    expect(bench.sim.T).toBe(0);
    expect(bench.sim.belts.every((x) => x === null)).toBe(true);
    expect(bench.delivered).toEqual([]);
    expect(bench.streak).toBe(0);
    expect(bench.placed().length).toBe(3);
  });

  it('brings the side door’s pails as the puzzle says', () => {
    const def: PuzzleDef = { ...DEF, board: ['T < < D'], pieces: {}, wants: [{ kind: 'milk', tick: 9 }, { kind: 'milk', tick: 10 }], milkPails: 2 };
    const bench = new Workbench(def);
    expect(loops(bench, BENCH_SOLVE_LOOPS).every((r) => r.ok)).toBe(true);
    expect(bench.solved).toBe(true);
  });
});

describe('Workbench: ladders', () => {
  const puzzles: PuzzleDef[] = [
    { ...DEF, id: 'b1' },
    { ...DEF, id: 'b2' },
    { ...DEF, id: 's1', ladder: 'spring' },
  ];

  it('one ladder for the basics and one for each piece unlocked after the start', () => {
    expect(LADDERS).toEqual(['basics', 'spring', 'chute', 'roaster', 'door', 'mixer', 'splitter']);
  });

  it('opens the basics from the start, and each other ladder with its piece', () => {
    const start = new Set<PieceKind>(['belt', 'plot', 'kettle', 'well']);
    expect(laddersOpen(start)).toEqual(['basics']);
    expect(laddersOpen(new Set<PieceKind>([...start, 'spring', 'mixer', 'splitter']))).toEqual(['basics', 'spring', 'mixer', 'splitter']);
  });

  it('opens each rung once the one below it is solved', () => {
    const unlocked = new Set<PieceKind>(['belt', 'plot', 'kettle', 'well']);
    expect(puzzleOpen(puzzles, 'b1', unlocked, new Set())).toBe(true);
    expect(puzzleOpen(puzzles, 'b2', unlocked, new Set())).toBe(false);
    expect(puzzleOpen(puzzles, 'b2', unlocked, new Set(['b1']))).toBe(true);
    expect(puzzleOpen(puzzles, 's1', unlocked, new Set(['b1', 'b2']))).toBe(false);
    expect(puzzleOpen(puzzles, 's1', new Set<PieceKind>([...unlocked, 'spring']), new Set())).toBe(true);
    expect(puzzleOpen(puzzles, 'nope', unlocked, new Set())).toBe(false);
  });
});
