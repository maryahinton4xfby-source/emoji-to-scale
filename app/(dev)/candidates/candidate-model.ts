import { ROUGH_HEIGHTS_CM } from './candidate-heights.ts';

export type CandidateTarget = 'scale' | 'speed';

export type RejectionReason =
  | 'abstract'
  | 'no-useful-dimension'
  | 'too-similar'
  | 'not-interesting';

export type CandidateDecision =
  | {
      status: 'shortlisted';
      targets: CandidateTarget[];
      note?: string;
    }
  | {
      status: 'rejected';
      reason: RejectionReason;
      note?: string;
    };

export type CandidateDecisions = Record<string, CandidateDecision>;

export type UnicodeEmoji = {
  emoji: string;
  key: string;
  name: string;
  group: string;
  subgroup: string;
  order: number;
};

export type Candidate = UnicodeEmoji & {
  targets: CandidateTarget[];
  /** Uncited triage guess in centimeters; see `candidate-heights.ts`. */
  roughHeightCm?: number;
  speedPotential: boolean;
  eligible: boolean;
  exclusionReason?: string;
  existing: boolean;
  similarityFamily?: string;
  similarExisting: Array<{ emoji: string; name: string }>;
};

export type CandidateDatabaseEntry = {
  name: string;
  tags?: string[];
  sources: Array<{
    values: {
      height?: { value: number };
      speed?: { value: number };
    };
  }>;
};

export type CandidateDatabase = Record<string, CandidateDatabaseEntry>;

const VARIATION_SELECTORS = /[\uFE0E\uFE0F]/gu;
const SKIN_TONES = /[\u{1F3FB}-\u{1F3FF}]/gu;

/** The stable key used by the catalog, database, and decision file. */
export function normalizeEmoji(emoji: string): string {
  return emoji.replace(VARIATION_SELECTORS, '').replace(SKIN_TONES, '');
}

/** Parse fully-qualified entries and retain Unicode's natural display order. */
export function parseEmojiTest(text: string): UnicodeEmoji[] {
  let group = '';
  let subgroup = '';
  let order = 0;
  const byKey = new Map<string, UnicodeEmoji>();

  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('# group:')) {
      group = line.slice('# group:'.length).trim();
      continue;
    }
    if (line.startsWith('# subgroup:')) {
      subgroup = line.slice('# subgroup:'.length).trim();
      continue;
    }
    if (!line.includes('; fully-qualified')) continue;

    const match = line.match(
      /^([0-9A-F ]+)\s*;\s*fully-qualified\s*#\s*\S+\s+E[\d.]+\s+(.+)$/u
    );
    if (!match) continue;

    const emoji = match[1]
      .trim()
      .split(/\s+/)
      .map((hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
      .join('');
    const key = normalizeEmoji(emoji);

    // The unmodified form precedes its skin-tone variants in emoji-test.txt.
    if (!byKey.has(key)) {
      byKey.set(key, {
        emoji,
        key,
        name: match[2].trim(),
        group,
        subgroup,
        order: order++,
      });
    }
  }

  return [...byKey.values()];
}

const PHYSICAL_GROUPS = new Set([
  'Animals & Nature',
  'Food & Drink',
  'Travel & Places',
  'Objects',
]);

const PEOPLE_NAME = /^(?:person|man|woman|boy|girl|child|baby|older person|old man|old woman|people|couple|family|bride|groom|prince|princess|king|queen|guard|detective|ninja|pilot|judge|farmer|cook|student|singer|artist|teacher|factory worker|technologist|office worker|mechanic|scientist|astronaut|firefighter|police officer|construction worker|health worker|superhero|supervillain|mage|fairy|vampire|merperson|elf|genie|zombie|walking|running|dancing|skier|snowboarder|surfer|swimmer|weight lifter|golfer|horse racing|biking|cartwheeling|wrestling|water polo|handball|juggling|climbing|fencer)(?:\b|:)/i;

export function defaultEligibility(item: UnicodeEmoji): {
  eligible: boolean;
  reason?: string;
} {
  if (item.group === 'Flags') {
    return { eligible: false, reason: 'Flags are structural exclusions.' };
  }
  if (item.group === 'Symbols') {
    return { eligible: false, reason: 'Symbols do not depict physical subjects.' };
  }
  if (item.group === 'Smileys & Emotion') {
    return { eligible: false, reason: 'Faces and emotions are intentionally repetitive.' };
  }
  if (item.group === 'People & Body') {
    if (item.subgroup === 'body-parts') return { eligible: true };
    return {
      eligible: false,
      reason: 'People, roles, and gestures are excluded by default.',
    };
  }
  if (item.group === 'Activities') {
    if (PEOPLE_NAME.test(item.name)) {
      return {
        eligible: false,
        reason: 'This activity depicts a person rather than a distinct object.',
      };
    }
    return { eligible: true };
  }
  if (PHYSICAL_GROUPS.has(item.group)) return { eligible: true };
  return {
    eligible: false,
    reason: 'Its Unicode group is not physical by default.',
  };
}

