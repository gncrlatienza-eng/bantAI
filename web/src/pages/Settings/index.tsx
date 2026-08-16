import React, { useState } from 'react';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
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

export const SettingsPage: React.FC = () => {
  // Form State
  const [profile, setProfile] = useState({
    fullName: 'Maria Santos',
    email: 'analyst@globe.com.ph',
    jobTitle: 'Senior Threat Intelligence Analyst',
    organization: 'Globe Telecom, Inc.',
    department: 'Cybersecurity Operations Center (SOC)',
  });

  const [notifications, setNotifications] = useState({
    realtimeAlerts: true,
    dailyDigest: true,
    weeklyReport: true,
    monthlyReport: false,
    browserPush: true,
    securityAlerts: true,
    campaignUpdates: true,
  });

  const [security, setSecurity] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    twoFactorEnabled: true,
    sessionTimeout: '30m',
  });

  const [preferences, setPreferences] = useState({
    timeZone: 'Asia/Manila (GMT+8)',
    dateFormat: 'YYYY-MM-DD (ISO 8601)',
    language: 'English (US)',
    defaultView: 'Executive Overview',
    theme: 'Dark Obsidian',
  });

  const [reports, setReports] = useState({
    exportFormat: 'CSV (Comma Separated)',
    autoReports: true,
    frequency: 'Daily 07:00 AM PST',
    compression: 'GZIP (.gz)',
  });

  const [apiKey, setApiKey] = useState('bnt_live_99481a82f3c091d7e2');
  const [savedNotice, setSavedNotice] = useState(false);

  const toggleNotif = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveAll = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <PortalShell
      role="client"
      sidebarGroups={CLIENT_SIDEBAR_GROUPS}
      title="Account & System Settings"
      tag="Globe Telecom"
      userInitials="MS"
      userName="Maria Santos"
      userMeta="Threat Intelligence Analyst"
      org="Globe Telecom"
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          width: '100%',
        }}
      >
        {savedNotice && (
          <div
            className="animate-scale-in"
            style={{
              padding: '14px 20px',
              borderRadius: 10,
              background: 'var(--green-bg)',
              border: '1px solid var(--green-border)',
              color: 'var(--green-text)',
              fontSize: '0.875rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span>✓</span>
            <span>
              All account settings and security preferences saved successfully.
            </span>
          </div>
        )}

        {/* 2-Column Responsive Settings Layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
            gap: 24,
            width: '100%',
          }}
        >
          {/* SECTION 1: PROFILE INFORMATION */}
          <div className="panel" style={{ gap: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: 12,
              }}
            >
              <strong style={{ fontSize: '1.125rem' }}>
                👤 Profile Information
              </strong>
              <span className="badge badge-purple">Verified Analyst</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div
                className="avatar client"
                style={{ width: 64, height: 64, fontSize: '1.5rem' }}
              >
                MS
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '1rem', display: 'block' }}>
                  {profile.fullName}
                </strong>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>
                  {profile.jobTitle}
                </small>
                <small
                  style={{ color: 'var(--accent-light)', fontWeight: 600 }}
                >
                  {profile.organization}
                </small>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => alert('Avatar upload simulation')}
              >
                Upload Photo
              </Button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
              }}
            >
              <Input
                label="Full Name"
                value={profile.fullName}
                onChange={(e) =>
                  setProfile({ ...profile, fullName: e.target.value })
                }
              />
              <Input
                label="Work Email Address"
                value={profile.email}
                onChange={(e) =>
                  setProfile({ ...profile, email: e.target.value })
                }
              />
            </div>

            <Input
              label="Job Title / Role"
              value={profile.jobTitle}
              onChange={(e) =>
                setProfile({ ...profile, jobTitle: e.target.value })
              }
            />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
              }}
            >
              <Input
                label="Organization"
                value={profile.organization}
                onChange={(e) =>
                  setProfile({ ...profile, organization: e.target.value })
                }
              />
              <Input
                label="Department / Team"
                value={profile.department}
                onChange={(e) =>
                  setProfile({ ...profile, department: e.target.value })
                }
              />
            </div>
          </div>

          {/* SECTION 2: NOTIFICATION PREFERENCES */}
          <div className="panel" style={{ gap: 16 }}>
            <div
              style={{
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: 12,
              }}
            >
              <strong style={{ fontSize: '1.125rem' }}>
                🔔 Notification Preferences
              </strong>
              <small
                style={{ color: 'var(--text-secondary)', display: 'block' }}
              >
                Configure real-time alerts and report delivery options.
              </small>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  padding: 8,
                  borderRadius: 8,
                  background: 'var(--bg-surface-elevated)',
                }}
              >
                <div>
                  <strong style={{ fontSize: '0.875rem', display: 'block' }}>
                    Real-Time Threat Alerts
                  </strong>
                  <small
                    style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}
                  >
                    Instant notification when a campaign targets your
                    subscribers.
                  </small>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.realtimeAlerts}
                  onChange={() => toggleNotif('realtimeAlerts')}
                  style={{
                    accentColor: 'var(--accent-primary)',
                    width: 20,
                    height: 20,
                    cursor: 'pointer',
                  }}
                />
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  padding: 8,
                  borderRadius: 8,
                  background: 'var(--bg-surface-elevated)',
                }}
              >
                <div>
                  <strong style={{ fontSize: '0.875rem', display: 'block' }}>
                    Daily Executive Digest
                  </strong>
                  <small
                    style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}
                  >
                    Automated daily email at 07:00 AM PST with campaign stats.
                  </small>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.dailyDigest}
                  onChange={() => toggleNotif('dailyDigest')}
                  style={{
                    accentColor: 'var(--accent-primary)',
                    width: 20,
                    height: 20,
                    cursor: 'pointer',
                  }}
                />
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  padding: 8,
                  borderRadius: 8,
                  background: 'var(--bg-surface-elevated)',
                }}
              >
                <div>
                  <strong style={{ fontSize: '0.875rem', display: 'block' }}>
                    Weekly Trend Summary
                  </strong>
                  <small
                    style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}
                  >
                    Weekly intelligence dossier delivered every Monday morning.
                  </small>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.weeklyReport}
                  onChange={() => toggleNotif('weeklyReport')}
                  style={{
                    accentColor: 'var(--accent-primary)',
                    width: 20,
                    height: 20,
                    cursor: 'pointer',
                  }}
                />
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  padding: 8,
                  borderRadius: 8,
                  background: 'var(--bg-surface-elevated)',
                }}
              >
                <div>
                  <strong style={{ fontSize: '0.875rem', display: 'block' }}>
                    Browser Push Notifications
                  </strong>
                  <small
                    style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}
                  >
                    Show popups when logged into the dashboard.
                  </small>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.browserPush}
                  onChange={() => toggleNotif('browserPush')}
                  style={{
                    accentColor: 'var(--accent-primary)',
                    width: 20,
                    height: 20,
                    cursor: 'pointer',
                  }}
                />
              </label>
            </div>
          </div>

          {/* SECTION 3: SECURITY & PASSWORD */}
          <div className="panel" style={{ gap: 16 }}>
            <div
              style={{
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: 12,
              }}
            >
              <strong style={{ fontSize: '1.125rem' }}>
                🔐 Security & Authentication
              </strong>
              <small
                style={{ color: 'var(--text-secondary)', display: 'block' }}
              >
                Manage password, 2FA credentials, and active sessions.
              </small>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input
                label="Current Password"
                isPassword
                placeholder="••••••••"
                value={security.currentPassword}
                onChange={(e) =>
                  setSecurity({ ...security, currentPassword: e.target.value })
                }
              />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 16,
                }}
              >
                <Input
                  label="New Password"
                  isPassword
                  placeholder="••••••••"
                  value={security.newPassword}
                  onChange={(e) =>
                    setSecurity({ ...security, newPassword: e.target.value })
                  }
                />
                <Input
                  label="Confirm New Password"
                  isPassword
                  placeholder="••••••••"
                  value={security.confirmPassword}
                  onChange={(e) =>
                    setSecurity({
                      ...security,
                      confirmPassword: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-surface-elevated)',
                padding: 12,
                borderRadius: 8,
              }}
            >
              <div>
                <strong style={{ fontSize: '0.875rem', display: 'block' }}>
                  Two-Factor Authentication (2FA)
                </strong>
                <small
                  style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}
                >
                  Enforced for corporate analyst accounts.
                </small>
              </div>
              <span className="badge badge-green">🟢 Enabled</span>
            </div>

            <div className="form-group">
              <label className="form-label">Idle Session Timeout</label>
              <select
                className="form-input"
                value={security.sessionTimeout}
                onChange={(e) =>
                  setSecurity({ ...security, sessionTimeout: e.target.value })
                }
              >
                <option value="15m">15 Minutes</option>
                <option value="30m">30 Minutes (Recommended)</option>
                <option value="1h">1 Hour</option>
                <option value="4h">4 Hours</option>
              </select>
            </div>
          </div>

          {/* SECTION 4: PREFERENCES & LOCALIZATION */}
          <div className="panel" style={{ gap: 16 }}>
            <div
              style={{
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: 12,
              }}
            >
              <strong style={{ fontSize: '1.125rem' }}>
                ⚙️ Preferences & Localization
              </strong>
              <small
                style={{ color: 'var(--text-secondary)', display: 'block' }}
              >
                Customize dashboard view, time zones, and formats.
              </small>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
              }}
            >
              <div className="form-group">
                <label className="form-label">Time Zone</label>
                <select
                  className="form-input"
                  value={preferences.timeZone}
                  onChange={(e) =>
                    setPreferences({ ...preferences, timeZone: e.target.value })
                  }
                >
                  <option>Asia/Manila (GMT+8)</option>
                  <option>UTC (Coordinated Universal Time)</option>
                  <option>America/New_York (EST)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Date Format</label>
                <select
                  className="form-input"
                  value={preferences.dateFormat}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      dateFormat: e.target.value,
                    })
                  }
                >
                  <option>YYYY-MM-DD (ISO 8601)</option>
                  <option>MMM DD, YYYY</option>
                  <option>DD/MM/YYYY</option>
                </select>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
              }}
            >
              <div className="form-group">
                <label className="form-label">Display Language</label>
                <select
                  className="form-input"
                  value={preferences.language}
                  onChange={(e) =>
                    setPreferences({ ...preferences, language: e.target.value })
                  }
                >
                  <option>English (US)</option>
                  <option>Filipino / Tagalog</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Default Landing Page</label>
                <select
                  className="form-input"
                  value={preferences.defaultView}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      defaultView: e.target.value,
                    })
                  }
                >
                  <option>Executive Overview</option>
                  <option>Flagged Messages Log</option>
                  <option>Campaign Clusters</option>
                </select>
              </div>
            </div>

            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                padding: 12,
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <strong style={{ fontSize: '0.875rem', display: 'block' }}>
                  Theme Selection
                </strong>
                <small
                  style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}
                >
                  Enterprise Dark Mode is enforced for high-density SOC screens.
                </small>
              </div>
              <span className="badge badge-purple">Dark Obsidian</span>
            </div>
          </div>

          {/* SECTION 5: REPORT PREFERENCES */}
          <div className="panel" style={{ gap: 16 }}>
            <div
              style={{
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: 12,
              }}
            >
              <strong style={{ fontSize: '1.125rem' }}>
                📄 Automated Report Settings
              </strong>
              <small
                style={{ color: 'var(--text-secondary)', display: 'block' }}
              >
                Configure scheduled intelligence exports.
              </small>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
              }}
            >
              <div className="form-group">
                <label className="form-label">Default Export Format</label>
                <select
                  className="form-input"
                  value={reports.exportFormat}
                  onChange={(e) =>
                    setReports({ ...reports, exportFormat: e.target.value })
                  }
                >
                  <option>CSV (Comma Separated)</option>
                  <option>JSON Dataset</option>
                  <option>STIX / TAXII v2.1</option>
                  <option>PDF Executive Dossier</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">File Compression</label>
                <select
                  className="form-input"
                  value={reports.compression}
                  onChange={(e) =>
                    setReports({ ...reports, compression: e.target.value })
                  }
                >
                  <option>GZIP (.gz)</option>
                  <option>ZIP (.zip)</option>
                  <option>None (Uncompressed)</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 6: API ACCESS & TOKENS */}
          <div className="panel" style={{ gap: 16 }}>
            <div
              style={{
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: 12,
              }}
            >
              <strong style={{ fontSize: '1.125rem' }}>
                🔑 Threat Intelligence API Token
              </strong>
              <small
                style={{ color: 'var(--text-secondary)', display: 'block' }}
              >
                Use bearer token to query REST API endpoints.
              </small>
            </div>

            <Input
              label="Active Bearer Token"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              helpText="Do not share API tokens in unencrypted channels."
            />

            <div style={{ display: 'flex', gap: 12 }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(apiKey);
                  alert('API Key copied to clipboard!');
                }}
              >
                📋 Copy Token
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const newKey = `bnt_live_${Math.random().toString(36).substring(2, 18)}`;
                  setApiKey(newKey);
                }}
              >
                🔄 Regenerate Token
              </Button>
            </div>
          </div>
        </div>

        {/* Global Save Actions Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: 20,
          }}
        >
          <Button
            variant="ghost"
            size="lg"
            onClick={() => window.location.reload()}
          >
            Cancel Changes
          </Button>
          <Button variant="primary" size="lg" onClick={handleSaveAll}>
            Save All Settings →
          </Button>
        </div>
      </div>
    </PortalShell>
  );
};
