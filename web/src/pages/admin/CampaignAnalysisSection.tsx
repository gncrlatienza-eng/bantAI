import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  DataTable,
  EmptyState,
  type Column,
} from '../../components/primitives';
import {
  listCampaignObservations,
  runCampaignAnalysis,
  type CampaignActivityChange,
  type CampaignObservation,
} from '../../services/campaignsService';

const MUTED = { color: 'var(--text-secondary)' } as const;

const ACTIVITY: Record<CampaignActivityChange, string> = {
  NEW: 'First activity',
  STABLE: 'Stable',
  SPIKE: 'Sharp rise',
  DECLINE: 'Falling',
  DORMANT: 'Went quiet',
  RESURGENCE: 'Active again',
};

const LANGUAGE: Record<string, string> = {
  en: 'English',
  fil: 'Filipino',
  mixed: 'Mixed',
};

function day(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

const COLUMNS: Column<CampaignObservation>[] = [
  {
    key: 'window',
    header: 'Window (UTC)',
    width: '18%',
    render: (o) => `${day(o.windowStart)} – ${day(o.windowEnd)}`,
  },
  {
    key: 'messages',
    header: 'Messages',
    align: 'right',
    width: '12%',
    render: (o) => (
      <span>
        {o.messageCount}
        <span style={{ ...MUTED, display: 'block', fontSize: '0.8rem' }}>
          prev. {o.previousMessageCount}
        </span>
      </span>
    ),
  },
  {
    key: 'activity',
    header: 'Activity',
    width: '14%',
    render: (o) => ACTIVITY[o.activityChange],
  },
  {
    key: 'language',
    header: 'Language (heuristic)',
    render: (o) => {
      const now = o.dominantLanguage
        ? LANGUAGE[o.dominantLanguage]
        : 'No clear majority';
      const before = o.previousDominantLanguage
        ? LANGUAGE[o.previousDominantLanguage]
        : null;
      return (
        <span>
          {now}
          {before && before !== now && (
            <span style={{ ...MUTED, display: 'block', fontSize: '0.8rem' }}>
              was {before}
            </span>
          )}
        </span>
      );
    },
  },
  {
    key: 'domains',
    header: 'New indicator domains',
    render: (o) =>
      o.newDomains.length ? (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
          {o.newDomains.join(', ')}
        </span>
      ) : (
        <span style={MUTED}>None</span>
      ),
  },
  {
    key: 'evidence',
    header: 'Evidence msgs',
    align: 'right',
    width: '11%',
    render: (o) => (
      <span title="Internal message ids stored as evidence">
        {o.evidenceMessageIds.length}
      </span>
    ),
  },
];

/**
 * Deterministic 7-day window analysis of one campaign. Findings are filed as
 * draft evolution entries in the review list below; nothing reaches Shield
 * until an Admin approves the draft.
 */
export function CampaignAnalysisSection({
  campaignId,
  onProposals,
}: {
  campaignId: string;
  onProposals: () => void;
}) {
  const [observations, setObservations] = useState<CampaignObservation[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setObservations(await listCampaignObservations(campaignId));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Campaign observations are unavailable.',
      );
    }
  }, [campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function analyze() {
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const summary = await runCampaignAnalysis(campaignId);
      const outcome = summary.observations.skipped
        ? 'No confirmed activity in this or the previous window, so nothing was recorded.'
        : summary.observations.unchanged
          ? 'The latest window was already analyzed and nothing changed.'
          : summary.observations.updated
            ? 'The latest window was re-analyzed with new data; outdated drafts were withdrawn.'
            : 'The latest window was analyzed.';
      setNotice(
        `${outcome} ${summary.proposals ? `${summary.proposals} proposed change${summary.proposals === 1 ? '' : 's'} added for review.` : 'No new changes proposed.'}`,
      );
      await load();
      if (summary.proposals || summary.observations.updated) onProposals();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Analysis could not run.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="campaign-analysis-title"
      style={{ marginTop: 24 }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <div>
          <h3 id="campaign-analysis-title" style={{ margin: 0 }}>
            Evolution analysis
          </h3>
          <p
            style={{
              ...MUTED,
              margin: '4px 0 0',
              fontSize: '0.9rem',
              maxWidth: '75ch',
            }}
          >
            Compares the last complete 7 days (UTC) with the week before, using
            only model-matched or Admin-corrected messages. It flags new
            approved indicator domains, a shift in the main message language (a
            word-list heuristic over masked text) and sharp changes in activity.
            It runs daily and can be re-run here; the same data always gives the
            same result.
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void analyze()}
        >
          {busy ? 'Analyzing…' : 'Analyze latest window'}
        </Button>
      </div>
      {notice && (
        <p role="status" style={{ ...MUTED, margin: '0 0 12px' }}>
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" style={{ margin: '0 0 12px', fontWeight: 600 }}>
          {error}
        </p>
      )}
      <DataTable<CampaignObservation>
        ariaLabel="Campaign observations"
        rowKey={(o) => o.id}
        rows={observations}
        columns={COLUMNS}
        emptyState={
          <EmptyState
            title="No observations yet"
            description="An observation is recorded once the campaign has confirmed messages in a 7-day window."
          />
        }
      />
    </section>
  );
}
