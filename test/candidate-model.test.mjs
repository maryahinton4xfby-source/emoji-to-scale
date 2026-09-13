import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  buildCandidates,
  defaultEligibility,
  normalizeEmoji,
  parseEmojiTest,
  sanitizeDecisions,
  serializeDecisions,
  similarityFamily,
} from '../app/(dev)/candidates/candidate-model.ts';

const fixture = `
# group: Smileys & Emotion
# subgroup: face-smiling
1F600                                                  ; fully-qualified     # 😀 E1.0 grinning face
# group: Animals & Nature
# subgroup: animal-mammal
1F981                                                  ; fully-qualified     # 🦁 E1.0 lion
1F431                                                  ; fully-qualified     # 🐱 E0.6 cat face
1F408                                                  ; fully-qualified     # 🐈 E0.7 cat
# group: People & Body
# subgroup: hand-fingers-open
1F44B                                                  ; fully-qualified     # 👋 E0.6 waving hand
1F44B 1F3FB                                            ; fully-qualified     # 👋🏻 E1.0 waving hand: light skin tone
# group: Travel & Places
# subgroup: sky & weather
26A1 FE0F                                              ; fully-qualified     # ⚡ E0.6 high voltage
# group: Objects
# subgroup: phone
1F4F1                                                  ; fully-qualified     # 📱 E0.6 mobile phone
# group: Flags
# subgroup: country-flag
1F1E9 1F1EA                                            ; fully-qualified     # 🇩🇪 E2.0 flag: Germany
`;

const emptySource = { values: {} };

test('parses fully-qualified Unicode entries and collapses visual variants', () => {
  const catalog = parseEmojiTest(fixture);
  assert.equal(catalog.length, 8);
  assert.equal(catalog.find((item) => item.emoji === '🦁')?.group, 'Animals & Nature');
  assert.equal(catalog.filter((item) => item.name.startsWith('waving hand')).length, 1);
  assert.equal(normalizeEmoji('⚡️'), normalizeEmoji('⚡'));
});

test('eligibility rules are explicit and auditable', () => {
  const catalog = parseEmojiTest(fixture);
  assert.equal(defaultEligibility(catalog.find((item) => item.emoji === '🦁')).eligible, true);
  assert.equal(defaultEligibility(catalog.find((item) => item.emoji === '😀')).eligible, false);
  assert.equal(defaultEligibility(catalog.find((item) => item.emoji === '👋')).eligible, false);
});

test('derives new, scale-upgrade, and speed-upgrade candidates', () => {
  const catalog = parseEmojiTest(fixture);
  const database = {
    '🐈': { name: 'Cat', tags: ['animals'], sources: [{ values: { height: { value: 25 } } }] },
    '⚡': { name: 'Lightning', tags: ['nature'], sources: [{ values: { speed: { value: 1000 } } }] },
    '📱': { name: 'Mobile Phone', tags: ['objects'], sources: [{ values: { height: { value: 15 } } }] },
  };
  const candidates = buildCandidates(catalog, database);

  const lion = candidates.find((item) => item.emoji === '🦁');
  assert.deepEqual(lion.targets, ['scale', 'speed']);
  assert.equal(lion.eligible, true);

  const lightning = candidates.find((item) => item.key === normalizeEmoji('⚡'));
  assert.deepEqual(lightning.targets, ['scale']);

  const phone = candidates.find((item) => item.emoji === '📱');
  assert.deepEqual(phone.targets, ['speed']);
  assert.equal(phone.eligible, false);

  const flag = candidates.find((item) => item.emoji === '🇩🇪');
  assert.equal(flag, undefined);
});

test('reports conservative duplicate families and existing neighbors', () => {
  const catalog = parseEmojiTest(fixture);
  const candidates = buildCandidates(catalog, {
    '🐈': { name: 'Cat', tags: ['animals'], sources: [emptySource] },
  });
  const catFace = candidates.find((item) => item.emoji === '🐱');
  assert.equal(similarityFamily(catFace), 'cat depictions');
  assert.deepEqual(catFace.similarExisting, [{ emoji: '🐈', name: 'Cat' }]);
});

test('decision sanitation and export are deterministic', () => {
  const raw = {
    '🦁': { status: 'shortlisted', targets: ['speed', 'scale', 'speed'], note: '  useful  ' },
    '😀': { status: 'rejected', reason: 'too-similar' },
    bad: { status: 'rejected', reason: 'unknown' },
  };
  const clean = sanitizeDecisions(raw);
  assert.deepEqual(clean['🦁'], { status: 'shortlisted', targets: ['scale', 'speed'], note: 'useful' });
  assert.equal(clean.bad, undefined);
  assert.equal(serializeDecisions(clean), serializeDecisions(JSON.parse(serializeDecisions(clean))));
  assert.ok(serializeDecisions(clean).endsWith('\n'));
});

test('the vendored Unicode 17 catalog parses with groups and unique keys', () => {
  const text = fs.readFileSync(new URL('../src/db/reference/emoji-test.txt', import.meta.url), 'utf8');
  const catalog = parseEmojiTest(text);
  assert.ok(catalog.length > 1500);
  assert.equal(new Set(catalog.map((item) => item.key)).size, catalog.length);
  assert.ok(catalog.every((item) => item.group && item.subgroup && item.name));
});
