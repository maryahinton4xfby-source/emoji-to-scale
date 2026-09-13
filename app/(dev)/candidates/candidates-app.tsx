'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  Candidate,
  CandidateDecision,
  CandidateDecisions,
  CandidateTarget,
  RejectionReason,
} from './candidate-model';
import {
  formatRoughHeight,
  parseLengthCm,
  sanitizeDecisions,
  serializeDecisions,
} from './candidate-model';

const STORAGE_KEY = 'emoji-to-scale:candidate-decisions:v1';

type Draft = {
  version: 1;
  trackedRevision: string;
  decisions: CandidateDecisions;
};

type StatusFilter = 'all' | 'unreviewed' | 'shortlisted' | 'rejected';
type EligibilityFilter = 'eligible' | 'excluded' | 'all';
type TargetFilter = 'all' | CandidateTarget;
type SpeedFilter = 'all' | 'yes' | 'no';
type SaturationFilter = 'all' | 'fresh' | 'saturated';
type SortOrder = 'similarity' | 'height';

const NICHE_BAND = { min: '333mm', max: '1.5km' };

const REJECTION_OPTIONS: Array<{ value: RejectionReason; label: string }> = [
  { value: 'not-interesting', label: 'Not interesting' },
  { value: 'abstract', label: 'Abstract' },
  { value: 'no-useful-dimension', label: 'No useful dimension' },
  { value: 'too-similar', label: 'Too similar' },
];

function statusOf(decision?: CandidateDecision): StatusFilter {
  return decision?.status ?? 'unreviewed';
}

function readDraft(trackedRevision: string, tracked: CandidateDecisions): CandidateDecisions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return tracked;
    const draft = JSON.parse(raw) as Partial<Draft>;
    if (draft.version !== 1 || !draft.decisions) return tracked;
    const saved = sanitizeDecisions(draft.decisions);
    return draft.trackedRevision === trackedRevision
      ? saved
      : sanitizeDecisions({ ...tracked, ...saved });
  } catch {
    return tracked;
  }
}

function TargetPill({ target }: { target: CandidateTarget }) {
  return <span className={`candidate-pill candidate-pill-${target}`}>{target}</span>;
}

