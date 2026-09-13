import type { CSSProperties } from 'react';
import type { BoundingBox } from './db';

/**
 * EMOJI GLYPH GEOMETRY
 *
 * Turns a measured `boundingBox` (see `db/reference/measure-bounding-boxes.mjs`
 * for how the numbers are produced) into the CSS custom properties both
 * renderers use to place a glyph by its *artwork* rather than by its font box.
 *
 * ## The anchor
 *
 * Everything below is in `em`, measured from the glyph span's anchor — the
 * origin of a `position: absolute; line-height: 0` span, which is what
 * `.emoji span` is. `line-height: 0` is load-bearing: it collapses the span's
 * line box to zero height so the anchor is a single point rather than something
 * that moves with the inherited line-height.
 *
 * Relative to that anchor, Apple Color Emoji's 1em artwork square sits at:
 *
 *        anchor ──┐
 *     ┌───────────┼───────────┐  ← square top,    0.54em ABOVE the anchor
 *     │           │           │
 *     │        artwork        │  (1em tall, 1em wide)
 *     │           │           │
 *     └───────────┼───────────┘  ← square bottom, 0.46em BELOW the anchor
 *
 * The 0.46 is calibrated, not derived: Chrome's inline layout does not place the
 * baseline where the font's ascent/descent alone predict. It was measured by
 * rendering glyphs with a known offset and scanning the resulting pixels — at
 * `--emoji-size` (200px) all test glyphs landed on the identical pixel row. To
 * re-derive it, render a glyph whose box is [0,0,0,0] (it fills the square edge
 * to edge) and find the offset that puts its ink bottom on the anchor.
 *
 * Horizontally the square is flush with the span's box, which shrink-to-fits to
 * the glyph's advance — always exactly 1em in this font.
 */
const SQUARE_BOTTOM_BELOW_ANCHOR = 0.46;
const SQUARE_TOP_ABOVE_ANCHOR = 1 - SQUARE_BOTTOM_BELOW_ANCHOR;

/**
 * The same square, placed for `<canvas>` instead of CSS. Canvas draws text from
 * the alphabetic baseline directly, with none of the line-box machinery the
 * anchor above has to account for, so this is the font's own metric and does NOT
 * match `SQUARE_*_ANCHOR`. Used only by /debug-size.
 */
export const SQUARE_TOP_ABOVE_BASELINE = 0.875;

/** Half of `[top, right, bottom, left]` percentages, as an em fraction. */
const halfEm = (pct: number) => pct / 200;

/**
 * The three properties `.emoji span` reads, all in em from the anchor:
 *
 * - `--ink-bottom` — bottom edge of the artwork. Negating it drops the artwork
 *   onto the anchor, which is how BOTH renderers place a glyph: one font size,
 *   one translate to the artwork's base. Nothing resizes per emoji.
 * - `--ink-cx` / `--ink-cy` — center of the artwork. Not a placement; it is the
 *   `transform-origin` on /speed, so a per-emoji flip or rotate (🚀, ☄️) spins
 *   about the artwork rather than about the font box.
 *
 * Defaults matching a glyph that fills the square live in `style.css`, so the
 * rules stay meaningful for an unmeasured emoji.
 */
export function inkVars([
  top,
  right,
  bottom,
  left,
]: BoundingBox): CSSProperties {
  const cx = 0.5 + halfEm(left) - halfEm(right);
  const cy =
    (SQUARE_BOTTOM_BELOW_ANCHOR - SQUARE_TOP_ABOVE_ANCHOR) / 2 +
    halfEm(top) -
    halfEm(bottom);
  const inkBottom = SQUARE_BOTTOM_BELOW_ANCHOR - bottom / 100;

  return {
    '--ink-cx': `${round(cx)}em`,
    '--ink-cy': `${round(cy)}em`,
    '--ink-bottom': `${round(inkBottom)}em`,
  } as CSSProperties;
}

/** Keeps the inline style strings short; 1e-4 em is far below a device pixel. */
function round(v: number) {
  return Math.round(v * 10000) / 10000;
}
