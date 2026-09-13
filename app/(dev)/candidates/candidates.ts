import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import decisionsJson from './candidate-decisions.json';
import { emojiDatabase } from '../../../src/db';
import {
  buildCandidates,
  parseEmojiTest,
  sanitizeDecisions,
  serializeDecisions,
} from './candidate-model';

export function loadCandidateData() {
  const catalogText = fs.readFileSync(
    path.join(process.cwd(), 'src/db/reference/emoji-test.txt'),
    'utf8'
  );
  const version = catalogText.match(/^# Version:\s*(.+)$/m)?.[1] ?? 'unknown';
  const catalog = parseEmojiTest(catalogText);
  const decisions = sanitizeDecisions(decisionsJson);

  return {
    candidates: buildCandidates(catalog, emojiDatabase),
    decisions,
    unicodeVersion: version,
    trackedRevision: serializeDecisions(decisions),
  };
}
