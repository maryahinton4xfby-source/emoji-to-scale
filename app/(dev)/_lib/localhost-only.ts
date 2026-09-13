import 'server-only';

import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

/* Loopback only, by Host header rather than NODE_ENV, so a local `next start`
   (a production build, served locally) still reaches these pages while the
   deployed site — where Host is the real domain — 404s. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** Every page under `app/(dev)` calls this first; see that folder's README. */
export async function assertLocalhost() {
  const host = (await headers()).get('host') ?? '';
  // Strip the port; an IPv6 host arrives bracketed, e.g. `[::1]:7317`.
  const hostname = host.replace(/:\d+$/, '');
  if (!LOCAL_HOSTS.has(hostname)) {
    notFound();
  }
}

/** Belt and braces: notFound() already injects noindex, but the pages render
    normally on localhost and this keeps that response out of any crawler's
    hands too. */
export const NO_INDEX = { index: false, follow: false } as const;
