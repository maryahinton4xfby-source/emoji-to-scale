import Link from 'next/link';
import EmojiToScaleApp from '../src/app';
import { getEmojiData } from '../src/db';

export default function Page() {
  const data = getEmojiData();

  return (
    <>
      <div className="bg" />

      <header className="header header-left">
        <h1>Emoji to Scale</h1>
        <div>
          <Link href="/speed" className="header-link-featured">
            Emoji to Speed (New!)
          </Link>
        </div>
        <div>
          <a href="https://github.com/javierbyte/emoji-to-scale">Source</a>
          {', '}
          <a href="https://www.youtube.com/watch?v=RiLBR6roAsM">
            YouTube Video
          </a>
          {', '}
          <a href="https://javier.xyz/pokemon-to-scale">Pokémon Version</a>
        </div>
      </header>

      <main>
        <noscript>
          <h1>Emoji to Scale</h1>
          <p>Your favorite emojis. To scale (more or less).</p>
        </noscript>
        <EmojiToScaleApp data={data} />
      </main>

      <footer className="footer">
        <div>Scroll ↕</div>
        <div className="footer-credit">
          by <a href="https://x.com/javierbyte">@javierbyte</a>, more in{' '}
          <a href="https://javier.xyz">my website</a>. 2021-2026
        </div>
      </footer>
    </>
  );
}
