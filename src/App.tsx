import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Card } from './Card';
import {
  type Card as CardData,
  type DrawCount,
  type GameState,
  type Location,
  type Target,
  autoMoveStep,
  canAutoComplete,
  canMove,
  cardsAt,
  deal,
  draw,
  findAutoTarget,
  isWon,
  move,
} from './game';

const STORAGE_KEY = 'solitaire:v1';
const DRAG_THRESHOLD = 6;

interface Saved {
  history: GameState[];
  elapsed: number;
}

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Saved;
    return saved.history?.length ? saved : null;
  } catch {
    return null;
  }
}

function save(saved: Saved) {
  try {
    // Keep the undo stack bounded so storage never grows without limit.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, history: saved.history.slice(-200) }));
  } catch {
    // Storage may be unavailable (private mode, quota); the game still works.
  }
}

interface Drag {
  from: Location;
  cards: CardData[];
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
}

interface Pending {
  from: Location;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
}

const sameLocation = (a: Location, b: Location) =>
  a.pile === b.pile &&
  (a.pile === 'waste' ||
    (a.pile === 'foundation' && b.pile === 'foundation' && a.index === b.index) ||
    (a.pile === 'tableau' && b.pile === 'tableau' && a.index === b.index && a.cardIndex === b.cardIndex));

