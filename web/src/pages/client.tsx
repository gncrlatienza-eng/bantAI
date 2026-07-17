import { BarChart, CampaignTile, Field, Panel, PortalShell, StatCards, Table, Toggle } from "../components/ui";
import {
  analyticsBreakdown,
  analyticsVariants,
  campaigns,
  clientCampaignColumns,
  clientMessages,
  clientOverviewMetrics,
  clientSidebar,
  exportReports,
  helpFaqs,
  threatFeed,
} from "../mocks/referenceData";

function ClientShell({ title, children, popup }: { title: string; children: React.ReactNode; popup?: boolean }) {
  return (
    <PortalShell
      role="client"
      sidebar={clientSidebar}
      title={title}
      tag="Globe Telecom"
      userInitials="MS"
      userName="Maria Santos"
      userMeta="Threat Intelligence Analyst"
      org="Globe Telecom"
      showPopup={popup}
    >
      {children}
    </PortalShell>
  );
}

export function ClientOverviewPage() {
  return (
    <ClientShell title="Overview">
      <StatCards items={clientOverviewMetrics} />
      <div className="grid-overview">
        <Panel title="Weekly Activity" subtitle="User-reported suspicious messages received over the past 7 days">
          <BarChart />
        </Panel>
        <Panel title="Live Threat Feed" subtitle="Real-time intercepted campaigns">
          <div className="feed-list">
            {threatFeed.map(([name, level]) => (
              <div key={name} className="feed-row">
                <div>
                  <span className="feed-dot" />
                  <strong>{name}</strong>
                </div>
                <span className={`badge ${level === "Critical" ? "red" : "amber"}`}>{level}</span>
              </div>
            ))}
            <a href="#" className="panel-link">View all in Messages ---</a>
          </div>
        </Panel>
      </div>
      <div className="section-head">
        <strong>Active Campaigns</strong>
        <a href="#">View all ---</a>
      </div>
      <div className="three-up">
        {campaigns.map((item) => (
          <CampaignTile key={item.title} item={item} />
        ))}
      </div>
    </ClientShell>
  );
}

export function ClientMessagesPage() {
  return (
    <ClientShell title="Messages">
      <div className="page-head">
        <div>
          <h1>Messages</h1>
          <p>Classification log --- all flagged incoming messages</p>
        </div>
        <div className="toolbar-row">
          <div className="search-box">Search sender or content...</div>
          <button className="ghost-btn tiny" type="button">Export CSV</button>
        </div>
      </div>
      <div className="tab-pills">
        <span className="tab-pill active">All 14,892</span>
        <span className="tab-pill">Likely Smishing 1,247</span>
        <span className="tab-pill">Suspicious 389</span>
        <span className="tab-pill">Reviewed 203</span>
      </div>
      <Table data={clientMessages} />
    </ClientShell>
  );
}

export function ClientCampaignsPage() {
  return (
    <ClientShell title="Campaigns">
      <div className="page-head">
        <div>
          <h1>Campaigns</h1>
          <p>Coordinated smishing clusters tracked by BantAI</p>
        </div>
        <div className="summary-mini">
          <div><strong>10</strong><span>Total Clusters</span></div>
          <div><strong>6</strong><span>Active</span></div>
          <div><strong>442,679</strong><span>Total Messages</span></div>
          <button className="ghost-btn tiny" type="button">Export</button>
        </div>
      </div>
      <div className="tab-pills">
        <span className="tab-pill active">All</span>
        <span className="tab-pill">Active</span>
        <span className="tab-pill">Inactive</span>
      </div>
      <div className="campaign-columns">
        <div>
          <h3>Active Campaigns</h3>
          <div className="stack-list">
            {clientCampaignColumns.active.map((item) => (
              <CampaignTile key={item.title} item={item} />
            ))}
          </div>
        </div>
        <div>
          <h3>Inactive Campaigns</h3>
          <div className="stack-list">
            {clientCampaignColumns.inactive.map((item) => (
              <CampaignTile key={item.title} item={item} />
            ))}
          </div>
        </div>
      </div>
    </ClientShell>
  );
}

