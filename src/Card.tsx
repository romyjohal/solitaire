import type { CSSProperties, PointerEvent } from 'react';
import { type Card as CardData, SUIT_SYMBOL, isRed, rankLabel } from './game';

interface CardProps {
  card: CardData;
  style?: CSSProperties;
  className?: string;
  onPointerDown?: (e: PointerEvent<HTMLDivElement>) => void;
}

export function Card({ card, style, className = '', onPointerDown }: CardProps) {
  if (!card.faceUp) {
    return <div className={`card back ${className}`} style={style} onPointerDown={onPointerDown} />;
  }
  const symbol = SUIT_SYMBOL[card.suit];
  const label = rankLabel(card.rank);
  return (
    <div
      className={`card face ${isRed(card.suit) ? 'red' : 'black'} ${className}`}
      style={style}
      onPointerDown={onPointerDown}
      aria-label={`${label} of ${card.suit}`}
    >
      <div className="corner top">
        <span className="rank">{label}</span>
        <span className="suit">{symbol}</span>
      </div>
      <div className="pip">{card.rank > 10 ? label : symbol}</div>
      <div className="corner bottom">
        <span className="rank">{label}</span>
        <span className="suit">{symbol}</span>
      </div>
    </div>
  );
}
