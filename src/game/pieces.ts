import type { Structure, StructureKind } from '../sim/types';

/** What the palette sells. A chute is one piece covering a launch and a catch. */
export type PieceKind =
  | 'belt'
  | 'plot'
  | 'kettle'
  | 'well'
  | 'spring'
  | 'chute'
  | 'roaster'
  | 'door'
  | 'mixer'
  | 'splitter';

export const ALL_PIECES: readonly PieceKind[] = [
  'belt',
  'plot',
  'kettle',
  'well',
  'spring',
  'chute',
  'roaster',
  'door',
  'mixer',
  'splitter',
];

export const PIECE_LABEL: Record<PieceKind, string> = {
  belt: 'Belt',
  plot: 'Plot',
  kettle: 'Kettle',
  well: 'Well',
  chute: 'Chute',
  roaster: 'Roaster',
  mixer: 'Mixer',
  door: 'Side door',
  spring: 'Spring',
  splitter: 'Splitter',
};

/** The palette piece a structure belongs to; null for the fixed bowl and feeder. */
export function pieceOf(kind: StructureKind): PieceKind | null {
  switch (kind) {
    case 'launch':
    case 'catch':
      return 'chute';
    case 'bowl':
    case 'feeder':
      return null;
    default:
      return kind;
  }
}

/** Pieces that cannot be selected, cut or deleted. */
export function isFixed(s: Structure | null): boolean {
  return !!s && (s.kind === 'bowl' || s.kind === 'feeder');
}
