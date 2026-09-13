import type { Metadata } from 'next';
import Script from 'next/script';
import '../src/style.css';

// Brutalita ships from its own site (github.com/javierbyte/brutalita), so the
// @font-face lives in style.css rather than next/font. Preconnect + preload put
// the fetch on the critical path anyway — a webfont referenced from a stylesheet
// isn't discovered by the preload scanner until the CSS itself has parsed.
const FONT_ORIGIN = 'https://brutalita.com';
const FONT_URLS = [
  `${FONT_ORIGIN}/font/Brutalita-Regular.woff2`,
  `${FONT_ORIGIN}/font/Brutalita-SemiBold.woff2`,
];

const TITLE = 'Emoji to Scale';
const DESCRIPTION = 'Your favorite emojis. To scale (more or less).';
const PAGE_URL = 'https://javier.xyz/emoji-to-scale';
const IMAGE = 'https://javier.xyz/emoji-to-scale/emoji-to-scale.jpg';

export const metadata: Metadata = {
  metadataBase: new URL('https://javier.xyz/emoji-to-scale'),
  // `default` covers pages with no title of their own (`/`); `template` suffixes
  // the ones that do (`/speed`) so sibling pages read as one site in SERPs.
  // Note this applies to <title> only — both pages set `openGraph.title`
  // explicitly, so social previews are unaffected.
  title: { default: TITLE, template: `%s · ${TITLE}` },
  description: DESCRIPTION,
  alternates: {
    canonical: PAGE_URL,
  },
  openGraph: {
    type: 'website',
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    images: [{ url: IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [IMAGE],
  },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>&#x1F4D0;</text></svg>",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href={FONT_ORIGIN} crossOrigin="anonymous" />
        {FONT_URLS.map((url) => (
          <link
            key={url}
            rel="preload"
            href={url}
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
        ))}
      </head>
      <body>
        {children}

        {/* Global site tag (gtag.js) - Google Analytics.
            `lazyOnload`: gtag.js is by far the largest script on these pages,
            whose own bundles are tiny, so deferring it to idle keeps it off the
            critical path. Load order doesn't matter — the inline config below
            queues into `dataLayer`, which gtag.js drains whenever it arrives. */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-M2FT27FXS2"
          strategy="lazyOnload"
        />
        <Script id="ga" strategy="lazyOnload">
          {`window.dataLayer = window.dataLayer || [];
function gtag() {
  dataLayer.push(arguments);
}
gtag('js', new Date());
gtag('config', 'G-M2FT27FXS2');`}
        </Script>
      </body>
    </html>
  );
}
