import type { Metadata } from 'next';
import Link from 'next/link';
import { assertLocalhost, NO_INDEX } from '../_lib/localhost-only';
import DebugSizeApp from './debug-size-app';
import { getAllEmojis } from '../../../src/db';

export const metadata: Metadata = {
  title: 'Debug Size',
  robots: NO_INDEX,
};

export default async function Page() {
  await assertLocalhost();

  const data = getAllEmojis();

  return (
    <>
      {/* Deliberately not `.header`, which is `position: fixed` for the two
          scroll-driven pages and would overlap this one's grid as it scrolls. */}
      <header
        style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: 24 }}
      >
        <h1>Debug Size</h1>
        <Link href="/">Scale Version</Link>
        <Link href="/speed">Speed Version</Link>
        <Link href="/candidates">Emoji Candidates</Link>
      </header>

      <main>
        <p style={{ margin: 0, padding: '0 24px' }}>
          {data.length} emojis, all at the same font size. Grey is the 1em
          artwork square; red is the measured <code>boundingBox.apple</code>,
          listed below each as <code>[top, right, bottom, left]</code> — the
          percentage of the square left empty on that side. The red bottom edge
          is the line both renderers stand each emoji on. Localhost only.
        </p>
        <DebugSizeApp data={data} />
      </main>
    </>
  );
}
