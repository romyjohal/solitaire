import type { CSSProperties, PointerEvent } from 'react';
import { COURT_FIGURE, PIPS } from './cardLayout';
import { type Card as CardData, SUIT_SYMBOL, isRed, rankLabel } from './game';

interface CardProps {
  card: CardData;
  back?: string;
  style?: CSSProperties;
  className?: string;
  onPointerDown?: (e: PointerEvent<HTMLDivElement>) => void;
}

export function CardBackFace({ back, className = '', style, onPointerDown }: Omit<CardProps, 'card'>) {
  return (
    <div className={`card back back-${back ?? 'weave-blue'} ${className}`} style={style} onPointerDown={onPointerDown}>
      <div className="back-pattern" />
    </div>
  );
}

export function Card({ card, back, style, className = '', onPointerDown }: CardProps) {
  if (!card.faceUp) {
    return <CardBackFace back={back} className={className} style={style} onPointerDown={onPointerDown} />;
  }
  const symbol = SUIT_SYMBOL[card.suit];
  const label = rankLabel(card.rank);
  const court = COURT_FIGURE[card.rank];
  return (
    <div
      className={`card face ${isRed(card.suit) ? 'red' : 'black'} ${className}`}
      style={style}
      onPointerDown={onPointerDown}
      aria-label={`${label} of ${card.suit}`}
    >
      <div className="index top">
        <span className="rank">{label}</span>
        <span className="suit">{symbol}</span>
      </div>
      <div className="index bottom">
        <span className="rank">{label}</span>
        <span className="suit">{symbol}</span>
      </div>
      {court ? (
        <div className="court">
          <span className="court-suit tl">{symbol}</span>
          <span className="figure">{court}</span>
          <span className="figure flipped">{court}</span>
          <span className="court-suit br">{symbol}</span>
        </div>
      ) : (
        <div className={`pips${card.rank === 1 ? ' ace' : ''}`}>
          {PIPS[card.rank].map(([x, y], i) => (
            <span key={i} className={`pip${y > 50 ? ' flipped' : ''}`} style={{ left: `${x}%`, top: `${y}%` }}>
              {symbol}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
