/*
 * Client Campaign Detail page. Phase F step 4.
 *
 * Wraps the shared CampaignDetail feature in the client AppShell. Reads :id
 * from the URL and hands it to the feature component. Back link returns to
 * the campaigns list.
 */

import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import type { NavGroupDef } from '../../components/appshell/AppShell';
import {
  Button,
  NavOverviewIcon,
  NavCampaignsIcon,
  NavMessagesIcon,
  NavAnalyticsIcon,
  NavReportsIcon,
  NavSystemIcon,
} from '../../components/primitives';
import { CampaignDetail } from '../../features/campaigns/CampaignDetail';
import { logout } from '../../services/authService';

const SIDEBAR_GROUPS: NavGroupDef[] = [
  {
    label: 'Threat Intelligence',
    items: [
      {
        label: 'Overview',
        path: '/client/overview',
        icon: <NavOverviewIcon />,
      },
      {
        label: 'Messages',
        path: '/client/messages',
        icon: <NavMessagesIcon />,
      },
      {
        label: 'Campaigns',
        path: '/client/campaigns',
        icon: <NavCampaignsIcon />,
      },
      {
        label: 'Analytics',
        path: '/client/analytics',
        icon: <NavAnalyticsIcon />,
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Help', path: '/client/help', icon: <NavReportsIcon /> },
      {
        label: 'Account settings',
        path: '/client/settings',
        icon: <NavSystemIcon />,
      },
    ],
  },
];

export function CampaignDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const campaignId = params.id ?? '';

  return (
    <AppShell
      role="client"
      groups={SIDEBAR_GROUPS}
      brandInitial="B"
      brandLabel="BantAI"
      currentPath={'/client/campaigns'}
      onNavigate={(p) => void navigate(p)}
      topbarContext={
        <span>
          Threat Intelligence &middot;{' '}
          <button
            type="button"
            onClick={() => void navigate('/client/campaigns')}
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
      topbarUtility={
        <>
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
        </>
      }
      footer={
        <span style={{ fontSize: '0.85rem' }}>Authenticated account</span>
      }
    >
      <PageHeader
        title="Campaign detail"
        description="View the messages, domains, and lifecycle for a single detected campaign."
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void navigate('/client/campaigns')}
          >
            Back to campaigns
          </Button>
        }
      />
      {campaignId ? (
        <CampaignDetail role="client" campaignId={campaignId} />
      ) : (
        <p style={{ color: 'var(--text-secondary)' }}>
          No campaign id in URL. Return to the campaigns list.
        </p>
      )}
    </AppShell>
  );
}

export default CampaignDetailPage;
