/**
 * measure-bounding-boxes.mjs — run manually, on macOS, with Chrome installed:
 *
 *   node src/db/reference/measure-bounding-boxes.mjs
 *
 * Fills in `boundingBox.apple` for every entry in data.json.
 *
 * WHY THIS EXISTS
 * ---------------
 * `ctx.measureText()` is useless for sizing Apple Color Emoji: it is a bitmap
 * font, so every single emoji reports the identical ink box (the full bitmap
 * frame — 1.015em square, at every font size). The artwork *inside* that frame
 * is what actually varies, and the only way to find it is to rasterize the
 * glyph and scan the alpha channel. That is what this script does, in headless
 * Chrome so the rasterizer is the same one the site renders with — counting a
 * pixel as artwork once it reaches ALPHA_THRESHOLD (see below).
 *
 * THE REFERENCE BOX
 * -----------------
 * Measured empirically (see `probe` output in the commit that added this):
 * Apple Color Emoji artwork always falls inside exactly a 1em square, placed
 * relative to the alphabetic baseline at
 *
 *   x: [-0.5em, +0.5em]   (centered on the glyph's advance, which is always 1em)
 *   y: [-0.875em, +0.125em]  (so the square's bottom sits 0.125em *below* the
 *                             baseline)
 *
 * `boundingBox.apple` records how much of that square each emoji leaves empty,
 * as percentages, in CSS inset order:
 *
 *   [top, right, bottom, left]
 *
 * So `[0, 0, 0, 0]` fills the square edge to edge (🌕 does), and 🗻 reports a
 * large `top` because a mountain's artwork hugs the bottom of its cell.
 * Percentages rather than pixels so the numbers are resolution-independent:
 * multiply by the rendered em size to get pixels.
 */

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import os from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(here, '..', 'data.json');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/* Rasterize big: the insets are rounded to 0.1%, and at 400px an em percent is
   4px, so a single pixel of measurement error is well under the rounding. */
const FONT_SIZE = 400;
const CANVAS = 1000;
const ORIGIN_X = 500;
const BASELINE_Y = 650;

/**
 * Alpha below this is not counted as artwork.
 *
 * Needed because a number of Apple's glyphs (💌 💳 💶 🚪 🗿 🌵 …) carry two tiny
 * 4x4 specks at *opposite corners of the em square*, peaking around alpha 40.
 * They are invisible on screen, but at `alpha > 0` they pin the box to the full
 * square and every affected emoji measures [0, 0, 0, 0] — which is how this was
 * caught, 💌 claiming to fill its cell edge to edge.
 *
 * 64 clears those specks with margin. It also trims genuinely faint edges — the
 * wisps of 🌪️, the steam above ☕️ — which is wanted rather than merely
 * tolerated: the box exists to make an emoji look correctly placed, and a 15%-
 * opaque wisp is not where the eye puts the edge. Nothing is ever clipped by
 * this; the glyph is always drawn whole.
 */
const ALPHA_THRESHOLD = 64;

/* The artwork square, in em units relative to the baseline origin. */
const EM_LEFT = -0.5;
const EM_RIGHT = 0.5;
const EM_TOP = -0.875;
const EM_BOTTOM = 0.125;

function buildPage(emojis) {
  return `<pre id="out"></pre>
<script>
const EMOJIS = ${JSON.stringify(emojis)};
const F = ${FONT_SIZE}, S = ${CANVAS}, OX = ${ORIGIN_X}, OY = ${BASELINE_Y};
const ALPHA = ${ALPHA_THRESHOLD};
const EM = { l: ${EM_LEFT}, r: ${EM_RIGHT}, t: ${EM_TOP}, b: ${EM_BOTTOM} };

const canvas = document.createElement('canvas');
canvas.width = S; canvas.height = S;
const ctx = canvas.getContext('2d', { willReadFrequently: true });

function measure(emoji) {
  ctx.clearRect(0, 0, S, S);
  ctx.font = F + "px 'Apple Color Emoji'";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const advance = ctx.measureText(emoji).width / F;
  ctx.fillText(emoji, OX, OY);

  const data = ctx.getImageData(0, 0, S, S).data;
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // Not \`> 0\`: see ALPHA_THRESHOLD — some glyphs carry invisible corner
      // specks that would otherwise pin the box to the whole em square.
      if (data[(y * S + x) * 4 + 3] >= ALPHA) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { emoji, empty: true, advance };

  // Pixel bounds -> em units relative to the baseline origin. maxX/maxY are the
  // last *covered* pixel, so the far edge is +1.
  const inkL = (minX - OX) / F;
  const inkR = (maxX + 1 - OX) / F;
  const inkT = (minY - OY) / F;
  const inkB = (maxY + 1 - OY) / F;

  // Empty space on each side of the artwork square, as a percentage of it.
  const pct = (v) => Math.round(v * 1000) / 10;
  return {
    emoji,
    advance,
    box: [
      pct(inkT - EM.t),
      pct(EM.r - inkR),
      pct(EM.b - inkB),
      pct(inkL - EM.l),
    ],
  };
}

document.fonts.ready.then(() => {
  const results = EMOJIS.map(measure);
  // base64 so --dump-dom can't mangle it with HTML escaping
  document.getElementById('out').textContent = btoa(
    String.fromCharCode(...new TextEncoder().encode(JSON.stringify(results)))
  );
});
</script>`;
}

function run(emojis) {
  const tmp = join(os.tmpdir(), `emoji-bbox-${Date.now()}.html`);
  fs.writeFileSync(tmp, buildPage(emojis));
  try {
    const dom = execFileSync(
      CHROME,
      [
        '--headless',
        '--disable-gpu',
        '--virtual-time-budget=120000',
        '--dump-dom',
        `file://${tmp}`,
      ],
      {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      }
    );
    const match = dom.match(/<pre id="out">([^<]*)<\/pre>/);
    if (!match) throw new Error('no output element found in dumped DOM');
    return JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
  } finally {
    fs.unlinkSync(tmp);
  }
}

const db = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
const emojis = Object.keys(db);
console.log(`measuring ${emojis.length} emojis at ${FONT_SIZE}px…`);

const results = run(emojis);

const problems = [];
for (const r of results) {
  if (r.empty) {
    problems.push(`${r.emoji} rendered nothing`);
    continue;
  }
  // An advance wider than 1em means the sequence did not compose into a single
  // glyph (it fell back to rendering its parts), so the artwork square — and
  // therefore the measurement — does not apply.
  if (Math.abs(r.advance - 1) > 0.01) {
    problems.push(
      `${r.emoji} advance ${r.advance.toFixed(3)}em (not a single glyph)`
    );
  }
  if (r.box.some((v) => v < 0)) {
    problems.push(`${r.emoji} ink outside the artwork square: [${r.box}]`);
  }
  db[r.emoji].boundingBox = { apple: r.box };
}

/* JSON.stringify explodes every array across multiple lines; prettier collapses
   the short ones back, which is how the file is already formatted. Run it the
   same way a save-on-format would, so re-running this script produces no
   incidental diff. */
fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2) + '\n');
execFileSync('npx', ['prettier', '--write', DATA_PATH], {
  cwd: join(here, '..', '..', '..'),
  stdio: ['ignore', 'ignore', 'inherit'],
});

console.log(
  `wrote boundingBox for ${results.filter((r) => !r.empty).length} emojis`
);
if (problems.length) {
  console.log(`\n${problems.length} need a look:`);
  for (const p of problems) console.log('  ' + p);
}
