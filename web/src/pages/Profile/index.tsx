import React from 'react';
import { PortalShell } from '../../components/layout/PortalShell';

const CLIENT_SIDEBAR_GROUPS = [
  {
    title: 'Threat Intelligence',
    items: [
      { path: '/client/overview', label: 'Overview', icon: '📊' },
      { path: '/client/messages', label: 'Messages', icon: '💬' },
      { path: '/client/campaigns', label: 'Campaigns', icon: '🛡️' },
      { path: '/client/analytics', label: 'Analytics', icon: '📈' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { path: '/client/export', label: 'Export Reports', icon: '📄' },
      { path: '/client/help', label: 'Help & Docs', icon: '❓' },
      { path: '/client/settings', label: 'Account Settings', icon: '⚙️' },
    ],
  },
];

export const ProfilePage: React.FC = () => {
  return (
    <PortalShell
      role="client"
      sidebarGroups={CLIENT_SIDEBAR_GROUPS}
      title="User Profile"
      tag="Globe Telecom"
      userInitials="MS"
      userName="Maria Santos"
      userMeta="Threat Intelligence Analyst"
      org="Globe Telecom"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 900 }}>
        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 24, padding: 32 }}>
          <div className="avatar client" style={{ width: 72, height: 72, fontSize: '1.75rem' }}>
            MS
          </div>
          <div>
            <h2 style={{ fontSize: '1.75rem', marginBottom: 4 }}>Maria Santos</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: 8 }}>
              Senior Threat Intelligence Analyst — Globe Telecom Fraud Ops
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="badge badge-purple">Verified Analyst</span>
              <span className="badge badge-green">2FA Enabled</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <h3 style={{ fontSize: '1.25rem', marginBottom: 16 }}>Account Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, fontSize: '0.875rem' }}>
            <div>
              <small style={{ color: 'var(--text-muted)', display: 'block' }}>Email Address</small>
              <strong>analyst@globe.com.ph</strong>
            </div>
            <div>
              <small style={{ color: 'var(--text-muted)', display: 'block' }}>Organization</small>
              <strong>Globe Telecom, Inc.</strong>
            </div>
            <div>
              <small style={{ color: 'var(--text-muted)', display: 'block' }}>Role</small>
              <strong>Threat Analyst Level 2</strong>
            </div>
            <div>
              <small style={{ color: 'var(--text-muted)', display: 'block' }}>Member Since</small>
              <strong>January 14, 2026</strong>
            </div>
          </div>
        </div>

        <div className="panel">
          <h3 style={{ fontSize: '1.25rem', marginBottom: 16 }}>Security & Access Log</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>IP Address</th>
                  <th>Location</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Portal Login (2FA Verified)</td>
                  <td>112.198.102.44</td>
                  <td>Taguig, Metro Manila</td>
                  <td>Today, 06:12 PM</td>
                </tr>
                <tr>
                  <td>Export CSV Generated</td>
                  <td>112.198.102.44</td>
                  <td>Taguig, Metro Manila</td>
                  <td>Yesterday, 02:45 PM</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PortalShell>
  );
};
