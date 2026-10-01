import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Select,
} from '../../components/primitives';
import {
  exportCampaignIntelligence,
  getActiveCampaigns,
  type CampaignCluster,
} from '../../services/campaignsService';
import { logout } from '../../services/authService';
import { saveBlob } from '../../utils/download';
import { useClientSidebarGroups } from './clientNav';

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'The export request failed.';

export function ExportPage() {
  const sidebarGroups = useClientSidebarGroups();
  const navigate = useNavigate();
  const location = useLocation();
  const [campaigns, setCampaigns] = useState<CampaignCluster[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await getActiveCampaigns();
      setCampaigns(items);
      setCampaignId((value) => value || items[0]?.id || '');
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function exportSelectedCampaign() {
    if (!campaignId) return;
    setBusy(true);
    setError(null);
    try {
      await exportCampaignIntelligence(campaignId).then((blob) =>
        saveBlob(blob, `bantai-shield-campaign-${campaignId}.json`),
      );
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppShell
      role="client"
      groups={sidebarGroups}
      brandInitial="S"
      brandLabel="BantAI Shield"
      currentPath={location.pathname}
      onNavigate={(path) => void navigate(path)}
      topbarContext={<span>Shield &middot; Exports</span>}
      topbarUtility={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            logout();
            void navigate('/login');
          }}
        >
          Sign out
        </Button>
      }
      footer={
        <span style={{ fontSize: '0.85rem' }}>
          Shield intelligence subscription
        </span>
      }
    >
      <PageHeader
        title="Campaign exports"
        description="Export one published campaign at a time. Exports follow the same approved intelligence boundary as the Shield campaign API."
      />
      {loading ? (
        <LoadingState label="Loading published campaigns…" />
      ) : error && campaigns.length === 0 ? (
        <ErrorState
          title="Campaign exports unavailable"
          description={error}
          action={
            <Button variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          }
        />
      ) : campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns available to export"
          description="Published campaign intelligence will become exportable when it is available."
        />
      ) : (
        <section
          style={{
            maxWidth: 640,
            background: 'var(--surface-raised)',
            borderRadius: 8,
            padding: 20,
          }}
        >
          <Select
            label="Campaign"
            value={campaignId}
            onChange={(event) => setCampaignId(event.target.value)}
            options={campaigns.map((campaign) => ({
              value: campaign.id,
              label: `${campaign.label || 'Published campaign'} (${campaign.id})`,
            }))}
          />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            JSON includes only the selected campaign&apos;s approved
            intelligence. Dataset exports, classification logs, and message
            records are unavailable in Shield.
          </p>
          <Button
            disabled={busy || !campaignId}
            onClick={() => void exportSelectedCampaign()}
          >
            {busy ? 'Preparing export…' : 'Download campaign JSON'}
          </Button>
          {error && (
            <p role="alert" style={{ color: 'var(--status-threat)' }}>
              {error}
            </p>
          )}
        </section>
      )}
    </AppShell>
  );
}

export default ExportPage;
