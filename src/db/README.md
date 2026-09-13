# Emoji Database (`src/db`)

## Schema

Each emoji is keyed by its Unicode character in `data.json`:

```json
{
  "🐜": {
    "tags": ["animals"],
    "name": "Ant",
    "sources": [
      {
        "values": { "height": { "value": 0.37 }, "speed": { "value": 0.3 } },
        "url": "https://en.wikipedia.org/wiki/Ant",
        "description": "Workers are about 3.7 mm long…"
      }
    ],
    "boundingBox": { "apple": [0, 0.3, 1.5, 0.3] }
  }
}
```

### Types

- **DataSource** —
  `{ values: { height?: {value}, speed?: {value} }, url?, description? }` — one
  citation, carrying every value it supports
- **EmojiEntry** — `{ tags?, name, sources, boundingBox? }`
- **EmojiDatabase** — `Record<string, EmojiEntry>`

## Conventions

- `height` is in **centimeters**, `speed` in **km/h**
- `name` is the clean common name of what the emoji depicts ("Ant"), not the
  specific instance a source happens to measure
- Values live on the source that supports them, so one citation can back both a
  height and a speed
- An emoji may appear with no usable value; the accessors filter those out

## `boundingBox`

Where the glyph's artwork actually sits inside its cell, keyed by emoji vendor.
Only `apple` is measured, and it is used for every platform.

The four numbers are **percentages of the 1em artwork square left empty on each
side**, in CSS inset order — `[top, right, bottom, left]`:

- `[0, 0, 0, 0]` fills the square edge to edge (☄️ does)
- `🚤` is `[49, 0, 2.3, 0.3]` — a speedboat's artwork hugs the bottom of its
  cell, leaving the top half empty

This exists because `measureText()` cannot answer the question: Apple Color
Emoji is a bitmap font, so **every** emoji reports the identical ink box (the
full bitmap frame) at every size. The only way to find the artwork is to
rasterize the glyph and scan its alpha channel.

A pixel counts as artwork once its alpha reaches 64 (25%), not at the first
non-zero value. Several of Apple's glyphs carry two invisible 4x4 specks at
opposite corners of the em square, peaking around alpha 40; counting those
pinned 17 emojis to a full `[0, 0, 0, 0]` square, 💌 among them. The threshold
also trims genuinely faint edges — ☕️'s steam, 🌪️'s wisps — which is wanted:
these boxes decide where an emoji _looks_ like it sits, and a 15%-opaque wisp is
not where the eye puts the edge. Nothing is ever clipped in the rendering; the
glyph is always drawn whole.

Both renderers use it to place emojis by their artwork rather than their font
box, and both do the same thing with it: one font size, one translate that
stands the artwork's base on a line — the floor on `/`, a per-lane base line on
`/speed`. Nothing is ever resized per emoji. `src/emoji-geometry.ts` documents
the coordinate system and converts a box into CSS custom properties;
`/debug-size` (localhost only) draws every box over its glyph so the numbers can
be checked by eye.

### Regenerating

Requires macOS and Google Chrome — the measurement must run against the same
rasterizer and the same font the site renders with:

```sh
node src/db/reference/measure-bounding-boxes.mjs
```

It rewrites `boundingBox.apple` for every entry in place, and warns about any
glyph that rendered nothing or failed to compose into a single glyph.

## Adding a new emoji

Add a key to `data.json`, then re-run the measurement script to fill in its
`boundingBox`. An entry without one still renders — the geometry falls back to
"fills the square" — but it will not sit on the floor correctly.

```json
"🦈": {
  "tags": ["animals"],
  "name": "Shark",
  "sources": [
    {
      "values": { "height": { "value": 460 } },
      "url": "https://en.wikipedia.org/wiki/Great_white_shark",
      "description": "Great white sharks reach about 4.6 m."
    }
  ]
}
```

## Finding candidates

Run the app locally and open
`http://localhost:7317/emoji-to-scale/candidates`. The localhost-only gallery
combines Unicode 17 emojis missing from the database with existing entries
that are absent from either Scale or Speed. Its deterministic rules provide a
physical-subject shortlist, while the excluded view keeps every editorial
choice auditable.

Review decisions are saved as a browser draft. Use **Export decisions** and
replace `app/(dev)/candidates/candidate-decisions.json` with the download when
the decisions should be committed. That file lives with the tool, not with the
database: it holds editorial state only, while measurements and sources belong
in `data.json`.

The Unicode catalog is the vendored `reference/emoji-test.txt`. Update that
snapshot when adopting a newer Unicode emoji release, then review any orphaned
decisions shown by the gallery.

## Accessors

```ts
import {
  getEmojiData,
  getEmojiSpeedData,
  getAllEmojis,
  emojiDatabase,
} from './db';

getEmojiData(); // entries with a height, sorted ascending
getEmojiSpeedData(); // entries with a speed, sorted ascending
getAllEmojis(); // every entry, unfiltered (used by /debug-size)

emojiDatabase['🐜']; // raw access
```
