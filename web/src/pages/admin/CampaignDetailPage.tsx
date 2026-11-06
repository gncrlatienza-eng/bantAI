/*
 * Admin Campaign Detail page. Phase F step 4.
 *
 * Wraps the shared CampaignDetail feature in the admin AppShell. Admins get
 * the deactivate action in the detail header via the shared component's
 * role prop. Admin review shows stored masked campaign records through an
 * audited backend path. Original SMS text remains on the user's phone.
 */

import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CampaignDetail } from '../../features/campaigns/CampaignDetail';
import { CampaignIntelligenceEditor } from './CampaignIntelligenceEditor';
import { CampaignReconciliationPanel } from './CampaignReconciliationPanel';

export function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params.id ?? '';
  const [archiveVersion, setArchiveVersion] = useState(0);

  return (
    <>
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
    </>
  );
}

export default CampaignDetailPage;
