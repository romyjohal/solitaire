// Pip positions for number cards, as percentages of the card face, matching
// the traditional layout used by the Windows card deck.
const L = 32;
const C = 50;
const R = 68;

export const PIPS: Record<number, [number, number][]> = {
  1: [[C, 50]],
  2: [[C, 20], [C, 80]],
  3: [[C, 20], [C, 50], [C, 80]],
  4: [[L, 20], [R, 20], [L, 80], [R, 80]],
  5: [[L, 20], [R, 20], [C, 50], [L, 80], [R, 80]],
  6: [[L, 20], [R, 20], [L, 50], [R, 50], [L, 80], [R, 80]],
  7: [[L, 20], [R, 20], [C, 35], [L, 50], [R, 50], [L, 80], [R, 80]],
  8: [[L, 20], [R, 20], [C, 35], [L, 50], [R, 50], [C, 65], [L, 80], [R, 80]],
  9: [[L, 20], [R, 20], [L, 40], [R, 40], [C, 50], [L, 60], [R, 60], [L, 80], [R, 80]],
  10: [[L, 20], [R, 20], [C, 30], [L, 40], [R, 40], [L, 60], [R, 60], [C, 70], [L, 80], [R, 80]],
};

/** Figures shown inside the frame of the court cards. */
export const COURT_FIGURE: Record<number, string> = { 11: '♞', 12: '♛', 13: '♚' };

export interface CardBack {
  id: string;
  name: string;
}

export const CARD_BACKS: CardBack[] = [
  { id: 'weave-blue', name: 'Blue weave' },
  { id: 'weave-red', name: 'Red weave' },
  { id: 'dots', name: 'Dots' },
  { id: 'lattice', name: 'Lattice' },
  { id: 'bricks', name: 'Bricks' },
  { id: 'waves', name: 'Waves' },
];
