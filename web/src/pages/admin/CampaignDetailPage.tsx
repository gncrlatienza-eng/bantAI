/*
 * Admin Campaign Detail page. Phase F step 4.
 *
 * Wraps the shared CampaignDetail feature in the admin AppShell. Admins get
 * the deactivate action in the detail header via the shared component's
 * role prop. The visible messages are still scoped to the admin's own JWT
 * user (see CampaignsService.findOne on the backend).
 */

import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import type { NavGroupDef } from '../../components/appshell/AppShell';
import {
  Button,
  NavOverviewIcon,
  NavCampaignsIcon,
  NavReportsIcon,
  NavUsersIcon,
  NavModelIcon,
  NavSystemIcon,
} from '../../components/primitives';
import { CampaignDetail } from '../../features/campaigns/CampaignDetail';
import { logout } from '../../services/authService';

const SIDEBAR_GROUPS: NavGroupDef[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Overview', path: '/admin/overview', icon: <NavOverviewIcon /> },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      {
        label: 'Campaigns',
        path: '/admin/campaigns',
        icon: <NavCampaignsIcon />,
      },
      { label: 'Model', path: '/admin/model', icon: <NavModelIcon /> },
      { label: 'Reports', path: '/admin/reports', icon: <NavReportsIcon /> },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Users', path: '/admin/users', icon: <NavUsersIcon /> },
      { label: 'Tips', path: '/admin/tips', icon: <NavReportsIcon /> },
      { label: 'System', path: '/admin/system', icon: <NavSystemIcon /> },
      { label: 'Settings', path: '/admin/settings', icon: <NavSystemIcon /> },
    ],
  },
];

export function CampaignDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const campaignId = params.id ?? '';

  return (
    <AppShell
      role="admin"
      groups={SIDEBAR_GROUPS}
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
      topbarUtility={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              logout();
              void navigate('/admin-login');
            }}
          >
            Sign out
          </Button>
        </>
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
        <CampaignDetail role="admin" campaignId={campaignId} />
      ) : (
        <p style={{ color: 'var(--text-secondary)' }}>
          No campaign id in URL. Return to the campaigns list.
        </p>
      )}
    </AppShell>
  );
}

export default CampaignDetailPage;
