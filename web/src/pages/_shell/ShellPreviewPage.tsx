/*
 * Dev-only AppShell preview.
 *
 * Renders the shell at whatever the current viewport is. Resize the browser
 * to see the three responsive states:
 *   >=1280 : 248px persistent sidebar
 *   1024-1279 : 72px rail with icon-only labels
 *   <1024 : hamburger + off-canvas drawer
 *
 * Registered only when import.meta.env.DEV is true. See AppRoutes.tsx.
 */

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import type { NavGroupDef, Role } from '../../components/appshell/AppShell';
import {
  NavOverviewIcon,
  NavCampaignsIcon,
  NavMessagesIcon,
  NavAnalyticsIcon,
  NavSearchIcon,
  NavReportsIcon,
  NavUsersIcon,
  NavModelIcon,
  NavSystemIcon,
} from '../../components/primitives/icons';

const GROUPS: NavGroupDef[] = [
  {
    label: 'Overview',
    items: [
      {
        label: 'Overview',
        path: '/_shell/overview',
        icon: <NavOverviewIcon />,
      },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      {
        label: 'Campaigns',
        path: '/_shell/campaigns',
        icon: <NavCampaignsIcon />,
      },
      {
        label: 'Messages',
        path: '/_shell/messages',
        icon: <NavMessagesIcon />,
      },
      {
        label: 'Analytics',
        path: '/_shell/analytics',
        icon: <NavAnalyticsIcon />,
      },
    ],
  },
  {
    label: 'Investigation',
    items: [
      {
        label: 'Search',
        path: '/_shell/search',
        icon: <NavSearchIcon />,
      },
      {
        label: 'Reports',
        path: '/_shell/reports',
        icon: <NavReportsIcon />,
      },
    ],
  },
  {
    label: 'Administration',
    roles: ['admin'],
    items: [
      {
        label: 'Users',
        path: '/_shell/users',
        icon: <NavUsersIcon />,
        roles: ['admin'],
      },
      {
        label: 'Model',
        path: '/_shell/model',
        icon: <NavModelIcon />,
        roles: ['admin'],
      },
      {
        label: 'System',
        path: '/_shell/system',
        icon: <NavSystemIcon />,
        roles: ['admin'],
      },
    ],
  },
];

export function ShellPreviewPage() {
  const [role, setRole] = React.useState<Role>('admin');
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <AppShell
      role={role}
      groups={GROUPS}
      brandInitial="B"
      brandLabel="BantAI"
      currentPath={location.pathname}
      onNavigate={(p) => void navigate(p)}
      topbarContext={<span>Shell preview / {role}</span>}
      topbarUtility={
        <>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              style={{
                background: 'var(--surface-canvas)',
                color: 'var(--text-primary)',
                border: '1px solid var(--surface-selected)',
                borderRadius: 4,
                padding: '4px 8px',
                fontFamily: 'inherit',
              }}
            >
              <option value="admin">admin</option>
              <option value="client">client</option>
            </select>
          </label>
        </>
      }
      footer={<span>Reymark / sign out</span>}
    >
      <PageHeader
        title="Shell preview"
        description="This route is dev-only. Resize the browser to see the sidebar transition from 248px, to 72px rail, to off-canvas drawer. Change the role in the top bar to see RBAC hide the Administration group."
        meta="Sidebar 248px / 72px / drawer · TopBar 60px · Content 32px x 28px · Motion 150-250ms"
        actions={
          <button
            type="button"
            style={{
              background: 'var(--action-primary-bg)',
              color: 'var(--action-primary-text)',
              border: 'none',
              padding: '8px 14px',
              borderRadius: 6,
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Primary action
          </button>
        }
      />

      <section
        style={{
          background: 'var(--surface-raised)',
          borderRadius: 8,
          padding: 20,
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            margin: 0,
            marginBottom: 8,
            fontSize: '1rem',
            color: 'var(--text-primary)',
          }}
        >
          Sample section
        </h2>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          Content region uses the mineral canvas. Sections sit on the raised
          porcelain surface. Text uses warm ink for primary and ash violet for
          secondary. No cards inside cards; sections group content directly.
        </p>
      </section>

      <section
        style={{
          background: 'var(--surface-raised)',
          borderRadius: 8,
          padding: 20,
        }}
      >
        <h2
          style={{
            margin: 0,
            marginBottom: 8,
            fontSize: '1rem',
            color: 'var(--text-primary)',
          }}
        >
          Grid smoke test
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, 1fr)',
            gap: 12,
          }}
        >
          {[7, 5, 12, 8, 4].map((cols, i) => (
            <div
              key={i}
              style={{
                gridColumn: `span ${cols}`,
                background: 'var(--surface-canvas)',
                border: '1px solid var(--surface-selected)',
                padding: 12,
                borderRadius: 6,
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
              }}
            >
              col-span {cols}
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

export default ShellPreviewPage;
