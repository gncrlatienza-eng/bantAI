import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button } from '../../components/primitives';
import './campaign-reconciliation.css';
import { CampaignAnalysisSection } from './CampaignAnalysisSection';
import {
  approveCampaignEvolution,
  correctCampaignAssignment,
  draftCampaignEvolution,
  getCampaignById,
  listCampaignEvolution,
  mergeCampaigns,
  splitCampaign,
  type CampaignDetail,
  type CampaignEvolutionEvent,
} from '../../services/campaignsService';

function lines(value: string) {
  return [
    ...new Set(
      value
        .split(/[\s,]+/)
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ];
}

export function CampaignReconciliationPanel({
  campaignId,
  onChanged,
}: {
  campaignId: string;
  onChanged?: () => void;
}) {
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [events, setEvents] = useState<CampaignEvolutionEvent[]>([]);
  const [mode, setMode] = useState<'merge' | 'split' | 'correct' | 'evolution'>(
    'evolution',
  );
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [otherId, setOtherId] = useState('');
  const [otherRevision, setOtherRevision] = useState('0');
  const [messageIds, setMessageIds] = useState('');
  const [domains, setDomains] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [eventType, setEventType] = useState<
    'INDICATOR_SHIFT' | 'TACTIC_CHANGE' | 'CAMPAIGN_RELATION' | 'STATUS_CHANGE'
  >('TACTIC_CHANGE');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [detail, timeline] = await Promise.all([
        getCampaignById(campaignId),
        listCampaignEvolution(campaignId),
      ]);
      setCampaign(detail);
      setEvents(timeline);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Campaign review is unavailable.',
      );
    }
  }, [campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!campaign || busy) return;
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const evidenceReferences = lines(evidence);
      if (mode === 'merge') {
        await mergeCampaigns(campaignId, {
          sourceId: otherId.trim(),
          expectedSourceRevision: Number(otherRevision),
          expectedTargetRevision: campaign.revision ?? 0,
          reason: reason.trim(),
          evidenceReferences,
        });
      } else if (mode === 'split') {
        await splitCampaign(campaignId, {
          expectedRevision: campaign.revision ?? 0,
          title: title.trim(),
          messageIds: lines(messageIds),
          domains: lines(domains),
          reason: reason.trim(),
          evidenceReferences,
        });
      } else if (mode === 'correct') {
        await correctCampaignAssignment({
          messageId: messageIds.trim(),
          targetCampaignId: otherId.trim() || undefined,
          reason: reason.trim(),
          evidenceReferences,
        });
      } else {
        await draftCampaignEvolution(campaignId, {
          type: eventType,
          summary: summary.trim(),
          evidenceReferences,
        });
      }
      setNotice(
        'Change recorded. Review publication and counts before making intelligence visible to Shield.',
      );
      await load();
      if (mode !== 'evolution') onChanged?.();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Campaign operation failed.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function approve(eventId: string) {
    setBusy(true);
    setError('');
    try {
      await approveCampaignEvolution(eventId);
      setNotice(
        'Evidence-backed evolution approved for the published timeline.',
      );
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Approval failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="campaign-reconciliation-title"
      style={{
        marginTop: 24,
        padding: 24,
        background: 'var(--surface-raised)',
        borderRadius: 8,
      }}
    >
      <h2 id="campaign-reconciliation-title">Campaign reconciliation</h2>
      <p>
        Merge, split and correction retain assignment history. Affected
        campaigns become dormant and unpublished until their counts, indicators
        and masked examples are reviewed.
      </p>
      {campaign && (
        <p>
          Current revision: {campaign.revision ?? 0} · Model count:{' '}
          {campaign.countVerified === false
            ? 'requires review'
            : campaign.messageCount}
        </p>
      )}
      <form
        className="campaign-reconciliation-form"
        onSubmit={(event) => void submit(event)}
        style={{ display: 'grid', gap: 14, maxWidth: 720 }}
      >
        <label>
          Operation
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as typeof mode)}
          >
            <option value="evolution">Draft evolution event</option>
            <option value="merge">Merge another campaign into this one</option>
            <option value="split">
              Split selected messages into a child campaign
            </option>
            <option value="correct">Correct one message assignment</option>
          </select>
        </label>
        {mode === 'evolution' ? (
          <>
            <label>
              Event type
              <select
                value={eventType}
                onChange={(event) =>
                  setEventType(event.target.value as typeof eventType)
                }
              >
                <option value="TACTIC_CHANGE">Tactic change</option>
                <option value="INDICATOR_SHIFT">Indicator shift</option>
                <option value="CAMPAIGN_RELATION">Campaign relation</option>
                <option value="STATUS_CHANGE">Status change</option>
              </select>
            </label>
            <label>
              Public summary, without identifiers
              <textarea
                required
                minLength={15}
                maxLength={500}
                rows={3}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
            </label>
          </>
        ) : (
          <label>
            Reason for the change
            <textarea
              required
              minLength={15}
              maxLength={500}
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        )}
        {mode === 'merge' && (
          <>
            <label>
              Source campaign ID
              <input
                required
                value={otherId}
                onChange={(event) => setOtherId(event.target.value)}
              />
            </label>
            <label>
              Source revision
              <input
                required
                type="number"
                min="0"
                value={otherRevision}
                onChange={(event) => setOtherRevision(event.target.value)}
              />
            </label>
          </>
        )}
        {mode === 'split' && (
          <>
            <label>
              New campaign title
              <input
                required
                minLength={3}
                maxLength={120}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              Message IDs, one per line
              <textarea
                required
                rows={4}
                value={messageIds}
                onChange={(event) => setMessageIds(event.target.value)}
              />
            </label>
            <label>
              Indicators to move, one domain per line
              <textarea
                rows={3}
                value={domains}
                onChange={(event) => setDomains(event.target.value)}
              />
            </label>
          </>
        )}
        {mode === 'correct' && (
          <>
            <label>
              Message ID
              <input
                required
                value={messageIds}
                onChange={(event) => setMessageIds(event.target.value)}
              />
            </label>
            <label>
              New campaign ID, blank to unassign
              <input
                value={otherId}
                onChange={(event) => setOtherId(event.target.value)}
              />
            </label>
          </>
        )}
        <label>
          Internal evidence references, one per line
          <textarea
            required
            rows={3}
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
            placeholder="report:UUID, operation:UUID or observation:UUID"
          />
        </label>
        <Button type="submit" disabled={busy || !campaign}>
          {busy ? 'Saving…' : 'Record reviewed change'}
        </Button>
      </form>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      <CampaignAnalysisSection
        campaignId={campaignId}
        onProposals={() => void load()}
      />
      <h3>Evolution review</h3>
      {events.length === 0 ? (
        <p>No evolution events have been drafted.</p>
      ) : (
        <ul>
          {events.map((event) => (
            <li key={event.id} style={{ marginBottom: 12 }}>
              <strong>{event.type.replaceAll('_', ' ')}</strong> ·{' '}
              {event.revokedAt ? 'WITHDRAWN' : event.status}
              {event.origin === 'ANALYSIS' && (
                <span style={{ color: 'var(--text-secondary)' }}>
                  {' '}
                  · proposed by analysis
                </span>
              )}
              <br />
              {event.summary}
              <br />
              {event.status === 'DRAFT' && !event.revokedAt && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void approve(event.id)}
                >
                  Approve event
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
