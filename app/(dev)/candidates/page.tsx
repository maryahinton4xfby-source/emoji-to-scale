import type { Metadata } from 'next';
import Link from 'next/link';
import { assertLocalhost, NO_INDEX } from '../_lib/localhost-only';
import CandidatesApp from './candidates-app';
import { loadCandidateData } from './candidates';

export const metadata: Metadata = {
  title: 'Emoji Candidates',
  robots: NO_INDEX,
};

export default async function Page() {
  await assertLocalhost();
  const data = loadCandidateData();

  return (
    <>
      <header className="candidate-header">
        <div>
          <h1>Emoji Candidates</h1>
          <p>Review physical subjects missing from Scale or Speed.</p>
        </div>
        <nav aria-label="Candidate tools">
          <Link href="/">Scale</Link>
          <Link href="/speed">Speed</Link>
          <Link href="/debug-size">Debug size</Link>
        </nav>
      </header>
      <main>
        <CandidatesApp {...data} />
      </main>
    </>
  );
}
