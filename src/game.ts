// Pure Klondike solitaire rules. Every function returns a new state and never
// mutates its input, which keeps undo trivial (just keep old states around).

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export interface Card {
  id: string;
  suit: Suit;
  rank: number; // 1 (Ace) .. 13 (King)
  faceUp: boolean;
}

export type DrawCount = 1 | 3;

export interface GameState {
  stock: Card[];
  waste: Card[];
  foundations: Card[][]; // 4 piles, built up by suit from Ace
  tableau: Card[][]; // 7 piles, built down in alternating colours
  drawCount: DrawCount;
  moves: number;
}

export type Location =
  | { pile: 'waste' }
  | { pile: 'foundation'; index: number }
  | { pile: 'tableau'; index: number; cardIndex: number };

export type Target = { pile: 'foundation'; index: number } | { pile: 'tableau'; index: number };

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

export const SUIT_SYMBOL: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const RANK_LABEL = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const rankLabel = (rank: number) => RANK_LABEL[rank];

export const isRed = (suit: Suit) => suit === 'hearts' || suit === 'diamonds';

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ id: `${rank}-${suit}`, suit, rank, faceUp: false });
    }
  }
  return deck;
}

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function deal(drawCount: DrawCount, random: () => number = Math.random): GameState {
  const deck = shuffle(createDeck(), random);
  const tableau: Card[][] = [];
  let next = 0;
  for (let pile = 0; pile < 7; pile++) {
    const cards: Card[] = [];
    for (let i = 0; i <= pile; i++) {
      cards.push({ ...deck[next++], faceUp: i === pile });
    }
    tableau.push(cards);
  }
  return {
    stock: deck.slice(next),
    waste: [],
    foundations: [[], [], [], []],
    tableau,
    drawCount,
    moves: 0,
  };
}

const last = <T,>(items: T[]): T | undefined => items[items.length - 1];

/** Deal from the stock to the waste, or recycle the waste when the stock is empty. */
export function draw(state: GameState): GameState {
  if (state.stock.length === 0) {
    if (state.waste.length === 0) return state;
    return {
      ...state,
      stock: state.waste.slice().reverse().map((c) => ({ ...c, faceUp: false })),
      waste: [],
      moves: state.moves + 1,
    };
  }
  const count = Math.min(state.drawCount, state.stock.length);
  const drawn = state.stock
    .slice(-count)
    .reverse()
    .map((c) => ({ ...c, faceUp: true }));
  return {
    ...state,
    stock: state.stock.slice(0, -count),
    waste: [...state.waste, ...drawn],
    moves: state.moves + 1,
  };
}

/** The cards that would be picked up from a location (a single card, or a tableau run). */
export function cardsAt(state: GameState, from: Location): Card[] {
  switch (from.pile) {
    case 'waste': {
      const top = last(state.waste);
      return top ? [top] : [];
    }
    case 'foundation': {
      const top = last(state.foundations[from.index]);
      return top ? [top] : [];
    }
    case 'tableau': {
      const pile = state.tableau[from.index];
      const run = pile.slice(from.cardIndex);
      return run.length > 0 && isValidRun(run) ? run : [];
    }
  }
}

function isValidRun(cards: Card[]): boolean {
  for (let i = 0; i < cards.length; i++) {
    if (!cards[i].faceUp) return false;
    if (i > 0) {
      const above = cards[i - 1];
      const below = cards[i];
      if (isRed(above.suit) === isRed(below.suit) || above.rank !== below.rank + 1) return false;
    }
  }
  return true;
}

export function canPlaceOnFoundation(card: Card, foundation: Card[]): boolean {
  const top = last(foundation);
  if (!top) return card.rank === 1;
  return top.suit === card.suit && card.rank === top.rank + 1;
}

export function canPlaceOnTableau(card: Card, pile: Card[]): boolean {
  const top = last(pile);
  if (!top) return card.rank === 13;
  return top.faceUp && isRed(top.suit) !== isRed(card.suit) && card.rank === top.rank - 1;
}

export function canMove(state: GameState, from: Location, to: Target): boolean {
  const cards = cardsAt(state, from);
  if (cards.length === 0) return false;
  if (from.pile === to.pile && from.index === to.index) return false;
  if (to.pile === 'foundation') {
    return cards.length === 1 && canPlaceOnFoundation(cards[0], state.foundations[to.index]);
  }
  return canPlaceOnTableau(cards[0], state.tableau[to.index]);
}

/** Apply a move. Returns the original state unchanged if the move is illegal. */
export function move(state: GameState, from: Location, to: Target): GameState {
  if (!canMove(state, from, to)) return state;
  const cards = cardsAt(state, from);
  const next: GameState = {
    ...state,
    foundations: state.foundations.slice(),
    tableau: state.tableau.slice(),
    moves: state.moves + 1,
  };

  if (from.pile === 'waste') {
    next.waste = state.waste.slice(0, -1);
  } else if (from.pile === 'foundation') {
    next.foundations[from.index] = state.foundations[from.index].slice(0, -1);
  } else {
    const remaining = state.tableau[from.index].slice(0, from.cardIndex);
    const top = last(remaining);
    if (top && !top.faceUp) remaining[remaining.length - 1] = { ...top, faceUp: true };
    next.tableau[from.index] = remaining;
  }

  if (to.pile === 'foundation') {
    next.foundations[to.index] = [...next.foundations[to.index], ...cards];
  } else {
    next.tableau[to.index] = [...next.tableau[to.index], ...cards];
  }
  return next;
}

/**
 * Pick the best destination for a clicked card: a foundation if possible,
 * otherwise a tableau pile (preferring non-empty piles over empty ones).
 */
export function findAutoTarget(state: GameState, from: Location): Target | null {
  const cards = cardsAt(state, from);
  if (cards.length === 0) return null;
  if (from.pile !== 'foundation' && cards.length === 1) {
    for (let i = 0; i < 4; i++) {
      const to: Target = { pile: 'foundation', index: i };
      if (canMove(state, from, to)) return to;
    }
  }
  const candidates: Target[] = [];
  for (let i = 0; i < 7; i++) {
    const to: Target = { pile: 'tableau', index: i };
    if (canMove(state, from, to)) candidates.push(to);
  }
  // Moving a King that already sits at the bottom of a pile to another empty pile is pointless.
  const useful = candidates.filter(
    (to) =>
      !(
        from.pile === 'tableau' &&
        from.cardIndex === 0 &&
        state.tableau[to.index].length === 0
      ),
  );
  return useful.find((to) => state.tableau[to.index].length > 0) ?? useful[0] ?? null;
}

export function isWon(state: GameState): boolean {
  return state.foundations.every((f) => f.length === 13);
}

/** True once every remaining card is visible, so the game can finish itself. */
export function canAutoComplete(state: GameState): boolean {
  return (
    !isWon(state) &&
    state.stock.length === 0 &&
    state.waste.length === 0 &&
    state.tableau.every((pile) => pile.every((c) => c.faceUp))
  );
}

/** Make a single card-to-foundation move, if one exists. */
export function autoMoveStep(state: GameState): GameState | null {
  const sources: Location[] = [{ pile: 'waste' }];
  state.tableau.forEach((pile, index) => {
    if (pile.length > 0) sources.push({ pile: 'tableau', index, cardIndex: pile.length - 1 });
  });
  for (const from of sources) {
    for (let i = 0; i < 4; i++) {
      const to: Target = { pile: 'foundation', index: i };
      if (canMove(state, from, to)) return move(state, from, to);
    }
  }
  return null;
}
