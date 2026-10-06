import { describe, expect, it } from 'vitest';
import {
  type Card,
  type GameState,
  autoMoveStep,
  canAutoComplete,
  deal,
  draw,
  findAutoTarget,
  isWon,
  move,
} from './game';

const c = (rank: number, suit: Card['suit'], faceUp = true): Card => ({ id: `${rank}-${suit}`, suit, rank, faceUp });

const empty = (overrides: Partial<GameState> = {}): GameState => ({
  stock: [],
  waste: [],
  foundations: [[], [], [], []],
  tableau: [[], [], [], [], [], [], []],
  drawCount: 1,
  moves: 0,
  score: 0,
  passes: 0,
  ...overrides,
});

describe('deal', () => {
  it('lays out 28 tableau cards with only the top of each pile face up', () => {
    const state = deal(1);
    expect(state.tableau.map((p) => p.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const pile of state.tableau) {
      expect(pile.filter((card) => card.faceUp)).toEqual([pile[pile.length - 1]]);
    }
    expect(state.stock).toHaveLength(24);
    const ids = new Set([...state.stock, ...state.tableau.flat()].map((card) => card.id));
    expect(ids.size).toBe(52);
  });
});

describe('draw', () => {
  it('draws three cards and recycles the waste in the original order', () => {
    const stock = [c(1, 'spades', false), c(2, 'spades', false), c(3, 'spades', false), c(4, 'spades', false)];
    let state = empty({ stock, drawCount: 3 });
    state = draw(state);
    expect(state.waste.map((x) => x.rank)).toEqual([4, 3, 2]);
    expect(state.stock.map((x) => x.rank)).toEqual([1]);
    state = draw(draw(state));
    expect(state.waste).toHaveLength(0);
    expect(state.stock.map((x) => x.rank)).toEqual([1, 2, 3, 4]);
    expect(state.stock.every((x) => !x.faceUp)).toBe(true);
  });
});

describe('move', () => {
  it('moves a run onto an alternating colour and flips the exposed card', () => {
    const state = empty({
      tableau: [[c(9, 'clubs', false), c(7, 'hearts'), c(6, 'spades')], [c(8, 'spades')], [], [], [], [], []],
    });
    const next = move(state, { pile: 'tableau', index: 0, cardIndex: 1 }, { pile: 'tableau', index: 1 });
    expect(next.tableau[1].map((x) => x.id)).toEqual(['8-spades', '7-hearts', '6-spades']);
    expect(next.tableau[0]).toEqual([c(9, 'clubs', true)]);
    expect(next.moves).toBe(1);
    expect(next.score).toBe(5); // turned over a card
  });

  it('rejects illegal moves', () => {
    const state = empty({ tableau: [[c(7, 'spades')], [c(8, 'clubs')], [], [], [], [], []] });
    expect(move(state, { pile: 'tableau', index: 0, cardIndex: 0 }, { pile: 'tableau', index: 1 })).toBe(state);
    expect(move(state, { pile: 'tableau', index: 0, cardIndex: 0 }, { pile: 'tableau', index: 2 })).toBe(state);
  });

  it('only accepts kings on empty tableau piles and aces on empty foundations', () => {
    const state = empty({ waste: [c(1, 'hearts')], tableau: [[c(13, 'hearts')], [], [], [], [], [], []] });
    expect(findAutoTarget(state, { pile: 'waste' })).toEqual({ pile: 'foundation', index: 0 });
    // A king already at the bottom of a pile has nowhere useful to go.
    expect(findAutoTarget(state, { pile: 'tableau', index: 0, cardIndex: 0 })).toBeNull();
  });
});

describe('scoring', () => {
  it('follows Windows standard scoring', () => {
    let state = empty({ waste: [c(1, 'hearts')], stock: [], tableau: [[c(13, 'clubs')], [], [], [], [], [], []] });
    state = move(state, { pile: 'waste' }, { pile: 'foundation', index: 0 });
    expect(state.score).toBe(10);
    state = { ...state, waste: [c(12, 'hearts')] };
    state = move(state, { pile: 'waste' }, { pile: 'tableau', index: 0 });
    expect(state.score).toBe(15);
  });

  it('penalises recycling and never goes below zero', () => {
    const one = draw(empty({ waste: [c(3, 'clubs')], score: 150 }));
    expect(one.score).toBe(50);
    expect(draw(empty({ waste: [c(3, 'clubs')], score: 30 })).score).toBe(0);
    const three = empty({ waste: [c(3, 'clubs')], drawCount: 3, score: 50 });
    expect(draw(three).score).toBe(50);
    expect(draw({ ...three, passes: 2 }).score).toBe(30);
  });
});

describe('auto-complete', () => {
  it('finishes a fully revealed game', () => {
    const suits: Card['suit'][] = ['spades', 'hearts', 'diamonds', 'clubs'];
    const tableau: Card[][] = [[], [], [], [], [], [], []];
    suits.forEach((suit, i) => {
      for (let rank = 13; rank >= 1; rank--) tableau[i].push(c(rank, suit));
    });
    let state: GameState | null = empty({ tableau });
    expect(canAutoComplete(state)).toBe(true);
    let last = state;
    while (state) {
      last = state;
      state = autoMoveStep(state);
    }
    expect(isWon(last)).toBe(true);
  });
});
