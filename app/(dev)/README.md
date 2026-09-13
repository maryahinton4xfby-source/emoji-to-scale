# Dev-only pages

Internal tools, **not part of the public site**. `(dev)` is a Next.js route
group, so it adds nothing to the URL — the routes below stay where they were:

| Directory         | URL           | What it is                                                  |
| ----------------- | ------------- | ----------------------------------------------------------- |
| `debug-size/`     | `/debug-size` | Every emoji at one font size, with its measured bounding box |
| `candidates/`     | `/candidates` | Triage gallery for emojis missing from Scale or Speed        |

Each directory holds its own page, components and data, so a tool can be read —
or deleted — without touching the rest of the repo. The only things they reach
outside this folder are `src/db` (the emoji database) and `src/emoji-geometry`.

Every page here must `await assertLocalhost()` from `_lib/localhost-only.ts`
before rendering. It matches on the `Host` header rather than `NODE_ENV`, so a
local `next start` still serves these pages while the deployed site 404s.

The public pages are `app/page.tsx` (Scale) and `app/speed/` (Speed); their
components live in `src/`.
