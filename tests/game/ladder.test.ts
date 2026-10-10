// The ladder of regulars 1 to 12 (Spec 5) and the unlock schedule (Rules 4).

import { describe, expect, it } from 'vitest';
import { rightsAfter } from '../../src/game/build';
import { REGULARS } from '../../src/levels/regulars';

describe('Ladder', () => {
  it('has eleven regulars and the cat in place 10, each at their own stool', () => {
    expect(REGULARS.length).toBe(12);
    expect(REGULARS[9].bowl).toBe(true);
    const stools = REGULARS.filter((d) => !d.bowl).map((d) => d.col);
    expect(new Set(stools).size).toBe(11);
  });

  it('unlocks pieces and wells as the schedule says', () => {
    const at = (n: number) => {
      const r = rightsAfter(REGULARS, n);
      return { pieces: [...r.unlocked].sort().join(','), wells: r.wellLimit };
    };
    const start = { pieces: 'belt,kettle,plot,well', wells: 1 };
    for (const n of [1, 2, 3, 4]) expect(at(n)).toEqual(start);
    expect(at(5)).toEqual({ pieces: 'belt,kettle,plot,spring,well', wells: 2 }); // postwoman: a second well and the spring
    expect(at(6)).toEqual({ pieces: 'belt,chute,kettle,plot,spring,well', wells: 2 }); // baker: chute
    expect(at(7)).toEqual({ pieces: 'belt,chute,kettle,plot,spring,well', wells: 2 });
    expect(at(8)).toEqual({ pieces: 'belt,chute,kettle,plot,roaster,spring,well', wells: 2 }); // witch: roaster
    expect(at(9)).toEqual({ pieces: 'belt,chute,kettle,plot,roaster,spring,well', wells: 3 }); // alchemist: a third well
    expect(at(10)).toEqual({ pieces: 'belt,chute,door,kettle,plot,roaster,spring,well', wells: 3 }); // the cat: side door
    expect(at(11)).toEqual({ pieces: 'belt,chute,door,kettle,mixer,plot,roaster,splitter,spring,well', wells: 3 }); // innkeeper: mixer and splitter
    expect(at(12)).toEqual(at(11));
  });
});
