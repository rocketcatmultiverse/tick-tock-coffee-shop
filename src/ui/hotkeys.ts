// Number keys pick from the build palette: 1 is its first piece, 9 the ninth
// and 0 the tenth, in palette order.

import { ALL_PIECES, type PieceKind } from '../game/pieces';

/** The key that picks the palette piece at `index`, or null past the tenth. */
export function pieceKey(index: number): string | null {
  return index < 10 ? String((index + 1) % 10) : null;
}

/** The palette piece a key picks, or null if the key picks none. */
export function pieceForKey(key: string): PieceKind | null {
  if (!/^[0-9]$/.test(key)) return null;
  return ALL_PIECES[(Number(key) + 9) % 10] ?? null;
}
