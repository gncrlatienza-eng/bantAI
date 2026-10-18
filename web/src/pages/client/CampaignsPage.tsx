/*
 * Client Campaigns page. Phase F step 3.
 *
 * Wraps the shared CampaignsList in the client AppShell. Admin uses the
 * same list with a different shell; both share sort, filter, search logic.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/appshell/AppShell';
import { CampaignsList } from '../../features/campaigns/CampaignsList';

export function CampaignsPage() {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Published smishing campaigns, their indicators and status."
      />
      <CampaignsList
        role="client"
        onCampaignClick={(c) =>
          void navigate(`/shield/campaigns/${encodeURIComponent(c.id)}`)
        }
      />
    </>
  );
}

export default CampaignsPage;
