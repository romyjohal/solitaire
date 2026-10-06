import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardBackFace } from './Card';
import { CARD_BACKS } from './cardLayout';
import { Cascade } from './Cascade';
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
import { Dialog, type Menu, MenuBar, SolitaireIcon, TitleBar } from './Win95';

const STORAGE_KEY = 'solitaire:v2';
const PREFS_KEY = 'solitaire:prefs';
const DRAG_THRESHOLD = 6;

type Scoring = 'standard' | 'none';

interface Prefs {
  back: string;
  scoring: Scoring;
  timed: boolean;
  statusBar: boolean;
}

const DEFAULT_PREFS: Prefs = { back: 'weave-blue', scoring: 'standard', timed: true, statusBar: true };

interface Saved {
  history: GameState[];
  elapsed: number;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
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

type DialogName = 'options' | 'deck' | 'about' | 'dealAgain' | null;

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

/** Windows standard scoring: -2 points every 10 seconds, and a time bonus on winning. */
function displayedScore(state: GameState, elapsed: number, prefs: Prefs, won: boolean) {
  if (!prefs.timed) return state.score;
  const score = Math.max(0, state.score - 2 * Math.floor(elapsed / 10));
  return won && elapsed >= 30 ? score + Math.floor(700000 / elapsed) : score;
}

export default function App() {
  const [saved] = useState(() => {
    const s = readJson<Saved>(STORAGE_KEY);
    return s?.history?.length ? s : null;
  });
  const [history, setHistory] = useState<GameState[]>(() => saved?.history ?? [deal(1)]);
  const [elapsed, setElapsed] = useState(saved?.elapsed ?? 0);
  const [prefs, setPrefs] = useState<Prefs>(() => ({ ...DEFAULT_PREFS, ...readJson<Partial<Prefs>>(PREFS_KEY) }));
  const [drag, setDrag] = useState<Drag | null>(null);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [dialog, setDialog] = useState<DialogName>(null);
  const [helpText, setHelpText] = useState('');
  const [maximized, setMaximized] = useState(false);
  const [closed, setClosed] = useState(false);
  // Win cascade: null when not running, otherwise how many cards have been launched.
  const [cascade, setCascade] = useState<number | null>(null);
  const state = history[history.length - 1];
  const won = isWon(state);

  const stateRef = useRef(state);
  stateRef.current = state;
  const pendingRef = useRef<Pending | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const busy = autoPlaying || cascade !== null || dialog !== null;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  const apply = useCallback((next: GameState) => {
    setHistory((h) => (next === h[h.length - 1] ? h : [...h, next]));
  }, []);

  const newGame = useCallback((drawCount: DrawCount) => {
    setHistory([deal(drawCount)]);
    setElapsed(0);
    setAutoPlaying(false);
    setCascade(null);
    setDialog(null);
  }, []);

  const undo = useCallback(() => {
    setAutoPlaying(false);
    setHistory((h) => (h.length > 1 && !isWon(h[h.length - 1]) ? h.slice(0, -1) : h));
  }, []);

  useEffect(() => writeJson(STORAGE_KEY, { history: history.slice(-200), elapsed }), [history, elapsed]);
  useEffect(() => writeJson(PREFS_KEY, prefs), [prefs]);

  // Clock runs once the first move is made and stops when the game is won.
  const running = prefs.timed && state.moves > 0 && !won && !closed;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') setElapsed((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  // Start the bouncing-cards celebration as soon as the last card lands.
  useEffect(() => {
    if (won) {
      setAutoPlaying(false);
      setCascade(0);
    }
  }, [won]);

  const endCascade = useCallback(() => {
    setCascade(null);
    setDialog('dealAgain');
  }, []);

  // Auto-play sends one card to the foundations per tick until none can go.
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
      if (e.key === 'F2') {
        e.preventDefault();
        newGame(stateRef.current.drawCount);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, newGame]);

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
          targetFromPoint(e.clientX - current.offsetX + 10, e.clientY - current.offsetY + 10);
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
    if (e.button !== 0 || busyRef.current) return;
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
    if (from.pile === 'foundation' && loc.pile === 'foundation') return from.index === loc.index;
    return from.pile === loc.pile;
  };

  const onStock = () => {
    if (busy || won) return;
    apply(draw(state));
  };

  // Right-clicking the table plays every available card to the foundations, as in Windows.
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!busy && !won && autoMoveStep(state)) setAutoPlaying(true);
  };

  const changeOptions = (next: Prefs, drawCount: DrawCount) => {
    const redeal = drawCount !== state.drawCount || next.scoring !== prefs.scoring;
    setPrefs(next);
    setDialog(null);
    if (redeal) newGame(drawCount);
  };

  const menus: Menu[] = [
    {
      label: '&Game',
      items: [
        { label: '&Deal', shortcut: 'F2', help: 'Deal a new game', onSelect: () => newGame(state.drawCount) },
        'separator',
        { label: '&Undo', help: 'Undo last action', disabled: history.length < 2 || won, onSelect: undo },
        { label: 'De&ck...', help: 'Choose new deck back', onSelect: () => setDialog('deck') },
        { label: '&Options...', help: 'Change Solitaire options', onSelect: () => setDialog('options') },
        {
          label: '&Auto-play',
          help: 'Play all available cards to the foundations',
          disabled: won || !autoMoveStep(state),
          onSelect: () => setAutoPlaying(true),
        },
        'separator',
        { label: 'E&xit', help: 'Quit Solitaire', onSelect: () => setClosed(true) },
      ],
    },
    {
      label: '&Help',
      items: [{ label: '&About Solitaire...', help: 'About Solitaire', onSelect: () => setDialog('about') }],
    },
  ];

  const fanWaste = state.drawCount === 3;
  // Draw 3 fans the top three cards; draw 1 keeps one card underneath for dragging.
  const visibleWaste = state.waste.slice(fanWaste ? -3 : -2);
  const wasteOffset = state.waste.length - visibleWaste.length;
  const score = displayedScore(state, elapsed, prefs, won);

  // During the cascade, launched cards leave the foundations in K,K,K,K,Q,... order.
  // Once it has finished, the cards have all bounced away and the table stays empty.
  const foundationShown = (index: number) => {
    if (cascade !== null) return 13 - Math.floor((cascade - index + 3) / 4);
    return won ? 0 : 13;
  };

  if (closed) {
    return (
      <div className="desktop">
        <button className="desktop-icon" onDoubleClick={() => setClosed(false)} onClick={(e) => e.currentTarget.focus()}>
          <SolitaireIcon size={32} />
          <span>Solitaire</span>
        </button>
        <p className="desktop-hint">Double-click the icon to play again.</p>
      </div>
    );
  }

  return (
    <div className={`desktop${maximized ? ' maximized' : ''}`}>
      <div className="window game-window">
        <TitleBar
          title="Solitaire"
          icon
          maximized={maximized}
          onMinimize={() => setClosed(true)}
          onMaximize={() => setMaximized((m) => !m)}
          onClose={() => setClosed(true)}
        />
        <MenuBar menus={menus} onHelpText={setHelpText} />

        <main className="table" onContextMenu={onContextMenu}>
          <div className="top-row">
            <div className="slot stock" onClick={onStock} role="button" aria-label="Stock">
              {state.stock.length > 0 ? (
                <CardBackFace back={prefs.back} />
              ) : (
                <div className={`empty ${state.waste.length > 0 ? 'redeal' : 'no-redeal'}`} />
              )}
            </div>

            <div className="slot waste">
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

            {state.foundations.map((fullPile, index) => {
              const pile = fullPile.slice(0, foundationShown(index));
              const top = pile[pile.length - 1];
              const loc: Location = { pile: 'foundation', index };
              return (
                <div key={index} className="slot foundation" data-target={`foundation-${index}`}>
                  <div className="empty" />
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
              // Squash long runs so tall columns still fit in the window.
              const squeeze = Math.min(1, 12 / Math.max(1, faceUp + faceDown * 0.25));
              let offset = 0;
              return (
                <div key={index} className="column" data-target={`tableau-${index}`}>
                  {pile.map((card, cardIndex) => {
                    const loc: Location = { pile: 'tableau', index, cardIndex };
                    const top = `calc(${offset.toFixed(4)} * var(--card-h))`;
                    offset += card.faceUp ? 0.2 * squeeze : 0.04;
                    return (
                      <Card
                        key={card.id}
                        card={card}
                        back={prefs.back}
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

          {canAutoComplete(state) && !autoPlaying && (
            <button className="button auto-complete" onClick={() => setAutoPlaying(true)}>
              Auto-complete
            </button>
          )}

          {cascade !== null && <Cascade foundations={state.foundations} onLaunch={setCascade} onDone={endCascade} />}
        </main>

        {prefs.statusBar && (
          <div className="status-bar">
            <div className="status-field help">{helpText}</div>
            <div className="status-field score">
              {prefs.scoring === 'standard' && <span>Score: {score}</span>}
              {prefs.timed && <span>Time: {elapsed}</span>}
            </div>
          </div>
        )}

        {dialog === 'options' && (
          <OptionsDialog
            prefs={prefs}
            drawCount={state.drawCount}
            onOk={changeOptions}
            onCancel={() => setDialog(null)}
          />
        )}
        {dialog === 'deck' && (
          <DeckDialog
            current={prefs.back}
            onOk={(back) => {
              setPrefs({ ...prefs, back });
              setDialog(null);
            }}
            onCancel={() => setDialog(null)}
          />
        )}
        {dialog === 'about' && (
          <Dialog title="About Solitaire" onClose={() => setDialog(null)} className="about">
            <div className="about-body">
              <SolitaireIcon size={32} />
              <div>
                <p>
                  <strong>Solitaire</strong>
                </p>
                <p>A tribute to the Windows 95 classic, built with React.</p>
                <p>Tip: right-click the table to play every available card to the foundations.</p>
              </div>
            </div>
            <div className="dialog-buttons">
              <button className="button default" autoFocus onClick={() => setDialog(null)}>
                OK
              </button>
            </div>
          </Dialog>
        )}
        {dialog === 'dealAgain' && (
          <Dialog title="Solitaire" onClose={() => setDialog(null)}>
            <div className="message">
              <span className="message-icon">?</span>
              <span>Deal again?</span>
            </div>
            <div className="dialog-buttons">
              <button className="button default" autoFocus onClick={() => newGame(state.drawCount)}>
                <u>Y</u>es
              </button>
              <button className="button" onClick={() => setDialog(null)}>
                <u>N</u>o
              </button>
            </div>
          </Dialog>
        )}
      </div>

      {drag && (
        <div className="drag-layer" style={{ left: drag.x - drag.offsetX, top: drag.y - drag.offsetY }}>
          {drag.cards.map((card, i) => (
            <Card key={card.id} card={card} style={{ top: `calc(${i * 0.2} * var(--card-h))` }} />
          ))}
        </div>
      )}
    </div>
  );
}

interface OptionsDialogProps {
  prefs: Prefs;
  drawCount: DrawCount;
  onOk: (prefs: Prefs, drawCount: DrawCount) => void;
  onCancel: () => void;
}

function OptionsDialog({ prefs, drawCount, onOk, onCancel }: OptionsDialogProps) {
  const [draft, setDraft] = useState(prefs);
  const [drawDraft, setDrawDraft] = useState(drawCount);
  return (
    <Dialog title="Options" onClose={onCancel} className="options">
      <div className="options-grid">
        <fieldset className="group">
          <legend>Draw</legend>
          <label>
            <input type="radio" checked={drawDraft === 1} onChange={() => setDrawDraft(1)} />
            <span>Draw <u>O</u>ne</span>
          </label>
          <label>
            <input type="radio" checked={drawDraft === 3} onChange={() => setDrawDraft(3)} />
            <span>Draw <u>T</u>hree</span>
          </label>
        </fieldset>
        <fieldset className="group">
          <legend>Scoring</legend>
          <label>
            <input
              type="radio"
              checked={draft.scoring === 'standard'}
              onChange={() => setDraft({ ...draft, scoring: 'standard' })}
            />
            <span><u>S</u>tandard</span>
          </label>
          <label>
            <input
              type="radio"
              checked={draft.scoring === 'none'}
              onChange={() => setDraft({ ...draft, scoring: 'none' })}
            />
            <span><u>N</u>one</span>
          </label>
        </fieldset>
      </div>
      <div className="options-checks">
        <label>
          <input type="checkbox" checked={draft.timed} onChange={(e) => setDraft({ ...draft, timed: e.target.checked })} />
          <span>Timed g<u>a</u>me</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={draft.statusBar}
            onChange={(e) => setDraft({ ...draft, statusBar: e.target.checked })}
          />
          <span>Status <u>b</u>ar</span>
        </label>
      </div>
      <div className="dialog-buttons">
        <button className="button default" onClick={() => onOk(draft, drawDraft)}>
          OK
        </button>
        <button className="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </Dialog>
  );
}

interface DeckDialogProps {
  current: string;
  onOk: (back: string) => void;
  onCancel: () => void;
}

function DeckDialog({ current, onOk, onCancel }: DeckDialogProps) {
  const [selected, setSelected] = useState(current);
  return (
    <Dialog title="Select Card Back" onClose={onCancel} className="deck">
      <div className="deck-grid">
        {CARD_BACKS.map((back) => (
          <button
            key={back.id}
            className={`deck-choice${selected === back.id ? ' selected' : ''}`}
            aria-label={back.name}
            aria-pressed={selected === back.id}
            onClick={() => setSelected(back.id)}
            onDoubleClick={() => onOk(back.id)}
          >
            <CardBackFace back={back.id} />
          </button>
        ))}
      </div>
      <div className="dialog-buttons">
        <button className="button default" onClick={() => onOk(selected)}>
          OK
        </button>
        <button className="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </Dialog>
  );
}