const SPEED_NAME = /\b(?:airplane|aircraft|helicopter|rocket|satellite|vehicle|car|taxi|bus|trolleybus|tram|train|railway|locomotive|monorail|tractor|truck|ambulance|fire engine|police car|motorcycle|motor scooter|bicycle|wheelchair|skateboard|roller skate|scooter|auto rickshaw|boat|canoe|ship|ferry|sailboat|speedboat|parachute|sled|ski|snowboard|ball|disc|shuttlecock|comet|cyclone|tornado|wind|wave|lightning)\b/i;

/** A suggestion only: it means a citable motion speed seems plausible. */
export function hasSpeedPotential(
  item: UnicodeEmoji,
  entry?: CandidateDatabaseEntry
): boolean {
  if (item.subgroup.startsWith('animal-')) return true;
  if (item.subgroup.startsWith('transport-')) return true;
  if (entry?.tags?.includes('animals')) return true;
  return SPEED_NAME.test(item.name);
}

export function similarityFamily(item: Pick<UnicodeEmoji, 'name' | 'group' | 'subgroup'>):
  | string
  | undefined {
  const name = item.name.toLowerCase();
  if (item.group === 'Smileys & Emotion' && name.includes('face')) return 'faces';
  if (item.group === 'People & Body' && item.subgroup.startsWith('hand')) return 'hands';
  if (item.group === 'People & Body' && item.subgroup !== 'body-parts') return 'people';
  if (name.includes('heart')) return 'hearts';
  if (/\b(?:clock|watch|stopwatch|timer|hourglass)\b/.test(name)) return 'timepieces';
  if (/\b(?:new moon|crescent moon|quarter moon|gibbous moon|full moon)\b/.test(name)) return 'moon phases';
  if (/\b(?:envelope|e-mail|mailbox|incoming envelope|outbox tray|inbox tray)\b/.test(name)) return 'mail';
  if (/\bbook(?:s)?\b/.test(name)) return 'books';
  if (/\b(?:banknote|money with wings)\b/.test(name)) return 'banknotes';
  if (/\b(?:mobile phone|telephone|pager|fax machine)\b/.test(name)) return 'phones';
  if (/\b(?:computer|laptop|desktop|keyboard|computer mouse|trackball)\b/.test(name)) return 'computers';

  const animalFace = name.match(/^(.+?) face$/);
  if (animalFace && item.subgroup.startsWith('animal-')) {
    return `${animalFace[1]} depictions`;
  }
  if (/^(?:cat|dog|mouse|rabbit|tiger|bear|pig|cow|horse)$/.test(name)) {
    return `${name} depictions`;
  }
  return undefined;
}

const roughHeights = new Map(
  Object.entries(ROUGH_HEIGHTS_CM).map(([emoji, cm]) => [normalizeEmoji(emoji), cm])
);

/** Undefined means "no guess", never "small" — see `candidate-heights.ts`. */
export function roughHeightOf(key: string): number | undefined {
  return roughHeights.get(normalizeEmoji(key));
}

/** Two significant figures at most: these numbers do not deserve more. */
export function formatRoughHeight(cm: number): string {
  const [value, unit] =
    cm < 1 ? [cm * 10, 'mm']
    : cm < 100 ? [cm, 'cm']
    : cm < 100_000 ? [cm / 100, 'm']
    : [cm / 100_000, 'km'];
  const rounded = value >= 100 ? Math.round(value) : Number(value.toPrecision(2));
  return `${rounded.toLocaleString('en-US')} ${unit}`;
}

/** Accepts `333mm`, `1.5 km`, `40` (centimeters). Returns undefined if unparsable. */
export function parseLengthCm(input: string): number | undefined {
  const match = input.trim().toLowerCase().match(/^([\d.,]+)\s*(mm|cm|m|km)?$/);
  if (!match) return undefined;
  const value = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(value)) return undefined;
  const factor = { mm: 0.1, cm: 1, m: 100, km: 100_000 }[match[2] ?? 'cm'] ?? 1;
  return value * factor;
}