function targetFromPoint(x: number, y: number): Target | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const target = (el as HTMLElement).closest<HTMLElement>('[data-target]')?.dataset.target;
    if (target) {
      const [pile, index] = target.split('-');
      return { pile: pile as Target['pile'], index: Number(index) };
    }
  }
  return null;
}

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export default function App() {
  const [saved] = useState(load);
  const [history, setHistory] = useState<GameState[]>(() => saved?.history ?? [deal(1)]);
  const [elapsed, setElapsed] = useState(saved?.elapsed ?? 0);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const state = history[history.length - 1];
  const won = isWon(state);

  const stateRef = useRef(state);
  stateRef.current = state;
  const pendingRef = useRef<Pending | null>(null);
  const dragRef = useRef<Drag | null>(null);

  const apply = useCallback((next: GameState) => {
    setHistory((h) => (next === h[h.length - 1] ? h : [...h, next]));
  }, []);

  const newGame = useCallback((drawCount: DrawCount) => {
    setHistory([deal(drawCount)]);
    setElapsed(0);
    setAutoPlaying(false);
  }, []);

  const undo = useCallback(() => {
    setAutoPlaying(false);
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  }, []);

  useEffect(() => save({ history, elapsed }), [history, elapsed]);

  // Clock runs once the first move is made and stops when the game is won.
  const running = state.moves > 0 && !won;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') setElapsed((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  // Auto-complete plays one card to the foundations per tick.
  useEffect(() => {
    if (!autoPlaying) return;
    const id = setInterval(() => {
      const next = autoMoveStep(stateRef.current);
      if (next) apply(next);
      else setAutoPlaying(false);
    }, 90);
    return () => clearInterval(id);
  }, [autoPlaying, apply]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);

  // Pointer handling: a press that moves past the threshold becomes a drag,
  // otherwise it is treated as a click that sends the card somewhere useful.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const pending = pendingRef.current;
      if (!pending) return;
      if (!dragRef.current) {
        if (Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY) < DRAG_THRESHOLD) return;
        const cards = cardsAt(stateRef.current, pending.from);
        if (cards.length === 0) {
          pendingRef.current = null;
          return;
        }
        dragRef.current = { from: pending.from, cards, x: 0, y: 0, offsetX: pending.offsetX, offsetY: pending.offsetY };
      }
      dragRef.current = { ...dragRef.current, x: e.clientX, y: e.clientY };
      setDrag(dragRef.current);
    };

    const onUp = (e: PointerEvent) => {
      const pending = pendingRef.current;
      const current = dragRef.current;
      pendingRef.current = null;
      dragRef.current = null;
      if (!pending) return;
      const game = stateRef.current;
      if (current) {
        setDrag(null);
        const target =
          targetFromPoint(e.clientX, e.clientY) ??
          targetFromPoint(e.clientX - current.offsetX + 20, e.clientY - current.offsetY + 20);
        if (target && canMove(game, current.from, target)) apply(move(game, current.from, target));
      } else {
        const target = findAutoTarget(game, pending.from);
        if (target) apply(move(game, pending.from, target));
      }
    };

    const onCancel = () => {
      pendingRef.current = null;
      dragRef.current = null;
      setDrag(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [apply]);

  const startPress = (from: Location) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || autoPlaying || won) return;
    if (cardsAt(state, from).length === 0) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    pendingRef.current = {
      from,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
  };

  const isDragged = (loc: Location) => {
    if (!drag) return false;
    const from = drag.from;
    if (from.pile === 'tableau' && loc.pile === 'tableau') {
      return from.index === loc.index && loc.cardIndex >= from.cardIndex;
    }
    return sameLocation(from, loc);
  };

  const dropClass = (target: Target) => (drag && canMove(state, drag.from, target) ? ' droppable' : '');

  const onStock = () => {
    if (autoPlaying || won) return;
    apply(draw(state));
  };

  // Draw 3 fans the top three cards; draw 1 keeps one card underneath for dragging.
  const fanWaste = state.drawCount === 3;
  const visibleWaste = state.waste.slice(fanWaste ? -3 : -2);
  const wasteOffset = state.waste.length - visibleWaste.length;

  return (
    <div className="app">
      <header className="toolbar">
        <h1>Solitaire</h1>
        <div className="stats">
          <span>Moves {state.moves}</span>
          <span>{formatTime(elapsed)}</span>
        </div>
        <div className="actions">
          <select
            aria-label="Draw mode"
            value={state.drawCount}
            onChange={(e) => newGame(Number(e.target.value) as DrawCount)}
          >
            <option value={1}>Draw 1</option>
            <option value={3}>Draw 3</option>
          </select>
          <button onClick={undo} disabled={history.length < 2}>
            Undo
          </button>
          <button onClick={() => newGame(state.drawCount)}>New game</button>
        </div>
      </header>

      <main className="table">
        <div className="top-row">
          <div className="slot stock" onClick={onStock} role="button" aria-label="Stock">
            {state.stock.length > 0 ? (
              <Card card={state.stock[state.stock.length - 1]} />
            ) : (
              <div className="empty recycle">{state.waste.length > 0 ? '↻' : ''}</div>
            )}
          </div>

          <div className="slot waste">
            {visibleWaste.length === 0 && <div className="empty" />}
            {visibleWaste.map((card, i) => {
              const isTop = wasteOffset + i === state.waste.length - 1;
              return (
                <Card
                  key={card.id}
                  card={card}
                  className={isTop && isDragged({ pile: 'waste' }) ? 'dragging-source' : ''}
                  style={{ left: `calc(var(--waste-fan) * ${fanWaste ? i : 0})`, zIndex: i }}
                  onPointerDown={isTop ? startPress({ pile: 'waste' }) : undefined}
                />
              );
            })}
          </div>

          <div className="spacer" />

          {state.foundations.map((pile, index) => {
            const top = pile[pile.length - 1];
            const loc: Location = { pile: 'foundation', index };
            return (
              <div
                key={index}
                className={`slot foundation${dropClass({ pile: 'foundation', index })}`}
                data-target={`foundation-${index}`}
              >
                <div className="empty">A</div>
                {pile.length > 1 && <Card card={pile[pile.length - 2]} />}
                {top && (
                  <Card
                    key={top.id}
                    card={top}
                    className={isDragged(loc) ? 'dragging-source' : ''}
                    onPointerDown={startPress(loc)}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="tableau">
          {state.tableau.map((pile, index) => {
            const faceUp = pile.filter((c) => c.faceUp).length;
            const faceDown = pile.length - faceUp;
            // Squash long runs so tall columns still fit on screen.
            const squeeze = Math.min(1, 11 / Math.max(1, faceUp + faceDown * 0.4));
            let offset = 0;
            return (
              <div
                key={index}
                className={`column${dropClass({ pile: 'tableau', index })}`}
                data-target={`tableau-${index}`}
              >
                <div className="empty" />
                {pile.map((card, cardIndex) => {
                  const loc: Location = { pile: 'tableau', index, cardIndex };
                  const top = `calc(${offset.toFixed(3)} * var(--card-h))`;
                  offset += (card.faceUp ? 0.26 : 0.1) * squeeze;
                  return (
                    <Card
                      key={card.id}
                      card={card}
                      className={isDragged(loc) ? 'dragging-source' : ''}
                      style={{ top }}
                      onPointerDown={card.faceUp ? startPress(loc) : undefined}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </main>

      {canAutoComplete(state) && !autoPlaying && (
        <button className="auto-complete" onClick={() => setAutoPlaying(true)}>
          Auto-complete
        </button>
      )}

      {drag && (
        <div
          className="drag-layer"
          style={{ left: drag.x - drag.offsetX, top: drag.y - drag.offsetY }}
        >
          {drag.cards.map((card, i) => (
            <Card key={card.id} card={card} style={{ top: `calc(${i * 0.26} * var(--card-h))` }} />
          ))}
        </div>
      )}

      {won && (
        <div className="win-overlay">
          <div className="win-dialog">
            <h2>You won! 🎉</h2>
            <p>
              {state.moves} moves in {formatTime(elapsed)}
            </p>
            <button onClick={() => newGame(state.drawCount)}>Play again</button>
          </div>
        </div>
      )}
    </div>
  );
}
