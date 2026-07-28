import { useNavigate } from "react-router-dom";
import { BarChart, CampaignTile, Field, LineVisual, Panel, PortalShell, StatCards, Table, Toggle } from "../components/ui";
import { clearSession } from "../lib/auth";
import {
  adminOverviewMetrics,
  adminReports,
  adminSidebar,
  apiLogs,
  classificationLog,
  clientCampaignColumns,
  dbStorage,
  exportHubHistory,
  fpfnReview,
  scamTips,
  usersTable,
} from "../mocks/referenceData";

function AdminShell({ title, children, popup }: { title: string; children: React.ReactNode; popup?: boolean }) {
  return (
    <PortalShell
      role="admin"
      sidebar={adminSidebar}
      title={title}
      tag="Super Admin"
      tagTone="amber"
      userInitials="GA"
      userName="Gian Carlo Atienza"
      userMeta="Super Administrator"
      org="BantAI Research Team"
      showPopup={popup}
    >
      {children}
    </PortalShell>
  );
}

export function AdminOverviewPage() {
  return (
    <AdminShell title="Overview">
      <div className="alert-banner">
        FN rate has risen 1.4% over 7 days --- potential concept drift detected. Review model performance. <a href="#">Review Model ---</a>
      </div>
      <StatCards items={adminOverviewMetrics} />
      <div className="admin-overview-grid">
        <Panel title="WEEKLY ACTIVITY">
          <BarChart />
        </Panel>
        <Panel title="SYSTEM HEALTH">
          <div className="health-list">
            {["Backend API", "Classification Engine", "Database (PostgreSQL)", "Campaign Clustering", "Mobile App Sync", "Web Dashboard"].map((item) => (
              <div key={item} className="health-row">
                <span>{item}</span>
                <span className="badge green">Operational</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="MODEL STATUS">
          <div className="metric-blocks">
            <p>Version: XLM-RoBERTa v3.1</p>
            <p>Accuracy: <span className="tone-green">94.2%</span></p>
            <p>F1 Score: <span className="tone-blue">0.931</span></p>
            <small>Last retrained: May 8, 2026</small>
          </div>
        </Panel>
        <Panel title="PENDING REVIEWS">
          <div className="metric-blocks">
            <strong className="big-amber">312</strong>
            <p>User reports awaiting validation</p>
            <small>489 validated - 46 rejected</small>
          </div>
        </Panel>
        <Panel title="CLIENT ORGANIZATIONS">
          <div className="health-list">
            {["Globe Telecom", "Smart Communications", "CICC (NCT)"].map((item) => (
              <div key={item} className="health-row">
                <span>{item}</span>
                <span className="badge green">Active</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AdminShell>
  );
}

export function AdminReportsPage() {
  return (
    <AdminShell title="User Reports">
      <div className="page-head">
        <div>
          <h1>User Reports</h1>
          <p>Suspicious messages manually reported by BantAI app users --- only reported messages are sent to the backend for review</p>
        </div>
        <div className="search-box">Search reports...</div>
      </div>
      <div className="mini-stats">
        <span><strong className="tone-amber">312</strong> Pending</span>
        <span><strong className="tone-green">489</strong> Validated</span>
        <span><strong className="tone-red">46</strong> Rejected</span>
        <span><strong>4.2h</strong> Avg Review Time</span>
      </div>
      <div className="tab-pills">
        <span className="tab-pill active">All 847</span>
        <span className="tab-pill">Pending Review 312</span>
        <span className="tab-pill">Validated 489</span>
        <span className="tab-pill">Rejected 46</span>
      </div>
      <Table data={adminReports} />
    </AdminShell>
  );
}

export function AdminModelPage() {
  return (
    <AdminShell title="Model Performance">
      <div className="page-head">
        <div>
          <h1>Model Performance Dashboard</h1>
          <p>XLM-RoBERTa v3.1   Last retrained May 8, 2026</p>
        </div>
        <button className="ghost-btn tiny" type="button">View Version History ---</button>
      </div>
      <div className="stat-grid">
        <article className="stat-card"><small>Detection Accuracy</small><strong className="tone-green">94.2%</strong><span>+0.8% vs last run</span></article>
        <article className="stat-card"><small>False Positive Rate</small><strong className="tone-amber">3.8%</strong><span>+0.3% (stable)</span></article>
        <article className="stat-card"><small>False Negative Rate</small><strong className="tone-amber">2.1%</strong><span>+1.4%</span></article>
        <article className="stat-card"><small>F1 Score</small><strong>0.931</strong><span>+0.012 vs last</span></article>
      </div>
      <div className="two-panels model-layout">
        <Panel title="ACCURACY OVER TIME --- APR 14 TO MAY 13">
          <LineVisual />
        </Panel>
        <Panel title="CLASSIFICATION BREAKDOWN">
          <div className="simple-metrics">
            <div><span>Likely Smishing</span><strong className="tone-red">1,247</strong></div>
            <div><span>Suspicious</span><strong className="tone-amber">389</strong></div>
            <div><span>Unknown / Safe</span><strong>13,256</strong></div>
          </div>
        </Panel>
      </div>
      <Panel title="Per-Class Metrics">
        <table className="compact">
          <thead>
            <tr><th>CLASS</th><th>PRECISION</th><th>RECALL</th><th>F1 SCORE</th><th>SUPPORT</th></tr>
          </thead>
          <tbody>
            <tr><td className="tone-red">Likely Smishing</td><td>0.946</td><td>0.938</td><td>0.942</td><td>1,247</td></tr>
            <tr><td className="tone-amber">Suspicious</td><td>0.891</td><td>0.903</td><td>0.897</td><td>389</td></tr>
            <tr><td className="tone-green">Unknown / Safe</td><td>0.971</td><td>0.964</td><td>0.967</td><td>13,256</td></tr>
          </tbody>
        </table>
      </Panel>
    </AdminShell>
  );
}

export function AdminConceptDriftPage() {
  return (
    <AdminShell title="Concept Drift">
      <Panel>
        <div className="drift-chart">
          <div className="drift-line yellow" />
          <div className="drift-line red" />
          <div className="drift-threshold" />
          <strong className="drift-label">FN crosses threshold</strong>
          <span className="drift-right top">3.5%</span>
          <span className="drift-right bottom">3.0%</span>
        </div>
        <div className="drift-warning">FN Rate crossed the 3.0% threshold on May 10 and has continued rising over the last 4 days.</div>
      </Panel>
      <div className="two-panels">
        <Panel title="Messages Not Matched to Any Cluster" subtitle="Potential new smishing patterns outside current training data">
          <table className="compact">
            <thead><tr><th>MESSAGE PREVIEW</th><th>CONFIDENCE</th><th>CLASSIFICATION</th><th>RECEIVED</th></tr></thead>
            <tbody>
              <tr><td>Your SSS benefits claim was denied. Verify identity at sss-ph-verify.net/claim</td><td>61%</td><td>Suspicious</td><td>May 14 08:12</td></tr>
              <tr><td>Congrats! Maya wallet selected for loyalty bonus. Tap: maya-rewards.xyz</td><td>58%</td><td>Unknown</td><td>May 14 07:44</td></tr>
              <tr><td>BPI alert: New device logged into your account. Verify: bpi-secure-ph.com</td><td>54%</td><td>Unknown</td><td>May 14 06:30</td></tr>
              <tr><td>Your PhilHealth contribution is overdue. Update records: philhealth-ph.com</td><td>49%</td><td>Unknown</td><td>May 14 05:18</td></tr>
              <tr><td>Metrobank: Suspicious login detected. Secure account: mbank-verify.ph</td><td>52%</td><td>Suspicious</td><td>May 14 04:55</td></tr>
            </tbody>
          </table>
        </Panel>
        <Panel title="RETRAINING RECOMMENDATION">
          <ul className="recommend-list">
            <li>312 new validated reports available</li>
            <li>FN rate above threshold for 4 consecutive days</li>
            <li>14 unclassified messages with no cluster match</li>
            <li>Last retrain: 5 days ago (within acceptable window)</li>
          </ul>
          <div className="drift-warning">Based on current indicators, a retraining cycle is recommended.</div>
          <button className="danger-cta" type="button">Trigger Model Retraining</button>
          <small>This will use 312 new validated samples. Estimated time: 45-60 minutes.</small>
        </Panel>
      </div>
    </AdminShell>
  );
}

export function AdminDatasetPage() {
  return (
    <AdminShell title="Dataset Mgmt">
      <div className="page-head">
        <div>
          <h1>Dataset Management</h1>
          <p>Training samples sourced from user-reported suspicious messages and auto-blocked smishing numbers</p>
        </div>
        <div className="toolbar-row">
          <button className="ghost-btn tiny" type="button">Download Full Dataset</button>
          <button className="primary-btn tiny" type="button">Upload New Samples</button>
        </div>
      </div>
      <div className="info-banner">Data Source: This dataset contains only messages that were explicitly sent to the backend --- either user-reported suspicious SMS or numbers automatically blocked by the system. Legitimate messages verified on the user's device are never transmitted to the backend and do not appear here.</div>
      <div className="dataset-stats">
        <div><strong>12,190</strong><span>Total Samples</span></div>
        <div><strong className="tone-red">8,940</strong><span>Confirmed Smishing</span></div>
        <div><strong className="tone-amber">2,250</strong><span>Suspicious</span></div>
        <div><strong>1,000</strong><span>Unreviewed</span></div>
        <div><strong>May 13, 2026</strong><span>Last Updated</span></div>
      </div>
      <Panel title="DATASET COMPOSITION">
        <div className="stacked-bar">
          <span className="red" style={{ width: "73.3%" }}>Confirmed Smishing 73.3%</span>
          <span className="amber" style={{ width: "18.5%" }}>Suspicious 18.5%</span>
          <span className="gray" style={{ width: "8.2%" }}>Unreviewed 8.2%</span>
        </div>
      </Panel>
      <div className="tab-pills">
        <span className="tab-pill active">All 12,190</span>
        <span className="tab-pill">Confirmed Smishing 8,940</span>
        <span className="tab-pill">Suspicious 2,250</span>
        <span className="tab-pill">Unreviewed 1,000</span>
      </div>
      <Table data={{ headers: ["SAMPLE ID", "LANGUAGE", "CLASSIFICATION", "CAMPAIGN", "SOURCE", "ADDED BY", "DATE ADDED", "VALIDATED BY"], rows: [["S-00421", "Taglish", "Confirmed Smishing", "Op. GCash Clone #17", "Reported", "admin_gio", "May 13", "admin_gio"], ["S-00420", "English", "Confirmed Smishing", "LBC Parcel Scam #8", "Auto-Blocked", "admin_gio", "May 12", "admin_gio"], ["S-00419", "English", "Confirmed Smishing", "BDO Fake Support #5", "Reported", "admin_gio", "May 11", "admin_gio"], ["U-00103", "Taglish", "Suspicious", "---", "Reported", "System", "May 11", "---"], ["U-00102", "Filipino", "Unreviewed", "---", "Auto-Blocked", "System", "May 11", "---"]], footer: "Showing 1-5 of 12,190 results" }} />
    </AdminShell>
  );
}

export function AdminClassificationPage() {
  return (
    <AdminShell title="Classification Log">
      <div className="page-head">
        <div>
          <h1>Detailed Classification Log</h1>
          <p>Classification log of all user-reported suspicious messages and automated blocked-number detections sent to the backend</p>
        </div>
        <div className="toolbar-row">
          <button className="ghost-btn tiny" type="button">May 13, 2026</button>
          <div className="search-box">Search sender...</div>
          <button className="ghost-btn tiny" type="button">Export CSV</button>
        </div>
      </div>
      <div className="tab-pills">
        <span className="tab-pill active">All 14,892</span>
        <span className="tab-pill">Likely Smishing 1,247</span>
        <span className="tab-pill">Suspicious 389</span>
        <span className="tab-pill">Unknown 13,256</span>
        <span className="tab-pill">False Positive 28</span>
        <span className="tab-pill">False Negative 14</span>
      </div>
      <Table data={classificationLog} />
    </AdminShell>
  );
}

export function AdminFpFnPage() {
  return (
    <AdminShell title="FP / FN Review">
      <div className="page-head">
        <div>
          <h1>FP / FN Review</h1>
          <p>Review and resolve misclassified messages to improve model training quality</p>
        </div>
      </div>
      <div className="mini-stats">
        <span><strong className="tone-amber">28</strong> Open FP Cases</span>
        <span><strong className="tone-red">14</strong> Open FN Cases</span>
        <span><strong className="tone-green">7</strong> Resolved Today</span>
      </div>
      <div className="tab-pills">
        <span className="tab-pill active">False Positives 28</span>
        <span className="tab-pill">False Negatives 14</span>
      </div>
      <div className="review-banner">False Positives are legitimate messages incorrectly flagged as smishing. Resolving these prevents good messages from entering the smishing training set.</div>
      <Table data={fpfnReview} />
      <Panel title="REVIEW PANEL --- FP-041">
        <div className="review-grid">
          <div>
            <strong>Message Text</strong>
            <div className="quote-box">"Your GoSURF50 promo is about to expire. Renew now to continue browsing."</div>
            <div className="review-meta">
              <span>PLDT Home</span>
              <span className="tone-red">Smishing</span>
              <span>71%</span>
            </div>
          </div>
          <div>
            <strong>Resolution Action</strong>
            <div className="option-list">
              <label><input type="radio" defaultChecked /> Confirm False Positive</label>
              <label><input type="radio" /> Override - System Was Correct</label>
              <label><input type="radio" /> Escalate for Expert Review</label>
            </div>
            <button className="primary-btn tiny" type="button">Submit Resolution</button>
          </div>
        </div>
      </Panel>
    </AdminShell>
  );
}

export function AdminCampaignsPage() {
  return (
    <AdminShell title="All Campaigns">
      <div className="page-head">
        <div>
          <h1>Campaign Management</h1>
          <p>Manage all tracked smishing clusters --- merge, archive, and control client access</p>
        </div>
        <div className="summary-mini">
          <div><strong>10</strong><span>Total Clusters</span></div>
          <div><strong>6</strong><span>Active</span></div>
          <div><strong>442,679</strong><span>Total Messages</span></div>
          <div><strong>3</strong><span>Client Org</span></div>
          <button className="ghost-btn tiny" type="button">Export All</button>
        </div>
      </div>
      <div className="tab-pills">
        <span className="tab-pill active">All</span>
        <span className="tab-pill">Active</span>
        <span className="tab-pill">Inactive</span>
      </div>
      <div className="merge-banner">Select two campaigns and use <strong>Merge</strong> to combine overlapping smishing clusters into a single tracked campaign.</div>
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
    </AdminShell>
  );
}

export function AdminTimelinePage() {
  return (
    <AdminShell title="Campaign Timeline">
      <div className="page-head">
        <div>
          <h1>Campaign Evolution Timeline</h1>
          <p>Track how a campaign has changed, grown, and adapted over time</p>
        </div>
        <button className="dark-select" type="button">Operation GCash Clone #17</button>
      </div>
      <Panel>
        <div className="timeline-head">
          <div className="timeline-card-title">
            <strong>Operation GCash Clone #17</strong>
            <span className="badge green">Active</span>
          </div>
          <div className="timeline-stats">
            <div><strong>382</strong><small>Total Messages</small></div>
            <div><strong>4</strong><small>Domains</small></div>
            <div><strong>3</strong><small>Variants</small></div>
            <div><strong>May 3, 2026</strong><small>Active Since</small></div>
          </div>
        </div>
      </Panel>
      <div className="timeline-layout">
        <div className="timeline-list">
          {[
            ["May 3, 2026", "Campaign First Detected", "Initial cluster formed with 12 messages. Domain: gcash-ph-support.net", "+12 messages", "New Campaign"],
            ["May 5, 2026", "New Variant Detected", "Variant B added --- slight wording change: \"Unusual login detected\"", "+34 messages", "Variant"],
            ["May 7, 2026", "New Domain Registered", "gcash-verify-ph.com joined the cluster. 2nd known domain.", "+67 messages", "Domain"],
            ["May 9, 2026", "Surge in Activity", "Daily message volume spiked 3.2x --- 182 messages in 24 hours", "+182 messages", "Surge"],
            ["May 11, 2026", "Variant C Detected", "Prize lure variant added --- tone shift to reward-based tactics", "+89 messages", "Variant"],
            ["May 13, 2026", "Current State: Active", "382 total messages tracked - 4 domains identified - Campaign ongoing", "LIVE", "Current"],
          ].map(([date, title, body, delta, badge], index) => (
            <div key={title} className="timeline-item">
              <div className={`timeline-node ${index === 2 ? "amber" : index === 3 ? "red" : index === 5 ? "green" : "violet"}`} />
              <div className="timeline-body">
                <small>{date}</small>
                <strong>{title}</strong>
                <p>{body}</p>
                <div className="timeline-meta">
                  <span className="tone-green">{delta}</span>
                  <span className="tab-pill">{badge}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="side-stack">
          <Panel title="VOLUME OVER TIME">
            <BarChart />
          </Panel>
          <Panel title="KNOWN DOMAINS">
            <div className="domain-list">
              <span>gcash-ph-support.net</span>
              <span>gcash-verify-ph.com</span>
              <span>gcash-support.xyz</span>
              <span>gcash-alert-ph.net</span>
            </div>
          </Panel>
          <Panel title="EVASION TACTIC BREAKDOWN">
            <div className="progress-list">
              <div className="progress-item"><div className="progress-top"><span>Fake Domain Usage</span><strong className="tone-red">90%</strong></div><div className="rail"><span className="red" style={{ width: "90%" }} /></div></div>
              <div className="progress-item"><div className="progress-top"><span>Brand Impersonation</span><strong className="tone-red">79%</strong></div><div className="rail"><span className="red" style={{ width: "79%" }} /></div></div>
              <div className="progress-item"><div className="progress-top"><span>Urgency Language</span><strong className="tone-amber">65%</strong></div><div className="rail"><span className="amber" style={{ width: "65%" }} /></div></div>
              <div className="progress-item"><div className="progress-top"><span>Taglish Wording</span><strong className="tone-amber">57%</strong></div><div className="rail"><span className="amber" style={{ width: "57%" }} /></div></div>
            </div>
          </Panel>
        </div>
      </div>
    </AdminShell>
  );
}

export function AdminUsersPage() {
  return (
    <AdminShell title="Registered Users">
      <div className="page-head">
        <div>
          <h1>Registered Users</h1>
          <p>Manage BantAI app users and authorized client organizations</p>
        </div>
        <div className="search-box">Search...</div>
      </div>
      <div className="mini-stats">
        <span><strong>8,421</strong> Registered</span>
        <span><strong className="tone-green">3,204</strong> Active Old</span>
        <span><strong className="tone-blue">214</strong> New Today</span>
      </div>
      <div className="tab-pills">
        <span className="tab-pill active">App Users</span>
        <span className="tab-pill">Client Organizations</span>
      </div>
      <Table data={usersTable} />
    </AdminShell>
  );
}

export function AdminExportPage() {
  return (
    <AdminShell title="Export Hub">
      <div className="page-head">
        <div>
          <h1>Export Hub</h1>
          <p>Generate and download datasets, logs, and reports for the system and for client organizations</p>
        </div>
      </div>
      <small className="section-label">SYSTEM EXPORTS (SUPER ADMIN ONLY)</small>
      <div className="two-panels export-cards">
        <Panel>
          <span className="card-icon" />
          <strong>Full Unmasked Classification Log</strong>
          <p>Complete log including raw sender numbers and full message text. Admin use only.</p>
          <button className="primary-btn tiny" type="button">Download CSV</button>
        </Panel>
        <Panel>
          <span className="card-icon" />
          <strong>Training Dataset Export</strong>
          <p>All labeled samples (smishing + legitimate) used for model training.</p>
          <button className="primary-btn tiny" type="button">Download CSV</button>
        </Panel>
        <Panel>
          <span className="card-icon" />
          <strong>System Audit Log</strong>
          <p>All admin actions, login events, and validation decisions.</p>
          <button className="primary-btn tiny" type="button">Download CSV</button>
        </Panel>
        <Panel>
          <span className="card-icon" />
          <strong>Export for Client Organization</strong>
          <p>Generate a scoped export delivered to a specific client org.</p>
          <a href="#" className="panel-link">Configure Scoped Export ---</a>
        </Panel>
      </div>
      <div className="selector-row">
        <div>
          <small className="section-label">Client Organization Selector</small>
          <div className="dark-select full">Globe Telecom</div>
          <small>Scoped exports exclude raw sender numbers and mask device IDs.</small>
        </div>
        <button className="primary-btn tiny" type="button">Generate Scoped Export</button>
      </div>
      <small className="section-label">EXPORT HISTORY</small>
      <Table data={exportHubHistory} />
    </AdminShell>
  );
}

export function AdminServerPage({ tab }: { tab: "server" | "api" | "db" }) {
  const isApi = tab === "api";
  const isDb = tab === "db";
  const title = isApi ? "API Logs" : isDb ? "DB Storage" : "Server Monitoring";

  return (
    <AdminShell title={title}>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p>{isApi ? "" : isDb ? "" : "Real-time infrastructure health for the BantAI system"}</p>
        </div>
        {!isApi && !isDb ? <small>Last checked 2m ago</small> : null}
      </div>
      <div className="tab-pills">
        <span className={`tab-pill ${!isApi && !isDb ? "active" : ""}`}>Server Monitoring</span>
        <span className={`tab-pill ${isApi ? "active" : ""}`}>API Logs</span>
        <span className={`tab-pill ${isDb ? "active" : ""}`}>DB Storage</span>
      </div>
      {isApi ? <ApiLogsContent /> : null}
      {isDb ? <DbStorageContent /> : null}
      {!isApi && !isDb ? <ServerMonitoringContent /> : null}
    </AdminShell>
  );
}

function ServerMonitoringContent() {
  return (
    <>
      <div className="stat-grid">
        <article className="stat-card"><small>API Response Time</small><strong className="tone-green">142ms</strong><span>-27ms vs yesterday</span></article>
        <article className="stat-card"><small>Backend Uptime</small><strong className="tone-green">99.97%</strong></article>
        <article className="stat-card"><small>Active Connections</small><strong>47</strong></article>
        <article className="stat-card"><small>Error Rate</small><strong className="tone-green">0.02%</strong></article>
      </div>
      <div className="two-panels">
        <Panel title="RESPONSE TIME --- LAST 24 HOURS" subtitle="Dashed line = 500ms warning threshold. Peak at noon due to scheduled batch jobs">
          <LineVisual green />
        </Panel>
        <Panel title="SERVICE STATUS">
          <div className="health-list">
            {["Backend API", "Classification Engine", "Database (PostgreSQL)", "Campaign Clustering", "Mobile App Sync", "Web Dashboard"].map((item) => (
              <div key={item} className="health-row">
                <span>{item}</span>
                <span className="badge green">Operational</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel title="Recent Server Events">
        <table className="compact">
          <thead><tr><th>TIMESTAMP</th><th>EVENT</th><th>SEVERITY</th><th>DETAILS</th></tr></thead>
          <tbody>
            <tr><td>May 14 02:00</td><td>Automated retraining check</td><td>Info</td><td>No retraining triggered --- FN threshold not exceeded</td></tr>
            <tr><td>May 14 01:00</td><td>Database backup completed</td><td>Info</td><td>18,420 records backed up successfully</td></tr>
          </tbody>
        </table>
      </Panel>
    </>
  );
}

function ApiLogsContent() {
  return (
    <>
      <div className="stat-grid">
        <article className="stat-card"><small>Requests Today</small><strong>8,241</strong></article>
        <article className="stat-card"><small>Avg Latency</small><strong className="tone-green">142ms</strong></article>
        <article className="stat-card"><small>4xx Errors Today</small><strong className="tone-amber">12</strong></article>
        <article className="stat-card"><small>5xx Errors</small><strong className="tone-green">0</strong><span>All clear</span></article>
      </div>
      <Panel title="REQUEST VOLUME --- LAST 24 HOURS" subtitle="Hourly request count - peaks coincide with shift start and scheduled exports">
        <LineVisual green />
      </Panel>
      <Panel title="Recent API Requests">
        <Table data={apiLogs} />
      </Panel>
    </>
  );
}

function DbStorageContent() {
  return (
    <>
      <div className="stat-grid">
        <article className="stat-card"><small>Storage Used</small><strong className="tone-blue">27.6 GB</strong><span>35% of 80 GB</span></article>
        <article className="stat-card"><small>Storage Available</small><strong className="tone-green">52.4 GB</strong></article>
        <article className="stat-card"><small>Total Records</small><strong>18,420</strong></article>
        <article className="stat-card"><small>Last Full Backup</small><strong className="tone-green">1 day</strong></article>
      </div>
      <div className="two-panels">
        <Panel title="STORAGE GROWTH --- DEC 2025 TO MAY 2026">
          <LineVisual />
        </Panel>
        <Panel title="CAPACITY OVERVIEW">
          <div className="capacity-list">
            <div><span>Used</span><strong className="tone-blue">27.6 GB (35%)</strong></div>
            <div><span>messages</span><strong>4.2 GB</strong></div>
            <div><span>training_set</span><strong>6.8 GB</strong></div>
            <div><span>audit_logs</span><strong>1.1 GB</strong></div>
            <div><span>other_tables</span><strong>15.5 GB</strong></div>
          </div>
        </Panel>
      </div>
      <Panel title="Table Details">
        <Table data={dbStorage} />
      </Panel>
    </>
  );
}

export function AdminTipsPage() {
  return (
    <AdminShell title="Scam Tips">
      <div className="page-head">
        <div>
          <h1>Scam Awareness Tips</h1>
          <p>Tips shown to BantAI app users via Settings &gt; Learn</p>
        </div>
        <button className="primary-btn tiny" type="button">Add New Tip</button>
      </div>
      <div className="mini-stats">
        <span><strong className="tone-green">28</strong> Published Tips</span>
        <span><strong className="tone-amber">3</strong> Draft Tips</span>
        <span><strong>May 10, 2026</strong> Last Updated</span>
      </div>
      <Table data={scamTips} />
    </AdminShell>
  );
}

export function AdminSettingsPage({ notifications }: { notifications?: boolean }) {
  const navigate = useNavigate();
  return (
    <AdminShell title="Account Settings" popup={notifications}>
      <div className="page-head">
        <div>
          <h1>Account Settings</h1>
          <p>Manage your Super Admin profile, security, and notification preferences</p>
        </div>
        <button
          className="danger-btn"
          type="button"
          onClick={() => {
            clearSession();
            navigate("/admin-login");
          }}
        >
          Sign Out
        </button>
      </div>
      <div className="tab-pills settings-tabs">
        <span className={`tab-pill ${notifications ? "" : "active"}`}>Profile</span>
        <span className="tab-pill">Password &amp; 2FA</span>
        <span className={`tab-pill ${notifications ? "active" : ""}`}>Notifications</span>
        <span className="tab-pill">Access &amp; Roles</span>
      </div>
      {notifications ? <AdminNotificationSettings /> : <AdminProfileSettings />}
    </AdminShell>
  );
}

function AdminProfileSettings() {
  return (
    <Panel>
      <small className="section-label">PROFILE INFORMATION</small>
      <div className="profile-row">
        <span className="avatar admin">GA</span>
        <div>
          <strong>Gian Carlo Atienza</strong>
          <small>Super Administrator - BantAI Research Team</small>
        </div>
      </div>
      <div className="two-col">
        <Field label="Full Name" value="Gian Carlo Atienza" />
        <Field label="Email Address" value="g.atienza@bantai.research" />
      </div>
      <Field label="Role" value="Super Administrator" />
      <Field label="Organization" value="BantAI Research Team --- De La Salle Lipa" />
      <button className="primary-btn tiny" type="button">Save Changes</button>
    </Panel>
  );
}

function AdminNotificationSettings() {
  return (
    <div className="settings-stack">
      <Panel>
        <small className="section-label">ALERT NOTIFICATIONS</small>
        <p>Receive in-portal and email alerts for the following events:</p>
        <div className="toggle-list">
          <div><strong>New Campaign Detected</strong><small>Triggered when BantAI's clustering engine identifies a new coordinated smishing campaign emerging in real time.</small></div>
          <Toggle />
          <div><strong>New Threat Pattern Detected</strong><small>Triggered when messages with evasive indicators don't match any existing campaign --- potential novel attack vector.</small></div>
          <Toggle />
          <div><strong>Model Drift Alert</strong><small>Triggered when the false negative rate exceeds the 3.0% threshold, indicating possible concept drift.</small></div>
          <Toggle />
        </div>
      </Panel>
      <Panel>
        <small className="section-label">REPORT FREQUENCY</small>
        <p>Scheduled threat intelligence summary reports delivered to your email.</p>
        <div className="radio-stack">
          <div className="radio-item"><strong>Daily Report</strong><small>Sent every morning at 7:00 AM with the previous day's classification summary</small></div>
          <div className="radio-item active"><strong>Weekly Report</strong><small>Sent every Monday at 8:00 AM with campaign trends and model health overview</small></div>
          <div className="radio-item"><strong>Both</strong><small>Receive both daily and weekly digests</small></div>
        </div>
        <button className="primary-btn tiny" type="button">Save Report Preferences</button>
      </Panel>
    </div>
  );
}
