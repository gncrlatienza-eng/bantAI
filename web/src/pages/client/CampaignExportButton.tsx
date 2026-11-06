/*
 * Shield campaign export: an action on the campaign itself (it used to be a
 * separate Exports page with a campaign picker). The JSON holds only that
 * campaign's approved intelligence, the same boundary as the Shield API.
 */

import React, { useState } from 'react';
import { Button } from '../../components/primitives';
import { exportCampaignIntelligence } from '../../services/campaignsService';
import { saveBlob } from '../../utils/download';

export function CampaignExportButton({ campaignId }: { campaignId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportCampaign() {
    setBusy(true);
    setError(null);
    try {
      const blob = await exportCampaignIntelligence(campaignId);
      saveBlob(blob, `bantai-shield-campaign-${campaignId}.json`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'The export request failed.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        disabled={busy || !campaignId}
        onClick={() => void exportCampaign()}
        title="Download this campaign's approved intelligence as JSON"
      >
        {busy ? 'Preparing export…' : 'Export JSON'}
      </Button>
      {error && (
        <span role="alert" style={{ color: 'var(--status-threat)' }}>
          {error}
        </span>
      )}
    </>
  );
}

export default CampaignExportButton;
