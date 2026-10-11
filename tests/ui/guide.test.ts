// The Guide tab (docs/QUESTIONS.md, Q71): the tooltips in one place for a
// touch screen. It lists each drink ordered by the regulars who have walked
// in, once, with who orders it, and nothing from regulars still to come.

import { describe, expect, it } from 'vitest';
import { REGULARS } from '../../src/levels/regulars';
import { FLOOR_MARKS, drinksOrdered } from '../../src/ui/guide';
import { coins, deleteHint } from '../../src/ui/tips';

describe('The Guide', () => {
  it('lists each drink once, with everyone who orders it', () => {
    const first = drinksOrdered(REGULARS.slice(0, 3));
    expect(first.map((d) => d.key)).toEqual(['drink:coffee:medium', 'drink:coffee:dark']);
    expect(first[0].who).toEqual(['the lamplighter', REGULARS[2].name.replace(/^The /, 'the ')]);
    expect(first[0].want).toEqual({ kind: 'coffee', roast: 'medium' });
  });

  it('shows no drink from a regular who has not walked in', () => {
    expect(drinksOrdered([])).toEqual([]);
    const some = drinksOrdered(REGULARS.slice(0, 2)).map((d) => d.want.kind);
    expect(some).not.toContain('latte');
  });

  it('a drink any roast will do has no roast', () => {
    const cat = REGULARS.find((d) => d.bowl)!;
    expect(drinksOrdered([cat])[0].want).toEqual({ kind: 'warmMilk', roast: null });
  });

  it('every line about the floor has its numbers filled in', () => {
    for (const line of FLOOR_MARKS) expect(line).not.toMatch(/undefined|NaN|\$\{/);
  });
});

describe('Tooltip words for each device', () => {
  it('deleting is a tap and a button on a touch screen, a hover and Z with a mouse', () => {
    expect(deleteHint(true)).toMatch(/^Tap one on the floor, then Delete/);
    expect(deleteHint(false)).toMatch(/press Z/);
  });

  it('one coin, many coins', () => {
    expect(coins(1)).toBe('1 coin');
    expect(coins(25)).toBe('25 coins');
  });
});
