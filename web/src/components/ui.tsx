import type { ReactNode } from "react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { CampaignCard, Metric, NavSection, TableData } from "../mocks/referenceData";
import { clearSession } from "../lib/auth";

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="brand-lockup">
      <span className="brand-glyph" />
      <div>
        <strong>BantAI</strong>
        {subtitle ? <small>{subtitle}</small> : null}
      </div>
    </div>
  );
}

export function Eyebrow({ children, tone }: { children: ReactNode; tone?: "green" | "amber" }) {
  return <span className={`eyebrow ${tone ?? ""}`.trim()}>{children}</span>;
}

export function Button({ children, to, className = "", ghost }: { children: ReactNode; to?: string; className?: string; ghost?: boolean }) {
  const classes = `${ghost ? "ghost-btn" : "primary-btn"} ${className}`.trim();
  if (to) return <Link to={to} className={classes}>{children}</Link>;
  return <button className={classes} type="button">{children}</button>;
}

export function StatCards({ items }: { items: Metric[] }) {
  return (
    <div className="stat-grid">
      {items.map((item) => (
        <article key={item.label} className="stat-card">
          <small>{item.label}</small>
          <strong className={item.tone ? `tone-${item.tone}` : ""}>{item.value}</strong>
          {item.meta ? <span>{item.meta}</span> : null}
        </article>
      ))}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`.trim()}>
      {title || subtitle || actions ? (
        <div className="panel-head">
          <div>
            {title ? <strong>{title}</strong> : null}
            {subtitle ? <small>{subtitle}</small> : null}
          </div>
          {actions ? <div>{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function PortalShell({
  role,
  sidebar,
  title,
  tag,
  tagTone,
  userInitials,
  userName,
  userMeta,
  org,
  children,
  showPopup,
}: {
  role: "client" | "admin";
  sidebar: NavSection[];
  title: string;
  tag: string;
  tagTone?: "amber";
  userInitials: string;
  userName: string;
  userMeta: string;
  org: string;
  children: ReactNode;
  showPopup?: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="dashboard-shell">
      {navOpen ? <div className="nav-backdrop" onClick={() => setNavOpen(false)} /> : null}
      <aside className={`sidebar ${navOpen ? "open" : ""}`.trim()}>
        <div className="sidebar-brand">
          <Brand subtitle={role === "admin" ? "System Administration" : "Client Portal"} />
        </div>
        <nav className="sidebar-nav">
          {sidebar.map((section) => (
            <div key={section.title ?? section.items[0].path} className="sidebar-section">
              {section.title ? <span className="sidebar-title">{section.title}</span> : null}
              {section.items.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={location.pathname === item.path ? "active" : ""}
                  onClick={() => setNavOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <small>{org}</small>
          <div className="account-row">
            <span className={`avatar ${role}`}>{userInitials}</span>
            <div>
              <strong>{userName}</strong>
              <small>{userMeta}</small>
            </div>
          </div>
          <button
            className="ghost-btn dark log-out-btn"
            type="button"
            onClick={() => {
              clearSession();
              navigate(role === "admin" ? "/admin-login" : "/login");
            }}
          >
            Log Out
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <button className="menu-toggle" type="button" onClick={() => setNavOpen((open) => !open)} aria-label="Toggle navigation">
            <span />
            <span />
            <span />
          </button>
          <strong>{title}</strong>
          <div className="topbar-actions">
            <button className="notif-dot" type="button">2</button>
            <span className={`org-pill ${tagTone === "amber" ? "amber" : ""}`}>{tag}</span>
            <span className={`avatar top ${role}`}>{userInitials}</span>
          </div>
          {showPopup ? <NotificationPopover role={role} /> : null}
        </header>
        <div className="dashboard-content">{children}</div>
      </main>
    </div>
  );
}

function NotificationPopover({ role }: { role: "client" | "admin" }) {
  const items =
    role === "admin"
      ? [
          ["New Campaign Detected", "\"Operation Maya Wallet Clone #3\" --- 47 messages flagged targeting your subscribers", "2m ago", "red"],
          ["Campaign Reactivated", "\"BDO OTP Harvester Wave #2\" has resurfaced after 18 days of inactivity", "38m ago", "amber"],
          ["New Campaign Detected", "\"LBC Parcel Scam #9\" --- 31 messages detected in the last hour", "1h ago", "red"],
          ["Daily Report --- May 13", "312 new reports today - 23 confirmed smishing - 8 suspicious", "6h ago", "blue"],
        ]
      : [
          ["New Campaign Detected", "\"Operation Maya Wallet Clone #3\" is active --- 47 messages flagged targeting your subscribers", "2m ago", "red"],
          ["Campaign Reactivated", "\"BDO OTP Harvester Wave #2\" has resurfaced after 18 days of inactivity", "38m ago", "amber"],
          ["Daily Report --- May 13", "312 reports processed today - 23 confirmed smishing - 8 suspicious", "6h ago", "blue"],
          ["Weekly Report Ready", "Your threat intelligence summary for May 7-13 is ready for download", "1d ago", "blue"],
        ];

  return (
    <div className="notification-popover">
      <div className="popover-head">
        <strong>Notifications</strong>
        <span>x</span>
      </div>
      {items.map(([title, body, time, tone]) => (
        <div key={title + time} className="popover-item">
          <span className={`pulse ${tone}`} />
          <div>
            <strong>{title}</strong>
            <p>{body}</p>
            <small>{time}</small>
          </div>
        </div>
      ))}
      <button className="mark-read" type="button">Mark all as read</button>
    </div>
  );
}

export function BarChart() {
  const bars = [
    { label: "Mon", value: 22 },
    { label: "Tue", value: 38 },
    { label: "Wed", value: 56 },
    { label: "Thu", value: 83 },
    { label: "Fri", value: 100, tone: "red" },
    { label: "Sat", value: 72 },
    { label: "Sun", value: 0 },
  ];

  return (
    <div className="bars">
      {bars.map((bar) => (
        <div key={bar.label} className="bar-col">
          <span className={`bar ${bar.tone ?? ""}`.trim()} style={{ height: `${bar.value}%` }} />
          <small>{bar.label}</small>
        </div>
      ))}
    </div>
  );
}

export function LineVisual({ green }: { green?: boolean }) {
  return (
    <div className={`line-visual ${green ? "green" : ""}`.trim()}>
      <div className="line-guideline" />
      <div className="line-curve" />
      <div className="line-dots">
        <span style={{ left: "0%", bottom: "25%" }} />
        <span style={{ left: "16%", bottom: "25%" }} />
        <span style={{ left: "33%", bottom: "28%" }} />
        <span style={{ left: "50%", bottom: "40%" }} />
        <span style={{ left: "66%", bottom: "31%" }} />
        <span style={{ left: "82%", bottom: "26%" }} />
        <span style={{ left: "100%", bottom: "22%" }} />
      </div>
    </div>
  );
}

export function Table({ data, compact }: { data: TableData; compact?: boolean }) {
  return (
    <div className="table-wrap">
      <table className={compact ? "compact" : ""}>
        <thead>
          <tr>
            {data.headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cell + cellIndex}>
                  <Cell cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.footer ? (
        <div className="table-foot">
          <small>{data.footer}</small>
          <div className="pagination">
            <span className="page current">1</span>
            <span className="page">2</span>
            <span className="page">3</span>
            <span className="page">...</span>
            <span className="page">1490</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Cell({ cell }: { cell: string }) {
  if (["Smishing", "Rejected", "Critical", "Delete"].includes(cell)) {
    return <span className="badge red">{cell}</span>;
  }
  if (["Suspicious", "Pending", "Review", "FP", "Draft"].includes(cell)) {
    return <span className="badge amber">{cell}</span>;
  }
  if (["Complete", "Active", "Validated", "Resolved", "Operational", "Published"].includes(cell)) {
    return <span className="badge green">{cell}</span>;
  }
  if (["Inactive"].includes(cell)) {
    return <span className="badge gray">{cell}</span>;
  }
  if (["Edit Delete", "Edit Publish Delete"].includes(cell)) {
    return <span className="inline-actions">{cell}</span>;
  }
  return <span>{cell}</span>;
}

export function CampaignTile({ item }: { item: CampaignCard }) {
  return (
    <article className="campaign-tile">
      <div className="tile-head">
        <strong>{item.title}</strong>
        <span className={`badge ${item.tone === "green" ? "green" : "gray"}`}>{item.status}</span>
      </div>
      <div className="tile-stats">
        <div>
          <strong>{item.messages}</strong>
          <small>Messages</small>
        </div>
        <div>
          <strong>{item.domains}</strong>
          <small>Domains</small>
        </div>
        <div>
          <strong>{item.since}</strong>
          <small>Since</small>
        </div>
      </div>
      <div className="chip-row">
        {item.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
    </article>
  );
}

export function Stepper({ active, completed = 0 }: { active: number; completed?: number }) {
  const steps = ["Submission", "Verification", "Proposal", "Payment", "Activation"];
  return (
    <div className="stepper">
      {steps.map((step, index) => {
        const current = index + 1;
        const state =
          current <= completed ? "done" : current === active ? "active" : "idle";
        return (
          <div key={step} className="step-wrap">
            <div className={`step ${state}`}>
              <span>{current <= completed ? "o" : current}</span>
              <small>{step}</small>
            </div>
            {index < steps.length - 1 ? <div className={`step-line ${current < active ? "done" : ""}`} /> : null}
          </div>
        );
      })}
    </div>
  );
}

export function Field({ label, value, area, eye }: { label: string; value: string; area?: boolean; eye?: boolean }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className={`input ${area ? "area" : ""}`.trim()}>
        <span>{value}</span>
        {eye ? <i className="eye" /> : null}
      </div>
    </label>
  );
}

export function Toggle({ on = true }: { on?: boolean }) {
  return (
    <span className={`toggle ${on ? "on" : ""}`.trim()}>
      <span />
    </span>
  );
}