function CandidateCard({
  candidate,
  decision,
  shortlistedNeighbors,
  onChange,
}: {
  candidate: Candidate;
  decision?: CandidateDecision;
  shortlistedNeighbors: Candidate[];
  onChange: (decision?: CandidateDecision) => void;
}) {
  const [rejectReason, setRejectReason] = useState<RejectionReason>(
    decision?.status === 'rejected' ? decision.reason : 'not-interesting'
  );
  const targetChoices: CandidateTarget[] = candidate.existing
    ? candidate.targets
    : ['scale', 'speed'];
  const [draftTargets, setDraftTargets] = useState<CandidateTarget[]>(candidate.targets);
  const selectedTargets =
    decision?.status === 'shortlisted' ? decision.targets : draftTargets;

  function shortlist() {
    onChange({
      status: 'shortlisted',
      targets: selectedTargets.length ? selectedTargets : candidate.targets,
      ...(decision?.note ? { note: decision.note } : {}),
    });
  }

  function toggleTarget(target: CandidateTarget) {
    const next = selectedTargets.includes(target)
      ? selectedTargets.filter((item) => item !== target)
      : [...selectedTargets, target];
    if (next.length === 0) return;
    if (decision?.status === 'shortlisted') {
      onChange({
        status: 'shortlisted',
        targets: next,
        ...(decision.note ? { note: decision.note } : {}),
      });
    } else {
      setDraftTargets(next);
    }
  }

  function updateNote(note: string) {
    if (!decision) return;
    onChange({ ...decision, ...(note.trim() ? { note } : { note: undefined }) });
  }

  const saturated = candidate.similarExisting.length + shortlistedNeighbors.length > 0;

  return (
    <article className={`candidate-card candidate-card-${statusOf(decision)}`}>
      <div className="candidate-card-heading">
        <span className="candidate-glyph" aria-hidden="true">{candidate.emoji}</span>
        <div>
          <h2>{candidate.name}</h2>
          <p>{candidate.group} · {candidate.subgroup}</p>
        </div>
      </div>

      <div className="candidate-pills">
        {candidate.targets.map((target) => <TargetPill key={target} target={target} />)}
        {candidate.existing && <span className="candidate-pill">existing entry</span>}
        {candidate.speedPotential && <span className="candidate-pill">speed plausible</span>}
        {!candidate.eligible && <span className="candidate-pill candidate-pill-warning">rule excluded</span>}
      </div>

      <p className="candidate-rough-height">
        {candidate.roughHeightCm != null ? (
          <>Roughly <strong>{formatRoughHeight(candidate.roughHeightCm)}</strong> · unverified guess</>
        ) : (
          <em>No rough height guessed</em>
        )}
      </p>

      {!candidate.eligible && <p className="candidate-rule-note">{candidate.exclusionReason}</p>}

      {candidate.similarityFamily && (
        <div className={saturated ? 'candidate-similarity is-saturated' : 'candidate-similarity'}>
          <strong>{candidate.similarityFamily}</strong>
          {!saturated && <span> · no existing neighbors</span>}
          {candidate.similarExisting.length > 0 && (
            <div>
              Existing: {candidate.similarExisting.map((item) => (
                <span title={item.name} key={item.emoji}>{item.emoji}</span>
              ))}
            </div>
          )}
          {shortlistedNeighbors.length > 0 && (
            <div>
              Shortlisted: {shortlistedNeighbors.map((item) => (
                <span title={item.name} key={item.key}>{item.emoji}</span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="candidate-actions">
        <fieldset>
          <legend>{decision?.status === 'shortlisted' ? 'Approved for' : 'Shortlist for'}</legend>
          {targetChoices.map((target) => (
            <label key={target}>
              <input
                type="checkbox"
                checked={selectedTargets.includes(target)}
                onChange={() => toggleTarget(target)}
              />
              {target}
            </label>
          ))}
        </fieldset>
        {decision?.status !== 'shortlisted' && (
          <button type="button" className="candidate-primary" onClick={shortlist}>
            Shortlist
          </button>
        )}

        <div className="candidate-reject">
          <select
            aria-label={`Rejection reason for ${candidate.name}`}
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value as RejectionReason)}
          >
            {REJECTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onChange({
              status: 'rejected',
              reason: rejectReason,
              ...(decision?.note ? { note: decision.note } : {}),
            })}
          >
            Reject
          </button>
        </div>

        {decision && (
          <>
            <input
              className="candidate-note"
              aria-label={`Note for ${candidate.name}`}
              placeholder="Optional note"
              value={decision.note ?? ''}
              onChange={(event) => updateNote(event.target.value)}
            />
            <button type="button" className="candidate-reset" onClick={() => onChange()}>
              Reset
            </button>
          </>
        )}
      </div>
    </article>
  );
}

export default function CandidatesApp({
  candidates,
  decisions: trackedDecisions,
  unicodeVersion,
  trackedRevision,
}: {
  candidates: Candidate[];
  decisions: CandidateDecisions;
  unicodeVersion: string;
  trackedRevision: string;
}) {
  const [decisions, setDecisions] = useState(trackedDecisions);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('unreviewed');
  const [eligibility, setEligibility] = useState<EligibilityFilter>('eligible');
  const [target, setTarget] = useState<TargetFilter>('all');
  const [group, setGroup] = useState('all');
  const [subgroup, setSubgroup] = useState('all');
  const [speed, setSpeed] = useState<SpeedFilter>('all');
  const [saturation, setSaturation] = useState<SaturationFilter>('all');
  const [minHeight, setMinHeight] = useState('');
  const [maxHeight, setMaxHeight] = useState('');
  const [includeUnsized, setIncludeUnsized] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('similarity');
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    setDecisions(readDraft(trackedRevision, trackedDecisions));
    setDraftReady(true);
  }, [trackedRevision, trackedDecisions]);

  useEffect(() => {
    if (!draftReady) return;
    const draft: Draft = { version: 1, trackedRevision, decisions };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [decisions, draftReady, trackedRevision]);

  const candidateKeys = useMemo(() => new Set(candidates.map((item) => item.key)), [candidates]);
  const orphanEntries = Object.entries(decisions).filter(([key]) => !candidateKeys.has(key));
  const groups = useMemo(() => [...new Set(candidates.map((item) => item.group))].sort(), [candidates]);
  const subgroups = useMemo(
    () => [...new Set(candidates.filter((item) => group === 'all' || item.group === group).map((item) => item.subgroup))].sort(),
    [candidates, group]
  );
  const shortlistedByFamily = useMemo(() => {
    const result = new Map<string, Candidate[]>();
    for (const candidate of candidates) {
      if (!candidate.similarityFamily || decisions[candidate.key]?.status !== 'shortlisted') continue;
      const list = result.get(candidate.similarityFamily) ?? [];
      list.push(candidate);
      result.set(candidate.similarityFamily, list);
    }
    return result;
  }, [candidates, decisions]);

  const minCm = parseLengthCm(minHeight);
  const maxCm = parseLengthCm(maxHeight);
  const heightFilterOn = minCm != null || maxCm != null;

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return candidates
      .filter((candidate) => {
        const decision = decisions[candidate.key];
        const candidateStatus = statusOf(decision);
        const shortlistedNeighbors = candidate.similarityFamily
          ? (shortlistedByFamily.get(candidate.similarityFamily) ?? []).filter((item) => item.key !== candidate.key)
          : [];
        const saturated = candidate.similarExisting.length + shortlistedNeighbors.length > 0;
        return (
          (!normalizedQuery || `${candidate.emoji} ${candidate.name} ${candidate.group} ${candidate.subgroup}`.toLocaleLowerCase().includes(normalizedQuery)) &&
          (status === 'all' || candidateStatus === status) &&
          (eligibility === 'all' || (eligibility === 'eligible' ? candidate.eligible : !candidate.eligible)) &&
          (target === 'all' || (
            decision?.status === 'shortlisted'
              ? decision.targets.includes(target)
              : candidate.targets.includes(target)
          )) &&
          (group === 'all' || candidate.group === group) &&
          (subgroup === 'all' || candidate.subgroup === subgroup) &&
          (speed === 'all' || (speed === 'yes' ? candidate.speedPotential : !candidate.speedPotential)) &&
          (saturation === 'all' || (saturation === 'saturated' ? saturated : !saturated)) &&
          (!heightFilterOn || (
            candidate.roughHeightCm == null
              ? includeUnsized
              : (minCm == null || candidate.roughHeightCm >= minCm) &&
                (maxCm == null || candidate.roughHeightCm <= maxCm)
          ))
        );
      })
      .sort((a, b) => {
        if (sortOrder === 'height') {
          // Unguessed subjects sort last rather than as zero-height.
          const aCm = a.roughHeightCm ?? Infinity;
          const bCm = b.roughHeightCm ?? Infinity;
          if (aCm !== bCm) return aCm - bCm;
        }
        const aFamily = a.similarityFamily;
        const bFamily = b.similarityFamily;
        const aShortlisted = aFamily
          ? (shortlistedByFamily.get(aFamily) ?? []).filter((item) => item.key !== a.key).length
          : 0;
        const bShortlisted = bFamily
          ? (shortlistedByFamily.get(bFamily) ?? []).filter((item) => item.key !== b.key).length
          : 0;
        const aSaturation = a.similarExisting.length + aShortlisted;
        const bSaturation = b.similarExisting.length + bShortlisted;
        return aSaturation - bSaturation || b.targets.length - a.targets.length || a.order - b.order;
      });
  }, [candidates, decisions, eligibility, group, heightFilterOn, includeUnsized, maxCm, minCm, query, saturation, shortlistedByFamily, sortOrder, speed, status, subgroup, target]);

  function changeDecision(key: string, decision?: CandidateDecision) {
    setDecisions((current) => {
      const next = { ...current };
      if (decision) next[key] = decision;
      else delete next[key];
      return next;
    });
  }

  function exportDecisions() {
    const blob = new Blob([serializeDecisions(decisions)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'candidate-decisions.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function discardDraft() {
    localStorage.removeItem(STORAGE_KEY);
    setDecisions(trackedDecisions);
  }

  const counts = useMemo(() => {
    const values = Object.values(decisions);
    return {
      shortlisted: values.filter((item) => item.status === 'shortlisted').length,
      rejected: values.filter((item) => item.status === 'rejected').length,
      eligible: candidates.filter((item) => item.eligible).length,
    };
  }, [candidates, decisions]);

  return (
    <div className="candidate-tool">
      <section className="candidate-summary">
        <div>
          <strong>{candidates.length}</strong> incomplete or missing ·{' '}
          <strong>{counts.eligible}</strong> eligible ·{' '}
          <strong>{counts.shortlisted}</strong> shortlisted ·{' '}
          <strong>{counts.rejected}</strong> rejected
        </div>
        <div className="candidate-export-actions">
          <button
            type="button"
            onClick={() => {
              setMinHeight(NICHE_BAND.min);
              setMaxHeight(NICHE_BAND.max);
              setSortOrder('height');
            }}
          >
            Niche band: 333 mm - 1.5 km
          </button>
          <button type="button" onClick={() => { setMinHeight(''); setMaxHeight(''); }}>
            Clear height range
          </button>
          <label className="candidate-inline-check">
            <input
              type="checkbox"
              checked={includeUnsized}
              onChange={(event) => setIncludeUnsized(event.target.checked)}
            />
            Keep unsized
          </label>
          <button type="button" className="candidate-primary" onClick={exportDecisions}>Export decisions</button>
          <button type="button" onClick={discardDraft}>Discard local draft</button>
        </div>
        <p>
          Unicode {unicodeVersion}. Heights are rough uncited guesses from{' '}
          <code>app/(dev)/candidates/candidate-heights.ts</code>, for triage only - verify before
          adding any of them to the database. Drafts stay in this browser. Replace{' '}
          <code>app/(dev)/candidates/candidate-decisions.json</code> with the exported file to track them.
        </p>
      </section>

      <section className="candidate-filters" aria-label="Candidate filters">
        <label className="candidate-search">
          Search
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Emoji or name" />
        </label>
        <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
          <option value="unreviewed">Unreviewed</option><option value="shortlisted">Shortlisted</option>
          <option value="rejected">Rejected</option><option value="all">All</option>
        </select></label>
        <label>Rules<select value={eligibility} onChange={(event) => setEligibility(event.target.value as EligibilityFilter)}>
          <option value="eligible">Eligible</option><option value="excluded">Rule excluded</option><option value="all">All</option>
        </select></label>
        <label>Target<select value={target} onChange={(event) => setTarget(event.target.value as TargetFilter)}>
          <option value="all">All</option><option value="scale">Scale</option><option value="speed">Speed</option>
        </select></label>
        <label>Group<select value={group} onChange={(event) => { setGroup(event.target.value); setSubgroup('all'); }}>
          <option value="all">All</option>{groups.map((item) => <option key={item}>{item}</option>)}
        </select></label>
        <label>Subgroup<select value={subgroup} onChange={(event) => setSubgroup(event.target.value)}>
          <option value="all">All</option>{subgroups.map((item) => <option key={item}>{item}</option>)}
        </select></label>
        <label>Speed potential<select value={speed} onChange={(event) => setSpeed(event.target.value as SpeedFilter)}>
          <option value="all">All</option><option value="yes">Yes</option><option value="no">No</option>
        </select></label>
        <label>Similarity<select value={saturation} onChange={(event) => setSaturation(event.target.value as SaturationFilter)}>
          <option value="all">All</option><option value="fresh">No neighbors</option><option value="saturated">Has neighbors</option>
        </select></label>
        <label>Min height
          <input
            value={minHeight}
            onChange={(event) => setMinHeight(event.target.value)}
            placeholder="333mm"
            aria-invalid={minHeight.trim() !== '' && minCm == null}
          />
        </label>
        <label>Max height
          <input
            value={maxHeight}
            onChange={(event) => setMaxHeight(event.target.value)}
            placeholder="1.5km"
            aria-invalid={maxHeight.trim() !== '' && maxCm == null}
          />
        </label>
        <label>Sort<select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)}>
          <option value="similarity">Similarity</option><option value="height">Rough height</option>
        </select></label>
      </section>

      <p className="candidate-result-count">
        Showing {visible.length} candidates
        {heightFilterOn && (
          <>
            {' '}roughly {minCm != null ? formatRoughHeight(minCm) : 'any'} to{' '}
            {maxCm != null ? formatRoughHeight(maxCm) : 'any'}
            {includeUnsized ? ', unsized included' : ''}
          </>
        )}
      </p>
      <section className="candidate-grid">
        {visible.map((candidate) => {
          const neighbors = candidate.similarityFamily
            ? (shortlistedByFamily.get(candidate.similarityFamily) ?? []).filter((item) => item.key !== candidate.key)
            : [];
          return (
            <CandidateCard
              key={candidate.key}
              candidate={candidate}
              decision={decisions[candidate.key]}
              shortlistedNeighbors={neighbors}
              onChange={(decision) => changeDecision(candidate.key, decision)}
            />
          );
        })}
      </section>

      {orphanEntries.length > 0 && (
        <section className="candidate-orphans">
          <h2>Orphaned decisions</h2>
          <p>These keys no longer match an incomplete candidate in the current catalog.</p>
          {orphanEntries.map(([key, decision]) => (
            <div key={key}>
              <span>{key} · {decision.status}</span>
              <button type="button" onClick={() => changeDecision(key)}>Remove</button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
