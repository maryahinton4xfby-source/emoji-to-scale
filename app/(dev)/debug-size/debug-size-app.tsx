'use client';

import { useEffect, useRef, useState } from 'react';
import type { BoundingBox, EmojiGlyph } from '../../../src/db';
import { SQUARE_TOP_ABOVE_BASELINE } from '../../../src/emoji-geometry';

/* Canvas geometry, in CSS pixels. */
const CANVAS_SIZE = 168;

/* One font size for every glyph — the whole point of this page is that the
   squares are directly comparable. The em square is drawn at 70% of the canvas,
   leaving a margin so the overlay's edges stay visible. */
const FONT_SIZE = CANVAS_SIZE * 0.7;

/* Canvas has no cascade to inherit from, so name the emoji fonts explicitly
   rather than relying on a fallback chain that starts at the body font. */
const EMOJI_FONT =
  "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

const SQUARE_STROKE = '#00000026';
const INK_STROKE = '#e4002b';

/**
 * Draws the emoji with its 1em artwork square centered in the canvas, then
 * optionally overlays that square (grey) and the measured artwork box (red).
 *
 * The emoji is positioned from the square, not from `measureText`: Apple Color
 * Emoji reports one identical ink box for every glyph, so measuring tells you
 * nothing about where a given glyph's artwork actually is. `boundingBox` in the
 * database is the answer to that, and this page is how you check it — a red box
 * that doesn't hug the artwork means the stored numbers are wrong.
 */
function draw(
  canvas: HTMLCanvasElement,
  emoji: string,
  box: BoundingBox,
  showBox: boolean
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Back the canvas with device pixels, then work in CSS pixels throughout.
  const dpr = window.devicePixelRatio || 1;
  canvas.width = CANVAS_SIZE * dpr;
  canvas.height = CANVAS_SIZE * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // The em square, centered.
  const squareLeft = (CANVAS_SIZE - FONT_SIZE) / 2;
  const squareTop = (CANVAS_SIZE - FONT_SIZE) / 2;

  ctx.font = `${FONT_SIZE}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(
    emoji,
    CANVAS_SIZE / 2,
    squareTop + SQUARE_TOP_ABOVE_BASELINE * FONT_SIZE
  );

  if (!showBox) return;

  const [top, right, bottom, left] = box;
  ctx.lineWidth = 1;

  ctx.strokeStyle = SQUARE_STROKE;
  ctx.strokeRect(
    squareLeft + 0.5,
    squareTop + 0.5,
    FONT_SIZE - 1,
    FONT_SIZE - 1
  );

  // How much of the em square the artwork actually occupies.
  const width = 1 - (right + left) / 100;
  const height = 1 - (top + bottom) / 100;
  ctx.strokeStyle = INK_STROKE;
  ctx.strokeRect(
    squareLeft + (left / 100) * FONT_SIZE + 0.5,
    squareTop + (top / 100) * FONT_SIZE + 0.5,
    width * FONT_SIZE - 1,
    height * FONT_SIZE - 1
  );
  // Mark the bottom edge: this is the line both renderers stand emojis on.
  ctx.beginPath();
  ctx.moveTo(squareLeft, squareTop + (1 - bottom / 100) * FONT_SIZE + 0.5);
  ctx.lineTo(
    squareLeft + FONT_SIZE,
    squareTop + (1 - bottom / 100) * FONT_SIZE + 0.5
  );
  ctx.stroke();
}

function EmojiCanvas({
  emoji,
  label,
  boundingBox,
  showBox,
}: EmojiGlyph & { showBox: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    function render() {
      if (cancelled || !canvas) return;
      draw(canvas, emoji, boundingBox, showBox);
    }

    // Draw once immediately so the grid is never blank, then again once fonts
    // have settled — the first paint can land before the emoji font is ready.
    render();
    document.fonts.ready.then(render);

    return () => {
      cancelled = true;
    };
  }, [emoji, boundingBox, showBox]);

  return (
    <figure style={{ margin: 0, textAlign: 'center', maxWidth: CANVAS_SIZE }}>
      <canvas
        ref={canvasRef}
        style={{
          width: CANVAS_SIZE,
          height: CANVAS_SIZE,
          display: 'block',
          background: '#fff',
        }}
        role="img"
        aria-label={label}
      />
      <figcaption style={{ padding: '6px 0 0' }}>
        <div>
          {emoji} {label}
        </div>
        <div style={{ color: '#444' }}>[{boundingBox.join(', ')}]</div>
      </figcaption>
    </figure>
  );
}

export default function DebugSizeApp({ data }: { data: EmojiGlyph[] }) {
  const [showBox, setShowBox] = useState(true);

  return (
    <>
      <label
        style={{
          display: 'inline-flex',
          gap: 8,
          alignItems: 'center',
          padding: '0 24px',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={showBox}
          onChange={(e) => setShowBox(e.target.checked)}
        />
        Show bounding box
      </label>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${CANVAS_SIZE}px, 1fr))`,
          gap: 24,
          justifyItems: 'center',
          padding: 24,
        }}
      >
        {data.map((item) => (
          <EmojiCanvas key={item.emoji} {...item} showBox={showBox} />
        ))}
      </div>
    </>
  );
}
