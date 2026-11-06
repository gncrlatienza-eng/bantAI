/*
 * Admin Campaigns page. Phase F step 3.
 *
 * Wraps the shared CampaignsList in the admin AppShell. Admin gets an extra
 * "Deactivate" action per row via role="admin" prop on the list.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/appshell/AppShell';
import { Button, Input, Select } from '../../components/primitives';
import { CampaignsList } from '../../features/campaigns/CampaignsList';
import {
  createAdminCampaign,
  type CampaignIntelligenceUpdate,
} from '../../services/campaignsService';

export function CampaignsPage() {
  const navigate = useNavigate();
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
    <>
      <PageHeader
        title="Campaigns"
        description="Drafts stay hidden from Shield until published."
        actions={
          <Button
            variant={creating ? 'secondary' : 'primary'}
            onClick={() => setCreating(!creating)}
          >
            {creating ? 'Cancel' : 'New campaign draft'}
          </Button>
        }
      />
      {creating && (
        <form
          onSubmit={(event) => void createDraft(event)}
          style={{
            display: 'grid',
            gap: 16,
            maxWidth: 640,
            margin: '0 0 28px',
            padding: 20,
            borderRadius: 8,
            background: 'var(--surface-raised)',
          }}
        >
          <Input
            label="Title"
            required
            maxLength={160}
            value={draft.title}
            onChange={(event) =>
              setDraft({ ...draft, title: event.target.value })
            }
          />
          <label className="bantai-p-field">
            <span className="bantai-p-field__label">Summary</span>
            <textarea
              className="bantai-p-input"
              rows={3}
              required
              maxLength={4000}
              value={draft.summary}
              onChange={(event) =>
                setDraft({ ...draft, summary: event.target.value })
              }
            />
          </label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
            }}
          >
            <Select
              label="Risk"
              value={draft.risk}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  risk: event.target
                    .value as CampaignIntelligenceUpdate['risk'],
                })
              }
              options={[
                { value: 'LOW', label: 'Low' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'HIGH', label: 'High' },
                { value: 'CRITICAL', label: 'Critical' },
              ]}
            />
            <Input
              label="Category"
              required
              maxLength={120}
              value={draft.category}
              onChange={(event) =>
                setDraft({ ...draft, category: event.target.value })
              }
            />
          </div>
          <label className="bantai-p-field">
            <span className="bantai-p-field__label">Mitigation</span>
            <textarea
              className="bantai-p-input"
              rows={3}
              required
              maxLength={4000}
              value={draft.mitigation}
              onChange={(event) =>
                setDraft({ ...draft, mitigation: event.target.value })
              }
            />
          </label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Button type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create draft'}
            </Button>
            {createError && (
              <p
                role="alert"
                style={{ margin: 0, color: 'var(--status-threat)' }}
              >
                {createError}
              </p>
            )}
          </div>
        </form>
      )}
      <CampaignsList
        role="admin"
        onCampaignClick={(c) =>
          void navigate(`/admin/campaigns/${encodeURIComponent(c.id)}`)
        }
      />
    </>
  );
}

export default CampaignsPage;
