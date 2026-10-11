import { describe, expect, it } from 'vitest';
import { ALL_PIECES } from '../../src/game/pieces';
import { pieceForKey, pieceKey } from '../../src/ui/hotkeys';

describe('Palette hotkeys', () => {
  it('1 to 9 pick the first nine pieces and 0 the tenth, in palette order', () => {
    expect(ALL_PIECES.map((_, i) => pieceKey(i))).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
    ALL_PIECES.forEach((piece, i) => expect(pieceForKey(pieceKey(i)!)).toBe(piece));
  });

  it('other keys pick nothing', () => {
    for (const key of ['a', 'r', '!', ' ', '10', 'F1']) expect(pieceForKey(key)).toBeNull();
    expect(pieceKey(10)).toBeNull();
  });
});