function hasValue(entry: CandidateDatabaseEntry, value: 'height' | 'speed') {
  return entry.sources.some((source) => source.values[value]?.value != null);
}

export function buildCandidates(
  catalog: UnicodeEmoji[],
  database: CandidateDatabase
): Candidate[] {
  const databaseByKey = new Map(
    Object.entries(database).map(([emoji, entry]) => [normalizeEmoji(emoji), { emoji, entry }])
  );
  const catalogByKey = new Map(catalog.map((item) => [item.key, item]));
  const familyMembers = new Map<string, Array<{ emoji: string; name: string; key: string }>>();

  for (const [key, value] of databaseByKey) {
    const unicode = catalogByKey.get(key);
    const family = unicode ? similarityFamily(unicode) : undefined;
    if (!family) continue;
    const members = familyMembers.get(family) ?? [];
    members.push({ emoji: value.emoji, name: value.entry.name, key });
    familyMembers.set(family, members);
  }

  const candidates: Candidate[] = [];
  for (const item of catalog) {
    // Flags and keycaps are structural noise rather than auditable editorial choices.
    if (item.group === 'Flags' || item.subgroup === 'keycap') continue;

    const existingValue = databaseByKey.get(item.key);
    const existingEntry = existingValue?.entry;
    const existing = Boolean(existingEntry);
    const speedPotential = hasSpeedPotential(item, existingEntry);
    const targets: CandidateTarget[] = [];

    if (!existingEntry) {
      targets.push('scale');
      if (speedPotential) targets.push('speed');
    } else {
      if (!hasValue(existingEntry, 'height')) targets.push('scale');
      if (!hasValue(existingEntry, 'speed')) targets.push('speed');
    }
    if (targets.length === 0) continue;

    const rule = defaultEligibility(item);
    const speedOnlyGap = existing && targets.length === 1 && targets[0] === 'speed';
    const eligible = speedOnlyGap ? rule.eligible && speedPotential : rule.eligible;
    const family = similarityFamily(item);
    const similarExisting = family
      ? (familyMembers.get(family) ?? [])
          .filter((member) => member.key !== item.key)
          .map(({ emoji, name }) => ({ emoji, name }))
      : [];

    candidates.push({
      ...item,
      targets,
      roughHeightCm: roughHeightOf(item.key),
      speedPotential,
      eligible,
      exclusionReason:
        rule.reason ??
        (speedOnlyGap && !speedPotential
          ? 'No deterministic rule suggests a meaningful speed.'
          : undefined),
      existing,
      similarityFamily: family,
      similarExisting,
    });
  }

  return candidates.sort((a, b) => {
    const aSaturation = a.similarExisting.length;
    const bSaturation = b.similarExisting.length;
    return (
      aSaturation - bSaturation ||
      b.targets.length - a.targets.length ||
      a.order - b.order
    );
  });
}

const REJECTION_REASONS = new Set<RejectionReason>([
  'abstract',
  'no-useful-dimension',
  'too-similar',
  'not-interesting',
]);

export function sanitizeDecisions(value: unknown): CandidateDecisions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const output: CandidateDecisions = {};

  for (const [rawKey, rawDecision] of Object.entries(value)) {
    if (!rawDecision || typeof rawDecision !== 'object' || Array.isArray(rawDecision)) continue;
    const decision = rawDecision as Record<string, unknown>;
    const key = normalizeEmoji(rawKey);
    const note = typeof decision.note === 'string' && decision.note.trim()
      ? decision.note.trim()
      : undefined;

    if (decision.status === 'shortlisted' && Array.isArray(decision.targets)) {
      const requestedTargets = new Set(decision.targets);
      const targets: CandidateTarget[] = (['scale', 'speed'] as const).filter(
        (target) => requestedTargets.has(target)
      );
      if (targets.length) output[key] = { status: 'shortlisted', targets, ...(note ? { note } : {}) };
    } else if (
      decision.status === 'rejected' &&
      REJECTION_REASONS.has(decision.reason as RejectionReason)
    ) {
      output[key] = {
        status: 'rejected',
        reason: decision.reason as RejectionReason,
        ...(note ? { note } : {}),
      };
    }
  }
  return output;
}

/** Stable output keeps exports reviewable and avoids timestamp-only diffs. */
export function serializeDecisions(decisions: CandidateDecisions): string {
  const sorted = Object.fromEntries(
    Object.entries(sanitizeDecisions(decisions)).sort(([a], [b]) =>
      a.localeCompare(b, 'en')
    )
  );
  return `${JSON.stringify(sorted, null, 2)}\n`;
}
