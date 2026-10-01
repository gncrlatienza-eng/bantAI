/*
 * Admin Campaigns page. Phase F step 3.
 *
 * Wraps the shared CampaignsList in the admin AppShell. Admin gets an extra
 * "Deactivate" action per row via role="admin" prop on the list.
 */

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import { Button } from '../../components/primitives';
import { CampaignsList } from '../../features/campaigns/CampaignsList';
import {
  createAdminCampaign,
  type CampaignIntelligenceUpdate,
} from '../../services/campaignsService';
import { ADMIN_SIDEBAR_GROUPS } from './adminNav';

export function CampaignsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<CampaignIntelligenceUpdate>({
    title: '',
    summary: '',
    risk: 'MEDIUM',
    category: '',
    mitigation: '',
  });
  const [createError, setCreateError] = useState('');
  const [busy, setBusy] = useState(false);

  async function createDraft(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setCreateError('');
    try {
      const created = await createAdminCampaign(draft);
      void navigate(`/admin/campaigns/${encodeURIComponent(created.id)}`);
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : 'Campaign creation failed.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppShell
      role="admin"
      groups={ADMIN_SIDEBAR_GROUPS}
      brandInitial="B"
      brandLabel="BantAI Admin"
      currentPath={location.pathname}
      onNavigate={(p) => void navigate(p)}
      topbarContext={<span>Intelligence &middot; Campaigns</span>}
      footer={<span style={{ fontSize: '0.85rem' }}>Authenticated admin</span>}
    >
      <PageHeader
        title="Campaigns"
        description="Review and publish campaign intelligence. Internal drafts stay hidden from Shield until published."
      />
      <Button variant="secondary" onClick={() => setCreating(!creating)}>
        {creating ? 'Close new campaign' : 'Create campaign draft'}
      </Button>
      {creating && (
        <form
          onSubmit={(event) => void createDraft(event)}
          style={{ display: 'grid', gap: 12, maxWidth: 640, margin: '20px 0' }}
        >
          <label>
            Title
            <input
              required
              maxLength={160}
              value={draft.title}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
            />
          </label>
          <label>
            Summary
            <textarea
              required
              maxLength={4000}
              value={draft.summary}
              onChange={(event) =>
                setDraft({ ...draft, summary: event.target.value })
              }
            />
          </label>
          <label>
            Risk
            <select
              value={draft.risk}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  risk: event.target
                    .value as CampaignIntelligenceUpdate['risk'],
                })
              }
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </label>
          <label>
            Category
            <input
              required
              maxLength={120}
              value={draft.category}
              onChange={(event) =>
                setDraft({ ...draft, category: event.target.value })
              }
            />
          </label>
          <label>
            Mitigation
            <textarea
              required
              maxLength={4000}
              value={draft.mitigation}
              onChange={(event) =>
                setDraft({ ...draft, mitigation: event.target.value })
              }
            />
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create internal draft'}
          </Button>
          {createError && <p role="alert">{createError}</p>}
        </form>
      )}
      <CampaignsList
        role="admin"
        onCampaignClick={(c) =>
          void navigate(`/admin/campaigns/${encodeURIComponent(c.id)}`)
        }
      />
    </AppShell>
  );
}

export default CampaignsPage;