export function ClientAnalyticsPage() {
  return (
    <ClientShell title="Analytics">
      <div className="page-head">
        <div>
          <h1>Analytics &amp; Threat Intelligence</h1>
          <p>Detailed breakdown of smishing patterns and classification logs</p>
        </div>
        <div className="toolbar-row">
          <button className="dark-select" type="button">Operation GCash Clone #17</button>
          <button className="ghost-btn tiny" type="button">Export CSV</button>
        </div>
      </div>
      <div className="two-panels">
        <Panel title="Campaign Pattern Breakdown" subtitle="Evasion tactic prevalence within selected campaign">
          <small className="tone-red">Operation GCash Clone #17</small>
          <div className="progress-list">
            {analyticsBreakdown.map(([label, value, tone]) => (
              <div key={label} className="progress-item">
                <div className="progress-top">
                  <span>{label}</span>
                  <strong className={`tone-${tone}`}>{value}</strong>
                </div>
                <div className="rail"><span className={tone} style={{ width: value }} /></div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Similarity Scores by Variant" subtitle="Message variants ranked by detection match">
          <div className="variant-list">
            {analyticsVariants.map(([name, text, value, tone]) => (
              <div key={name} className="variant-item">
                <div className="progress-top">
                  <strong>{name}</strong>
                  <strong className={`tone-${tone}`}>{value}</strong>
                </div>
                <small>{text}</small>
              </div>
            ))}
            <a href="#" className="panel-link">View all variants ---</a>
          </div>
        </Panel>
      </div>
      <Panel title="Recent Flagged Messages --- Classification Log" subtitle="User-reported suspicious messages --- Last 24 hours - Showing 1-6 of 312" actions={<button className="ghost-btn tiny" type="button">Export CSV</button>}>
        <Table data={{ ...clientMessages, rows: clientMessages.rows.slice(0, 4), footer: undefined }} compact />
      </Panel>
    </ClientShell>
  );
}

export function ClientExportPage() {
  return (
    <ClientShell title="Export Reports">
      <div className="page-head">
        <div>
          <h1>Export Reports</h1>
          <p>Download structured threat intelligence datasets</p>
        </div>
      </div>
      <small className="section-label">QUICK EXPORT</small>
      <div className="three-up export-cards">
        <Panel>
          <span className="card-icon" />
          <strong>Full Classification Log</strong>
          <p>All flagged messages with labels, scores, timestamps, and indicators</p>
          <small>Format: CSV   Last updated: May 13, 2026 09:30 AM</small>
          <button className="primary-btn tiny" type="button">Download CSV</button>
        </Panel>
        <Panel>
          <span className="card-icon" />
          <strong>Campaign Summary Report</strong>
          <p>All campaign clusters with pattern breakdowns and variant listings</p>
          <small>Format: CSV + PDF   Last updated: May 13, 2026 09:30 AM</small>
          <button className="primary-btn tiny" type="button">Download</button>
        </Panel>
        <Panel>
          <span className="card-icon" />
          <strong>Custom Date Range Export</strong>
          <p>Define a specific time window and campaign filter for your export</p>
          <a href="#" className="panel-link">Configure Export ---</a>
        </Panel>
      </div>
      <small className="section-label">RECENT EXPORTS</small>
      <Table data={exportReports} />
    </ClientShell>
  );
}

export function ClientHelpPage() {
  return (
    <ClientShell title="Help">
      <div className="page-head">
        <div>
          <h1>Help &amp; Support</h1>
          <p>Frequently asked questions and contact information for the BantAI team</p>
        </div>
      </div>
      <div className="help-grid">
        <div>
          <small className="section-label">FREQUENTLY ASKED QUESTIONS</small>
          <div className="faq-stack">
            {helpFaqs.map(([q, a]) => (
              <div key={q} className="faq-card">
                <strong>{q}</strong>
                <p>{a}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <small className="section-label">CONTACT SUPPORT</small>
          <div className="side-stack">
            <Panel>
              <strong>Email Support</strong>
              <p>For access issues, data questions, or bug reports:</p>
              <a href="#">support@bantai.research</a>
              <small>Response time: 24-48 hours on business days</small>
            </Panel>
            <Panel>
              <strong>Documentation</strong>
              <p>Full API and portal usage guide for client administrators.</p>
              <a href="#">View Portal Guide</a>
            </Panel>
            <Panel className="accent-panel">
              <strong>BantAI Research Team</strong>
              <p>College of IT and Engineering<br />De La Salle Lipa - DCIT Department<br />Group 7 --- Arias C. Castro D. De Castro R. Mendoza</p>
            </Panel>
          </div>
        </div>
      </div>
    </ClientShell>
  );
}

export function ClientSettingsPage({ notifications }: { notifications?: boolean }) {
  return (
    <ClientShell title="Account Settings" popup={notifications}>
      <div className="page-head">
        <div>
          <h1>Account Settings</h1>
          <p>Manage your profile, password, and notification preferences</p>
        </div>
        <button className="danger-btn" type="button">Sign Out</button>
      </div>
      <div className="tab-pills settings-tabs">
        <span className={`tab-pill ${notifications ? "" : "active"}`}>Profile</span>
        <span className="tab-pill">Password &amp; 2FA</span>
        <span className={`tab-pill ${notifications ? "active" : ""}`}>Notifications</span>
      </div>
      {notifications ? <ClientNotificationSettings /> : <ClientProfileSettings />}
    </ClientShell>
  );
}

function ClientProfileSettings() {
  return (
    <Panel>
      <small className="section-label">PROFILE INFORMATION</small>
      <div className="profile-row">
        <span className="avatar client">MS</span>
        <div>
          <strong>Maria Santos</strong>
          <small>Threat Intelligence Analyst - Globe Telecom</small>
        </div>
      </div>
      <div className="two-col">
        <Field label="Full Name" value="Maria Santos" />
        <Field label="Email Address" value="analyst@globe.com.ph" />
      </div>
      <Field label="Job Title" value="Threat Intelligence Analyst" />
      <Field label="Organization" value="Globe Telecom" />
      <button className="primary-btn tiny" type="button">Save Changes</button>
    </Panel>
  );
}

function ClientNotificationSettings() {
  return (
    <div className="settings-stack">
      <Panel>
        <small className="section-label">ALERT NOTIFICATIONS</small>
        <p>Get notified when BantAI detects the following events relevant to your organization:</p>
        <div className="toggle-list">
          <div><strong>New Campaign Detected</strong><small>Triggered when a new smishing campaign emerges that may be targeting your subscriber base or brand.</small></div>
          <Toggle />
          <div><strong>New Threat Pattern Detected</strong><small>Triggered when messages not matching any known campaign are detected --- potential early warning of a novel attack.</small></div>
          <Toggle />
        </div>
      </Panel>
      <Panel>
        <small className="section-label">REPORT FREQUENCY</small>
        <p>Scheduled threat intelligence summary reports delivered to your email.</p>
        <div className="radio-stack">
          <div className="radio-item"><strong>Daily Report</strong><small>Sent every morning at 7:00 AM with the previous day's flagged messages and campaign summary</small></div>
          <div className="radio-item active"><strong>Weekly Report</strong><small>Sent every Monday at 8:00 AM with campaign trends, new threats, and threat landscape overview</small></div>
          <div className="radio-item"><strong>Both</strong><small>Receive both daily and weekly digests</small></div>
        </div>
        <button className="primary-btn tiny" type="button">Save Report Preferences</button>
      </Panel>
    </div>
  );
}
