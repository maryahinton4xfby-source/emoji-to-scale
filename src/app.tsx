'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { CSSProperties } from 'react';
import { CATEGORIES, type EmojiData } from './db';
import { inkVars } from './emoji-geometry';

const emojiSpace = 300;

function parseSize(size: number): string {
  if (size < 2) {
    return `${size * 10}mm`;
  }
  if (size < 100) {
    return `${size}cm`;
  }
  if (size < 100 * 1000) {
    return `${Math.round(size * 100) / 100 / 100}m`;
  }
  return `${Math.round(size / 100 / 10) / 100}km`;
}

function EmojiToScale({
  data,
  category,
}: {
  data: EmojiData[];
  category: string;
}) {
  const [scroll, scrollSet] = useState(0);
  const [windowWidth, windowWidthSet] = useState(0);
  const prevMaxScrollRef = useRef(0);

  useEffect(() => {
    let rafId: number | null = null;

    function onScroll() {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        // Commit the complete frame before paint, including newly visible
        // glyphs. A deferred React commit can leave the previous row on screen.
        flushSync(() => {
          scrollSet(Math.round(window.scrollY));
        });
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Layout, not passive: the viewport width decides which emojis are on screen
  // at all, and it is 0 until this runs. As a `useEffect` it landed *after* the
  // first paint, so every load flashed the server's single-emoji render before
  // filling in. A layout effect makes React flush the re-render before the
  // browser paints, so the first thing drawn is already the real row.
  useLayoutEffect(() => {
    function onResize() {
      windowWidthSet(window.innerWidth);
    }
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const filteredData = useMemo(() => {
    if (!category) return data;
    return data.filter((item) => item.tags.includes(category));
  }, [data, category]);

  useLayoutEffect(() => {
    const originalHeight = document.body.style.height;
    return () => {
      document.body.style.height = originalHeight;
    };
  }, []);

  useLayoutEffect(() => {
    const prevMax = prevMaxScrollRef.current;
    const pct =
      prevMax > 0 ? Math.min(1, Math.max(0, window.scrollY / prevMax)) : 0;

    const newMax = emojiSpace * Math.max(0, filteredData.length - 1);
    const updateHeight = () => {
      document.body.style.height = `${newMax + window.innerHeight}px`;
    };
    updateHeight();
    prevMaxScrollRef.current = newMax;

    if (prevMax > 0) {
      window.scrollTo(0, pct * newMax);
    }
    scrollSet(Math.round(window.scrollY));
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [filteredData]);

  let floatScale = 1;
  if (filteredData.length > 0) {
    const floorIdx = Math.max(
      0,
      Math.min(Math.floor(scroll / emojiSpace), filteredData.length - 1)
    );
    const ceilIdx = Math.max(
      0,
      Math.min(Math.ceil(scroll / emojiSpace), filteredData.length - 1)
    );
    const floorCeilProgress = (scroll / emojiSpace) % 1;
    floatScale =
      floorCeilProgress * filteredData[ceilIdx].height +
      (1 - floorCeilProgress) * filteredData[floorIdx].height;
  }

  return (
    <div
      className="emoji-display"
      role="region"
      aria-label="Emoji size comparison"
    >
      {filteredData.map(({ emoji, height, label, boundingBox }, idx) => {
        const compoundDistance = windowWidth / 2 + idx * emojiSpace;

        let relativeDistance = compoundDistance - scroll - emojiSpace / 2;

        // Slow the scrolling at the beginning of the screen
        if (relativeDistance < windowWidth / 2) {
          relativeDistance =
            relativeDistance * 0.1 +
            (0.9 * (relativeDistance + windowWidth * 0.5)) / 2;
        }

        const calculatedScaleR = Math.min(height / floatScale, 9);
        const calculatedScale = Math.round(calculatedScaleR * 1000) / 1000;

        // A large glyph extends beyond its 256px container. Culling by the
        // container's left edge made visible artwork abruptly appear/disappear.
        // Use the full scaled em square (conservative across emoji fonts), plus
        // the label box, and keep one slot of overscan for fast scrolling.
        const glyphHalfWidth = 100 * calculatedScale;
        const leftEdge = relativeDistance + Math.min(0, 128 - glyphHalfWidth);
        const rightEdge = relativeDistance + Math.max(256, 128 + glyphHalfWidth);
        if (
          rightEdge < -emojiSpace ||
          leftEdge > windowWidth + emojiSpace
        ) {
          return null;
        }

        let opacity = 1;
        if (calculatedScale > 3) {
          const diff = (calculatedScale - 3) / 6;
          opacity = Math.max(1 - diff, 0);
        }

        return (
          <div
            className="emoji-container"
            aria-label={`${label}, ${parseSize(height)}`}
            style={{
              // Position and size share the same layout and paint.
              left: relativeDistance,
            }}
            key={emoji}
          >
            <div
              className="emoji"
              style={
                {
                  opacity,
                  // Draw at the final size. Switching between font sizing and
                  // composited scaling required remounts and could flash stale
                  // glyph layers when fast scrolling resumed.
                  '--emoji-scale': calculatedScale,
                } as CSSProperties
              }
            >
              <span className="emoji-glyph" style={inkVars(boundingBox)}>
                {emoji}
              </span>
            </div>
            <div>{parseSize(height)}</div>
            <div>{label}</div>
          </div>
        );
      })}
    </div>
  );
}

function EmojiToScaleApp({ data }: { data: EmojiData[] }) {
  const [category, categorySet] = useState('');

  return (
    <>
      <EmojiToScale data={data} category={category} />
      <select
        className="category-select"
        value={category}
        onChange={(e) => categorySet(e.target.value)}
      >
        <option value="">All</option>
        {CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>
            {cat[0].toUpperCase() + cat.slice(1)}
          </option>
        ))}
      </select>
    </>
  );
}

export default EmojiToScaleApp;
