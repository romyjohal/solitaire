import { useEffect, useRef } from 'react';
import { COURT_FIGURE, PIPS } from './cardLayout';
import { type Card, SUIT_SYMBOL, isRed, rankLabel } from './game';

interface CascadeProps {
  foundations: Card[][];
  /** Called with the number of cards that have left the foundations so far. */
  onLaunch: (launched: number) => void;
  onDone: () => void;
}

/** Pre-render a card to an offscreen canvas so each animation frame is one drawImage. */
function renderCard(card: Card, w: number, h: number, dpr: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * dpr);
  canvas.height = Math.ceil(h * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const r = w * 0.06;
  ctx.beginPath();
  ctx.roundRect(0.5, 0.5, w - 1, h - 1, r);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();

  const color = isRed(card.suit) ? '#ff0000' : '#000';
  const symbol = SUIT_SYMBOL[card.suit];
  const label = rankLabel(card.rank);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const drawIndex = () => {
    ctx.font = `bold ${w * 0.19}px Arial, sans-serif`;
    ctx.fillText(label, w * 0.12, h * 0.09);
    ctx.font = `${w * 0.17}px Arial, sans-serif`;
    ctx.fillText(symbol, w * 0.12, h * 0.21);
  };
  const rotated = (draw: () => void) => {
    ctx.save();
    ctx.translate(w, h);
    ctx.rotate(Math.PI);
    draw();
    ctx.restore();
  };
  drawIndex();
  rotated(drawIndex);

  const court = COURT_FIGURE[card.rank];
  if (court) {
    const fx = w * 0.22;
    const fy = h * 0.16;
    ctx.fillStyle = '#ffe680';
    ctx.fillRect(fx, fy, w - 2 * fx, h - 2 * fy);
    ctx.strokeStyle = '#0000a0';
    ctx.strokeRect(fx + 0.5, fy + 0.5, w - 2 * fx - 1, h - 2 * fy - 1);
    ctx.fillStyle = color;
    const figure = () => {
      ctx.font = `${w * 0.4}px "Segoe UI Symbol", "DejaVu Sans", sans-serif`;
      ctx.fillText(court, w / 2, h * 0.36);
    };
    figure();
    rotated(figure);
  } else {
    const size = card.rank === 1 ? w * 0.55 : w * 0.24;
    ctx.font = `${size}px Arial, sans-serif`;
    for (const [x, y] of PIPS[card.rank]) {
      const px = (w * x) / 100;
      const py = (h * y) / 100;
      if (y > 50) {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(Math.PI);
        ctx.fillText(symbol, 0, 0);
        ctx.restore();
      } else {
        ctx.fillText(symbol, px, py);
      }
    }
  }
  return canvas;
}

/**
 * The Windows victory animation: cards spring off the foundations one at a
 * time and bounce across the table, leaving a trail because the canvas is
 * never cleared.
 */
export function Cascade({ foundations, onLaunch, onDone }: CascadeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const callbacks = useRef({ onLaunch, onDone });
  callbacks.current = { onLaunch, onDone };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const box = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(box.width * dpr);
    canvas.height = Math.round(box.height * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const starts = foundations.map((_, i) => {
      const el = document.querySelector(`[data-target="foundation-${i}"]`)!.getBoundingClientRect();
      return { x: el.left - box.left, y: el.top - box.top, w: el.width, h: el.height };
    });
    const { w, h } = starts[0];

    // Kings first, cycling across the four foundations.
    const order: { card: Card; pile: number }[] = [];
    for (let rank = 12; rank >= 0; rank--) {
      foundations.forEach((pile, i) => pile[rank] && order.push({ card: pile[rank], pile: i }));
    }
    const images = new Map(order.map(({ card }) => [card.id, renderCard(card, w, h, dpr)]));

    const scale = w / 71; // physics tuned for the original 71px card
    let launched = 0;
    let current: { img: HTMLCanvasElement; x: number; y: number; vx: number; vy: number } | null = null;
    let frame = 0;

    const launch = () => {
      if (launched >= order.length) {
        callbacks.current.onDone();
        return false;
      }
      const { card, pile } = order[launched++];
      const start = starts[pile];
      const speed = (2 + Math.random() * 5) * scale;
      current = {
        img: images.get(card.id)!,
        x: start.x,
        y: start.y,
        vx: Math.random() < 0.5 ? -speed : speed,
        vy: -Math.random() * 8 * scale,
      };
      callbacks.current.onLaunch(launched);
      return true;
    };

    const tick = () => {
      if (!current && !launch()) return;
      const c = current!;
      c.vy += 0.6 * scale;
      c.x += c.vx;
      c.y += c.vy;
      if (c.y + h > box.height) {
        c.y = box.height - h;
        c.vy = -c.vy * 0.75;
      }
      ctx.drawImage(c.img, c.x, c.y, w, h);
      if (c.x + w < 0 || c.x > box.width) current = null;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [foundations]);

  return <canvas ref={canvasRef} className="cascade" onPointerDown={() => callbacks.current.onDone()} />;
}
