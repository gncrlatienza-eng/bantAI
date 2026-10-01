import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../../components/primitives';
import {
  approveMaskedCampaignMessage,
  getCampaignById,
  publishCampaignIntelligence,
  reactivateCampaign,
  setCampaignIndicators,
  updateCampaignIntelligence,
  type CampaignIntelligenceUpdate,
} from '../../services/campaignsService';

const EMPTY: CampaignIntelligenceUpdate = {
  title: '',
  summary: '',
  risk: 'MEDIUM',
  category: '',
  mitigation: '',
};

export function CampaignIntelligenceEditor({
  campaignId,
}: {
  campaignId: string;
}) {
  const [draft, setDraft] = useState<CampaignIntelligenceUpdate>(EMPTY);
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [maskedText, setMaskedText] = useState('');
  const [domains, setDomains] = useState('');
  const [active, setActive] = useState(false);
  const [archived, setArchived] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const campaign = await getCampaignById(campaignId);
      setDraft({
        title: campaign.label ?? '',
        summary: campaign.summary ?? '',
        risk: isRisk(campaign.risk) ? campaign.risk : 'MEDIUM',
        category: campaign.category ?? '',
        mitigation: campaign.mitigation ?? '',
      });
      setPublished(Boolean(campaign.publishedAt));
      setDomains(campaign.urlDomains.join('\n'));
      setActive(campaign.isActive);
      setArchived(Boolean(campaign.archivedAt));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Campaign could not be loaded.',
      );
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await updateCampaignIntelligence(campaignId, draft);
      setPublished(false);
      setMessage(
        'Campaign intelligence saved as an internal draft. Publish after review.',
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Campaign update failed.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await updateCampaignIntelligence(campaignId, draft);
      await publishCampaignIntelligence(campaignId);
      setPublished(true);
      setMessage('Campaign intelligence published to Shield.');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Campaign publication failed.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function approveMaskedExample() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await approveMaskedCampaignMessage(campaignId, maskedText);
      setMaskedText('');
      setMessage('Reviewed masked example approved for the Shield API.');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Masked example approval failed.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveIndicators() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const parsed = domains
        .split(/[\s,]+/)
        .map((domain) => domain.trim())
        .filter(Boolean);
      await setCampaignIndicators(campaignId, parsed);
      setPublished(false);
      setDomains(
        Array.from(new Set(parsed.map((domain) => domain.toLowerCase()))).join(
          '\n',
        ),
      );
      setMessage(
        'Indicators saved. Review and publish the campaign again for Shield.',
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Indicator update failed.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function reactivate() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await reactivateCampaign(campaignId);
      setActive(true);
      setMessage('Campaign reactivated for matching.');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Campaign reactivation failed.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p>Loading campaign publication details…</p>;
  if (archived) {
    return (
      <p role="status">
        This campaign is archived. Its intelligence is read-only and unavailable
        to Shield.
      </p>
    );
  }

  const field = (
    label: string,
    key: 'title' | 'summary' | 'category' | 'mitigation',
    multiline = false,
  ) => (
    <label style={{ display: 'grid', gap: 6 }} key={key}>
      <span>{label}</span>
      {multiline ? (
        <textarea
          value={draft[key]}
          onChange={(event) =>
            setDraft({ ...draft, [key]: event.target.value })
          }
          rows={4}
          style={{ width: '100%' }}
        />
      ) : (
        <input
          value={draft[key]}
          onChange={(event) =>
            setDraft({ ...draft, [key]: event.target.value })
          }
          style={{ width: '100%' }}
        />
      )}
    </label>
  );

  return (
    <section
      aria-labelledby="campaign-publication-title"
      style={{
        marginTop: 24,
        padding: 24,
        background: 'var(--surface-raised)',
        borderRadius: 8,
      }}
    >
      <h2 id="campaign-publication-title" style={{ marginTop: 0 }}>
        Shield publication
      </h2>
      <p>
        {published
          ? 'Published to Shield. Saving changes withdraws this version until it is reviewed and published again.'
          : 'Internal only. Complete and review every field before publishing.'}
      </p>
      <div style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
        {field('Campaign title', 'title')}
        {field('Campaign summary', 'summary', true)}
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Risk</span>
          <select
            value={draft.risk}
            onChange={(event) =>
              setDraft({
                ...draft,
                risk: event.target.value as CampaignIntelligenceUpdate['risk'],
              })
            }
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </label>
        {field('Threat category', 'category')}
        {field('Recommended mitigation', 'mitigation', true)}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
        <Button disabled={busy} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save intelligence'}
        </Button>
        {!published && (
          <Button
            disabled={busy}
            variant="secondary"
            onClick={() => void publish()}
          >
            Publish to Shield
          </Button>
        )}
      </div>
      <section
        aria-labelledby="campaign-indicators-title"
        style={{ marginTop: 28, maxWidth: 720 }}
      >
        <h3 id="campaign-indicators-title">Domain indicators</h3>
        <p>
          One hostname per line. Changes withdraw the published version until an
          Admin reviews and republishes it.
        </p>
        <label style={{ display: 'grid', gap: 6 }}>
          Domains
          <textarea
            value={domains}
            onChange={(event) => setDomains(event.target.value)}
            rows={5}
            style={{ width: '100%' }}
          />
        </label>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void saveIndicators()}
        >
          Save indicators
        </Button>
      </section>
      {!active && (
        <section
          aria-labelledby="campaign-activation-title"
          style={{ marginTop: 28 }}
        >
          <h3 id="campaign-activation-title">Campaign status</h3>
          <p>
            This campaign is dormant. Add at least one indicator before
            reactivating a manually created campaign.
          </p>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void reactivate()}
          >
            Reactivate campaign
          </Button>
        </section>
      )}
      <section
        aria-labelledby="masked-example-title"
        style={{ marginTop: 28, maxWidth: 720 }}
      >
        <h3 id="masked-example-title">Approve a masked API example</h3>
        <p>
          Write a de-identified example with placeholders such as [BRAND],
          [ACCOUNT] and [URL]. Review it before approval. The regular Shield
          campaign page never displays examples.
        </p>
        <label style={{ display: 'grid', gap: 6 }}>
          Reviewed placeholder text
          <textarea
            value={maskedText}
            onChange={(event) => setMaskedText(event.target.value)}
            rows={3}
            maxLength={2000}
            style={{ width: '100%' }}
          />
        </label>
        <Button
          variant="secondary"
          disabled={busy || !maskedText.trim()}
          onClick={() => void approveMaskedExample()}
        >
          Approve masked example
        </Button>
      </section>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

function isRisk(
  value: string | null | undefined,
): value is CampaignIntelligenceUpdate['risk'] {
  return (
    value === 'LOW' ||
    value === 'MEDIUM' ||
    value === 'HIGH' ||
    value === 'CRITICAL'
  );
}
