/*
 * Admin Campaign Detail page. Phase F step 4.
 *
 * Wraps the shared CampaignDetail feature in the admin AppShell. Admins get
 * the deactivate action in the detail header via the shared component's
 * role prop. Admin review shows stored masked campaign records through an
 * audited backend path. Original SMS text remains on the user's phone.
 */

import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import { Button } from '../../components/primitives';
import { CampaignDetail } from '../../features/campaigns/CampaignDetail';
import { ADMIN_SIDEBAR_GROUPS } from './adminNav';
import { CampaignIntelligenceEditor } from './CampaignIntelligenceEditor';
import { CampaignReconciliationPanel } from './CampaignReconciliationPanel';

export function CampaignDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const campaignId = params.id ?? '';
  const [archiveVersion, setArchiveVersion] = useState(0);

  return (
    <AppShell
      role="admin"
      groups={ADMIN_SIDEBAR_GROUPS}
      brandInitial="B"
      brandLabel="BantAI Admin"
      currentPath={'/admin/campaigns'}
      onNavigate={(p) => void navigate(p)}
      topbarContext={
        <span>
          Intelligence &middot;{' '}
          <button
            type="button"
            onClick={() => void navigate('/admin/campaigns')}
            style={{
              background: 'none',
              border: 0,
              padding: 0,
              color: 'inherit',
              cursor: 'pointer',
              textDecoration: 'underline',
              font: 'inherit',
            }}
          >
            Campaigns
          </button>{' '}
          &middot; Detail
        </span>
      }
      footer={<span style={{ fontSize: '0.85rem' }}>Authenticated admin</span>}
    >
      <PageHeader
        title="Campaign detail"
        description="Inspect a detected campaign, its linked domains, and the messages it clusters. Deactivate stops new messages from clustering under it."
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void navigate('/admin/campaigns')}
          >
            Back to campaigns
          </Button>
        }
      />
      {campaignId ? (
        <>
          <CampaignDetail
            key={archiveVersion}
            role="admin"
            campaignId={campaignId}
            onArchived={() => setArchiveVersion((version) => version + 1)}
          />
          <CampaignIntelligenceEditor
            key={archiveVersion}
            campaignId={campaignId}
          />
          <CampaignReconciliationPanel
            campaignId={campaignId}
            onChanged={() => setArchiveVersion((version) => version + 1)}
          />
        </>
      ) : (
        <p style={{ color: 'var(--text-secondary)' }}>
          No campaign id in URL. Return to the campaigns list.
        </p>
      )}
    </AppShell>
  );
}

export default CampaignDetailPage;
