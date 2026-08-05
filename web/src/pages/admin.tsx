import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart } from '../components/charts/BarChart';
import { DonutChart } from '../components/charts/DonutChart';
import { LineAreaChart } from '../components/charts/LineAreaChart';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { UserAvatar } from '../components/common/UserAvatar';
import { useUserAvatar } from '../context/UserAvatarContext';
import { ServiceHealthCard } from '../components/dashboard/ServiceHealthCard';
import { StatCard } from '../components/dashboard/StatCard';
import { PortalShell } from '../components/layout/PortalShell';

import {
  adminOverviewMetrics,
  adminReports,
  apiLogs,
  dbStorage,
  exportHubHistory,
  fpfnReview,
  scamTips,
  usersTable,
} from '../mocks/referenceData';

const ADMIN_SIDEBAR_GROUPS = [
  {
    title: 'Overview',
    items: [
      { path: '/admin/overview', label: 'System Overview', icon: '📊' },
      { path: '/admin/reports', label: 'User Reports', icon: '📩' },
    ],
  },
  {
    title: 'AI Model & Dataset',
    items: [
      { path: '/admin/model', label: 'Model Performance', icon: '🤖' },
      { path: '/admin/concept-drift', label: 'Concept Drift', icon: '⚡' },
      { path: '/admin/dataset', label: 'Dataset Mgmt', icon: '🗄️' },
      { path: '/admin/classification', label: 'Classification Log', icon: '📋' },
      { path: '/admin/fpfn', label: 'FP/FN Review', icon: '⚖️' },
    ],
  },
  {
    title: 'Threat Clusters',
    items: [
      { path: '/admin/campaigns', label: 'All Campaigns', icon: '🛡️' },
      { path: '/admin/timeline', label: 'Campaign Timeline', icon: '📅' },
    ],
  },
  {
    title: 'Clients & System',
    items: [
      { path: '/admin/users', label: 'Registered Users', icon: '👥' },
      { path: '/admin/server', label: 'Server Monitoring', icon: '🖥️' },
    ],
  },
  {
    title: 'Exports',
    items: [
      { path: '/admin/export', label: 'Export Hub', icon: '📄' },
    ],
  },
  {
    title: 'System',
    items: [
      { path: '/admin/api-logs', label: 'API Logs', icon: '🔌' },
      { path: '/admin/db-storage', label: 'DB Storage', icon: '💾' },
    ],
  },
  {
    title: 'Content',
    items: [
      { path: '/admin/tips', label: 'Scam Tips', icon: '💡' },
    ],
  },
];

function AdminShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <PortalShell
      role="admin"
      sidebarGroups={ADMIN_SIDEBAR_GROUPS}
      title={title}
      tag="Super Admin"
      userInitials="GA"
      userName="Gian Carlo Atienza"
      userMeta="Super Administrator"
      org="BantAI Research Team"
    >
      {children}
    </PortalShell>
  );
}

export function AdminOverviewPage() {
  const navigate = useNavigate();
  const [showAlert, setShowAlert] = useState(true);

  return (
    <AdminShell title="System Administration Overview">
      {/* Alert Banner (Matching Photo 2 Top Banner) */}
      {showAlert && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#f87171',
            padding: '12px 20px',
            borderRadius: 10,
            fontSize: '0.875rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontWeight: 600,
            gap: 16,
          }}
          className="animate-slide-up"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>⚠️</span>
            <span>FN rate has risen 1.4% over 7 days — potential concept drift detected. Review model performance.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => navigate('/admin/model')}
              style={{
                background: 'none',
                border: 'none',
                color: '#f87171',
                fontWeight: 700,
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Review Model →
            </button>
            <button
              onClick={() => setShowAlert(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Stat Cards Grid (Matching Photo 2 Top 4 Cards) */}
      <div className="stat-grid">
        <StatCard title="Reports Received" value="14,892" subtext="+312 today" trend="12.4%" icon="📬" />
        <StatCard title="Likely Smishing" value="1,247" subtext="+23 today" trend="8.1%" icon="🚨" iconBg="rgba(239, 68, 68, 0.15)" />
        <StatCard title="Pending Reports" value="312" subtext="Awaiting validation" trend="3.2%" trendUp={false} icon="⏳" iconBg="rgba(245, 158, 11, 0.15)" />
        <StatCard title="Registered Users" value="8,421" subtext="Mobile app telemetry users" trend="4.8%" icon="👥" iconBg="rgba(59, 130, 246, 0.15)" />
      </div>

      {/* System Infrastructure Health Grid */}
      <div className="panel">
        <div className="panel-head">
          <div>
            <strong>System Infrastructure Health</strong>
            <small>Live status metrics of BantAI microservices</small>
          </div>
        </div>
        <div className="grid-3x2">
          <ServiceHealthCard name="Backend API" status="Operational" latency={12} uptime="99.99%" icon="📡" />
          <ServiceHealthCard name="Classification Engine" status="Operational" latency={28} uptime="99.95%" icon="🤖" />
          <ServiceHealthCard name="Database (PostgreSQL)" status="Operational" latency={8} uptime="100%" icon="🗄️" />
          <ServiceHealthCard name="Campaign Clustering" status="Operational" latency={45} uptime="99.90%" icon="🕸️" />
          <ServiceHealthCard name="Mobile App Sync" status="Operational" latency={18} uptime="99.97%" icon="📱" />
          <ServiceHealthCard name="Web Dashboard" status="Operational" latency={6} uptime="100%" icon="🖥️" />
        </div>
      </div>

      {/* Main Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        <div className="panel">
          <div className="panel-head">
            <div>
              <strong>Weekly Reporting Volume</strong>
              <small>Distribution of user submissions over the past 7 days</small>
            </div>
          </div>
          <BarChart />
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <strong>SYSTEM HEALTH SUMMARY</strong>
              <small>Service operational status</small>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              'Backend API',
              'Classification Engine',
              'Database (PostgreSQL)',
              'Campaign Clustering',
              'Mobile App Sync',
              'Web Dashboard',
            ].map((service) => (
              <div
                key={service}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  background: 'var(--bg-surface-elevated)',
                  borderRadius: 8,
                  fontSize: '0.8125rem',
                }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>{service}</span>
                <span className="badge badge-green">Operational</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Model Status, Pending Reviews, Client Organizations */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
        {/* Card 1: Model Status */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <strong>MODEL STATUS</strong>
              <small>XLM-RoBERTa v3.1 Metrics</small>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Version:</span>
              <strong style={{ color: 'var(--text-primary)' }}>XLM-RoBERTa v3.1</strong>
            </div>
            <div style={{ background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Accuracy:</span>
              <strong style={{ color: 'var(--green-text)' }}>94.2%</strong>
            </div>
            <div style={{ background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>F1 Score:</span>
              <strong style={{ color: 'var(--accent-light)' }}>0.931</strong>
            </div>
            <div style={{ background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>False Positive Rate:</span>
              <strong style={{ color: 'var(--amber-text)' }}>3.8%</strong>
            </div>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 4 }}>Last retrained: May 8, 2026</small>
          </div>
        </div>

        {/* Card 2: Pending Reviews */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <strong>PENDING REVIEWS</strong>
              <small>Analyst validation workbench queue</small>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, justifyContent: 'center' }}>
            <strong style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--amber-text)', lineHeight: 1 }}>312</strong>
            <p style={{ color: 'var(--text-primary)', fontSize: '0.9375rem', margin: 0, fontWeight: 600 }}>
              User reports awaiting validation
            </p>
            <div style={{ padding: '10px 14px', background: 'var(--bg-surface-elevated)', borderRadius: 8, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--green-text)' }}>489</strong> validated · <strong style={{ color: 'var(--red-text)' }}>46</strong> rejected
            </div>
            <Button variant="secondary" size="sm" onClick={() => navigate('/admin/reports')}>
              Open Reports Workbench →
            </Button>
          </div>
        </div>

        {/* Card 3: Client Organizations */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <strong>CLIENT ORGANIZATIONS</strong>
              <small>Active institutional clients</small>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { name: 'Globe Telecom', status: 'Active', date: 'May 14' },
              { name: 'Smart Communications', status: 'Active', date: 'May 11' },
              { name: 'CICC (NCT)', status: 'Active', date: 'May 08' },
            ].map((org) => (
              <div
                key={org.name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  background: 'var(--bg-surface-elevated)',
                  borderRadius: 8,
                }}
              >
                <div>
                  <strong style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-primary)' }}>{org.name}</strong>
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Active since {org.date}</small>
                </div>
                <span className="badge badge-green">Active</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

// USER REPORTS PAGE (Detailed Enterprise Workbench)
interface UserReportItem {
  id: string;
  user: string;
  preview: string;
  campaign: string;
  category: string;
  submittedAt: string;
  status: 'Pending' | 'Validated' | 'Rejected';
  fullMessage?: string;
  confidence?: string;
  url?: string;
}

const REPORT_ITEMS: UserReportItem[] = [
  {
    id: '#RPT-0912',
    user: 'user_4821',
    preview: 'Your GCash account has been flagged. Verify now at gcash-ph-support.net/...',
    campaign: 'Op. GCash Clone #17',
    category: 'Smishing / Fake Domain',
    submittedAt: 'May 13 9:01 AM',
    status: 'Pending',
    fullMessage: 'Your GCash account has been flagged due to unverified details. Verify now at https://gcash-ph-support.net/login to prevent permanent deactivation.',
    confidence: '96.4%',
    url: 'gcash-ph-support.net',
  },
  {
    id: '#RPT-0911',
    user: 'user_3340',
    preview: 'Congratulations! You\'ve won a ₱5,000 GCash reward. Claim at...',
    campaign: 'Op. GCash Clone #17',
    category: 'Smishing / Prize Lure',
    submittedAt: 'May 13 8:47 AM',
    status: 'Pending',
    fullMessage: 'Congratulations! You\'ve won a ₱5,000 GCash reward for being a loyal subscriber. Claim your prize immediately at http://claim-gcash-promo.site',
    confidence: '94.1%',
    url: 'claim-gcash-promo.site',
  },
  {
    id: '#RPT-0910',
    user: 'user_7102',
    preview: 'Your PLDT bill is overdue. Pay now to avoid disconnection.',
    campaign: 'PLDT Impersonation #4',
    category: 'Smishing / Urgency',
    submittedAt: 'May 13 8:30 AM',
    status: 'Validated',
    fullMessage: 'Your PLDT bill of ₱1,899 is overdue. Pay now to avoid disconnection within 24 hours at http://pldt-billing-online.com',
    confidence: '92.8%',
    url: 'pldt-billing-online.com',
  },
  {
    id: '#RPT-0909',
    user: 'user_2211',
    preview: 'Ang inyong BDO account ay nangangailangan ng verification.',
    campaign: 'BDO Fake Support #5',
    category: 'Smishing / Brand Impersonation',
    submittedAt: 'May 13 7:55 AM',
    status: 'Validated',
    fullMessage: 'Ang inyong BDO account ay nangangailangan ng verification dahil sa bagong BSP policy. Mag-log in sa http://bdo-online-sec.com para i-update.',
    confidence: '91.5%',
    url: 'bdo-online-sec.com',
  },
  {
    id: '#RPT-0908',
    user: 'user_8830',
    preview: 'URGENT: LBC parcel held at customs. Pay release fee.',
    campaign: 'LBC Parcel Scam #8',
    category: 'Smishing / Fake Domain',
    submittedAt: 'May 13 7:40 AM',
    status: 'Pending',
    fullMessage: 'URGENT: LBC parcel #PH8812 is held at customs. Pay ₱250 release fee now at http://lbc-express-delivery.top to initiate delivery.',
    confidence: '95.0%',
    url: 'lbc-express-delivery.top',
  },
  {
    id: '#RPT-0907',
    user: 'user_4401',
    preview: 'Meralco disconnection notice for your account.',
    campaign: 'Meralco Threat #2',
    category: 'Suspicious / Urgency',
    submittedAt: 'May 13 6:50 AM',
    status: 'Rejected',
    fullMessage: 'Meralco notice: Your electric bill is due tomorrow. Please pay via authorized Bayad Center or Meralco Online app.',
    confidence: '42.0%',
  },
  {
    id: '#RPT-0906',
    user: 'user_9912',
    preview: 'SHOPEE: Your ₱10,000 prize is waiting. Claim within 24h.',
    campaign: 'Shopee Prize Lure #11',
    category: 'Smishing / Prize Lure',
    submittedAt: 'May 13 6:20 AM',
    status: 'Pending',
    fullMessage: 'SHOPEE NOTICE: Your ₱10,000 prize is waiting for claim! Tap http://shopee-voucher-claim.site before link expires in 24 hours.',
    confidence: '88.9%',
    url: 'shopee-voucher-claim.site',
  },
  {
    id: '#RPT-0905',
    user: 'user_1154',
    preview: 'Maya Advisory: Unusual login detected from new device.',
    campaign: 'Maya Account Takeover #3',
    category: 'Smishing / Brand Impersonation',
    submittedAt: 'May 13 5:45 AM',
    status: 'Pending',
    fullMessage: 'Maya Advisory: Unusual login detected on your account from IP 182.25.14.3. Secure your account now at http://maya-verify-auth.com',
    confidence: '97.2%',
    url: 'maya-verify-auth.com',
  },
  {
    id: '#RPT-0904',
    user: 'user_6672',
    preview: 'BPI Alert: Your online session has expired.',
    campaign: 'BPI Phishing Campaign #9',
    category: 'Smishing / Urgency',
    submittedAt: 'May 13 5:10 AM',
    status: 'Validated',
    fullMessage: 'BPI Alert: Your online session has expired due to inactivity. Re-authenticate at http://bpi-online-portal-sec.info',
    confidence: '93.7%',
    url: 'bpi-online-portal-sec.info',
  },
  {
    id: '#RPT-0903',
    user: 'user_5021',
    preview: 'Globe Telecom: You have 1,500 unused rewards points.',
    campaign: 'Globe Points Scam #14',
    category: 'Smishing / Prize Lure',
    submittedAt: 'May 13 4:35 AM',
    status: 'Pending',
    fullMessage: 'Globe Telecom: You have 1,500 unused rewards points expiring today! Redeem for items at http://globe-rewards-claim.org',
    confidence: '91.8%',
    url: 'globe-rewards-claim.org',
  },
  {
    id: '#RPT-0902',
    user: 'user_3890',
    preview: 'Lazada Voucher: Free ₱1,000 shopping credit.',
    campaign: 'Lazada Lure #6',
    category: 'Smishing / Prize Lure',
    submittedAt: 'May 13 4:00 AM',
    status: 'Rejected',
    fullMessage: 'Lazada Sale: Use code FREESHIP50 at checkout for free delivery on orders over ₱500. Visit lazada.com.ph',
    confidence: '35.4%',
  },
  {
    id: '#RPT-0901',
    user: 'user_7741',
    preview: 'UnionBank: Transaction of ₱15,400 initiated.',
    campaign: 'UnionBank Alert Fake #2',
    category: 'Smishing / Urgency',
    submittedAt: 'May 13 3:15 AM',
    status: 'Validated',
    fullMessage: 'UnionBank: Transaction of ₱15,400 initiated to Juan Dela Cruz. If you did not authorize this, cancel immediately at http://ubp-secure-cancel.net',
    confidence: '98.1%',
    url: 'ubp-secure-cancel.net',
  },
  {
    id: '#RPT-0900',
    user: 'user_2098',
    preview: 'SSS Advisory: Loan disbursement confirmation required.',
    campaign: 'SSS Impersonation #1',
    category: 'Smishing / Brand Impersonation',
    submittedAt: 'May 13 2:40 AM',
    status: 'Pending',
    fullMessage: 'SSS Advisory: Your salary loan request of ₱30,000 requires member portal confirmation. Confirm at http://sss-gov-ph-loan.com',
    confidence: '89.6%',
    url: 'sss-gov-ph-loan.com',
  },
  {
    id: '#RPT-0899',
    user: 'user_4119',
    preview: 'DTI Scam Alert: Verify your business permit registration.',
    campaign: 'DTI Business Lure #3',
    category: 'Smishing / Urgency',
    submittedAt: 'May 13 1:55 AM',
    status: 'Pending',
    fullMessage: 'DTI Notice: Your business permit registration #DTI-8891 requires immediate verification. Update status at http://dti-gov-verify.info',
    confidence: '90.3%',
    url: 'dti-gov-verify.info',
  },
  {
    id: '#RPT-0898',
    user: 'user_9012',
    preview: 'GCash Advisory: SIM Registration deadline reminder.',
    campaign: 'Op. GCash Clone #17',
    category: 'Smishing / Urgency',
    submittedAt: 'May 12 11:30 PM',
    status: 'Validated',
    fullMessage: 'GCash Urgent: Unregistered SIM cards will be permanently deactivated. Complete registration at http://sim-registration-gcash.online',
    confidence: '95.8%',
    url: 'sim-registration-gcash.online',
  },
  {
    id: '#RPT-0897',
    user: 'user_1430',
    preview: 'J&T Express: Package delivery address incomplete.',
    campaign: 'Express Parcel Lure #5',
    category: 'Smishing / Fake Domain',
    submittedAt: 'May 12 10:45 PM',
    status: 'Pending',
    fullMessage: 'J&T Express: Parcel #JT9920 cannot be delivered due to missing house number. Update address at http://jtexpress-ph-track.site',
    confidence: '94.6%',
    url: 'jtexpress-ph-track.site',
  },
  {
    id: '#RPT-0896',
    user: 'user_6189',
    preview: 'Metrobank: Account locked due to failed passcode attempts.',
    campaign: 'Metrobank Phish #4',
    category: 'Smishing / Brand Impersonation',
    submittedAt: 'May 12 10:15 PM',
    status: 'Validated',
    fullMessage: 'Metrobank Warning: Your account has been temporarily locked. Unlock your account via http://metrobank-online-help.com',
    confidence: '96.9%',
    url: 'metrobank-online-help.com',
  },
  {
    id: '#RPT-0895',
    user: 'user_8321',
    preview: 'Security Bank: Important notice regarding your credit card.',
    campaign: 'Security Bank Scam #1',
    category: 'Smishing / Urgency',
    submittedAt: 'May 12 9:40 PM',
    status: 'Pending',
    fullMessage: 'Security Bank: Suspicious charge of ₱8,900 on your card ending in 4092. Report unauthorized transaction at http://securitybank-alert-center.org',
    confidence: '92.1%',
    url: 'securitybank-alert-center.org',
  },
  {
    id: '#RPT-0894',
    user: 'user_3552',
    preview: 'Pag-IBIG Fund: Housing loan rebate released.',
    campaign: 'Pag-IBIG Rebate Lure #2',
    category: 'Smishing / Prize Lure',
    submittedAt: 'May 12 9:00 PM',
    status: 'Rejected',
    fullMessage: 'Pag-IBIG Fund Reminder: Virtual Pag-IBIG portal maintenance scheduled on May 15. Plan your transactions accordingly.',
    confidence: '38.2%',
  },
  {
    id: '#RPT-0893',
    user: 'user_7710',
    preview: 'Landbank: Your account requires mandatory e-KYC update.',
    campaign: 'Landbank e-KYC Phish #7',
    category: 'Smishing / Fake Domain',
    submittedAt: 'May 12 8:20 PM',
    status: 'Pending',
    fullMessage: 'Landbank Notice: Mandatory e-KYC update required per BSP circular. Submit documents at http://landbank-ekyc-portal.com',
    confidence: '95.3%',
    url: 'landbank-ekyc-portal.com',
  },
  {
    id: '#RPT-0892',
    user: 'user_2844',
    preview: 'Cebuana Lhuillier: Remittance reference ready for pickup.',
    campaign: 'Cebuana Remittance Lure #3',
    category: 'Smishing / Prize Lure',
    submittedAt: 'May 12 7:45 PM',
    status: 'Pending',
    fullMessage: 'Cebuana Lhuillier: Remittance of ₱12,000 is ready for cash-out. Verify receiver details at http://cebuana-remit-claim.info',
    confidence: '91.0%',
    url: 'cebuana-remit-claim.info',
  },
];

export function AdminReportsPage() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'Pending' | 'Validated' | 'Rejected'>('All');
  const [selectedReport, setSelectedReport] = useState<UserReportItem | null>(null);
  const [reportsList, setReportsList] = useState<UserReportItem[]>(REPORT_ITEMS);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  const handleTabChange = (tab: 'All' | 'Pending' | 'Validated' | 'Rejected') => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  // Filtered List
  const filteredReports = reportsList.filter((item) => {
    const matchesTab = activeTab === 'All' || item.status === activeTab;
    const matchesSearch =
      item.id.toLowerCase().includes(search.toLowerCase()) ||
      item.user.toLowerCase().includes(search.toLowerCase()) ||
      item.preview.toLowerCase().includes(search.toLowerCase()) ||
      item.campaign.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredReports.length);
  const paginatedReports = filteredReports.slice(startIndex, endIndex);

  const pendingCount = reportsList.filter((r) => r.status === 'Pending').length;
  const validatedCount = reportsList.filter((r) => r.status === 'Validated').length;
  const rejectedCount = reportsList.filter((r) => r.status === 'Rejected').length;

  const handleUpdateStatus = (id: string, newStatus: 'Validated' | 'Rejected') => {
    setReportsList((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
    );
    setSelectedReport(null);
  };

  return (
    <AdminShell title="User Reports Workbench">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Top Controls Header */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          {/* Search Bar */}
          <div style={{ position: 'relative', width: 280 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search reports, users, lures..."
              value={search}
              onChange={handleSearchChange}
              style={{ width: '100%', height: 38, paddingLeft: 34, fontSize: '0.8125rem' }}
            />
            <span style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              🔍
            </span>
          </div>
        </div>

        {/* Visually Appealing Stat Cards Grid */}
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
          <div className="stat-card" style={{ background: 'var(--bg-card)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <small style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Pending Review</small>
              <span className="badge badge-amber" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>⏳ Action Needed</span>
            </div>
            <strong style={{ color: 'var(--amber-text)', fontSize: '2.25rem', fontWeight: 800, margin: '6px 0 2px 0', display: 'block' }}>{pendingCount}</strong>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Awaiting analyst review</span>
          </div>

          <div className="stat-card" style={{ background: 'var(--bg-card)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <small style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Validated Smishing</small>
              <span className="badge badge-green" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>🛡️ Confirmed</span>
            </div>
            <strong style={{ color: 'var(--green-text)', fontSize: '2.25rem', fontWeight: 800, margin: '6px 0 2px 0', display: 'block' }}>{validatedCount}</strong>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Flagged &amp; cluster matched</span>
          </div>

          <div className="stat-card" style={{ background: 'var(--bg-card)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <small style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Rejected Reports</small>
              <span className="badge badge-red" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>✕ Benign</span>
            </div>
            <strong style={{ color: 'var(--red-text)', fontSize: '2.25rem', fontWeight: 800, margin: '6px 0 2px 0', display: 'block' }}>{rejectedCount}</strong>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>False alarms dismissed</span>
          </div>

          <div className="stat-card" style={{ background: 'var(--bg-card)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <small style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Avg Review Time</small>
              <span className="badge badge-blue" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>⚡ Analyst SLA</span>
            </div>
            <strong style={{ color: 'var(--text-primary)', fontSize: '2.25rem', fontWeight: 800, margin: '6px 0 2px 0', display: 'block' }}>4.2h</strong>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Average turnaround time</span>
          </div>
        </div>

        {/* Filter Tabs Row */}
        <div className="tabs-row" style={{ borderBottom: 'none', padding: 0 }}>
          <button
            className={`tab-btn ${activeTab === 'All' ? 'active' : ''}`}
            onClick={() => handleTabChange('All')}
          >
            All ({reportsList.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'Pending' ? 'active' : ''}`}
            onClick={() => handleTabChange('Pending')}
          >
            Pending Review ({pendingCount})
          </button>
          <button
            className={`tab-btn ${activeTab === 'Validated' ? 'active' : ''}`}
            onClick={() => handleTabChange('Validated')}
          >
            Validated ({validatedCount})
          </button>
          <button
            className={`tab-btn ${activeTab === 'Rejected' ? 'active' : ''}`}
            onClick={() => handleTabChange('Rejected')}
          >
            Rejected ({rejectedCount})
          </button>
        </div>

        {/* Main Detailed Reports Table */}
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>REPORT ID</th>
                  <th>USER</th>
                  <th>PREVIEW</th>
                  <th>CAMPAIGN</th>
                  <th>CATEGORY</th>
                  <th>SUBMITTED AT</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReports.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <code style={{ color: 'var(--accent-light)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        {item.id}
                      </code>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{item.user}</span>
                    </td>
                    <td style={{ maxWidth: 280 }}>
                      <span
                        style={{
                          color: 'var(--text-secondary)',
                          fontSize: '0.8125rem',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                        title={item.preview}
                      >
                        {item.preview}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                        {item.campaign}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-purple" style={{ fontSize: '0.6875rem' }}>
                        {item.category}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.submittedAt}</span>
                    </td>
                    <td>
                      {item.status === 'Pending' ? (
                        <span className="badge badge-amber">Pending</span>
                      ) : item.status === 'Validated' ? (
                        <span className="badge badge-green">Validated</span>
                      ) : (
                        <span className="badge badge-red">Rejected</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Button
                        variant={item.status === 'Pending' ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => setSelectedReport(item)}
                      >
                        {item.status === 'Pending' ? 'Review →' : 'View →'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer Pagination Bar */}
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
              background: 'var(--bg-surface-elevated)',
            }}
          >
            <span>
              Showing {filteredReports.length === 0 ? 0 : startIndex + 1}–{endIndex} of {filteredReports.length} results
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                className="btn btn-ghost"
                style={{
                  padding: '4px 8px',
                  height: 28,
                  fontSize: '0.75rem',
                  opacity: currentPage === 1 ? 0.5 : 1,
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                }}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                ‹
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  className={`btn ${currentPage === pageNum ? 'btn-primary' : 'btn-ghost'}`}
                  style={{
                    padding: '4px 10px',
                    height: 28,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              ))}

              <button
                className="btn btn-ghost"
                style={{
                  padding: '4px 8px',
                  height: 28,
                  fontSize: '0.75rem',
                  opacity: currentPage >= totalPages ? 0.5 : 1,
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                }}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Review / View Modal */}
      {selectedReport && (
        <Modal
          isOpen={Boolean(selectedReport)}
          onClose={() => setSelectedReport(null)}
          title={`Review Report ${selectedReport.id}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8 }}>
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Reported By</small>
                <strong>{selectedReport.user}</strong>
              </div>
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Submitted At</small>
                <strong>{selectedReport.submittedAt}</strong>
              </div>
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Status</small>
                <span className={`badge ${selectedReport.status === 'Pending' ? 'badge-amber' : selectedReport.status === 'Validated' ? 'badge-green' : 'badge-red'}`}>
                  {selectedReport.status}
                </span>
              </div>
            </div>

            <div>
              <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Full Message Text</small>
              <div
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 8,
                  padding: 14,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8125rem',
                  lineHeight: 1.5,
                }}
              >
                "{selectedReport.fullMessage || selectedReport.preview}"
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8 }}>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>AI Model Confidence</small>
                <strong style={{ fontSize: '1.25rem', color: 'var(--accent-light)' }}>
                  {selectedReport.confidence || '94.2%'}
                </strong>
                <small style={{ display: 'block', color: 'var(--text-secondary)' }}>XLM-RoBERTa High Confidence</small>
              </div>

              <div style={{ background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8 }}>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Campaign Group</small>
                <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{selectedReport.campaign}</strong>
                <small style={{ display: 'block', color: 'var(--text-secondary)' }}>Category: {selectedReport.category}</small>
              </div>
            </div>

            {selectedReport.url && (
              <div style={{ padding: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid var(--red-border)', borderRadius: 8, color: 'var(--red-text)' }}>
                <strong>🚨 Intercepted Malicious URL:</strong> <code style={{ fontFamily: 'var(--font-mono)' }}>{selectedReport.url}</code>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 16, marginTop: 8 }}>
              <Button variant="ghost" size="md" onClick={() => setSelectedReport(null)}>
                Close
              </Button>

              {selectedReport.status === 'Pending' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="danger" size="md" onClick={() => handleUpdateStatus(selectedReport.id, 'Rejected')}>
                    Reject Report
                  </Button>
                  <Button variant="primary" size="md" onClick={() => handleUpdateStatus(selectedReport.id, 'Validated')}>
                    Validate as Smishing
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </AdminShell>
  );
}

// MODEL PERFORMANCE DASHBOARD (Matching User's Reference Screenshot)
export function AdminModelPage() {
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  return (
    <AdminShell title="Model Performance Dashboard">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Top Actions Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <Button variant="secondary" size="md" onClick={() => setShowHistoryModal(true)}>
            View Version History →
          </Button>
        </div>

        {/* Top 4 Stat Cards (Matching Screenshot Top Row Metrics) */}
        <div className="stat-grid">
          <StatCard
            title="Detection Accuracy"
            value="94.2%"
            subtext="+0.8% vs last run"
            trend="0.8%"
            trendUp={true}
            icon="🎯"
            iconBg="rgba(16, 185, 129, 0.15)"
          />
          <StatCard
            title="False Positive Rate"
            value="3.8%"
            subtext="+0.1% (stable)"
            trend="0.1%"
            trendUp={false}
            icon="📈"
            iconBg="rgba(245, 158, 11, 0.15)"
          />
          <StatCard
            title="False Negative Rate"
            value="2.1%"
            subtext="+1.4% ⚠️ drift alert"
            trend="1.4%"
            trendUp={false}
            icon="⚠️"
            iconBg="rgba(239, 68, 68, 0.15)"
          />
          <StatCard
            title="F1 Score"
            value="0.931"
            subtext="+0.012 vs last"
            trend="0.012"
            trendUp={true}
            icon="📊"
            iconBg="rgba(124, 58, 237, 0.15)"
          />
        </div>

        {/* Charts & Breakdown Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          {/* Accuracy Over Time Graph */}
          <div className="panel">
            <div className="panel-head">
              <div>
                <strong>ACCURACY OVER TIME — APR 14 TO MAY 13</strong>
                <small>Post-retrain improvement: +1.2% accuracy · +0.8% F1 · FN rate recovering</small>
              </div>
            </div>

            {/* Custom SVG Line Chart with Target & Retrain Line */}
            <div style={{ position: 'relative', marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 16, fontSize: '0.75rem', marginBottom: 12, color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 3, background: 'var(--accent-primary)', borderRadius: 2 }} /> Accuracy %
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 2, background: 'var(--amber-text)', borderStyle: 'dashed' }} /> Target (90%)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 2, background: '#60a5fa' }} /> Retrain Event (May 8)
                </span>
              </div>

              <LineAreaChart />
            </div>
          </div>

          {/* Classification Breakdown Progress Bars */}
          <div className="panel">
            <div className="panel-head">
              <div>
                <strong>CLASSIFICATION BREAKDOWN</strong>
                <small>Distribution of 14,892 test dataset samples</small>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 10 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: 6 }}>
                  <span style={{ color: 'var(--red-text)', fontWeight: 600 }}>Likely Smishing</span>
                  <strong style={{ color: 'var(--text-primary)' }}>1,247</strong>
                </div>
                <div style={{ height: 8, width: '100%', background: 'var(--bg-input)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '15%', background: 'var(--red-text)', borderRadius: 4 }} />
                </div>
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2, display: 'block' }}>8.4% of total volume</small>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: 6 }}>
                  <span style={{ color: 'var(--amber-text)', fontWeight: 600 }}>Suspicious</span>
                  <strong style={{ color: 'var(--text-primary)' }}>389</strong>
                </div>
                <div style={{ height: 8, width: '100%', background: 'var(--bg-input)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '8%', background: 'var(--amber-text)', borderRadius: 4 }} />
                </div>
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2, display: 'block' }}>2.6% of total volume</small>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: 6 }}>
                  <span style={{ color: 'var(--green-text)', fontWeight: 600 }}>Unknown / Safe</span>
                  <strong style={{ color: 'var(--text-primary)' }}>13,256</strong>
                </div>
                <div style={{ height: 8, width: '100%', background: 'var(--bg-input)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '89%', background: 'var(--green-text)', borderRadius: 4 }} />
                </div>
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2, display: 'block' }}>89.0% of total volume</small>
              </div>
            </div>
          </div>
        </div>

        {/* Per-Class Performance Metrics Table (Matching Screenshot Bottom Section) */}
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <strong style={{ fontSize: '1.125rem', color: 'var(--text-primary)', display: 'block' }}>Per-Class Metrics</strong>
            <small style={{ color: 'var(--text-secondary)' }}>Detailed Precision, Recall, F1 Score, and Support breakdown</small>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>CLASS</th>
                  <th>PRECISION</th>
                  <th>RECALL</th>
                  <th>F1 SCORE</th>
                  <th style={{ textAlign: 'right' }}>SUPPORT</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <span className="badge badge-red">Likely Smishing</span>
                  </td>
                  <td><code style={{ fontFamily: 'var(--font-mono)' }}>0.946</code></td>
                  <td><code style={{ fontFamily: 'var(--font-mono)' }}>0.938</code></td>
                  <td><code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-light)', fontWeight: 700 }}>0.942</code></td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>1,247</td>
                </tr>

                <tr>
                  <td>
                    <span className="badge badge-amber">Suspicious</span>
                  </td>
                  <td><code style={{ fontFamily: 'var(--font-mono)' }}>0.891</code></td>
                  <td><code style={{ fontFamily: 'var(--font-mono)' }}>0.903</code></td>
                  <td><code style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber-text)', fontWeight: 700 }}>0.897</code></td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>389</td>
                </tr>

                <tr>
                  <td>
                    <span className="badge badge-green">Unknown / Safe</span>
                  </td>
                  <td><code style={{ fontFamily: 'var(--font-mono)' }}>0.971</code></td>
                  <td><code style={{ fontFamily: 'var(--font-mono)' }}>0.964</code></td>
                  <td><code style={{ fontFamily: 'var(--font-mono)', color: 'var(--green-text)', fontWeight: 700 }}>0.967</code></td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>13,256</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Model Version History Modal */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title="XLM-RoBERTa Model Checkpoint History"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: '0.875rem' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>VERSION</th>
                  <th>RETRAINED DATE</th>
                  <th>ACCURACY</th>
                  <th>F1 SCORE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>XLM-RoBERTa v3.1</strong></td>
                  <td>May 8, 2026</td>
                  <td style={{ color: 'var(--green-text)', fontWeight: 700 }}>94.2%</td>
                  <td>0.931</td>
                  <td><span className="badge badge-green">Active Production</span></td>
                </tr>
                <tr>
                  <td>XLM-RoBERTa v3.0</td>
                  <td>Apr 14, 2026</td>
                  <td>93.0%</td>
                  <td>0.919</td>
                  <td><span className="badge badge-gray">Archived</span></td>
                </tr>
                <tr>
                  <td>XLM-RoBERTa v2.5</td>
                  <td>Mar 01, 2026</td>
                  <td>91.8%</td>
                  <td>0.904</td>
                  <td><span className="badge badge-gray">Archived</span></td>
                </tr>
                <tr>
                  <td>BERT-Multilingual v1.0</td>
                  <td>Jan 15, 2026</td>
                  <td>88.4%</td>
                  <td>0.865</td>
                  <td><span className="badge badge-gray">Baseline Initial</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <Button variant="ghost" size="md" onClick={() => setShowHistoryModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </AdminShell>
  );
}

// FULLY INTERACTIVE CONCEPT DRIFT SVG CHART COMPONENT
interface DriftPointData {
  date: string;
  fp: number;
  fn: number;
  x: number;
  fpY: number;
  fnY: number;
  note?: string;
}

const CONCEPT_DRIFT_POINTS: DriftPointData[] = [
  { date: 'Apr 14', fp: 3.5, fn: 2.0, x: 100, fpY: 100, fnY: 160 },
  { date: 'Apr 21', fp: 3.7, fn: 1.8, x: 230, fpY: 92,  fnY: 168 },
  { date: 'Apr 28', fp: 3.9, fn: 2.2, x: 360, fpY: 84,  fnY: 152 },
  { date: 'May 5',  fp: 3.8, fn: 2.6, x: 490, fpY: 88,  fnY: 136 },
  { date: 'May 10', fp: 3.8, fn: 3.2, x: 630, fpY: 88,  fnY: 112, note: 'FN crossed 3.0% threshold' },
  { date: 'May 13', fp: 3.5, fn: 3.5, x: 760, fpY: 100, fnY: 100, note: 'Highest divergence point' },
];

function InteractiveConceptDriftChart() {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(4); // Default hover on May 10
  const [showFp, setShowFp] = useState(true);
  const [showFn, setShowFn] = useState(true);
  const [showThreshold, setShowThreshold] = useState(true);

  const activePoint = hoveredIdx !== null ? CONCEPT_DRIFT_POINTS[hoveredIdx] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Legend & Toggle Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 16, fontSize: '0.8125rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: showFp ? '#f59e0b' : 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={showFp}
              onChange={(e) => setShowFp(e.target.checked)}
              style={{ accentColor: '#f59e0b' }}
            />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
            <strong>FP Rate (Baseline)</strong>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: showFn ? '#ef4444' : 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={showFn}
              onChange={(e) => setShowFn(e.target.checked)}
              style={{ accentColor: '#ef4444' }}
            />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
            <strong>FN Rate (Smishing Missed)</strong>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: showThreshold ? '#f43f5e' : 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={showThreshold}
              onChange={(e) => setShowThreshold(e.target.checked)}
              style={{ accentColor: '#f43f5e' }}
            />
            <span style={{ width: 16, height: 2, borderTop: '2px dashed #f43f5e', display: 'inline-block' }} />
            <span>Threshold (3.0%)</span>
          </label>
        </div>

        {activePoint && (
          <div style={{ fontSize: '0.8125rem', background: 'var(--bg-surface-elevated)', padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border-default)' }}>
            Selected: <strong style={{ color: 'var(--accent-light)' }}>{activePoint.date}</strong> — FN: <span style={{ color: activePoint.fn >= 3.0 ? '#ef4444' : 'var(--text-primary)', fontWeight: 700 }}>{activePoint.fn}%</span> · FP: <span style={{ color: '#f59e0b', fontWeight: 700 }}>{activePoint.fp}%</span>
          </div>
        )}
      </div>

      {/* SVG Canvas Area */}
      <div style={{ position: 'relative', width: '100%', height: 260, background: 'var(--bg-surface-elevated)', borderRadius: 10, border: '1px solid var(--border-subtle)', padding: '10px 0' }}>
        <svg width="100%" height="100%" viewBox="0 0 800 240" preserveAspectRatio="none">
          {/* Grid Lines */}
          <line x1="60" y1="40" x2="780" y2="40" stroke="var(--border-subtle)" strokeDasharray="3,3" />
          <line x1="60" y1="80" x2="780" y2="80" stroke="var(--border-subtle)" strokeDasharray="3,3" />
          <line x1="60" y1="120" x2="780" y2="120" stroke="var(--border-subtle)" strokeDasharray="3,3" />
          <line x1="60" y1="160" x2="780" y2="160" stroke="var(--border-subtle)" strokeDasharray="3,3" />
          <line x1="60" y1="200" x2="780" y2="200" stroke="var(--border-subtle)" strokeDasharray="3,3" />

          {/* Y Axis Labels */}
          <text x="30" y="44" fill="var(--text-muted)" fontSize="12">5%</text>
          <text x="30" y="84" fill="var(--text-muted)" fontSize="12">4%</text>
          <text x="30" y="124" fill="var(--text-muted)" fontSize="12">3%</text>
          <text x="30" y="164" fill="var(--text-muted)" fontSize="12">2%</text>
          <text x="30" y="204" fill="var(--text-muted)" fontSize="12">1%</text>

          {/* Threshold Line at 3.0% */}
          {showThreshold && (
            <g>
              <line x1="60" y1="120" x2="780" y2="120" stroke="#f43f5e" strokeWidth="2" strokeDasharray="5,5" />
              <text x="740" y="115" fill="#f43f5e" fontSize="12" fontWeight="bold">3.0% Limit</text>
            </g>
          )}

          {/* Vertical Dashed Line at May 10 (x=630) */}
          <g>
            <line x1="630" y1="20" x2="630" y2="200" stroke="#f43f5e" strokeWidth="2" strokeDasharray="4,4" />
            <rect x="635" y="16" width="135" height="22" rx="4" fill="rgba(239,68,68,0.2)" stroke="#ef4444" strokeWidth="1" />
            <text x="640" y="31" fill="#ef4444" fontSize="11" fontWeight="bold">FN crosses threshold</text>
          </g>

          {/* Hover Vertical Guide Line */}
          {activePoint && (
            <line x1={activePoint.x} y1="20" x2={activePoint.x} y2="210" stroke="var(--accent-light)" strokeWidth="1.5" strokeDasharray="3,3" />
          )}

          {/* Yellow Line: FP Rate */}
          {showFp && (
            <g>
              <polyline
                fill="none"
                stroke="#f59e0b"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={CONCEPT_DRIFT_POINTS.map((p) => `${p.x},${p.fpY}`).join(' ')}
              />
              {CONCEPT_DRIFT_POINTS.map((p, idx) => (
                <circle
                  key={`fp-${idx}`}
                  cx={p.x}
                  cy={p.fpY}
                  r={hoveredIdx === idx ? 8 : 5}
                  fill="#f59e0b"
                  stroke="#ffffff"
                  strokeWidth={hoveredIdx === idx ? 3 : 1.5}
                  style={{ transition: 'all 0.2s ease', cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredIdx(idx)}
                />
              ))}
            </g>
          )}

          {/* Red Line: FN Rate */}
          {showFn && (
            <g>
              <polyline
                fill="none"
                stroke="#ef4444"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={CONCEPT_DRIFT_POINTS.map((p) => `${p.x},${p.fnY}`).join(' ')}
              />
              {CONCEPT_DRIFT_POINTS.map((p, idx) => (
                <circle
                  key={`fn-${idx}`}
                  cx={p.x}
                  cy={p.fnY}
                  r={hoveredIdx === idx ? 8 : 5}
                  fill="#ef4444"
                  stroke="#ffffff"
                  strokeWidth={hoveredIdx === idx ? 3 : 1.5}
                  style={{ transition: 'all 0.2s ease', cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredIdx(idx)}
                />
              ))}
            </g>
          )}

          {/* Hover Target Hotspots */}
          {CONCEPT_DRIFT_POINTS.map((p, idx) => (
            <rect
              key={`hotspot-${idx}`}
              x={p.x - 30}
              y="20"
              width="60"
              height="190"
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredIdx(idx)}
            />
          ))}

          {/* X Axis Labels */}
          {CONCEPT_DRIFT_POINTS.map((p, idx) => (
            <text
              key={`x-${idx}`}
              x={p.x - 18}
              y="230"
              fill={hoveredIdx === idx ? 'var(--accent-light)' : 'var(--text-muted)'}
              fontSize="13"
              fontWeight={hoveredIdx === idx ? 'bold' : 'normal'}
              style={{ cursor: 'pointer' }}
              onClick={() => setHoveredIdx(idx)}
            >
              {p.date}
            </text>
          ))}
        </svg>

        {/* Dynamic Hover Tooltip Popover */}
        {activePoint && (
          <div
            style={{
              position: 'absolute',
              left: `${(activePoint.x / 800) * 100}%`,
              top: '25px',
              transform: 'translateX(-50%)',
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid var(--accent-light)',
              borderRadius: 8,
              padding: '8px 12px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
              zIndex: 10,
              minWidth: 160,
            }}
            className="animate-fade-in"
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>
              📅 {activePoint.date} DRIFT AUDIT
            </div>
            <div style={{ fontSize: '0.8125rem', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: '#ef4444' }}>FN Rate:</span>
              <strong style={{ color: activePoint.fn >= 3.0 ? '#ef4444' : '#ffffff' }}>{activePoint.fn}%</strong>
            </div>
            <div style={{ fontSize: '0.8125rem', display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 2 }}>
              <span style={{ color: '#f59e0b' }}>FP Rate:</span>
              <strong style={{ color: '#f59e0b' }}>{activePoint.fp}%</strong>
            </div>
            {activePoint.note && (
              <div style={{ fontSize: '0.6875rem', color: '#f87171', marginTop: 6, borderTop: '1px solid var(--border-subtle)', paddingTop: 4 }}>
                ⚠️ {activePoint.note}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// CONCEPT DRIFT MONITORING (Matching Reference Screenshot)
export function AdminConceptDriftPage() {
  const [retrainingTriggered, setRetrainingTriggered] = useState(false);
  const [isRetraining, setIsRetraining] = useState(false);

  const handleStartRetraining = () => {
    setIsRetraining(true);
    setTimeout(() => {
      setIsRetraining(false);
      setRetrainingTriggered(true);
    }, 2000);
  };

  return (
    <AdminShell title="Concept Drift Monitoring">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Top Graph Panel: Concept Drift Lines & Threshold Crossing Alert */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="panel-head">
            <div>
              <strong>CONCEPT DRIFT METRICS — APR 14 TO MAY 13</strong>
              <small>Hover over dates or toggle legend metrics to inspect drift divergence in detail</small>
            </div>
          </div>

          {/* FULLY INTERACTIVE SVG CONCEPT DRIFT CHART */}
          <InteractiveConceptDriftChart />

          {/* Alert Banner (Matching Reference Image) */}
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              padding: '12px 18px',
              borderRadius: 8,
              fontSize: '0.875rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span>⚠️</span>
            <span>FN Rate crossed the 3.0% threshold on May 10 and has continued rising over the last 4 days.</span>
          </div>
        </div>

        {/* Bottom Row Grid (Messages Not Matched + Retraining Recommendation) */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          {/* Messages Not Matched to Any Cluster */}
          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <strong style={{ fontSize: '1.125rem', color: 'var(--text-primary)', display: 'block' }}>
                Messages Not Matched to Any Cluster
              </strong>
              <small style={{ color: 'var(--text-secondary)' }}>Potential new smishing patterns outside current training data</small>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>MESSAGE PREVIEW</th>
                    <th>CONFIDENCE</th>
                    <th>CLASSIFICATION</th>
                    <th style={{ textAlign: 'right' }}>RECEIVED</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ maxWidth: 320 }}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        Your SSS benefits claim was denied. Verify identity at sss-ph-verify.net/claim
                      </span>
                    </td>
                    <td><code style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber-text)', fontWeight: 700 }}>61%</code></td>
                    <td><span className="badge badge-amber">Suspicious</span></td>
                    <td style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>May 14 08:12</td>
                  </tr>

                  <tr>
                    <td style={{ maxWidth: 320 }}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        Congrats! Maya wallet selected for loyalty bonus. Tap: maya-rewards.xyz
                      </span>
                    </td>
                    <td><code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>58%</code></td>
                    <td><span className="badge badge-purple">Unknown</span></td>
                    <td style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>May 14 07:44</td>
                  </tr>

                  <tr>
                    <td style={{ maxWidth: 320 }}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        BPI alert: New device logged into your account. Verify: bpi-secure-ph.com
                      </span>
                    </td>
                    <td><code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>54%</code></td>
                    <td><span className="badge badge-purple">Unknown</span></td>
                    <td style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>May 14 06:30</td>
                  </tr>

                  <tr>
                    <td style={{ maxWidth: 320 }}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        Your PhilHealth contribution is overdue. Update records: philhealth-ph.net
                      </span>
                    </td>
                    <td><code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>49%</code></td>
                    <td><span className="badge badge-purple">Unknown</span></td>
                    <td style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>May 14 05:18</td>
                  </tr>

                  <tr>
                    <td style={{ maxWidth: 320 }}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        Metrobank: Suspicious login detected. Secure account: mbank-verify.ph
                      </span>
                    </td>
                    <td><code style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber-text)', fontWeight: 700 }}>52%</code></td>
                    <td><span className="badge badge-amber">Suspicious</span></td>
                    <td style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>May 14 04:55</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Retraining Recommendation Box */}
          <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'space-between' }}>
            <div>
              <strong style={{ fontSize: '0.875rem', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'block', marginBottom: 12 }}>
                RETRAINING RECOMMENDATION
              </strong>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--green-text)' }}>
                  <span>✓</span>
                  <span><strong>312 new validated reports</strong> available</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--green-text)' }}>
                  <span>✓</span>
                  <span>FN rate above threshold for <strong>4 consecutive days</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--green-text)' }}>
                  <span>✓</span>
                  <span><strong>14 unclassified messages</strong> with no cluster match</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--amber-text)' }}>
                  <span>⚠️</span>
                  <span>Last retrain: <strong>5 days ago</strong> (within acceptable window)</span>
                </div>
              </div>

              {/* Recommendation Callout Notice */}
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid var(--red-border)',
                  color: 'var(--red-text)',
                  padding: 12,
                  borderRadius: 8,
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  marginTop: 16,
                  textAlign: 'center',
                }}
              >
                Based on current indicators, a retraining cycle is recommended.
              </div>
            </div>

            {/* Action Trigger Button */}
            <div>
              <Button
                variant="danger"
                size="md"
                style={{ width: '100%', height: 42, fontSize: '0.9375rem', fontWeight: 700 }}
                onClick={handleStartRetraining}
                disabled={isRetraining || retrainingTriggered}
              >
                {isRetraining ? '⏳ Initializing Pipeline...' : retrainingTriggered ? '✓ Retraining Scheduled' : '🔄 Trigger Model Retraining'}
              </Button>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', textAlign: 'center', marginTop: 8 }}>
                This will use 312 new validated samples. Estimated time: 45-60 minutes.
              </small>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

// DATASET MANAGEMENT PAGE (Matching User's Reference Screenshot)
interface DatasetSampleItem {
  id: string;
  language: string;
  classification: 'Confirmed Smishing' | 'Suspicious' | 'Unreviewed';
  campaign: string;
  source: 'Reported' | 'Auto-Blocked';
  addedBy: string;
  dateAdded: string;
  validatedBy: string;
  textPayload?: string;
}

const DATASET_SAMPLES: DatasetSampleItem[] = [
  {
    id: 'S-00421',
    language: 'Taglish',
    classification: 'Confirmed Smishing',
    campaign: 'Op. GCash Clone #17',
    source: 'Reported',
    addedBy: 'admin_gio',
    dateAdded: 'May 13',
    validatedBy: 'admin_gio',
    textPayload: 'GCash: Your account was flagged for unverified info. Update now at https://gcash-ph-support.net/login to prevent suspension.',
  },
  {
    id: 'S-00420',
    language: 'English',
    classification: 'Confirmed Smishing',
    campaign: 'LBC Parcel Scam #8',
    source: 'Auto-Blocked',
    addedBy: 'admin_gio',
    dateAdded: 'May 12',
    validatedBy: 'admin_gio',
    textPayload: 'URGENT: LBC parcel PH8812 is held at customs. Pay ₱250 release fee at http://lbc-express-delivery.top',
  },
  {
    id: 'S-00419',
    language: 'English',
    classification: 'Confirmed Smishing',
    campaign: 'BDO Fake Support #5',
    source: 'Reported',
    addedBy: 'admin_gio',
    dateAdded: 'May 11',
    validatedBy: 'admin_gio',
    textPayload: 'BDO Advisory: Security update required under new BSP rules. Verify account at http://bdo-online-sec.com',
  },
  {
    id: 'U-00103',
    language: 'Taglish',
    classification: 'Suspicious',
    campaign: '—',
    source: 'Reported',
    addedBy: 'System',
    dateAdded: 'May 11',
    validatedBy: '—',
    textPayload: 'Your SSS benefits claim was denied. Verify identity at sss-ph-verify.net/claim',
  },
  {
    id: 'U-00102',
    language: 'Filipino',
    classification: 'Unreviewed',
    campaign: '—',
    source: 'Auto-Blocked',
    addedBy: 'System',
    dateAdded: 'May 11',
    validatedBy: '—',
    textPayload: 'Congrats! Maya wallet selected for loyalty bonus. Tap: maya-rewards.xyz',
  },
  {
    id: 'S-00418',
    language: 'Tagalog',
    classification: 'Confirmed Smishing',
    campaign: 'Maya Loyalty Scam #12',
    source: 'Reported',
    addedBy: 'analyst_maria',
    dateAdded: 'May 10',
    validatedBy: 'admin_gio',
    textPayload: 'Maya Loyalty Reward: You have ₱5,000 pending cash reward! Claim now at http://maya-cash-bonus.online',
  },
  {
    id: 'S-00417',
    language: 'English',
    classification: 'Confirmed Smishing',
    campaign: 'PLDT Overdue #4',
    source: 'Auto-Blocked',
    addedBy: 'admin_gio',
    dateAdded: 'May 10',
    validatedBy: 'admin_gio',
    textPayload: 'Your PLDT bill of ₱1,899 is overdue. Pay now at http://pldt-billing-online.com to avoid disconnection within 24h.',
  },
];

export function AdminDatasetPage() {
  const [activeTab, setActiveTab] = useState<'All' | 'Confirmed Smishing' | 'Suspicious' | 'Unreviewed'>('All');
  const [search, setSearch] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedSample, setSelectedSample] = useState<DatasetSampleItem | null>(null);
  const [samplesList, setSamplesList] = useState<DatasetSampleItem[]>(DATASET_SAMPLES);
  const [currentPage, setCurrentPage] = useState(1);

  // Download export state
  const [exportFormat, setExportFormat] = useState<'CSV' | 'JSON'>('CSV');
  const [isExporting, setIsExporting] = useState(false);

  // Upload simulation state
  const [uploadText, setUploadText] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Filtered dataset logic
  const filteredSamples = samplesList.filter((item) => {
    const matchesTab = activeTab === 'All' || item.classification === activeTab;
    const matchesSearch =
      item.id.toLowerCase().includes(search.toLowerCase()) ||
      item.language.toLowerCase().includes(search.toLowerCase()) ||
      item.campaign.toLowerCase().includes(search.toLowerCase()) ||
      item.source.toLowerCase().includes(search.toLowerCase()) ||
      item.addedBy.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const confirmedCount = samplesList.filter((s) => s.classification === 'Confirmed Smishing').length;
  const suspiciousCount = samplesList.filter((s) => s.classification === 'Suspicious').length;
  const unreviewedCount = samplesList.filter((s) => s.classification === 'Unreviewed').length;

  const handleDownloadDataset = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setShowDownloadModal(false);
      alert(`Successfully exported dataset (${exportFormat} format) containing 12,190 records!`);
    }, 1200);
  };

  const handleUploadSamples = () => {
    if (!uploadText.trim()) {
      alert("Please paste dataset samples or choose a file first.");
      return;
    }
    setIsUploading(true);
    setTimeout(() => {
      const newSample: DatasetSampleItem = {
        id: `S-00${Math.floor(422 + Math.random() * 100)}`,
        language: 'Taglish',
        classification: 'Unreviewed',
        campaign: '—',
        source: 'Reported',
        addedBy: 'admin_gio',
        dateAdded: 'Just now',
        validatedBy: '—',
        textPayload: uploadText,
      };
      setSamplesList([newSample, ...samplesList]);
      setIsUploading(false);
      setUploadText('');
      setShowUploadModal(false);
      alert("Successfully ingested new samples into the training dataset!");
    }, 1500);
  };

  return (
    <AdminShell title="Dataset Management">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Top Actions Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="secondary" size="md" onClick={() => setShowDownloadModal(true)}>
              📥 Download Full Dataset
            </Button>
            <Button variant="primary" size="md" onClick={() => setShowUploadModal(true)}>
              📤 Upload New Samples
            </Button>
          </div>
        </div>

        {/* Data Source Notice Info Banner (Matching Reference Image) */}
        <div
          style={{
            background: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            color: '#60a5fa',
            padding: '14px 18px',
            borderRadius: 10,
            fontSize: '0.875rem',
            lineHeight: 1.5,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <span style={{ fontSize: '1.125rem' }}>ⓘ</span>
          <div>
            <strong>Data Source:</strong> This dataset contains only messages that were explicitly sent to the backend — either user-reported suspicious SMS or numbers automatically blocked by the system. Legitimate messages verified on the user's device are never transmitted to the backend and do not appear here.
          </div>
        </div>

        {/* Top 5 Stat Cards (Matching Reference Screenshot Row) */}
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="panel" style={{ padding: '16px 20px' }}>
            <strong style={{ fontSize: '1.75rem', color: 'var(--text-primary)', display: 'block' }}>12,190</strong>
            <small style={{ color: 'var(--text-muted)' }}>Total Samples</small>
          </div>

          <div className="panel" style={{ padding: '16px 20px' }}>
            <strong style={{ fontSize: '1.75rem', color: 'var(--red-text)', display: 'block' }}>8,940</strong>
            <small style={{ color: 'var(--text-muted)' }}>Confirmed Smishing</small>
          </div>

          <div className="panel" style={{ padding: '16px 20px' }}>
            <strong style={{ fontSize: '1.75rem', color: 'var(--amber-text)', display: 'block' }}>2,250</strong>
            <small style={{ color: 'var(--text-muted)' }}>Suspicious</small>
          </div>

          <div className="panel" style={{ padding: '16px 20px' }}>
            <strong style={{ fontSize: '1.75rem', color: 'var(--text-secondary)', display: 'block' }}>1,000</strong>
            <small style={{ color: 'var(--text-muted)' }}>Unreviewed</small>
          </div>

          <div className="panel" style={{ padding: '16px 20px' }}>
            <strong style={{ fontSize: '1.25rem', color: 'var(--accent-light)', display: 'block', marginTop: 4 }}>May 13, 2026</strong>
            <small style={{ color: 'var(--text-muted)' }}>Last Updated</small>
          </div>
        </div>

        {/* Dataset Composition Bar Panel (Matching Reference Image) */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <strong>DATASET COMPOSITION</strong>
              <small>Proportional distribution of 12,190 training samples</small>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            {/* Visual Multi-Color Progress Bar */}
            <div style={{ height: 24, width: '100%', borderRadius: 6, overflow: 'hidden', display: 'flex', fontSize: '0.75rem', fontWeight: 700, color: '#ffffff' }}>
              <div style={{ width: '73.3%', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Confirmed Smishing 73.3%
              </div>
              <div style={{ width: '18.5%', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
                Suspicious 18.5%
              </div>
              <div style={{ width: '8.2%', background: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Unreviewed 8.2%
              </div>
            </div>

            {/* Legend Labels */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 14, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, background: '#ef4444', borderRadius: 2 }} />
                <span>Confirmed Smishing — auto-blocked or validated via report review</span>
              </span>

              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, background: '#f59e0b', borderRadius: 2 }} />
                <span>Suspicious — user-reported, awaiting reviewer validation</span>
              </span>

              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, background: '#64748b', borderRadius: 2 }} />
                <span>Unreviewed — newly received, pending classification</span>
              </span>
            </div>
          </div>
        </div>

        {/* Filter Pills Row & Search Input (Matching Image Filter Buttons) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              className={`btn ${activeTab === 'All' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setActiveTab('All'); setCurrentPage(1); }}
              style={{ borderRadius: 20, padding: '6px 16px', fontSize: '0.8125rem' }}
            >
              All 12,190
            </button>
            <button
              className={`btn ${activeTab === 'Confirmed Smishing' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setActiveTab('Confirmed Smishing'); setCurrentPage(1); }}
              style={{ borderRadius: 20, padding: '6px 16px', fontSize: '0.8125rem' }}
            >
              Confirmed Smishing 8,940
            </button>
            <button
              className={`btn ${activeTab === 'Suspicious' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setActiveTab('Suspicious'); setCurrentPage(1); }}
              style={{ borderRadius: 20, padding: '6px 16px', fontSize: '0.8125rem' }}
            >
              Suspicious 2,250
            </button>
            <button
              className={`btn ${activeTab === 'Unreviewed' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setActiveTab('Unreviewed'); setCurrentPage(1); }}
              style={{ borderRadius: 20, padding: '6px 16px', fontSize: '0.8125rem' }}
            >
              Unreviewed 1,000
            </button>
          </div>

          <div style={{ position: 'relative', width: 260 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Filter samples..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', height: 36, paddingLeft: 32, fontSize: '0.8125rem' }}
            />
            <span style={{ position: 'absolute', left: 10, top: 8, color: 'var(--text-muted)' }}>🔍</span>
          </div>
        </div>

        {/* Detailed Dataset Table */}
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SAMPLE ID</th>
                  <th>LANGUAGE</th>
                  <th>CLASSIFICATION</th>
                  <th>CAMPAIGN</th>
                  <th>SOURCE</th>
                  <th>ADDED BY</th>
                  <th>DATE ADDED</th>
                  <th>VALIDATED BY</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredSamples.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <code style={{ color: 'var(--accent-light)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        {item.id}
                      </code>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>{item.language}</span>
                    </td>
                    <td>
                      {item.classification === 'Confirmed Smishing' ? (
                        <span className="badge badge-red">Confirmed Smishing</span>
                      ) : item.classification === 'Suspicious' ? (
                        <span className="badge badge-amber">Suspicious</span>
                      ) : (
                        <span className="badge badge-gray">Unreviewed</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>{item.campaign}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{item.source}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{item.addedBy}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.dateAdded}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{item.validatedBy}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedSample(item)}>
                        View Payload →
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer Pagination Bar */}
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
              background: 'var(--bg-surface-elevated)',
            }}
          >
            <span>Showing 1–{filteredSamples.length} of 12,190 results</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn btn-ghost"
                style={{ padding: '4px 8px', height: 28, fontSize: '0.75rem' }}
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              >
                ‹
              </button>
              <button
                className={`btn ${currentPage === 1 ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', height: 28, fontSize: '0.75rem' }}
                onClick={() => setCurrentPage(1)}
              >
                1
              </button>
              <button
                className={`btn ${currentPage === 2 ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', height: 28, fontSize: '0.75rem' }}
                onClick={() => setCurrentPage(2)}
              >
                2
              </button>
              <button
                className={`btn ${currentPage === 3 ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', height: 28, fontSize: '0.75rem' }}
                onClick={() => setCurrentPage(3)}
              >
                3
              </button>
              <span style={{ padding: '4px 6px' }}>...</span>
              <button
                className={`btn ${currentPage === 1219 ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', height: 28, fontSize: '0.75rem' }}
                onClick={() => setCurrentPage(1219)}
              >
                1219
              </button>
              <button
                className="btn btn-ghost"
                style={{ padding: '4px 8px', height: 28, fontSize: '0.75rem' }}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal 1: Download Full Dataset Modal */}
      <Modal
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        title="Download Dataset Export"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: '0.875rem' }}>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Choose format to export all 12,190 training samples (includes SMS text payloads, labels, and telemetry metadata).
          </p>

          <div style={{ display: 'flex', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="radio"
                name="exportFmt"
                checked={exportFormat === 'CSV'}
                onChange={() => setExportFormat('CSV')}
              />
              <strong>CSV Spreadsheet Format</strong>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="radio"
                name="exportFmt"
                checked={exportFormat === 'JSON'}
                onChange={() => setExportFormat('JSON')}
              />
              <strong>JSON Lines (JSONL)</strong>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
            <Button variant="ghost" size="md" onClick={() => setShowDownloadModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={handleDownloadDataset} disabled={isExporting}>
              {isExporting ? '⏳ Exporting...' : '📥 Start Download'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal 2: Upload New Samples Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload New Training Samples"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: '0.875rem' }}>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Paste raw text messages or upload a JSON/CSV file containing user-reported smishing payloads to ingest into the BantAI pipeline.
          </p>

          <textarea
            className="form-input"
            rows={5}
            placeholder="Paste suspicious text samples here (one per line)..."
            value={uploadText}
            onChange={(e) => setUploadText(e.target.value)}
            style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}
          />

          <div style={{ border: '2px dashed var(--border-default)', padding: 20, textAlign: 'center', borderRadius: 8, color: 'var(--text-muted)' }}>
            📄 Or drag & drop <strong>.csv</strong> or <strong>.json</strong> files here
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <Button variant="ghost" size="md" onClick={() => setShowUploadModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={handleUploadSamples} disabled={isUploading}>
              {isUploading ? '⏳ Ingesting...' : '📤 Ingest Samples'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal 3: View Sample Payload Modal */}
      {selectedSample && (
        <Modal
          isOpen={Boolean(selectedSample)}
          onClose={() => setSelectedSample(null)}
          title={`Sample ${selectedSample.id} Payload Details`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8 }}>
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Classification</small>
                <span className={`badge ${selectedSample.classification === 'Confirmed Smishing' ? 'badge-red' : selectedSample.classification === 'Suspicious' ? 'badge-amber' : 'badge-gray'}`}>
                  {selectedSample.classification}
                </span>
              </div>
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Language</small>
                <strong>{selectedSample.language}</strong>
              </div>
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Source</small>
                <strong>{selectedSample.source}</strong>
              </div>
            </div>

            <div>
              <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Raw SMS Text Payload</small>
              <div
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-default)',
                  padding: 14,
                  borderRadius: 8,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8125rem',
                  color: 'var(--text-primary)',
                  lineHeight: 1.5,
                }}
              >
                "{selectedSample.textPayload || 'No text preview available'}"
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8 }}>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Campaign Cluster</small>
                <strong>{selectedSample.campaign}</strong>
              </div>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8 }}>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Validated By</small>
                <strong>{selectedSample.validatedBy}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
              <Button variant="ghost" size="md" onClick={() => setSelectedSample(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </AdminShell>
  );
}

// DETAILED CLASSIFICATION LOG PAGE (Matching Reference Screenshot)
interface ClassificationLogItem {
  id: string;
  device: string;
  sender: string;
  lang: string;
  preview: string;
  classification: 'Smishing' | 'Suspicious' | 'FP' | 'FN' | 'Safe';
  confidence: string;
  campaign: string;
  flag: string;
  reviewer: string;
  timestamp: string;
  fullMessage?: string;
}

const CLASSIFICATION_LOG_ITEMS: ClassificationLogItem[] = [
  // May 13 Logs
  {
    id: '#LOG-4821',
    device: 'device_7f3a',
    sender: '+63 908 000 1234',
    lang: 'Taglish',
    preview: 'Your GCash account has been flagged...',
    classification: 'Smishing',
    confidence: '94%',
    campaign: 'Op. GCash Clone #17',
    flag: '—',
    reviewer: 'admin_gio',
    timestamp: 'May 13 09:01',
    fullMessage: 'Your GCash account has been flagged due to unverified details. Update now at https://gcash-ph-support.net/login to prevent permanent suspension.',
  },
  {
    id: '#LOG-4820',
    device: 'device_3b21',
    sender: '+63 917 231 5500',
    lang: 'Taglish',
    preview: "You've been selected for a ₱5,000 reward...",
    classification: 'Smishing',
    confidence: '91%',
    campaign: 'Op. GCash Clone #17',
    flag: '—',
    reviewer: '—',
    timestamp: 'May 13 08:47',
    fullMessage: 'Congratulations! You have been selected for a ₱5,000 GCash reward. Claim your bonus immediately at http://claim-gcash-promo.site',
  },
  {
    id: '#LOG-4819',
    device: 'device_c99a',
    sender: '+63 2 8631 8000',
    lang: 'English',
    preview: 'You have a pending transaction of ₱12,500...',
    classification: 'Suspicious',
    confidence: '68%',
    campaign: 'BDO Fake Support #5',
    flag: '—',
    reviewer: '—',
    timestamp: 'May 13 08:33',
    fullMessage: 'BDO Alert: You have a pending transaction of ₱12,500 on your Online Banking. If you did not authorize this, log in at http://bdo-online-sec.com to cancel.',
  },
  {
    id: '#LOG-4818',
    device: 'device_4d11',
    sender: '+63 919 100 4567',
    lang: 'Filipino',
    preview: 'Ang inyong BDO account ay...',
    classification: 'Smishing',
    confidence: '89%',
    campaign: 'BDO Fake Support #5',
    flag: '—',
    reviewer: '—',
    timestamp: 'May 13 08:20',
    fullMessage: 'Ang inyong BDO account ay nangangailangan ng panibagong verification ayon sa bagong BSP mandate. I-verify sa http://bdo-online-sec.com',
  },
  {
    id: '#LOG-4817',
    device: 'device_8e44',
    sender: '+63 927 888 3210',
    lang: 'English',
    preview: 'URGENT: Your LBC parcel is held...',
    classification: 'Smishing',
    confidence: '96%',
    campaign: 'LBC Parcel Scam #8',
    flag: '—',
    reviewer: '—',
    timestamp: 'May 13 07:58',
    fullMessage: 'URGENT: LBC parcel PH8812 is held at customs. Pay ₱250 release fee now at http://lbc-express-delivery.top to initiate delivery.',
  },
  {
    id: '#LOG-4816',
    device: 'device_2f77',
    sender: 'PLDT Home',
    lang: 'English',
    preview: 'Your PLDT bill payment is due...',
    classification: 'FP',
    confidence: '71%',
    campaign: '—',
    flag: 'FP',
    reviewer: 'admin_gio',
    timestamp: 'May 13 07:40',
    fullMessage: 'PLDT Home Advisory: Your monthly bill of ₱1,899 is due tomorrow. Pay via PLDT Home app or MyHome portal to avoid penalties.',
  },
  {
    id: '#LOG-4815',
    device: 'device_9a02',
    sender: 'GCash',
    lang: 'English',
    preview: 'You have successfully loaded ₱100...',
    classification: 'FP',
    confidence: '55%',
    campaign: '—',
    flag: 'FP',
    reviewer: 'admin_gio',
    timestamp: 'May 13 06:10',
    fullMessage: 'You have successfully loaded ₱100.00 Regular Load to 09171234567. Reference No. 900123847.',
  },

  // May 12 Logs
  {
    id: '#LOG-4814',
    device: 'device_1a4e',
    sender: '+63 918 444 8811',
    lang: 'Tagalog',
    preview: 'MAYA: Bonus reward is waiting for claim...',
    classification: 'Smishing',
    confidence: '95%',
    campaign: 'Maya Loyalty Scam #12',
    flag: '—',
    reviewer: 'analyst_maria',
    timestamp: 'May 12 18:22',
    fullMessage: 'MAYA ADVISORY: You have a ₱3,000 cashback pending. Tap http://maya-cash-bonus.online to claim before 12 AM.',
  },
  {
    id: '#LOG-4813',
    device: 'device_5b00',
    sender: '+63 905 111 2233',
    lang: 'English',
    preview: 'Shopee: Order #SHP991 requires address check...',
    classification: 'Smishing',
    confidence: '92%',
    campaign: 'Shopee Prize Lure #11',
    flag: '—',
    reviewer: 'admin_gio',
    timestamp: 'May 12 14:15',
    fullMessage: 'Shopee Alert: Parcel cannot be delivered due to incomplete address. Update now: http://shopee-voucher-claim.site',
  },

  // May 11 Logs
  {
    id: '#LOG-4812',
    device: 'device_8f99',
    sender: '+63 920 999 0011',
    lang: 'Taglish',
    preview: 'SSS notice: Your pension verification failed...',
    classification: 'Suspicious',
    confidence: '61%',
    campaign: '—',
    flag: '—',
    reviewer: '—',
    timestamp: 'May 11 11:05',
    fullMessage: 'Your SSS benefits claim was denied. Verify identity at sss-ph-verify.net/claim',
  },
];

const AVAILABLE_DATES = [
  'May 13, 2026',
  'May 12, 2026',
  'May 11, 2026',
  'May 10, 2026',
  'All Dates',
];

export function AdminClassificationPage() {
  const [selectedDate, setSelectedDate] = useState<string>('May 13, 2026');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'All' | 'Likely Smishing' | 'Suspicious' | 'Unknown' | 'False Positive' | 'False Negative'>('All');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<ClassificationLogItem | null>(null);
  const [logsList, setLogsList] = useState<ClassificationLogItem[]>(CLASSIFICATION_LOG_ITEMS);
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  // Filter logic matching date selector + pill buttons + search query
  const filteredLogs = logsList.filter((item) => {
    // 1. Date Filter
    let matchesDate = true;
    if (selectedDate !== 'All Dates') {
      // e.g. "May 13, 2026" matches "May 13 09:01"
      const datePrefix = selectedDate.replace(', 2026', ''); // "May 13"
      matchesDate = item.timestamp.includes(datePrefix);
    }

    // 2. Classification Filter
    let matchesFilter = true;
    if (activeFilter === 'Likely Smishing') matchesFilter = item.classification === 'Smishing';
    else if (activeFilter === 'Suspicious') matchesFilter = item.classification === 'Suspicious';
    else if (activeFilter === 'False Positive') matchesFilter = item.classification === 'FP';
    else if (activeFilter === 'False Negative') matchesFilter = item.classification === 'FN';

    // 3. Search Filter
    const matchesSearch =
      item.id.toLowerCase().includes(search.toLowerCase()) ||
      item.sender.toLowerCase().includes(search.toLowerCase()) ||
      item.preview.toLowerCase().includes(search.toLowerCase()) ||
      item.campaign.toLowerCase().includes(search.toLowerCase()) ||
      item.device.toLowerCase().includes(search.toLowerCase());

    return matchesDate && matchesFilter && matchesSearch;
  });

  const handleExportCSV = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      alert(`Successfully exported ${filteredLogs.length} classification logs for date [${selectedDate}] to CSV!`);
    }, 1200);
  };

  const handleFlagAsFP = (logId: string) => {
    setLogsList((prev) =>
      prev.map((item) =>
        item.id === logId
          ? { ...item, classification: 'FP', flag: 'FP', reviewer: 'admin_gio' }
          : item
      )
    );
    setSelectedLog(null);
    alert(`Log ${logId} updated: Flagged as False Positive.`);
  };

  return (
    <AdminShell title="Full Classification Log">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Top Controls Header with Date Picker, Search & Export Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* CLICKABLE INTERACTIVE DATE SELECTOR DROPDOWN */}
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-ghost"
                onClick={() => setShowDatePicker(!showDatePicker)}
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--accent-light)',
                  color: 'var(--accent-light)',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                <span>📅</span>
                <span>{selectedDate}</span>
                <span style={{ fontSize: '0.7rem' }}>▼</span>
              </button>

              {showDatePicker && (
                <div
                  style={{
                    position: 'absolute',
                    top: '110%',
                    right: 0,
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 10,
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    zIndex: 20,
                    minWidth: 180,
                    padding: 6,
                  }}
                  className="animate-fade-in"
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '6px 10px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 700 }}>
                    SELECT LOG DATE
                  </div>
                  {AVAILABLE_DATES.map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        setSelectedDate(d);
                        setShowDatePicker(false);
                        setCurrentPage(1);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 12px',
                        background: selectedDate === d ? 'rgba(124, 58, 237, 0.2)' : 'transparent',
                        color: selectedDate === d ? 'var(--accent-light)' : 'var(--text-primary)',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: '0.8125rem',
                        fontWeight: selectedDate === d ? 700 : 400,
                      }}
                    >
                      {selectedDate === d ? `✓ ${d}` : d}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ position: 'relative', width: 220 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search sender..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%', height: 36, paddingLeft: 32, fontSize: '0.8125rem' }}
              />
              <span style={{ position: 'absolute', left: 10, top: 8, color: 'var(--text-muted)', fontSize: '0.875rem' }}>🔍</span>
            </div>

            <Button variant="secondary" size="md" onClick={handleExportCSV} disabled={isExporting}>
              {isExporting ? '⏳ Exporting...' : '📥 Export CSV'}
            </Button>
          </div>
        </div>

        {/* Filter Pills Row (Matching Reference Screenshot) */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className={`btn ${activeFilter === 'All' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setActiveFilter('All'); setCurrentPage(1); }}
            style={{ borderRadius: 20, padding: '6px 16px', fontSize: '0.8125rem' }}
          >
            All 14,892
          </button>
          <button
            className={`btn ${activeFilter === 'Likely Smishing' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setActiveFilter('Likely Smishing'); setCurrentPage(1); }}
            style={{ borderRadius: 20, padding: '6px 16px', fontSize: '0.8125rem' }}
          >
            Likely Smishing 1,247
          </button>
          <button
            className={`btn ${activeFilter === 'Suspicious' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setActiveFilter('Suspicious'); setCurrentPage(1); }}
            style={{ borderRadius: 20, padding: '6px 16px', fontSize: '0.8125rem' }}
          >
            Suspicious 389
          </button>
          <button
            className={`btn ${activeFilter === 'Unknown' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setActiveFilter('Unknown'); setCurrentPage(1); }}
            style={{ borderRadius: 20, padding: '6px 16px', fontSize: '0.8125rem' }}
          >
            Unknown 13,256
          </button>
          <button
            className={`btn ${activeFilter === 'False Positive' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setActiveFilter('False Positive'); setCurrentPage(1); }}
            style={{ borderRadius: 20, padding: '6px 16px', fontSize: '0.8125rem' }}
          >
            False Positive 28
          </button>
          <button
            className={`btn ${activeFilter === 'False Negative' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setActiveFilter('False Negative'); setCurrentPage(1); }}
            style={{ borderRadius: 20, padding: '6px 16px', fontSize: '0.8125rem' }}
          >
            False Negative 14
          </button>
        </div>

        {/* Classification Table */}
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>LOG ID</th>
                  <th>DEVICE</th>
                  <th>SENDER</th>
                  <th>LANG</th>
                  <th>PREVIEW</th>
                  <th>CLASSIFICATION</th>
                  <th>CONFIDENCE</th>
                  <th>CAMPAIGN</th>
                  <th>FLAG</th>
                  <th>REVIEWER</th>
                  <th>TIMESTAMP</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <code style={{ color: 'var(--accent-light)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                          {item.id}
                        </code>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{item.device}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.sender}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{item.lang}</span>
                      </td>
                      <td style={{ maxWidth: 260 }}>
                        <span
                          style={{
                            fontSize: '0.8125rem',
                            color: 'var(--text-secondary)',
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                          title={item.preview}
                        >
                          {item.preview}
                        </span>
                      </td>
                      <td>
                        {item.classification === 'Smishing' ? (
                          <span className="badge badge-red">Smishing</span>
                        ) : item.classification === 'Suspicious' ? (
                          <span className="badge badge-amber">Suspicious</span>
                        ) : item.classification === 'FP' ? (
                          <span className="badge badge-amber" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', border: '1px solid #f59e0b' }}>FP</span>
                        ) : (
                          <span className="badge badge-gray">{item.classification}</span>
                        )}
                      </td>
                      <td>
                        <strong style={{ fontSize: '0.875rem', color: 'var(--accent-light)', fontFamily: 'var(--font-mono)' }}>
                          {item.confidence}
                        </strong>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>{item.campaign}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{item.flag}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{item.reviewer}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.timestamp}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedLog(item)}>
                          Inspect →
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      No classification logs found for selected date [{selectedDate}].
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer Pagination Bar */}
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
              background: 'var(--bg-surface-elevated)',
            }}
          >
            <span>Showing 1–{filteredLogs.length} of {selectedDate === 'All Dates' ? '14,892' : filteredLogs.length} results for date: <strong style={{ color: 'var(--accent-light)' }}>{selectedDate}</strong></span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn btn-ghost"
                style={{ padding: '4px 8px', height: 28, fontSize: '0.75rem' }}
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              >
                ‹
              </button>
              <button
                className={`btn ${currentPage === 1 ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', height: 28, fontSize: '0.75rem' }}
                onClick={() => setCurrentPage(1)}
              >
                1
              </button>
              <button
                className={`btn ${currentPage === 2 ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', height: 28, fontSize: '0.75rem' }}
                onClick={() => setCurrentPage(2)}
              >
                2
              </button>
              <button
                className={`btn ${currentPage === 3 ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', height: 28, fontSize: '0.75rem' }}
                onClick={() => setCurrentPage(3)}
              >
                3
              </button>
              <span style={{ padding: '4px 6px' }}>...</span>
              <button
                className={`btn ${currentPage === 1490 ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', height: 28, fontSize: '0.75rem' }}
                onClick={() => setCurrentPage(1490)}
              >
                1490
              </button>
              <button
                className="btn btn-ghost"
                style={{ padding: '4px 8px', height: 28, fontSize: '0.75rem' }}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Inspect Log Entry Modal */}
      {selectedLog && (
        <Modal
          isOpen={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          title={`Inspect Log Entry ${selectedLog.id}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8 }}>
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Sender</small>
                <strong>{selectedLog.sender}</strong>
              </div>
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Device ID</small>
                <code style={{ fontFamily: 'var(--font-mono)' }}>{selectedLog.device}</code>
              </div>
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Confidence</small>
                <strong style={{ color: 'var(--accent-light)', fontSize: '1.125rem' }}>{selectedLog.confidence}</strong>
              </div>
            </div>

            <div>
              <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Full Message Text Payload</small>
              <div
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 8,
                  padding: 14,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8125rem',
                  lineHeight: 1.5,
                }}
              >
                "{selectedLog.fullMessage || selectedLog.preview}"
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8 }}>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Campaign Cluster</small>
                <strong>{selectedLog.campaign}</strong>
              </div>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8 }}>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Reviewed By</small>
                <strong>{selectedLog.reviewer}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 14, marginTop: 4 }}>
              <Button variant="ghost" size="md" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
              <Button variant="secondary" size="md" onClick={() => handleFlagAsFP(selectedLog.id)}>
                Flag as False Positive (FP)
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </AdminShell>
  );
}

// FP / FN REVIEW WORKBENCH PAGE (Matching User's Reference Screenshot - Maximized Space)
interface FpFnCaseItem {
  id: string;
  sender: string;
  preview: string;
  classification: 'Smishing' | 'Suspicious' | 'Safe' | 'Legitimate';
  confidence: string;
  reportedBy: string;
  date: string;
  status: 'Pending' | 'Resolved';
  type: 'FP' | 'FN';
  fullMessage?: string;
}

const FPFN_CASES: FpFnCaseItem[] = [
  // False Positive Cases (FP)
  {
    id: 'FP-041',
    sender: 'PLDT Home',
    preview: '"Your GoSURF50 promo is about to expire. Renew now to continue browsing."',
    classification: 'Smishing',
    confidence: '71%',
    reportedBy: 'user_3421',
    date: 'May 12',
    status: 'Pending',
    type: 'FP',
    fullMessage: 'Your GoSURF50 promo is about to expire. Renew now to continue browsing.',
  },
  {
    id: 'FP-040',
    sender: 'GCash',
    preview: '"You have successfully sent ₱100 to Juan dela Cruz."',
    classification: 'Smishing',
    confidence: '55%',
    reportedBy: 'user_7891',
    date: 'May 11',
    status: 'Pending',
    type: 'FP',
    fullMessage: 'You have successfully sent ₱100 to Juan dela Cruz. Ref No. 900123441.',
  },
  {
    id: 'FP-039',
    sender: 'BPI Direct',
    preview: '"Your BPI savings account statement is now available."',
    classification: 'Suspicious',
    confidence: '62%',
    reportedBy: 'user_2201',
    date: 'May 10',
    status: 'Resolved',
    type: 'FP',
    fullMessage: 'Your BPI savings account statement for April 2026 is now available via BPI Online.',
  },

  // False Negative Cases (FN)
  {
    id: 'FN-014',
    sender: '+63 908 111 2233',
    preview: '"GCash: Account flagged due to unusual activity. Login to gcash-sec.ph"',
    classification: 'Safe',
    confidence: '45%',
    reportedBy: 'user_9912',
    date: 'May 12',
    status: 'Pending',
    type: 'FN',
    fullMessage: 'GCash: Account flagged due to unusual activity. Login to gcash-sec.ph to verify.',
  },
  {
    id: 'FN-013',
    sender: '+63 917 555 4433',
    preview: '"PLDT Notice: Your account is disconnected. Pay ₱1,500 at pldt-pay.site"',
    classification: 'Safe',
    confidence: '48%',
    reportedBy: 'user_1029',
    date: 'May 11',
    status: 'Pending',
    type: 'FN',
    fullMessage: 'PLDT Notice: Your account is disconnected. Pay ₱1,500 at http://pldt-pay.site within 2 hours.',
  },
  {
    id: 'FN-012',
    sender: '+63 920 888 7766',
    preview: '"BDO: Account suspended. Verify now at bdo-sec-login.top"',
    classification: 'Safe',
    confidence: '42%',
    reportedBy: 'user_5431',
    date: 'May 10',
    status: 'Resolved',
    type: 'FN',
    fullMessage: 'BDO Advisory: Account suspended. Verify now at http://bdo-sec-login.top to avoid closure.',
  },
];

export function AdminFpFnPage() {
  const [activeTab, setActiveTab] = useState<'FP' | 'FN'>('FP');
  const [casesList, setCasesList] = useState<FpFnCaseItem[]>(FPFN_CASES);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('FP-041');
  const [resolutionAction, setResolutionAction] = useState<'Confirm' | 'Override' | 'Escalate'>('Confirm');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openFpCount = casesList.filter((c) => c.type === 'FP' && c.status === 'Pending').length + 26; // Total 28
  const openFnCount = casesList.filter((c) => c.type === 'FN' && c.status === 'Pending').length + 12; // Total 14
  const resolvedTodayCount = casesList.filter((c) => c.status === 'Resolved').length + 5; // Total 7

  const currentTabCases = casesList.filter((c) => c.type === activeTab);
  const selectedCase = casesList.find((c) => c.id === selectedCaseId) || currentTabCases[0];

  const handleSubmitResolution = () => {
    if (!selectedCase) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setCasesList((prev) =>
        prev.map((c) => (c.id === selectedCase.id ? { ...c, status: 'Resolved' } : c))
      );
      setIsSubmitting(false);
      alert(`Resolution submitted for case [${selectedCase.id}]: Action marked as ${resolutionAction}. Case resolved.`);
    }, 1000);
  };

  return (
    <AdminShell title="FP / FN Review">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Visually Appealing Stat Cards Grid */}
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          <div className="stat-card" style={{ background: 'var(--bg-card)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <small style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Open FP Cases</small>
              <span className="badge badge-amber" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>⚠️ Over-Blocked</span>
            </div>
            <strong style={{ color: 'var(--amber-text)', fontSize: '2.25rem', fontWeight: 800, margin: '6px 0 2px 0', display: 'block' }}>{openFpCount}</strong>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Clean messages misflagged</span>
          </div>

          <div className="stat-card" style={{ background: 'var(--bg-card)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <small style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Open FN Cases</small>
              <span className="badge badge-red" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>🚨 Missed Threats</span>
            </div>
            <strong style={{ color: 'var(--red-text)', fontSize: '2.25rem', fontWeight: 800, margin: '6px 0 2px 0', display: 'block' }}>{openFnCount}</strong>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Smishing passed to users</span>
          </div>

          <div className="stat-card" style={{ background: 'var(--bg-card)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <small style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Resolved Today</small>
              <span className="badge badge-green" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>✓ Reviewed</span>
            </div>
            <strong style={{ color: 'var(--green-text)', fontSize: '2.25rem', fontWeight: 800, margin: '6px 0 2px 0', display: 'block' }}>{resolvedTodayCount}</strong>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Audit cases cleared today</span>
          </div>
        </div>

        {/* Filter Pills Row */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className={`btn ${activeTab === 'FP' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              setActiveTab('FP');
              setSelectedCaseId('FP-041');
            }}
            style={{ borderRadius: 20, padding: '6px 18px', fontSize: '0.8125rem' }}
          >
            False Positives 28
          </button>
          <button
            className={`btn ${activeTab === 'FN' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              setActiveTab('FN');
              setSelectedCaseId('FN-014');
            }}
            style={{ borderRadius: 20, padding: '6px 18px', fontSize: '0.8125rem' }}
          >
            False Negatives 14
          </button>
        </div>

        {/* Category Description Banner (Matching Reference Screenshot) */}
        <div
          style={{
            background: activeTab === 'FP' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: activeTab === 'FP' ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
            color: activeTab === 'FP' ? '#60a5fa' : '#f87171',
            padding: '12px 18px',
            borderRadius: 8,
            fontSize: '0.875rem',
            lineHeight: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontWeight: 500,
          }}
        >
          <span>{activeTab === 'FP' ? '🟦' : '🔴'}</span>
          <span>
            {activeTab === 'FP'
              ? 'False Positives are legitimate messages incorrectly flagged as smishing. Resolving these prevents good messages from entering the smishing training set.'
              : 'False Negatives are actual smishing messages missed by the system or classified as safe. Resolving these adds new smishing patterns to the training pipeline.'}
          </span>
        </div>

        {/* FP / FN Cases Table */}
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>SENDER</th>
                  <th>MESSAGE PREVIEW</th>
                  <th>CLASSIFICATION</th>
                  <th>CONFIDENCE</th>
                  <th>REPORTED BY</th>
                  <th>DATE</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {currentTabCases.map((item) => (
                  <tr
                    key={item.id}
                    style={{
                      background: selectedCaseId === item.id ? 'rgba(124, 58, 237, 0.12)' : 'transparent',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedCaseId(item.id)}
                  >
                    <td>
                      <code style={{ color: 'var(--accent-light)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        {item.id}
                      </code>
                    </td>
                    <td>
                      <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{item.sender}</strong>
                    </td>
                    <td style={{ maxWidth: 360 }}>
                      <span
                        style={{
                          fontSize: '0.8125rem',
                          color: 'var(--text-secondary)',
                          display: '-webkit-box',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {item.preview}
                      </span>
                    </td>
                    <td>
                      {item.classification === 'Smishing' ? (
                        <span className="badge badge-red">Smishing</span>
                      ) : item.classification === 'Suspicious' ? (
                        <span className="badge badge-amber">Suspicious</span>
                      ) : (
                        <span className="badge badge-green">Safe</span>
                      )}
                    </td>
                    <td>
                      <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                        {item.confidence}
                      </strong>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{item.reportedBy}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.date}</span>
                    </td>
                    <td>
                      {item.status === 'Pending' ? (
                        <span className="badge badge-amber">Pending</span>
                      ) : (
                        <span className="badge badge-green">Resolved</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Button
                        variant={item.id === selectedCaseId ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCaseId(item.id);
                        }}
                      >
                        {item.status === 'Pending' ? 'Review →' : 'View →'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* MAXIMIZED SPACE WORKBENCH REVIEW PANEL */}
        {selectedCase && (
          <div
            className="panel animate-fade-in"
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--accent-light)',
              padding: '24px 28px',
              borderRadius: 12,
              boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: 12,
              }}
            >
              <div style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>📋 REVIEW PANEL —</span>
                <code style={{ fontSize: '1rem', color: 'var(--accent-light)', fontFamily: 'var(--font-mono)' }}>
                  {selectedCase.id}
                </code>
                <span className={`badge ${selectedCase.status === 'Pending' ? 'badge-amber' : 'badge-green'}`}>
                  {selectedCase.status}
                </span>
              </div>

              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Reported by <strong style={{ color: 'var(--text-primary)' }}>{selectedCase.reportedBy}</strong> on {selectedCase.date}
              </div>
            </div>

            {/* MAXIMIZED TWO-COLUMN EQUAL GRID (1fr 1fr) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
              {/* Left Column: Message Text & High-Density Stat Strip */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'block', marginBottom: 8 }}>
                    Message Text Payload
                  </label>
                  <div
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-default)',
                      padding: '18px 20px',
                      borderRadius: 10,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.9375rem',
                      lineHeight: 1.6,
                      minHeight: 110,
                    }}
                  >
                    "{selectedCase.fullMessage || selectedCase.preview}"
                  </div>
                </div>

                {/* High-Density Stat Cards Strip */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 12,
                    background: 'var(--bg-input)',
                    padding: 14,
                    borderRadius: 10,
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div>
                    <small style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Sender Header</small>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.9375rem' }}>{selectedCase.sender}</strong>
                  </div>

                  <div>
                    <small style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Model Prediction</small>
                    <span className={`badge ${selectedCase.classification === 'Smishing' ? 'badge-red' : selectedCase.classification === 'Suspicious' ? 'badge-amber' : 'badge-green'}`} style={{ marginTop: 2 }}>
                      {selectedCase.classification}
                    </span>
                  </div>

                  <div>
                    <small style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Confidence Score</small>
                    <strong style={{ color: 'var(--amber-text)', fontFamily: 'var(--font-mono)', fontSize: '1rem' }}>{selectedCase.confidence}</strong>
                  </div>
                </div>
              </div>

              {/* Right Column: Resolution Action Choices & Submit Button */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <label style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 700, display: 'block' }}>
                  Select Analyst Resolution Action
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      cursor: 'pointer',
                      background: resolutionAction === 'Confirm' ? 'rgba(124, 58, 237, 0.18)' : 'var(--bg-input)',
                      padding: '12px 16px',
                      borderRadius: 10,
                      border: resolutionAction === 'Confirm' ? '1px solid var(--accent-light)' : '1px solid var(--border-subtle)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="resolution"
                      checked={resolutionAction === 'Confirm'}
                      onChange={() => setResolutionAction('Confirm')}
                      style={{ marginTop: 4, accentColor: 'var(--accent-light)' }}
                    />
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        {activeTab === 'FP' ? 'Confirm False Positive' : 'Confirm False Negative'}
                      </strong>
                      <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        {activeTab === 'FP'
                          ? 'Reclassify as Legitimate, exclude from smishing set'
                          : 'Reclassify as Smishing, add to training dataset'}
                      </small>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      cursor: 'pointer',
                      background: resolutionAction === 'Override' ? 'rgba(124, 58, 237, 0.18)' : 'var(--bg-input)',
                      padding: '12px 16px',
                      borderRadius: 10,
                      border: resolutionAction === 'Override' ? '1px solid var(--accent-light)' : '1px solid var(--border-subtle)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="resolution"
                      checked={resolutionAction === 'Override'}
                      onChange={() => setResolutionAction('Override')}
                      style={{ marginTop: 4, accentColor: 'var(--accent-light)' }}
                    />
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        Override — System Was Correct
                      </strong>
                      <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        Dismiss report, keep classification as-is
                      </small>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      cursor: 'pointer',
                      background: resolutionAction === 'Escalate' ? 'rgba(124, 58, 237, 0.18)' : 'var(--bg-input)',
                      padding: '12px 16px',
                      borderRadius: 10,
                      border: resolutionAction === 'Escalate' ? '1px solid var(--accent-light)' : '1px solid var(--border-subtle)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="resolution"
                      checked={resolutionAction === 'Escalate'}
                      onChange={() => setResolutionAction('Escalate')}
                      style={{ marginTop: 4, accentColor: 'var(--accent-light)' }}
                    />
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        Escalate for Senior Review
                      </strong>
                      <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        Uncertain — pass to senior reviewer
                      </small>
                    </div>
                  </label>
                </div>

                <Button
                  variant="primary"
                  size="md"
                  onClick={handleSubmitResolution}
                  disabled={isSubmitting || selectedCase.status === 'Resolved'}
                  style={{ width: '100%', height: 42, fontSize: '0.9375rem', fontWeight: 700 }}
                >
                  {isSubmitting ? '⏳ Submitting Resolution...' : selectedCase.status === 'Resolved' ? '✓ Resolution Submitted' : 'Submit Resolution'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

// CAMPAIGN MANAGEMENT PAGE (Matching User's Reference Screenshot)
interface CampaignClusterItem {
  id: string;
  title: string;
  messages: number;
  domainsCount: number;
  domainsList: string[];
  since: string;
  status: 'Active' | 'Inactive';
  tags: string[];
  samplePayload?: string;
}

const INITIAL_CAMPAIGNS: CampaignClusterItem[] = [
  // Active Campaigns
  {
    id: 'C-017',
    title: 'Operation GCash Clone #17',
    messages: 142847,
    domainsCount: 4,
    domainsList: ['gcash-ph-support.net', 'claim-gcash-promo.site', 'gcash-sec.ph', 'gcash-bonus.top'],
    since: 'May 11',
    status: 'Active',
    tags: ['Prize Lure', 'Fake Domain', 'Taglish Wording'],
    samplePayload: 'Your GCash account has been flagged due to unverified details. Verify now at https://gcash-ph-support.net/login to prevent permanent deactivation.',
  },
  {
    id: 'C-015',
    title: 'BDO Fake Support Wave #5',
    messages: 84291,
    domainsCount: 2,
    domainsList: ['bdo-online-sec.com', 'bdo-sec-login.top'],
    since: 'May 9',
    status: 'Active',
    tags: ['Urgency Tactics', 'OTP Harvesting', 'Brand Impersonation'],
    samplePayload: 'Ang inyong BDO account ay nangangailangan ng verification dahil sa bagong BSP policy. Mag-log in sa http://bdo-online-sec.com para i-update.',
  },
  {
    id: 'C-014',
    title: 'LBC Parcel Delivery Scam #8',
    messages: 67128,
    domainsCount: 3,
    domainsList: ['lbc-express-delivery.top', 'lbc-tracking-ph.xyz', 'lbc-release.site'],
    since: 'May 8',
    status: 'Active',
    tags: ['Fake Domain', 'Shortened URL', 'Urgency Tactics'],
    samplePayload: 'URGENT: LBC parcel PH8812 is held at customs. Pay ₱250 release fee now at http://lbc-express-delivery.top to initiate delivery.',
  },
  {
    id: 'C-013',
    title: 'Maya Loyalty Scam #12',
    messages: 45210,
    domainsCount: 2,
    domainsList: ['maya-cash-bonus.online', 'maya-rewards.xyz'],
    since: 'May 5',
    status: 'Active',
    tags: ['Prize Lure', 'Brand Impersonation'],
    samplePayload: 'Maya Loyalty Reward: You have ₱5,000 pending cash reward! Claim now at http://maya-cash-bonus.online',
  },
  {
    id: 'C-012',
    title: 'PLDT Overdue Notice Scam #4',
    messages: 38920,
    domainsCount: 2,
    domainsList: ['pldt-billing-online.com', 'pldt-pay.site'],
    since: 'May 2',
    status: 'Active',
    tags: ['Urgency Tactics', 'Fake Domain'],
    samplePayload: 'Your PLDT bill of ₱1,899 is overdue. Pay now at http://pldt-billing-online.com to avoid disconnection within 24h.',
  },
  {
    id: 'C-011',
    title: 'Shopee Voucher Fake Claim #11',
    messages: 25410,
    domainsCount: 2,
    domainsList: ['shopee-voucher-claim.site', 'shopee-flash-deal.ph'],
    since: 'Apr 28',
    status: 'Active',
    tags: ['Prize Lure', 'Fake Domain'],
    samplePayload: 'Shopee Alert: Parcel cannot be delivered due to incomplete address. Update now: http://shopee-voucher-claim.site',
  },

  // Inactive Campaigns
  {
    id: 'C-010',
    title: 'BDO OTP Harvester Wave #3',
    messages: 18920,
    domainsCount: 2,
    domainsList: ['bdo-otp-verify.net', 'bdo-banking-auth.com'],
    since: 'Apr 22',
    status: 'Inactive',
    tags: ['OTP Harvesting'],
    samplePayload: 'BDO OTP Authorization: Enter your OTP code at http://bdo-otp-verify.net to confirm payment.',
  },
  {
    id: 'C-009',
    title: 'Piso Fare Lure #6',
    messages: 12456,
    domainsCount: 1,
    domainsList: ['piso-fare-promo2026.online'],
    since: 'Apr 15',
    status: 'Inactive',
    tags: ['Prize Lure'],
    samplePayload: 'Cebu Pacific Advisory: ₱1 Piso Fare promo open! Book flights now at http://piso-fare-promo2026.online',
  },
  {
    id: 'C-008',
    title: 'Shopee Flash Sale Scam #9',
    messages: 9843,
    domainsCount: 2,
    domainsList: ['shopee-flash-deal.ph', 'shopee-sale-discount.site'],
    since: 'Apr 10',
    status: 'Inactive',
    tags: ['Fake Domain'],
    samplePayload: 'Shopee Flash Sale! 90% off iPhone 15 Pro Max. Limited stocks at http://shopee-flash-deal.ph',
  },
  {
    id: 'C-007',
    title: 'Globe GoSURF Fake Renewal #2',
    messages: 7420,
    domainsCount: 1,
    domainsList: ['globe-gosurf-renew.online'],
    since: 'Apr 02',
    status: 'Inactive',
    tags: ['Taglish Wording', 'Shortened URL'],
    samplePayload: 'Globe Advisory: Your GoSURF promo has expired. Top up now at http://globe-gosurf-renew.online',
  },
];

export function AdminCampaignsPage() {
  const [activeTab, setActiveTab] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [search, setSearch] = useState('');
  const [campaignsList, setCampaignsList] = useState<CampaignClusterItem[]>(INITIAL_CAMPAIGNS);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<CampaignClusterItem | null>(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Filtered lists
  const filteredCampaigns = campaignsList.filter((item) => {
    const matchesTab = activeTab === 'All' || item.status === activeTab;
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.id.toLowerCase().includes(search.toLowerCase()) ||
      item.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())) ||
      item.domainsList.some((d) => d.toLowerCase().includes(search.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const activeCampaigns = filteredCampaigns.filter((c) => c.status === 'Active');
  const inactiveCampaigns = filteredCampaigns.filter((c) => c.status === 'Inactive');

  const totalClustersCount = campaignsList.length;
  const activeCount = campaignsList.filter((c) => c.status === 'Active').length;
  const totalMessagesCount = campaignsList.reduce((acc, c) => acc + c.messages, 0);

  const toggleSelectCard = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      if (selectedIds.length >= 2) {
        setSelectedIds([selectedIds[1], id]);
      } else {
        setSelectedIds([...selectedIds, id]);
      }
    }
  };

  const handleExportAll = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      alert(`Exported telemetry report for all ${totalClustersCount} campaign clusters (${totalMessagesCount.toLocaleString()} total messages) to CSV/JSON!`);
    }, 1200);
  };

  const handleExecuteMerge = () => {
    if (selectedIds.length !== 2) return;
    const [id1, id2] = selectedIds;
    const c1 = campaignsList.find((c) => c.id === id1);
    const c2 = campaignsList.find((c) => c.id === id2);

    if (!c1 || !c2) return;

    const mergedCampaign: CampaignClusterItem = {
      id: c1.id,
      title: `${c1.title} (Merged with ${c2.id})`,
      messages: c1.messages + c2.messages,
      domainsCount: Array.from(new Set([...c1.domainsList, ...c2.domainsList])).length,
      domainsList: Array.from(new Set([...c1.domainsList, ...c2.domainsList])),
      since: c1.since,
      status: 'Active',
      tags: Array.from(new Set([...c1.tags, ...c2.tags])),
      samplePayload: c1.samplePayload || c2.samplePayload,
    };

    setCampaignsList((prev) => prev.filter((c) => c.id !== id2).map((c) => (c.id === id1 ? mergedCampaign : c)));
    setSelectedIds([]);
    setShowMergeModal(false);
    alert(`Successfully merged campaign [${c2.id}] into [${c1.id}]! Total messages updated to ${mergedCampaign.messages.toLocaleString()}.`);
  };

  const handleToggleClusterStatus = (clusterId: string) => {
    setCampaignsList((prev) =>
      prev.map((c) => (c.id === clusterId ? { ...c, status: c.status === 'Active' ? 'Inactive' : 'Active' } : c))
    );
    if (selectedCluster && selectedCluster.id === clusterId) {
      setSelectedCluster({
        ...selectedCluster,
        status: selectedCluster.status === 'Active' ? 'Inactive' : 'Active',
      });
    }
  };

  return (
    <AdminShell title="All Campaign Clusters">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Top Summary Stat Badges & Export All Button Header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', gap: 16, width: '100%', alignItems: 'center' }}>
          <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)', padding: '10px 16px', borderRadius: 12, textAlign: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
            <strong style={{ display: 'block', fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 800 }}>{totalClustersCount}</strong>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 600 }}>Total Clusters</small>
          </div>

          <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)', padding: '10px 16px', borderRadius: 12, textAlign: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
            <strong style={{ display: 'block', fontSize: '1.25rem', color: 'var(--green-text)', fontWeight: 800 }}>{activeCount}</strong>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 600 }}>Active</small>
          </div>

          <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)', padding: '10px 16px', borderRadius: 12, textAlign: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
            <strong style={{ display: 'block', fontSize: '1.25rem', color: 'var(--accent-light)', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
              {totalMessagesCount.toLocaleString()}
            </strong>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 600 }}>Total Messages</small>
          </div>

          <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)', padding: '10px 16px', borderRadius: 12, textAlign: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
            <strong style={{ display: 'block', fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 800 }}>3</strong>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 600 }}>Client Orgs</small>
          </div>

          <Button variant="secondary" size="md" onClick={handleExportAll} disabled={isExporting} style={{ height: 46, padding: '0 20px' }}>
            {isExporting ? '⏳ Exporting...' : '📥 Export All'}
          </Button>
        </div>

        {/* Filter Pills Row & Search Input */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className={`btn ${activeTab === 'All' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('All')}
              style={{ borderRadius: 20, padding: '6px 18px', fontSize: '0.8125rem' }}
            >
              All {totalClustersCount}
            </button>
            <button
              className={`btn ${activeTab === 'Active' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('Active')}
              style={{ borderRadius: 20, padding: '6px 18px', fontSize: '0.8125rem' }}
            >
              Active {activeCount}
            </button>
            <button
              className={`btn ${activeTab === 'Inactive' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('Inactive')}
              style={{ borderRadius: 20, padding: '6px 18px', fontSize: '0.8125rem' }}
            >
              Inactive {totalClustersCount - activeCount}
            </button>
          </div>

          <div style={{ position: 'relative', width: 260 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Filter campaigns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', height: 36, paddingLeft: 32, fontSize: '0.8125rem' }}
            />
            <span style={{ position: 'absolute', left: 10, top: 8, color: 'var(--text-muted)', fontSize: '0.875rem' }}>🔍</span>
          </div>
        </div>

        {/* Merge Callout Banner (Matching Reference Screenshot) */}
        <div
          style={{
            background: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            color: '#60a5fa',
            padding: '12px 18px',
            borderRadius: 10,
            fontSize: '0.875rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.125rem' }}>ⓘ</span>
            <span>
              Select two campaigns and use <strong style={{ color: 'var(--accent-light)' }}>Merge</strong> to combine overlapping smishing clusters into a single tracked campaign.
            </span>
          </div>

          {selectedIds.length === 2 && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowMergeModal(true)}
              style={{ background: 'var(--accent-primary)', color: '#fff', fontWeight: 700 }}
            >
              ⚡ Merge Selected ({selectedIds.length})
            </Button>
          )}
        </div>

        {/* Main 2-Column Campaign Clusters Layout (Active Campaigns on Left, Inactive Campaigns on Right) */}
        <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'All' ? '1fr 1fr' : '1fr', gap: 24 }}>
          {/* Active Campaigns Column */}
          {(activeTab === 'All' || activeTab === 'Active') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                <span>Active Campaigns ({activeCampaigns.length})</span>
              </div>

              {activeCampaigns.map((item) => {
                const isChecked = selectedIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className="panel animate-fade-in campaign-card-interactive"
                    style={{
                      background: isChecked ? 'rgba(124, 58, 237, 0.12)' : 'var(--bg-surface-elevated)',
                      border: isChecked ? '1px solid var(--accent-light)' : '1px solid var(--border-default)',
                      padding: 20,
                      borderRadius: 12,
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                    onClick={() => setSelectedCluster(item)}
                  >
                    {/* Header Row with Checkbox & Status Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => e.stopPropagation()}
                          onClick={(e) => toggleSelectCard(item.id, e)}
                          style={{ width: 18, height: 18, accentColor: 'var(--accent-light)', cursor: 'pointer' }}
                        />
                        <div>
                          <small style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700 }}>
                            {item.id}
                          </small>
                          <h4 style={{ margin: 0, fontSize: '1.0625rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                            {item.title}
                          </h4>
                        </div>
                      </div>

                      <span className="badge badge-green">Active</span>
                    </div>

                    {/* Metrics Row */}
                    <div style={{ display: 'flex', gap: 24, margin: '14px 0', fontSize: '0.875rem' }}>
                      <div>
                        <strong style={{ display: 'block', fontSize: '1.125rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                          {item.messages.toLocaleString()}
                        </strong>
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Messages</small>
                      </div>

                      <div>
                        <strong style={{ display: 'block', fontSize: '1.125rem', color: 'var(--accent-light)' }}>
                          {item.domainsCount}
                        </strong>
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Domains</small>
                      </div>

                      <div>
                        <strong style={{ display: 'block', fontSize: '1rem', color: 'var(--text-secondary)' }}>
                          {item.since}
                        </strong>
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Since</small>
                      </div>
                    </div>

                    {/* Tags Pill Row */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            background: 'var(--bg-input)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-secondary)',
                            padding: '4px 10px',
                            borderRadius: 16,
                            fontSize: '0.75rem',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Inactive Campaigns Column */}
          {(activeTab === 'All' || activeTab === 'Inactive') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#64748b', display: 'inline-block' }} />
                <span>Inactive Campaigns ({inactiveCampaigns.length})</span>
              </div>

              {inactiveCampaigns.map((item) => {
                const isChecked = selectedIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className="panel animate-fade-in campaign-card-interactive"
                    style={{
                      background: isChecked ? 'rgba(124, 58, 237, 0.12)' : 'var(--bg-surface-elevated)',
                      border: isChecked ? '1px solid var(--accent-light)' : '1px solid var(--border-subtle)',
                      padding: 20,
                      borderRadius: 12,
                      cursor: 'pointer',
                      opacity: 0.85,
                    }}
                    onClick={() => setSelectedCluster(item)}
                  >
                    {/* Header Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => e.stopPropagation()}
                          onClick={(e) => toggleSelectCard(item.id, e)}
                          style={{ width: 18, height: 18, accentColor: 'var(--accent-light)', cursor: 'pointer' }}
                        />
                        <div>
                          <small style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700 }}>
                            {item.id}
                          </small>
                          <h4 style={{ margin: 0, fontSize: '1.0625rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                            {item.title}
                          </h4>
                        </div>
                      </div>

                      <span className="badge badge-gray">Inactive</span>
                    </div>

                    {/* Metrics Row */}
                    <div style={{ display: 'flex', gap: 24, margin: '14px 0', fontSize: '0.875rem' }}>
                      <div>
                        <strong style={{ display: 'block', fontSize: '1.125rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                          {item.messages.toLocaleString()}
                        </strong>
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Messages</small>
                      </div>

                      <div>
                        <strong style={{ display: 'block', fontSize: '1.125rem', color: 'var(--text-muted)' }}>
                          {item.domainsCount}
                        </strong>
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Domains</small>
                      </div>

                      <div>
                        <strong style={{ display: 'block', fontSize: '1rem', color: 'var(--text-muted)' }}>
                          {item.since}
                        </strong>
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Since</small>
                      </div>
                    </div>

                    {/* Tags Pill Row */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            background: 'var(--bg-input)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-muted)',
                            padding: '4px 10px',
                            borderRadius: 16,
                            fontSize: '0.75rem',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal 1: Campaign Cluster Workbench Details Modal */}
      {selectedCluster && (
        <Modal
          isOpen={Boolean(selectedCluster)}
          onClose={() => setSelectedCluster(null)}
          title={`Campaign Cluster ${selectedCluster.id} Details`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface-elevated)', padding: 14, borderRadius: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.125rem', color: 'var(--text-primary)' }}>{selectedCluster.title}</h3>
                <small style={{ color: 'var(--text-muted)' }}>Active since {selectedCluster.since}, 2026</small>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className={`badge ${selectedCluster.status === 'Active' ? 'badge-green' : 'badge-gray'}`}>
                  {selectedCluster.status}
                </span>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleToggleClusterStatus(selectedCluster.id)}
                >
                  {selectedCluster.status === 'Active' ? 'Deactivate Cluster' : 'Reactivate Cluster'}
                </Button>
              </div>
            </div>

            {/* Metrics Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8 }}>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Total Messages Intercepted</small>
                <strong style={{ fontSize: '1.25rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {selectedCluster.messages.toLocaleString()}
                </strong>
              </div>

              <div style={{ background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8 }}>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Tracked Domains</small>
                <strong style={{ fontSize: '1.25rem', color: 'var(--accent-light)' }}>
                  {selectedCluster.domainsCount}
                </strong>
              </div>

              <div style={{ background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8 }}>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Classification Tactics</small>
                <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  {selectedCluster.tags.join(', ')}
                </strong>
              </div>
            </div>

            {/* Tracked Malicious Domains List */}
            <div>
              <strong style={{ display: 'block', marginBottom: 8, color: 'var(--text-primary)' }}>Tracked Malicious Domains:</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selectedCluster.domainsList.map((domain) => (
                  <div
                    key={domain}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-default)',
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <span style={{ color: 'var(--red-text)' }}>🚨 {domain}</span>
                    <span className="badge badge-red" style={{ fontSize: '0.6875rem' }}>Blocked</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sample Text Payload */}
            {selectedCluster.samplePayload && (
              <div>
                <strong style={{ display: 'block', marginBottom: 6, color: 'var(--text-primary)' }}>Representative SMS Text Payload:</strong>
                <div
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-default)',
                    padding: 14,
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8125rem',
                    lineHeight: 1.5,
                  }}
                >
                  "{selectedCluster.samplePayload}"
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
              <Button variant="ghost" size="md" onClick={() => setSelectedCluster(null)}>
                Close
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  alert(`Exporting telemetry report for cluster ${selectedCluster.id}...`);
                  setSelectedCluster(null);
                }}
              >
                📥 Export Cluster Report
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal 2: Merge Clusters Modal */}
      <Modal
        isOpen={showMergeModal}
        onClose={() => setShowMergeModal(false)}
        title="Merge Selected Smishing Clusters"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: '0.875rem' }}>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Combining two overlapping clusters merges all tracked domains, total intercepted messages, and classification tags into a single unified threat campaign.
          </p>

          {selectedIds.length === 2 && (
            <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--accent-light)', padding: 14, borderRadius: 10 }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 700 }}>CAMPAIGNS TO BE MERGED:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)' }}>
                  <span><strong>{selectedIds[0]}</strong> — {campaignsList.find((c) => c.id === selectedIds[0])?.title}</span>
                  <strong style={{ color: 'var(--accent-light)' }}>{campaignsList.find((c) => c.id === selectedIds[0])?.messages.toLocaleString()} msgs</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)' }}>
                  <span><strong>{selectedIds[1]}</strong> — {campaignsList.find((c) => c.id === selectedIds[1])?.title}</span>
                  <strong style={{ color: 'var(--accent-light)' }}>{campaignsList.find((c) => c.id === selectedIds[1])?.messages.toLocaleString()} msgs</strong>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <Button variant="ghost" size="md" onClick={() => setShowMergeModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={handleExecuteMerge}>
              ⚡ Confirm & Merge Clusters
            </Button>
          </div>
        </div>
      </Modal>
    </AdminShell>
  );
}

// CAMPAIGN TIMELINE PAGE (Matching User's Reference Screenshot)
interface TimelineEventItem {
  id: string;
  date: string;
  title: string;
  description: string;
  msgDelta: string;
  badgeType: 'New Campaign' | 'Variant' | 'Domain' | 'Surge' | 'Current';
  nodeColor: 'purple' | 'amber' | 'red' | 'green';
  samplePayload?: string;
}

interface CampaignTimelineData {
  id: string;
  title: string;
  status: 'Active' | 'Inactive';
  totalMessages: number;
  domainsCount: number;
  variantsCount: number;
  activeSince: string;
  events: TimelineEventItem[];
  volumeHistory: { date: string; volume: number }[];
  knownDomains: string[];
  tactics: { name: string; pct: number; color: 'red' | 'amber' | 'purple' }[];
}

const TIMELINE_CAMPAIGNS_DATA: Record<string, CampaignTimelineData> = {
  'Operation GCash Clone #17': {
    id: 'C-017',
    title: 'Operation GCash Clone #17',
    status: 'Active',
    totalMessages: 382,
    domainsCount: 4,
    variantsCount: 3,
    activeSince: 'May 3, 2026',
    events: [
      {
        id: 'EVT-01',
        date: 'May 3, 2026',
        title: 'Campaign First Detected',
        description: 'Initial cluster formed with 12 messages. Domain: gcash-ph-support.net',
        msgDelta: '+12 messages',
        badgeType: 'New Campaign',
        nodeColor: 'purple',
        samplePayload: 'Your GCash account has been flagged due to unverified details. Verify now at https://gcash-ph-support.net/login',
      },
      {
        id: 'EVT-02',
        date: 'May 5, 2026',
        title: 'New Variant Detected',
        description: 'Variant B added — slight wording change: "Unusual login detected"',
        msgDelta: '+34 messages',
        badgeType: 'Variant',
        nodeColor: 'purple',
        samplePayload: 'GCash Alert: Unusual login detected from Chrome OS. Verify identity: http://gcash-verify-ph.com',
      },
      {
        id: 'EVT-03',
        date: 'May 7, 2026',
        title: 'New Domain Registered',
        description: 'gcash-verify-ph.com joined the cluster. 2nd known domain.',
        msgDelta: '+67 messages',
        badgeType: 'Domain',
        nodeColor: 'amber',
        samplePayload: 'GCash Notice: Confirm account details at http://gcash-verify-ph.com to avoid 24h lockout.',
      },
      {
        id: 'EVT-04',
        date: 'May 9, 2026',
        title: 'Surge in Activity',
        description: 'Daily message volume spiked 3.2× — 182 messages in 24 hours',
        msgDelta: '+182 messages',
        badgeType: 'Surge',
        nodeColor: 'red',
        samplePayload: 'URGENT: GCash wallet balance locked! Unlock immediately at http://mygcash-support.xyz',
      },
      {
        id: 'EVT-05',
        date: 'May 11, 2026',
        title: 'Variant C Detected',
        description: 'Prize lure variant added — tone shift to reward-based tactics',
        msgDelta: '+89 messages',
        badgeType: 'Variant',
        nodeColor: 'purple',
        samplePayload: 'Congratulations! You won ₱5,000 GCash reward. Claim now at http://gcash-alert-ph.net',
      },
      {
        id: 'EVT-06',
        date: 'May 13, 2026',
        title: 'Current State: Active',
        description: '382 total messages tracked - 4 domains identified - Campaign ongoing',
        msgDelta: 'LIVE',
        badgeType: 'Current',
        nodeColor: 'green',
        samplePayload: 'Live tracking active across 4 malicious domains.',
      },
    ],
    volumeHistory: [
      { date: 'May 3', volume: 12 },
      { date: 'May 5', volume: 34 },
      { date: 'May 7', volume: 67 },
      { date: 'May 9', volume: 182 },
      { date: 'May 11', volume: 89 },
      { date: 'May 12', volume: 140 },
      { date: 'May 13', volume: 287 },
    ],
    knownDomains: [
      'gcash-ph-support.net',
      'gcash-verify-ph.com',
      'mygcash-support.xyz',
      'gcash-alert-ph.net',
    ],
    tactics: [
      { name: 'Fake Domain Usage', pct: 90, color: 'red' },
      { name: 'Brand Impersonation', pct: 79, color: 'red' },
      { name: 'Urgency Language', pct: 65, color: 'amber' },
      { name: 'Taglish Wording', pct: 57, color: 'amber' },
    ],
  },
  'BDO Fake Support Wave #5': {
    id: 'C-015',
    title: 'BDO Fake Support Wave #5',
    status: 'Active',
    totalMessages: 248,
    domainsCount: 2,
    variantsCount: 2,
    activeSince: 'May 9, 2026',
    events: [
      {
        id: 'EVT-10',
        date: 'May 9, 2026',
        title: 'Campaign Outbreak',
        description: 'Initial cluster formed with 45 messages. Domain: bdo-online-sec.com',
        msgDelta: '+45 messages',
        badgeType: 'New Campaign',
        nodeColor: 'purple',
        samplePayload: 'BDO Alert: Update security details under new BSP mandate at http://bdo-online-sec.com',
      },
      {
        id: 'EVT-11',
        date: 'May 11, 2026',
        title: 'Domain Pivot',
        description: 'bdo-sec-login.top registered to evade DNS blocking',
        msgDelta: '+98 messages',
        badgeType: 'Domain',
        nodeColor: 'amber',
        samplePayload: 'BDO Notice: Verify login credentials at http://bdo-sec-login.top',
      },
      {
        id: 'EVT-12',
        date: 'May 13, 2026',
        title: 'Current State: Active',
        description: '248 total messages tracked across 2 malicious domains',
        msgDelta: 'LIVE',
        badgeType: 'Current',
        nodeColor: 'green',
      },
    ],
    volumeHistory: [
      { date: 'May 9', volume: 45 },
      { date: 'May 11', volume: 98 },
      { date: 'May 13', volume: 105 },
    ],
    knownDomains: ['bdo-online-sec.com', 'bdo-sec-login.top'],
    tactics: [
      { name: 'OTP Harvesting', pct: 94, color: 'red' },
      { name: 'Brand Impersonation', pct: 88, color: 'red' },
      { name: 'Urgency Language', pct: 82, color: 'amber' },
    ],
  },
  'LBC Parcel Delivery Scam #8': {
    id: 'C-014',
    title: 'LBC Parcel Delivery Scam #8',
    status: 'Active',
    totalMessages: 194,
    domainsCount: 3,
    variantsCount: 2,
    activeSince: 'May 8, 2026',
    events: [
      {
        id: 'EVT-20',
        date: 'May 8, 2026',
        title: 'Customs Fee Scam Launch',
        description: 'Initial outbreak targeting online shoppers. Domain: lbc-express-delivery.top',
        msgDelta: '+38 messages',
        badgeType: 'New Campaign',
        nodeColor: 'purple',
        samplePayload: 'URGENT: LBC parcel held at customs. Pay ₱250 release fee at http://lbc-express-delivery.top',
      },
      {
        id: 'EVT-21',
        date: 'May 10, 2026',
        title: 'Shortened URL Variant',
        description: 'Added tracking link variant with release fee payment lure',
        msgDelta: '+72 messages',
        badgeType: 'Variant',
        nodeColor: 'purple',
        samplePayload: 'LBC Parcel #PH8812 release fee required: http://lbc-tracking-ph.xyz',
      },
      {
        id: 'EVT-22',
        date: 'May 13, 2026',
        title: 'Current State: Active',
        description: '194 messages tracked across 3 domains',
        msgDelta: 'LIVE',
        badgeType: 'Current',
        nodeColor: 'green',
      },
    ],
    volumeHistory: [
      { date: 'May 8', volume: 38 },
      { date: 'May 10', volume: 72 },
      { date: 'May 13', volume: 84 },
    ],
    knownDomains: ['lbc-express-delivery.top', 'lbc-tracking-ph.xyz', 'lbc-release.site'],
    tactics: [
      { name: 'Fake Domain Usage', pct: 92, color: 'red' },
      { name: 'Urgency Language', pct: 85, color: 'red' },
      { name: 'Shortened URL', pct: 76, color: 'amber' },
    ],
  },
};

export function AdminTimelinePage() {
  const [selectedCampaignKey, setSelectedCampaignKey] = useState<string>('Operation GCash Clone #17');
  const [selectedEvent, setSelectedEvent] = useState<TimelineEventItem | null>(null);
  const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(null);
  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);

  const campaign = TIMELINE_CAMPAIGNS_DATA[selectedCampaignKey] || TIMELINE_CAMPAIGNS_DATA['Operation GCash Clone #17'];

  const handleCopyDomain = (domain: string) => {
    navigator.clipboard.writeText(domain);
    setCopiedDomain(domain);
    setTimeout(() => setCopiedDomain(null), 2000);
  };

  const maxVolume = Math.max(...campaign.volumeHistory.map((v) => v.volume));

  return (
    <AdminShell title="Campaign Timeline">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Dropdown Campaign Selector Header */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          {/* SELECTOR DROPDOWN */}
          <div style={{ position: 'relative' }}>
            <select
              className="form-input"
              value={selectedCampaignKey}
              onChange={(e) => setSelectedCampaignKey(e.target.value)}
              style={{
                height: 42,
                padding: '0 36px 0 16px',
                fontSize: '0.875rem',
                fontWeight: 700,
                color: 'var(--accent-light)',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--accent-light)',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              {Object.keys(TIMELINE_CAMPAIGNS_DATA).map((key) => (
                <option key={key} value={key} style={{ background: '#12121a', color: '#ffffff' }}>
                  {key}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Campaign Header Metrics Card (Matching Reference Screenshot - Maximized Space) */}
        <div
          className="panel"
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 12,
            padding: '20px 24px',
            display: 'grid',
            gridTemplateColumns: '1.2fr 2fr',
            alignItems: 'center',
            gap: 24,
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 10,
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid var(--red-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.35rem',
                flexShrink: 0,
              }}
            >
              🛡️
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                  {campaign.title}
                </h3>
                <span className={`badge ${campaign.status === 'Active' ? 'badge-green' : 'badge-gray'}`}>
                  {campaign.status}
                </span>
              </div>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2, display: 'block' }}>
                Cluster ID: {campaign.id}
              </small>
            </div>
          </div>

          {/* Evenly Spaced Stat Grid Spanning 100% Right Column */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 16,
              background: 'var(--bg-input)',
              padding: '12px 20px',
              borderRadius: 10,
              border: '1px solid var(--border-subtle)',
              alignItems: 'center',
            }}
          >
            <div>
              <strong style={{ display: 'block', fontSize: '1.25rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {campaign.totalMessages.toLocaleString()}
              </strong>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Total Messages</small>
            </div>

            <div>
              <strong style={{ display: 'block', fontSize: '1.25rem', color: 'var(--accent-light)' }}>
                {campaign.domainsCount}
              </strong>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Domains</small>
            </div>

            <div>
              <strong style={{ display: 'block', fontSize: '1.25rem', color: 'var(--amber-text)' }}>
                {campaign.variantsCount}
              </strong>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Variants</small>
            </div>

            <div>
              <strong style={{ display: 'block', fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>
                {campaign.activeSince}
              </strong>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Active Since</small>
            </div>
          </div>
        </div>

        {/* Main Grid: Left Side Timeline Stream (2fr), Right Side Analytics Sidebar (1.2fr) */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: 24 }}>
          {/* LEFT SIDE: Chronological Event Node Timeline Stream */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {campaign.events.map((evt, idx) => {
              const nodeBg =
                evt.nodeColor === 'red'
                  ? '#ef4444'
                  : evt.nodeColor === 'amber'
                  ? '#f59e0b'
                  : evt.nodeColor === 'green'
                  ? '#10b981'
                  : '#a855f7';

              const badgeClass =
                evt.badgeType === 'Surge'
                  ? 'badge-red'
                  : evt.badgeType === 'Domain'
                  ? 'badge-amber'
                  : evt.badgeType === 'Current'
                  ? 'badge-green'
                  : 'badge-purple';

              return (
                <div key={evt.id} style={{ display: 'flex', gap: 20, position: 'relative' }}>
                  {/* Vertical Timeline Line */}
                  {idx < campaign.events.length - 1 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 17,
                        top: 36,
                        bottom: -20,
                        width: 2,
                        background: 'var(--border-default)',
                        zIndex: 1,
                      }}
                    />
                  )}

                  {/* Node Circle */}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'var(--bg-dark)',
                      border: `3px solid ${nodeBg}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2,
                      flexShrink: 0,
                      boxShadow: evt.nodeColor === 'green' ? '0 0 14px rgba(16,185,129,0.6)' : 'none',
                    }}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: nodeBg }} />
                  </div>

                  {/* Event Card Content Box */}
                  <div
                    className="panel animate-fade-in campaign-card-interactive"
                    style={{
                      flex: 1,
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 12,
                      padding: '16px 20px',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedEvent(evt)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {evt.date}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: evt.msgDelta === 'LIVE' ? 'var(--green-text)' : 'var(--green-text)' }}>
                          {evt.msgDelta}
                        </span>
                        <span className={`badge ${badgeClass}`}>{evt.badgeType}</span>
                      </div>
                    </div>

                    <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                      {evt.title}
                    </h4>

                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {evt.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* RIGHT SIDE: Analytics Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Card 1: VOLUME OVER TIME (Interactive Bar Graph) */}
            <div className="panel" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)', padding: 20 }}>
              <div style={{ fontSize: '0.75rem', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 16, fontWeight: 700 }}>
                VOLUME OVER TIME
              </div>

              <div style={{ position: 'relative', height: 160, display: 'flex', alignItems: 'flex-end', gap: 12, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
                {/* Y-Axis Labels */}
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                  <span>{maxVolume}</span>
                  <span>{Math.round(maxVolume * 0.6)}</span>
                  <span>{Math.round(maxVolume * 0.3)}</span>
                </div>

                {/* Bars Container */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', width: '100%', paddingLeft: 28, height: '100%' }}>
                  {campaign.volumeHistory.map((item, idx) => {
                    const barHeightPct = Math.max(15, (item.volume / maxVolume) * 100);
                    const isHovered = hoveredBarIdx === idx;
                    const isRedBar = item.volume > 150;

                    return (
                      <div
                        key={item.date}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', flex: 1, position: 'relative' }}
                        onMouseEnter={() => setHoveredBarIdx(idx)}
                        onMouseLeave={() => setHoveredBarIdx(null)}
                      >
                        {/* Hover Tooltip */}
                        {isHovered && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: `${barHeightPct + 10}%`,
                              background: '#1a1a26',
                              border: '1px solid var(--accent-light)',
                              color: '#fff',
                              fontSize: '0.6875rem',
                              padding: '2px 6px',
                              borderRadius: 4,
                              whiteSpace: 'nowrap',
                              zIndex: 10,
                            }}
                          >
                            {item.volume} msgs
                          </div>
                        )}

                        <div
                          style={{
                            width: '65%',
                            height: `${barHeightPct}%`,
                            background: isRedBar
                              ? 'linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)'
                              : 'linear-gradient(180deg, #7c3aed 0%, #4c1d95 100%)',
                            borderRadius: '4px 4px 0 0',
                            transition: 'all 0.2s ease',
                            transform: isHovered ? 'scaleY(1.05)' : 'none',
                          }}
                        />
                        <span style={{ fontSize: '0.6875rem', color: isHovered ? 'var(--accent-light)' : 'var(--text-muted)', marginTop: 6 }}>
                          {item.date}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Card 2: KNOWN DOMAINS */}
            <div className="panel" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)', padding: 20 }}>
              <div style={{ fontSize: '0.75rem', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 14, fontWeight: 700 }}>
                KNOWN DOMAINS
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {campaign.knownDomains.map((dom) => (
                  <div
                    key={dom}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      padding: '10px 14px',
                      borderRadius: 8,
                      fontSize: '0.8125rem',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f87171' }}>
                      <span>🔗</span>
                      <span>{dom}</span>
                    </div>

                    <button
                      onClick={() => handleCopyDomain(dom)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: copiedDomain === dom ? 'var(--green-text)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      {copiedDomain === dom ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 3: EVASION TACTIC BREAKDOWN */}
            <div className="panel" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)', padding: 20 }}>
              <div style={{ fontSize: '0.75rem', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 16, fontWeight: 700 }}>
                EVASION TACTIC BREAKDOWN
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {campaign.tactics.map((tac) => (
                  <div key={tac.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: 6 }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{tac.name}</span>
                      <strong style={{ color: tac.color === 'red' ? '#ef4444' : 'var(--amber-text)', fontFamily: 'var(--font-mono)' }}>
                        {tac.pct}%
                      </strong>
                    </div>
                    <div style={{ height: 8, width: '100%', background: 'var(--bg-input)', borderRadius: 4, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${tac.pct}%`,
                          background: tac.color === 'red' ? 'linear-gradient(90deg, #ef4444, #dc2626)' : 'linear-gradient(90deg, #f59e0b, #d97706)',
                          borderRadius: 4,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 4: TARGETED OPERATOR NETWORKS (Fills Bottom Right Column Space) */}
            <div className="panel" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)', padding: 20 }}>
              <div style={{ fontSize: '0.75rem', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 16, fontWeight: 700 }}>
                TARGETED OPERATOR NETWORKS
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: '0.8125rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Smart Communications</span>
                    <strong style={{ color: 'var(--accent-light)', fontFamily: 'var(--font-mono)' }}>54%</strong>
                  </div>
                  <div style={{ height: 6, width: '100%', background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '54%', background: 'var(--accent-primary)', borderRadius: 3 }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Globe Telecom</span>
                    <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>38%</strong>
                  </div>
                  <div style={{ height: 6, width: '100%', background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '38%', background: '#60a5fa', borderRadius: 3 }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>DITO Telecommunity</span>
                    <strong style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>8%</strong>
                  </div>
                  <div style={{ height: 6, width: '100%', background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '8%', background: '#34d399', borderRadius: 3 }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Timeline Event Node Detail Audit Modal */}
      {selectedEvent && (
        <Modal
          isOpen={Boolean(selectedEvent)}
          onClose={() => setSelectedEvent(null)}
          title={`Timeline Audit Event ${selectedEvent.id}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8 }}>
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Event Date</small>
                <strong>{selectedEvent.date}</strong>
              </div>
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Event Type</small>
                <span className={`badge ${selectedEvent.badgeType === 'Surge' ? 'badge-red' : 'badge-purple'}`}>
                  {selectedEvent.badgeType}
                </span>
              </div>
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Volume Impact</small>
                <strong style={{ color: 'var(--green-text)' }}>{selectedEvent.msgDelta}</strong>
              </div>
            </div>

            <div>
              <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Event Title & Summary</small>
              <strong style={{ fontSize: '1rem', color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                {selectedEvent.title}
              </strong>
              <p style={{ color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                {selectedEvent.description}
              </p>
            </div>

            {selectedEvent.samplePayload && (
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Sample SMS Text Intercepted During Event</small>
                <div
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-default)',
                    padding: 14,
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8125rem',
                    lineHeight: 1.5,
                  }}
                >
                  "{selectedEvent.samplePayload}"
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)', paddingTop: 14, marginTop: 4 }}>
              <Button variant="ghost" size="md" onClick={() => setSelectedEvent(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </AdminShell>
  );
}

// REGISTERED USERS PAGE (Matching User's Reference Screenshot)
interface RegisteredUserItem {
  id: string;
  region: string;
  joined: string;
  lastActive: string;
  reportsCount: number;
  scannedCount: number;
  status: 'Active' | 'Inactive';
}

interface ClientOrgItem {
  name: string;
  type: string;
  apiAccess: string;
  activeClients: number;
  joined: string;
  status: 'Active' | 'Inactive';
}

const REGISTERED_USERS_DATA: RegisteredUserItem[] = [
  { id: 'user_4821', region: 'Metro Manila', joined: 'Mar 12, 2026', lastActive: 'May 13', reportsCount: 14, scannedCount: 2847, status: 'Active' },
  { id: 'user_3340', region: 'Cebu', joined: 'Apr 2, 2026', lastActive: 'May 12', reportsCount: 7, scannedCount: 1204, status: 'Active' },
  { id: 'user_7102', region: 'Davao', joined: 'Jan 8, 2026', lastActive: 'May 10', reportsCount: 2, scannedCount: 893, status: 'Active' },
  { id: 'user_1029', region: 'Metro Manila', joined: 'Feb 20, 2026', lastActive: 'Apr 30', reportsCount: 0, scannedCount: 1547, status: 'Inactive' },
  { id: 'user_5512', region: 'Laguna', joined: 'Mar 5, 2026', lastActive: 'May 11', reportsCount: 3, scannedCount: 412, status: 'Active' },
  { id: 'user_9901', region: 'Quezon City', joined: 'Apr 18, 2026', lastActive: 'May 13', reportsCount: 1, scannedCount: 234, status: 'Active' },
  { id: 'user_2219', region: 'Iloilo', joined: 'Feb 14, 2026', lastActive: 'May 12', reportsCount: 5, scannedCount: 1120, status: 'Active' },
  { id: 'user_6604', region: 'Pampanga', joined: 'Mar 28, 2026', lastActive: 'May 09', reportsCount: 0, scannedCount: 512, status: 'Active' },
];

const CLIENT_ORGS_DATA: ClientOrgItem[] = [
  { name: 'Globe Telecom', type: 'Telco Operator', apiAccess: 'Enterprise API Tier', activeClients: 1420, joined: 'Jan 15, 2026', status: 'Active' },
  { name: 'Smart Communications', type: 'Telco Operator', apiAccess: 'Enterprise API Tier', activeClients: 1180, joined: 'Feb 01, 2026', status: 'Active' },
  { name: 'CICC (Cybercrime Investigation)', type: 'Government Agency', apiAccess: 'Super Admin Audit Tier', activeClients: 450, joined: 'Mar 10, 2026', status: 'Active' },
  { name: 'GCash Risk Team', type: 'FinTech Security', apiAccess: 'Realtime Webhook Tier', activeClients: 890, joined: 'Apr 05, 2026', status: 'Active' },
];

export function AdminUsersPage() {
  const [activeTab, setActiveTab] = useState<'App Users' | 'Client Organizations'>('App Users');
  const [search, setSearch] = useState('');
  const [usersList, setUsersList] = useState<RegisteredUserItem[]>(REGISTERED_USERS_DATA);
  const [orgsList, setOrgsList] = useState<ClientOrgItem[]>(CLIENT_ORGS_DATA);
  const [selectedUser, setSelectedUser] = useState<RegisteredUserItem | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<ClientOrgItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter logic
  const filteredUsers = usersList.filter((u) =>
    u.id.toLowerCase().includes(search.toLowerCase()) ||
    u.region.toLowerCase().includes(search.toLowerCase()) ||
    u.status.toLowerCase().includes(search.toLowerCase())
  );

  const filteredOrgs = orgsList.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.type.toLowerCase().includes(search.toLowerCase()) ||
    o.apiAccess.toLowerCase().includes(search.toLowerCase())
  );

  const totalRegistered = 8421;
  const active7dCount = 3204;
  const newTodayCount = 214;

  const handleToggleUserStatus = (userId: string) => {
    setUsersList((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, status: u.status === 'Active' ? 'Inactive' : 'Active' } : u))
    );
    if (selectedUser && selectedUser.id === userId) {
      setSelectedUser({
        ...selectedUser,
        status: selectedUser.status === 'Active' ? 'Inactive' : 'Active',
      });
    }
  };

  return (
    <AdminShell title="Registered Users">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Top Search Bar Header */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ position: 'relative', width: 280 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', height: 38, paddingLeft: 34, fontSize: '0.8125rem' }}
            />
            <span style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              🔍
            </span>
          </div>
        </div>

        {/* Top Summary Metric Strip (Matching Screenshot Header Metrics) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 10,
            padding: '14px 20px',
            fontSize: '0.875rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong style={{ fontSize: '1.25rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {totalRegistered.toLocaleString()}
            </strong>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Registered</span>
          </div>

          <span style={{ color: 'var(--border-default)' }}>|</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong style={{ fontSize: '1.25rem', color: 'var(--green-text)', fontFamily: 'var(--font-mono)' }}>
              {active7dCount.toLocaleString()}
            </strong>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Active (7d)</span>
          </div>

          <span style={{ color: 'var(--border-default)' }}>|</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong style={{ fontSize: '1.25rem', color: 'var(--accent-light)', fontFamily: 'var(--font-mono)' }}>
              {newTodayCount}
            </strong>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>New Today</span>
          </div>
        </div>

        {/* Filter Pills Row */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className={`btn ${activeTab === 'App Users' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setActiveTab('App Users'); setCurrentPage(1); }}
            style={{ borderRadius: 20, padding: '6px 18px', fontSize: '0.8125rem' }}
          >
            App Users
          </button>
          <button
            className={`btn ${activeTab === 'Client Organizations' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setActiveTab('Client Organizations'); setCurrentPage(1); }}
            style={{ borderRadius: 20, padding: '6px 18px', fontSize: '0.8125rem' }}
          >
            Client Organizations
          </button>
        </div>

        {/* Table Panel */}
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            {activeTab === 'App Users' ? (
              <table>
                <thead>
                  <tr>
                    <th>USER ID</th>
                    <th>REGION</th>
                    <th>JOINED</th>
                    <th>LAST ACTIVE</th>
                    <th>REPORTS</th>
                    <th>SCANNED</th>
                    <th>STATUS</th>
                    <th style={{ textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <code style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                          {item.id}
                        </code>
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{item.region}</span>
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{item.joined}</span>
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{item.lastActive}</span>
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', fontWeight: 600 }}>
                          {item.reportsCount} {item.reportsCount === 1 ? 'report' : 'reports'}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>
                          {item.scannedCount.toLocaleString()} scanned
                        </span>
                      </td>
                      <td>
                        {item.status === 'Active' ? (
                          <span className="badge badge-green">Active</span>
                        ) : (
                          <span className="badge badge-gray">Inactive</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedUser(item)}>
                          View Details →
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>ORGANIZATION</th>
                    <th>TYPE</th>
                    <th>API ACCESS LEVEL</th>
                    <th>ACTIVE CLIENTS</th>
                    <th>JOINED</th>
                    <th>STATUS</th>
                    <th style={{ textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrgs.map((item) => (
                    <tr key={item.name}>
                      <td>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>{item.name}</strong>
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{item.type}</span>
                      </td>
                      <td>
                        <span className="badge badge-purple" style={{ fontSize: '0.6875rem' }}>{item.apiAccess}</span>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--accent-light)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
                          {item.activeClients.toLocaleString()} devices
                        </strong>
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{item.joined}</span>
                      </td>
                      <td>
                        <span className="badge badge-green">Active</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedOrg(item)}>
                          Inspect Org →
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Table Footer Pagination Bar (Matching Screenshot Footer) */}
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
              background: 'var(--bg-surface-elevated)',
            }}
          >
            <span>Showing 1–{activeTab === 'App Users' ? filteredUsers.length : filteredOrgs.length} of 8,421 results</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                className="btn btn-ghost"
                style={{ padding: '4px 8px', height: 28, fontSize: '0.75rem' }}
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              >
                ‹
              </button>
              <button
                className={`btn ${currentPage === 1 ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', height: 28, fontSize: '0.75rem' }}
                onClick={() => setCurrentPage(1)}
              >
                1
              </button>
              <button
                className={`btn ${currentPage === 2 ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', height: 28, fontSize: '0.75rem' }}
                onClick={() => setCurrentPage(2)}
              >
                2
              </button>
              <button
                className={`btn ${currentPage === 3 ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', height: 28, fontSize: '0.75rem' }}
                onClick={() => setCurrentPage(3)}
              >
                3
              </button>
              <span style={{ padding: '4px 6px' }}>...</span>
              <button
                className={`btn ${currentPage === 842 ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', height: 28, fontSize: '0.75rem' }}
                onClick={() => setCurrentPage(842)}
              >
                842
              </button>
              <button
                className="btn btn-ghost"
                style={{ padding: '4px 8px', height: 28, fontSize: '0.75rem' }}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal 1: User Profile Details Modal */}
      {selectedUser && (
        <Modal
          isOpen={Boolean(selectedUser)}
          onClose={() => setSelectedUser(null)}
          title={`User Profile: ${selectedUser.id}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-surface-elevated)', padding: 14, borderRadius: 10 }}>
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>User Location Region</small>
                <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{selectedUser.region}</strong>
              </div>

              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Account Status</small>
                <span className={`badge ${selectedUser.status === 'Active' ? 'badge-green' : 'badge-gray'}`}>
                  {selectedUser.status}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8 }}>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Total Messages Scanned</small>
                <strong style={{ fontSize: '1.25rem', color: 'var(--accent-light)', fontFamily: 'var(--font-mono)' }}>
                  {selectedUser.scannedCount.toLocaleString()}
                </strong>
              </div>

              <div style={{ background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8 }}>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Reports Submitted</small>
                <strong style={{ fontSize: '1.25rem', color: 'var(--amber-text)', fontFamily: 'var(--font-mono)' }}>
                  {selectedUser.reportsCount}
                </strong>
              </div>

              <div style={{ background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8 }}>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Joined Date</small>
                <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  {selectedUser.joined}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 14, marginTop: 4 }}>
              <Button variant="ghost" size="md" onClick={() => setSelectedUser(null)}>
                Close
              </Button>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => handleToggleUserStatus(selectedUser.id)}
                >
                  {selectedUser.status === 'Active' ? 'Suspend User Account' : 'Reactivate User Account'}
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    alert(`Exported activity telemetry log for ${selectedUser.id}!`);
                    setSelectedUser(null);
                  }}
                >
                  📥 Export Activity Log
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal 2: Client Organization Details Modal */}
      {selectedOrg && (
        <Modal
          isOpen={Boolean(selectedOrg)}
          onClose={() => setSelectedOrg(null)}
          title={`Organization Details: ${selectedOrg.name}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-surface-elevated)', padding: 14, borderRadius: 10 }}>
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Organization Type</small>
                <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{selectedOrg.type}</strong>
              </div>
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>API Access Level</small>
                <span className="badge badge-purple">{selectedOrg.apiAccess}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8 }}>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Active Client Devices</small>
                <strong style={{ fontSize: '1.25rem', color: 'var(--accent-light)', fontFamily: 'var(--font-mono)' }}>
                  {selectedOrg.activeClients.toLocaleString()}
                </strong>
              </div>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8 }}>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Onboarding Date</small>
                <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{selectedOrg.joined}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
              <Button variant="ghost" size="md" onClick={() => setSelectedOrg(null)}>
                Close
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  alert(`Exported API usage log for ${selectedOrg.name}!`);
                  setSelectedOrg(null);
                }}
              >
                📥 Export API Usage Log
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </AdminShell>
  );
}

interface ExportHistoryItem {
  filename: string;
  type: string;
  dateGenerated: string;
  records: string;
  size: string;
  status: 'Complete' | 'Processing' | 'Failed';
}

const INITIAL_EXPORT_HISTORY: ExportHistoryItem[] = [
  { filename: 'classification-log-may13.csv', type: 'Full Log', dateGenerated: 'May 13, 2026', records: '12,847 records', size: '2.4 MB', status: 'Complete' },
  { filename: 'globe-export-may10.csv', type: 'Client Export (Globe)', dateGenerated: 'May 10, 2026', records: '1,247 records', size: '340 KB', status: 'Complete' },
  { filename: 'full-dataset-may8.csv', type: 'Training Dataset', dateGenerated: 'May 8, 2026', records: '18,420 records', size: '4.8 MB', status: 'Complete' },
  { filename: 'audit-log-may5.csv', type: 'Audit Log', dateGenerated: 'May 5, 2026', records: '892 entries', size: '1.1 MB', status: 'Complete' },
];

export function AdminExportPage() {
  const [history, setHistory] = useState<ExportHistoryItem[]>(INITIAL_EXPORT_HISTORY);
  const [selectedOrg, setSelectedOrg] = useState('Globe Telecom');
  const [isScopedModalOpen, setIsScopedModalOpen] = useState(false);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);

  // Scoped Export Modal Form State
  const [scopedDateRange, setScopedDateRange] = useState('Last 30 Days');
  const [scopedFormat, setScopedFormat] = useState<'CSV' | 'JSON' | 'Parquet'>('CSV');
  const [maskPhone, setMaskPhone] = useState(true);
  const [hashDeviceId, setHashDeviceId] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const triggerDownload = (filename: string) => {
    setDownloadToast(`Starting download: ${filename}...`);
    setTimeout(() => {
      setDownloadToast(`✓ Downloaded ${filename} successfully!`);
      setTimeout(() => setDownloadToast(null), 3000);
    }, 800);
  };

  const handleSystemExport = (title: string, defaultFilename: string, typeName: string, sizeStr: string) => {
    triggerDownload(defaultFilename);
    const newEntry: ExportHistoryItem = {
      filename: defaultFilename,
      type: typeName,
      dateGenerated: 'May 14, 2026',
      records: '18,420 records',
      size: sizeStr,
      status: 'Complete',
    };
    setHistory((prev) => [newEntry, ...prev.filter((item) => item.filename !== defaultFilename)]);
  };

  const handleConfirmScopedExport = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setIsScopedModalOpen(false);
      const cleanOrgName = selectedOrg.toLowerCase().replace(/[^a-z0-9]/g, '');
      const newFilename = `${cleanOrgName}-scoped-export-${Date.now().toString().slice(-4)}.${scopedFormat.toLowerCase()}`;
      
      const newEntry: ExportHistoryItem = {
        filename: newFilename,
        type: `Client Export (${selectedOrg})`,
        dateGenerated: 'May 14, 2026',
        records: '1,480 records',
        size: '420 KB',
        status: 'Complete',
      };
      
      setHistory((prev) => [newEntry, ...prev]);
      triggerDownload(newFilename);
    }, 900);
  };

  return (
    <AdminShell title="Export Hub">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Toast Notification */}
        {downloadToast && (
          <div
            style={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              background: '#12121a',
              border: '1px solid #10b981',
              color: '#ffffff',
              padding: '12px 20px',
              borderRadius: 10,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              zIndex: 9999,
              fontSize: '0.875rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span>💾</span>
            <span>{downloadToast}</span>
          </div>
        )}

        {/* Section 1: SYSTEM EXPORTS (SUPER ADMIN ONLY) */}
        <div>
          <div style={{ fontSize: '0.75rem', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 12 }}>
            SYSTEM EXPORTS (SUPER ADMIN ONLY)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {/* Card 1: Full Unmasked Classification Log */}
            <div
              className="panel campaign-card-interactive"
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 12,
                padding: 20,
                display: 'flex',
                gap: 16,
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: 'rgba(124, 58, 237, 0.15)',
                  border: '1px solid rgba(124, 58, 237, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  flexShrink: 0,
                }}
              >
                📄
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                  Full Unmasked Classification Log
                </h4>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Complete log including raw sender numbers and full message text. Admin use only.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleSystemExport('Full Unmasked Classification Log', 'classification-log-may14.csv', 'Full Log', '2.5 MB')}
                  style={{ borderRadius: 6, fontSize: '0.8125rem' }}
                >
                  ⬇ Download CSV
                </Button>
              </div>
            </div>

            {/* Card 2: Training Dataset Export */}
            <div
              className="panel campaign-card-interactive"
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 12,
                padding: 20,
                display: 'flex',
                gap: 16,
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  flexShrink: 0,
                }}
              >
                🤖
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                  Training Dataset Export
                </h4>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  All labeled samples (smishing + legitimate) used for model training.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleSystemExport('Training Dataset Export', 'full-dataset-may14.csv', 'Training Dataset', '4.9 MB')}
                  style={{ borderRadius: 6, fontSize: '0.8125rem' }}
                >
                  ⬇ Download CSV
                </Button>
              </div>
            </div>

            {/* Card 3: System Audit Log */}
            <div
              className="panel campaign-card-interactive"
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 12,
                padding: 20,
                display: 'flex',
                gap: 16,
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  flexShrink: 0,
                }}
              >
                🛡️
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                  System Audit Log
                </h4>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  All admin actions, login events, and validation decisions.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleSystemExport('System Audit Log', 'audit-log-may14.csv', 'Audit Log', '1.2 MB')}
                  style={{ borderRadius: 6, fontSize: '0.8125rem' }}
                >
                  ⬇ Download CSV
                </Button>
              </div>
            </div>

            {/* Card 4: Export for Client Organization */}
            <div
              className="panel campaign-card-interactive"
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 12,
                padding: 20,
                display: 'flex',
                gap: 16,
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  flexShrink: 0,
                }}
              >
                👥
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                  Export for Client Organization
                </h4>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Generate a scoped export delivered to a specific client org.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsScopedModalOpen(true)}
                  style={{ borderRadius: 6, fontSize: '0.8125rem', border: '1px solid var(--border-default)' }}
                >
                  ⬇ Configure Scoped Export →
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Client Organization Selector (Interactive Control Panel) */}
        <div
          className="panel campaign-card-interactive"
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 12,
            padding: 20,
          }}
        >
          <label style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 10 }}>
            Client Organization Selector
          </label>

          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={selectedOrg}
              onChange={(e) => setSelectedOrg(e.target.value)}
              style={{
                flex: 1,
                minWidth: 260,
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            >
              <option value="Globe Telecom">Globe Telecom</option>
              <option value="Smart Communications">Smart Communications</option>
              <option value="DITO Telecommunity">DITO Telecommunity</option>
              <option value="CICC (Cybercrime)">CICC (Cybercrime)</option>
              <option value="GCash Risk Team">GCash Risk Team</option>
            </select>

            <Button
              variant="primary"
              size="md"
              onClick={() => setIsScopedModalOpen(true)}
              style={{ borderRadius: 8, padding: '10px 20px', fontSize: '0.875rem', whiteSpace: 'nowrap' }}
            >
              Generate Scoped Export
            </Button>
          </div>

          <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginTop: 10 }}>
            Scoped exports exclude raw sender numbers and mask device IDs.
          </small>
        </div>

        {/* Section 3: EXPORT HISTORY Table */}
        <div className="panel" style={{ padding: 0, overflow: 'hidden', borderRadius: 12, border: '1px solid var(--border-default)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface-elevated)' }}>
            <div style={{ fontSize: '0.75rem', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
              EXPORT HISTORY
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>FILENAME</th>
                  <th>TYPE</th>
                  <th>DATE GENERATED</th>
                  <th>RECORDS</th>
                  <th>SIZE</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row, idx) => (
                  <tr key={idx}>
                    <td>
                      <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                        {row.filename}
                      </strong>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{row.type}</span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>
                        {row.dateGenerated}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-primary)', fontSize: '0.8125rem' }}>{row.records}</span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>
                        {row.size}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-green">{row.status}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => triggerDownload(row.filename)}
                        title={`Download ${row.filename}`}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--accent-light)',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          padding: '4px 8px',
                          borderRadius: 4,
                        }}
                      >
                        ⬇
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: Scoped Export Generator Modal */}
      {isScopedModalOpen && (
        <Modal
          isOpen={isScopedModalOpen}
          onClose={() => setIsScopedModalOpen(false)}
          title={`Configure Scoped Export — ${selectedOrg}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: '0.875rem' }}>
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Target Organization
              </label>
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: '0.875rem',
                }}
              >
                <option value="Globe Telecom">Globe Telecom</option>
                <option value="Smart Communications">Smart Communications</option>
                <option value="DITO Telecommunity">DITO Telecommunity</option>
                <option value="CICC (Cybercrime)">CICC (Cybercrime)</option>
                <option value="GCash Risk Team">GCash Risk Team</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Date Range
                </label>
                <select
                  value={scopedDateRange}
                  onChange={(e) => setScopedDateRange(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    fontSize: '0.875rem',
                  }}
                >
                  <option value="Last 7 Days">Last 7 Days</option>
                  <option value="Last 30 Days">Last 30 Days</option>
                  <option value="Last 90 Days">Last 90 Days</option>
                  <option value="All Time">All Time</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Export Format
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['CSV', 'JSON', 'Parquet'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setScopedFormat(fmt)}
                      style={{
                        flex: 1,
                        padding: '8px 0',
                        borderRadius: 6,
                        border: `1px solid ${scopedFormat === fmt ? 'var(--accent-light)' : 'var(--border-default)'}`,
                        background: scopedFormat === fmt ? 'rgba(124, 58, 237, 0.15)' : 'var(--bg-input)',
                        color: scopedFormat === fmt ? '#ffffff' : 'var(--text-secondary)',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface-elevated)', padding: 14, borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
                Privacy & Data Redaction Controls
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={maskPhone}
                    onChange={(e) => setMaskPhone(e.target.checked)}
                    style={{ accentColor: 'var(--accent-light)' }}
                  />
                  <span>Mask Raw Phone Numbers (e.g. +63 917 *** 4567)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={hashDeviceId}
                    onChange={(e) => setHashDeviceId(e.target.checked)}
                    style={{ accentColor: 'var(--accent-light)' }}
                  />
                  <span>Hash Device Unique IDs & IMSI Tokens</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
              <Button variant="ghost" size="md" onClick={() => setIsScopedModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="md" onClick={handleConfirmScopedExport} disabled={isGenerating}>
                {isGenerating ? 'Generating...' : `Generate & Download ${scopedFormat}`}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </AdminShell>
  );
}

// SERVER MONITORING PAGE (Matching User's Reference Screenshot)
interface ServerEventItem {
  timestamp: string;
  event: string;
  severity: 'Info' | 'Warning' | 'Notice' | 'Error';
  details: string;
}

const RECENT_SERVER_EVENTS: ServerEventItem[] = [
  { timestamp: 'May 14 02:00', event: 'Automated retraining check', severity: 'Info', details: 'No retraining triggered — FN threshold not exceeded' },
  { timestamp: 'May 14 01:00', event: 'Database backup completed', severity: 'Info', details: '18,420 records backed up successfully' },
  { timestamp: 'May 13 22:15', event: 'API rate-limit burst', severity: 'Warning', details: 'Client org Globe IP 112.198.x rate limit applied' },
  { timestamp: 'May 13 18:40', event: 'Cluster re-indexing job', severity: 'Info', details: '84 new SMS threat clusters synchronized' },
  { timestamp: 'May 13 12:00', event: 'Scheduled batch job peak', severity: 'Notice', details: 'Peak latency reached 312ms at 12:00 PM' },
  { timestamp: 'May 13 06:30', event: 'System Health Check', severity: 'Info', details: 'All microservices responded cleanly within 14ms' },
];

export function AdminServerPage({ tab = 'server' }: { tab?: 'server' | 'api' | 'db' }) {
  const navigate = useNavigate();
  const [activeSubTab, setActiveSubTab] = useState<'server' | 'api' | 'db'>(tab);
  const [lastChecked, setLastChecked] = useState('2m ago');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ServerEventItem | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);

  const handleRefreshHealth = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastChecked('just now');
      setIsRefreshing(false);
    }, 600);
  };

  // 24 Hour Response Time Chart Data Points
  const responseData = [
    { time: '00:00', ms: 140 },
    { time: '03:00', ms: 145 },
    { time: '06:00', ms: 152 },
    { time: '09:00', ms: 188 },
    { time: '12:00', ms: 312, isPeak: true },
    { time: '15:00', ms: 240 },
    { time: '18:00', ms: 195 },
    { time: '21:00', ms: 160 },
    { time: '24:00', ms: 142 },
  ];

  const microservicesList = [
    { name: 'Backend API', status: 'Operational', latency: '14ms', icon: '🔌' },
    { name: 'Classification Engine', status: 'Operational', latency: '82ms', icon: '🤖' },
    { name: 'Database (PostgreSQL)', status: 'Operational', latency: '6ms', icon: '🗄️' },
    { name: 'Campaign Clustering', status: 'Operational', latency: '24ms', icon: '🔗' },
    { name: 'Mobile App Sync', status: 'Operational', latency: '18ms', icon: '📱' },
    { name: 'Web Dashboard', status: 'Operational', latency: '12ms', icon: '💻' },
  ];

  return (
    <AdminShell title="Server Monitoring">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header Title & Subtitle + Refresh Indicator Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <button
            onClick={handleRefreshHealth}
            className="btn btn-ghost"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-default)',
              padding: '6px 14px',
              borderRadius: 8,
            }}
          >
            <span style={{ display: 'inline-block', transform: isRefreshing ? 'rotate(360deg)' : 'none', transition: 'transform 0.6s ease' }}>
              🔄
            </span>
            <span>Last checked {lastChecked}</span>
          </button>
        </div>

        {/* View Filter Tabs Row (Matching Screenshot Top Tabs) */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className={`btn ${activeSubTab === 'server' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setActiveSubTab('server'); navigate('/admin/server'); }}
            style={{ borderRadius: 8, padding: '8px 18px', fontSize: '0.8125rem' }}
          >
            💻 Server Monitoring
          </button>
          <button
            className={`btn ${activeSubTab === 'api' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setActiveSubTab('api'); navigate('/admin/api-logs'); }}
            style={{ borderRadius: 8, padding: '8px 18px', fontSize: '0.8125rem' }}
          >
            💬 API Logs
          </button>
          <button
            className={`btn ${activeSubTab === 'db' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setActiveSubTab('db'); navigate('/admin/db-storage'); }}
            style={{ borderRadius: 8, padding: '8px 18px', fontSize: '0.8125rem' }}
          >
            🗄️ DB Storage
          </button>
        </div>

        {/* Top 4 KPI Metric Cards (Maximized Space & Interactive Hover Effects) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { id: 'resp', icon: '⚡', title: 'API Response Time', val: '142ms', valColor: '#10b981', sub: '↓ 12ms vs yesterday', subColor: '#10b981', bgIcon: 'rgba(16, 185, 129, 0.15)', borderIcon: 'rgba(16, 185, 129, 0.3)' },
            { id: 'upt', icon: '📶', title: 'Backend Uptime', val: '99.97%', valColor: '#10b981', sub: 'All services operational', subColor: 'var(--text-muted)', bgIcon: 'rgba(16, 185, 129, 0.15)', borderIcon: 'rgba(16, 185, 129, 0.3)' },
            { id: 'conn', icon: '🔌', title: 'Active Connections', val: '47', valColor: 'var(--text-primary)', sub: 'Live WebSocket clients', subColor: 'var(--text-muted)', bgIcon: 'rgba(124, 58, 237, 0.15)', borderIcon: 'rgba(124, 58, 237, 0.3)' },
            { id: 'err', icon: 'ⓘ', title: 'Error Rate', val: '0.02%', valColor: '#10b981', sub: 'All clear — no alerts', subColor: '#10b981', bgIcon: 'rgba(16, 185, 129, 0.15)', borderIcon: 'rgba(16, 185, 129, 0.3)' },
          ].map((card) => (
            <div
              key={card.id}
              className="panel campaign-card-interactive"
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 12,
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: 120,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{card.title}</span>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: card.bgIcon, border: `1px solid ${card.borderIcon}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                  {card.icon}
                </div>
              </div>

              <div>
                <strong style={{ fontSize: '1.75rem', color: card.valColor, fontFamily: 'var(--font-mono)', fontWeight: 800, lineHeight: 1.1 }}>
                  {card.val}
                </strong>
                <small style={{ fontSize: '0.75rem', color: card.subColor, display: 'block', marginTop: 4, fontWeight: 600 }}>
                  {card.sub}
                </small>
              </div>
            </div>
          ))}
        </div>

        {/* Main Grid: Left Response Time Chart (2/3) + Right Service Status (1/3) */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          {/* Left Panel: RESPONSE TIME — LAST 24 HOURS */}
          <div className="panel" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)', padding: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.75rem', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
                RESPONSE TIME — LAST 24 HOURS
              </div>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginTop: 2 }}>
                Dashed line = 500ms warning threshold · Peak at noon due to scheduled batch jobs
              </small>
            </div>

            {/* Interactive Custom SVG Latency Line Chart (Full Width Clean Vector) */}
            <div style={{ position: 'relative', width: '100%', height: 220, marginTop: 10 }}>
              <svg width="100%" height="180" viewBox="0 0 960 180" style={{ overflow: 'visible' }}>
                {/* Background horizontal grid lines & Y labels */}
                {[
                  { label: '600ms', y: 20 },
                  { label: '500ms', y: 50 },
                  { label: '400ms', y: 80 },
                  { label: '300ms', y: 110 },
                  { label: '200ms', y: 140 },
                  { label: '100ms', y: 160 },
                  { label: '0ms', y: 175 },
                ].map((g) => (
                  <g key={g.label}>
                    <line x1="45" y1={g.y} x2="940" y2={g.y} stroke={g.label === '500ms' ? '#f59e0b' : 'var(--border-subtle)'} strokeDasharray={g.label === '500ms' ? '4 4' : 'none'} strokeWidth={g.label === '500ms' ? 1.5 : 1} strokeOpacity={g.label === '500ms' ? 0.8 : 0.4} />
                    <text x="35" y={g.y + 4} fill={g.label === '500ms' ? '#f59e0b' : 'var(--text-muted)'} fontSize="10" textAnchor="end">
                      {g.label}
                    </text>
                  </g>
                ))}

                {/* 500ms Warning Threshold Text Callout */}
                <text x="935" y="46" fill="#f59e0b" fontSize="11" fontWeight="700" textAnchor="end">
                  --- 500ms
                </text>

                {/* Gradient Fill under Line */}
                <defs>
                  <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Shaded Area */}
                <polygon
                  points="60,138 165,136 270,134 375,123 480,86 585,108 690,121 795,132 900,137 900,175 60,175"
                  fill="url(#latencyGradient)"
                />

                {/* Green Glowing Trend Line */}
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points="60,138 165,136 270,134 375,123 480,86 585,108 690,121 795,132 900,137"
                />

                {/* Peak Callout Badge at 12:00 (480, 86) */}
                <g transform="translate(480, 62)">
                  <rect x="-42" y="-14" width="84" height="22" rx="4" fill="#f59e0b" />
                  <text x="0" y="2" fill="#000" fontSize="11" fontWeight="800" textAnchor="middle">
                    Peak 312ms
                  </text>
                </g>

                {/* Data Points */}
                {responseData.map((pt, idx) => {
                  const x = 60 + idx * 105;
                  const y = 175 - (pt.ms / 600) * 155;
                  const isHovered = hoveredPointIdx === idx;

                  return (
                    <g key={pt.time} onMouseEnter={() => setHoveredPointIdx(idx)} onMouseLeave={() => setHoveredPointIdx(null)} style={{ cursor: 'pointer' }}>
                      <circle
                        cx={x}
                        cy={y}
                        r={pt.isPeak ? 5 : isHovered ? 6 : 4}
                        fill={pt.isPeak ? '#f59e0b' : '#10b981'}
                        stroke="#12121a"
                        strokeWidth="2"
                      />

                      {/* Tooltip on Hover */}
                      {isHovered && (
                        <g transform={`translate(${x}, ${y - 24})`}>
                          <rect x="-45" y="-12" width="90" height="20" rx="4" fill="#1a1a26" stroke="#10b981" strokeWidth="1" />
                          <text x="0" y="2" fill="#ffffff" fontSize="10" fontWeight="600" textAnchor="middle">
                            {pt.time}: {pt.ms}ms
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* X-Axis Labels */}
                {responseData.map((pt, idx) => {
                  const x = 60 + idx * 105;
                  return (
                    <text key={pt.time} x={x} y="195" fill="var(--text-muted)" fontSize="10" textAnchor="middle">
                      {pt.time}
                    </text>
                  );
                })}
              </svg>
            </div>

            <div style={{ fontSize: '0.8125rem', color: '#10b981', marginTop: 24, fontWeight: 600 }}>
              ✓ All requests within acceptable thresholds
            </div>
          </div>

          {/* Right Panel: SERVICE STATUS */}
          <div className="panel" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)', padding: 20 }}>
            <div style={{ fontSize: '0.75rem', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 16, fontWeight: 700 }}>
              SERVICE STATUS
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {microservicesList.map((svc) => (
                <div
                  key={svc.name}
                  onClick={() => setSelectedService(svc.name)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  className="campaign-card-interactive"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{svc.icon}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{svc.name}</span>
                  </div>
                  <span className="badge badge-green">Operational</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Panel: Recent Server Events Table */}
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface-elevated)' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
              Recent Server Events
            </h3>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>TIMESTAMP</th>
                  <th>EVENT</th>
                  <th>SEVERITY</th>
                  <th>DETAILS</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {RECENT_SERVER_EVENTS.map((evt, idx) => (
                  <tr key={idx}>
                    <td>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>
                        {evt.timestamp}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>{evt.event}</strong>
                    </td>
                    <td>
                      {evt.severity === 'Info' && <span className="badge badge-blue">Info</span>}
                      {evt.severity === 'Warning' && <span className="badge badge-amber">Warning</span>}
                      {evt.severity === 'Notice' && <span className="badge badge-purple">Notice</span>}
                      {evt.severity === 'Error' && <span className="badge badge-red">Error</span>}
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{evt.details}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedEvent(evt)}>
                        Inspect Event →
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal 1: Server Event Audit Log Modal */}
      {selectedEvent && (
        <Modal
          isOpen={Boolean(selectedEvent)}
          onClose={() => setSelectedEvent(null)}
          title={`Server Event Audit: ${selectedEvent.event}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-surface-elevated)', padding: 14, borderRadius: 10 }}>
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Event Timestamp</small>
                <strong style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{selectedEvent.timestamp}</strong>
              </div>
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Severity Level</small>
                <span className={`badge ${selectedEvent.severity === 'Warning' ? 'badge-amber' : 'badge-blue'}`}>
                  {selectedEvent.severity}
                </span>
              </div>
            </div>

            <div>
              <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Diagnostic Details</small>
              <div
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-default)',
                  padding: 14,
                  borderRadius: 8,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8125rem',
                  color: 'var(--text-primary)',
                  lineHeight: 1.5,
                }}
              >
                {selectedEvent.details}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
              <Button variant="ghost" size="md" onClick={() => setSelectedEvent(null)}>
                Close Audit
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal 2: Microservice Audit Modal */}
      {selectedService && (
        <Modal
          isOpen={Boolean(selectedService)}
          onClose={() => setSelectedService(null)}
          title={`Microservice Health Audit: ${selectedService}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-surface-elevated)', padding: 14, borderRadius: 10 }}>
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Service Name</small>
                <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{selectedService}</strong>
              </div>
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Health Indicator</small>
                <span className="badge badge-green">100% Operational</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8 }}>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>P99 Latency</small>
                <strong style={{ fontSize: '1.25rem', color: 'var(--green-text)', fontFamily: 'var(--font-mono)' }}>14ms</strong>
              </div>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8 }}>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Memory Utilization</small>
                <strong style={{ fontSize: '1.25rem', color: 'var(--accent-light)', fontFamily: 'var(--font-mono)' }}>34% (512MB)</strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
              <Button variant="ghost" size="md" onClick={() => setSelectedService(null)}>
                Close Audit
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </AdminShell>
  );
}

// API LOGS PAGE (Matching Photo 1 in Reference Request)
interface ApiLogItem {
  timestamp: string;
  endpoint: string;
  status: string;
  latency: string;
  client: string;
  payloadSample?: string;
}

const RECENT_API_LOGS: ApiLogItem[] = [
  { timestamp: 'May 14 08:12', endpoint: 'POST /api/v1/classify', status: '200 OK', latency: '142ms', client: 'Globe Telecom', payloadSample: '{"text": "URGENT: GCash account locked. Click http://gcash-ph.net", "sender": "09171234567"}' },
  { timestamp: 'May 14 08:11', endpoint: 'GET /api/v1/campaigns', status: '200 OK', latency: '68ms', client: 'Smart Communications' },
  { timestamp: 'May 14 08:09', endpoint: 'POST /api/v1/report', status: '200 OK', latency: '115ms', client: 'CICC (Cybercrime)' },
  { timestamp: 'May 14 08:05', endpoint: 'POST /api/v1/classify', status: '429 Rate Limit Exceeded', latency: '4ms', client: 'GCash Risk Team', payloadSample: 'Rate limit threshold exceeded: 100 req/min for IP 112.198.45.12' },
  { timestamp: 'May 14 07:58', endpoint: 'GET /api/v1/drift-metrics', status: '200 OK', latency: '210ms', client: 'Internal Web Dashboard' },
  { timestamp: 'May 14 07:45', endpoint: 'POST /api/v1/feedback', status: '200 OK', latency: '95ms', client: 'Mobile App Sync Client' },
  { timestamp: 'May 14 07:30', endpoint: 'GET /api/v1/users/telemetry', status: '200 OK', latency: '88ms', client: 'Globe Telecom' },
  { timestamp: 'May 14 07:15', endpoint: 'POST /api/v1/classify', status: '200 OK', latency: '132ms', client: 'Smart Communications' },
];

export function AdminApiLogsPage() {
  const navigate = useNavigate();
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);
  const [selectedApiLog, setSelectedApiLog] = useState<ApiLogItem | null>(null);

  // Hourly Latency & Request Volume Data for Graph
  const apiGraphData = [
    { time: '00:00', ms: 140, reqs: 420 },
    { time: '03:00', ms: 145, reqs: 380 },
    { time: '06:00', ms: 152, reqs: 590 },
    { time: '09:00', ms: 188, reqs: 910 },
    { time: '12:00', ms: 312, reqs: 1480, isPeak: true },
    { time: '15:00', ms: 240, reqs: 1120 },
    { time: '18:00', ms: 195, reqs: 850 },
    { time: '21:00', ms: 160, reqs: 640 },
    { time: '24:00', ms: 142, reqs: 460 },
  ];

  return (
    <AdminShell title="API Logs">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header Title & Subtitle */}
        {/* Top Sub-Tabs Row (Matching Photo 1) */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-ghost"
            onClick={() => navigate('/admin/server')}
            style={{ borderRadius: 8, padding: '8px 18px', fontSize: '0.8125rem' }}
          >
            💻 Server Monitoring
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/admin/api-logs')}
            style={{ borderRadius: 8, padding: '8px 18px', fontSize: '0.8125rem' }}
          >
            💬 API Logs
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => navigate('/admin/db-storage')}
            style={{ borderRadius: 8, padding: '8px 18px', fontSize: '0.8125rem' }}
          >
            🗄️ DB Storage
          </button>
        </div>

        {/* Metric Cards Grid (Maximized Space & Interactive Hover Effects) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { id: 'req', icon: '📈', title: 'Requests Today', val: '8,241', valColor: 'var(--text-primary)', sub: 'Total API consumption', subColor: 'var(--text-muted)', bgIcon: 'rgba(59, 130, 246, 0.15)', borderIcon: 'rgba(59, 130, 246, 0.3)' },
            { id: 'lat', icon: '⚡', title: 'Avg Latency', val: '142ms', valColor: '#10b981', sub: 'Optimal response rate', subColor: '#10b981', bgIcon: 'rgba(16, 185, 129, 0.15)', borderIcon: 'rgba(16, 185, 129, 0.3)' },
            { id: 'err4', icon: 'ⓘ', title: '4xx Errors', val: '12', valColor: '#f59e0b', sub: 'Today (Rate-limits & bad reqs)', subColor: '#f59e0b', bgIcon: 'rgba(245, 158, 11, 0.15)', borderIcon: 'rgba(245, 158, 11, 0.3)' },
            { id: 'err5', icon: 'ⓘ', title: '5xx Errors', val: '0', valColor: '#10b981', sub: 'All clear — zero server crashes', subColor: '#10b981', bgIcon: 'rgba(16, 185, 129, 0.15)', borderIcon: 'rgba(16, 185, 129, 0.3)' },
          ].map((card) => (
            <div
              key={card.id}
              className="panel campaign-card-interactive"
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 12,
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: 120,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{card.title}</span>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: card.bgIcon, border: `1px solid ${card.borderIcon}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                  {card.icon}
                </div>
              </div>

              <div>
                <strong style={{ fontSize: '1.75rem', color: card.valColor, fontFamily: 'var(--font-mono)', fontWeight: 800, lineHeight: 1.1 }}>
                  {card.val}
                </strong>
                <small style={{ fontSize: '0.75rem', color: card.subColor, display: 'block', marginTop: 4, fontWeight: 600 }}>
                  {card.sub}
                </small>
              </div>
            </div>
          ))}
        </div>

        {/* Main Panel: REQUEST VOLUME — LAST 24 HOURS (Interactive SVG with Hover Tooltips) */}
        <div className="panel" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)', padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.75rem', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
              REQUEST VOLUME — LAST 24 HOURS
            </div>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginTop: 2 }}>
              Hourly request count · peaks coincide with shift start and scheduled exports
            </small>
          </div>

          {/* SVG Line Chart with Interactive Hover Dots (Full Width Clean Vector) */}
          <div style={{ position: 'relative', width: '100%', height: 220, marginTop: 10 }}>
            <svg width="100%" height="180" viewBox="0 0 960 180" style={{ overflow: 'visible' }}>
              {[
                { label: '600ms', y: 20 },
                { label: '500ms', y: 50 },
                { label: '400ms', y: 80 },
                { label: '300ms', y: 110 },
                { label: '200ms', y: 140 },
                { label: '100ms', y: 160 },
                { label: '0ms', y: 175 },
              ].map((g) => (
                <g key={g.label}>
                  <line x1="45" y1={g.y} x2="940" y2={g.y} stroke={g.label === '500ms' ? '#f59e0b' : 'var(--border-subtle)'} strokeDasharray={g.label === '500ms' ? '4 4' : 'none'} strokeWidth={g.label === '500ms' ? 1.5 : 1} strokeOpacity={g.label === '500ms' ? 0.8 : 0.4} />
                  <text x="35" y={g.y + 4} fill={g.label === '500ms' ? '#f59e0b' : 'var(--text-muted)'} fontSize="10" textAnchor="end">
                    {g.label}
                  </text>
                </g>
              ))}

              <text x="935" y="46" fill="#f59e0b" fontSize="11" fontWeight="700" textAnchor="end">
                --- 500ms
              </text>

              <defs>
                <linearGradient id="apiLatencyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              <polygon points="60,138 165,136 270,134 375,123 480,86 585,108 690,121 795,132 900,137 900,175 60,175" fill="url(#apiLatencyGrad)" />

              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points="60,138 165,136 270,134 375,123 480,86 585,108 690,121 795,132 900,137"
              />

              <g transform="translate(480, 62)">
                <rect x="-42" y="-14" width="84" height="22" rx="4" fill="#f59e0b" />
                <text x="0" y="2" fill="#000" fontSize="11" fontWeight="800" textAnchor="middle">
                  Peak 312ms
                </text>
              </g>

              {apiGraphData.map((pt, idx) => {
                const x = 60 + idx * 105;
                const y = 175 - (pt.ms / 600) * 155;
                const isHovered = hoveredPointIdx === idx;

                return (
                  <g key={pt.time} onMouseEnter={() => setHoveredPointIdx(idx)} onMouseLeave={() => setHoveredPointIdx(null)} style={{ cursor: 'pointer' }}>
                    <circle
                      cx={x}
                      cy={y}
                      r={pt.isPeak ? 6 : isHovered ? 7 : 4}
                      fill={pt.isPeak ? '#f59e0b' : '#10b981'}
                      stroke="#12121a"
                      strokeWidth="2"
                    />

                    {isHovered && (
                      <g transform={`translate(${x}, ${y - 30})`}>
                        <rect x="-65" y="-14" width="130" height="26" rx="6" fill="#1a1a26" stroke="#10b981" strokeWidth="1.5" />
                        <text x="0" y="3" fill="#ffffff" fontSize="10" fontWeight="700" textAnchor="middle">
                          {pt.time} · {pt.ms}ms ({pt.reqs} req/h)
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {apiGraphData.map((pt, idx) => {
                const x = 60 + idx * 105;
                return (
                  <text key={pt.time} x={x} y="195" fill="var(--text-muted)" fontSize="10" textAnchor="middle">
                    {pt.time}
                  </text>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Bottom Panel: Recent API Requests Table (Matching Photo 1) */}
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface-elevated)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
              Recent API Requests
            </h3>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Showing last 8 · updated live</small>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>TIMESTAMP</th>
                  <th>ENDPOINT</th>
                  <th>STATUS</th>
                  <th>LATENCY</th>
                  <th>CLIENT</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {RECENT_API_LOGS.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>
                        {item.timestamp}
                      </span>
                    </td>
                    <td>
                      <code style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                        {item.endpoint}
                      </code>
                    </td>
                    <td>
                      {item.status.startsWith('200') ? (
                        <span className="badge badge-green">{item.status}</span>
                      ) : (
                        <span className="badge badge-amber">{item.status}</span>
                      )}
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>
                        {item.latency}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>{item.client}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedApiLog(item)}>
                        Inspect Call →
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: API Log Details Modal */}
      {selectedApiLog && (
        <Modal
          isOpen={Boolean(selectedApiLog)}
          onClose={() => setSelectedApiLog(null)}
          title={`API Request Inspection: ${selectedApiLog.endpoint}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-surface-elevated)', padding: 14, borderRadius: 10 }}>
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Consumer Client</small>
                <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{selectedApiLog.client}</strong>
              </div>

              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>HTTP Response Status</small>
                <span className={`badge ${selectedApiLog.status.startsWith('200') ? 'badge-green' : 'badge-amber'}`}>
                  {selectedApiLog.status}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8 }}>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Execution Latency</small>
                <strong style={{ fontSize: '1.25rem', color: '#10b981', fontFamily: 'var(--font-mono)' }}>{selectedApiLog.latency}</strong>
              </div>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8 }}>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Timestamp</small>
                <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{selectedApiLog.timestamp}</strong>
              </div>
            </div>

            {selectedApiLog.payloadSample && (
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Raw JSON Payload / Log Stream</small>
                <div
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-default)',
                    padding: 14,
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8125rem',
                    lineHeight: 1.5,
                  }}
                >
                  {selectedApiLog.payloadSample}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
              <Button variant="ghost" size="md" onClick={() => setSelectedApiLog(null)}>
                Close Inspection
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </AdminShell>
  );
}

// DB STORAGE PAGE (Matching Photo 2 in Reference Request)
interface DbTableDetailItem {
  tableName: string;
  rowCount: string;
  size: string;
  indexes: number;
  lastWrite: string;
}

const DB_TABLES_DATA: DbTableDetailItem[] = [
  { tableName: 'messages', rowCount: '18,420', size: '4.2 GB', indexes: 6, lastWrite: '14s ago' },
  { tableName: 'campaigns', rowCount: '31', size: '840 KB', indexes: 3, lastWrite: '4m ago' },
  { tableName: 'users', rowCount: '2,847', size: '92 MB', indexes: 4, lastWrite: '9m ago' },
  { tableName: 'reports', rowCount: '312', size: '18 MB', indexes: 2, lastWrite: '2m ago' },
  { tableName: 'training_set', rowCount: '12,450', size: '6.8 GB', indexes: 8, lastWrite: '1h ago' },
  { tableName: 'audit_log', rowCount: '45,210', size: '1.1 GB', indexes: 5, lastWrite: '30s ago' },
];

export function AdminDbStoragePage() {
  const navigate = useNavigate();
  const [hoveredMonthIdx, setHoveredMonthIdx] = useState<number | null>(null);
  const [selectedTable, setSelectedTable] = useState<DbTableDetailItem | null>(null);

  // Storage Growth Data (Dec 2025 to May 2026)
  const growthData = [
    { month: 'Dec', gb: 12.1, delta: '+1.2 GB' },
    { month: 'Jan', gb: 14.8, delta: '+2.7 GB' },
    { month: 'Feb', gb: 17.2, delta: '+2.4 GB' },
    { month: 'Mar', gb: 20.4, delta: '+3.2 GB' },
    { month: 'Apr', gb: 24.1, delta: '+3.7 GB' },
    { month: 'May', gb: 27.6, delta: '+3.5 GB' },
  ];

  return (
    <AdminShell title="DB Storage">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header Title */}
        {/* Top Sub-Tabs Row (Matching Photo 2) */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-ghost"
            onClick={() => navigate('/admin/server')}
            style={{ borderRadius: 8, padding: '8px 18px', fontSize: '0.8125rem' }}
          >
            💻 Server Monitoring
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => navigate('/admin/api-logs')}
            style={{ borderRadius: 8, padding: '8px 18px', fontSize: '0.8125rem' }}
          >
            💬 API Logs
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/admin/db-storage')}
            style={{ borderRadius: 8, padding: '8px 18px', fontSize: '0.8125rem' }}
          >
            🗄️ DB Storage
          </button>
        </div>

        {/* Top 4 KPI Metric Cards (Maximized Space & Interactive Hover Effects) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { id: 'used', icon: '💾', title: 'Storage Used', val: '27.6 GB', valColor: '#a855f7', sub: '35% of 80 GB capacity', subColor: '#ef4444', bgIcon: 'rgba(168, 85, 247, 0.15)', borderIcon: 'rgba(168, 85, 247, 0.3)' },
            { id: 'avail', icon: '🗄️', title: 'Storage Available', val: '52.4 GB', valColor: '#10b981', sub: 'Free allocation remaining', subColor: 'var(--text-muted)', bgIcon: 'rgba(16, 185, 129, 0.15)', borderIcon: 'rgba(16, 185, 129, 0.3)' },
            { id: 'recs', icon: '⚡', title: 'Total Records', val: '18,420', valColor: 'var(--text-primary)', sub: 'Indexed PostgreSQL rows', subColor: 'var(--text-muted)', bgIcon: 'rgba(124, 58, 237, 0.15)', borderIcon: 'rgba(124, 58, 237, 0.3)' },
            { id: 'bkp', icon: '🛡️', title: 'Last Full Backup', val: '1 day ago', valColor: '#10b981', sub: 'Automated snapshot healthy', subColor: '#10b981', bgIcon: 'rgba(16, 185, 129, 0.15)', borderIcon: 'rgba(16, 185, 129, 0.3)' },
          ].map((card) => (
            <div
              key={card.id}
              className="panel campaign-card-interactive"
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 12,
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: 120,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{card.title}</span>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: card.bgIcon, border: `1px solid ${card.borderIcon}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                  {card.icon}
                </div>
              </div>

              <div>
                <strong style={{ fontSize: '1.75rem', color: card.valColor, fontFamily: 'var(--font-mono)', fontWeight: 800, lineHeight: 1.1 }}>
                  {card.val}
                </strong>
                <small style={{ fontSize: '0.75rem', color: card.subColor, display: 'block', marginTop: 4, fontWeight: 600 }}>
                  {card.sub}
                </small>
              </div>
            </div>
          ))}
        </div>

        {/* Main Grid: STORAGE GROWTH (2/3) + CAPACITY OVERVIEW (1/3) */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          {/* Left Panel: STORAGE GROWTH — DEC 2025 TO MAY 2026 */}
          <div className="panel" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)', padding: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.75rem', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
                STORAGE GROWTH — DEC 2025 TO MAY 2026
              </div>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginTop: 2 }}>
                Dashed line = 75% capacity warning (60 GB)
              </small>
            </div>

            {/* Interactive SVG Storage Growth Line Chart with Hover Dots (Full Width Clean Vector) */}
            <div style={{ position: 'relative', width: '100%', height: 210, marginTop: 10 }}>
              <svg width="100%" height="180" viewBox="0 0 960 180" style={{ overflow: 'visible' }}>
                {[
                  { label: '80 GB', y: 20 },
                  { label: '60 GB', y: 55 },
                  { label: '40 GB', y: 95 },
                  { label: '20 GB', y: 135 },
                  { label: '0 GB', y: 175 },
                ].map((g) => (
                  <g key={g.label}>
                    <line x1="45" y1={g.y} x2="940" y2={g.y} stroke={g.label === '60 GB' ? '#f59e0b' : 'var(--border-subtle)'} strokeDasharray={g.label === '60 GB' ? '4 4' : 'none'} strokeWidth={g.label === '60 GB' ? 1.5 : 1} strokeOpacity={g.label === '60 GB' ? 0.8 : 0.4} />
                    <text x="35" y={g.y + 4} fill={g.label === '60 GB' ? '#f59e0b' : 'var(--text-muted)'} fontSize="10" textAnchor="end">
                      {g.label}
                    </text>
                  </g>
                ))}

                <text x="935" y="51" fill="#f59e0b" fontSize="11" fontWeight="700" textAnchor="end">
                  --- 75% (60 GB)
                </text>

                <defs>
                  <linearGradient id="storagePurpleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Shaded Storage Growth Area */}
                <polygon points="70,152 238,146 406,141 574,135 742,128 910,121 910,175 70,175" fill="url(#storagePurpleGrad)" />

                {/* Purple Trend Line */}
                <polyline
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points="70,152 238,146 406,141 574,135 742,128 910,121"
                />

                {/* Interactive Dots for Months */}
                {growthData.map((pt, idx) => {
                  const x = 70 + idx * 168;
                  const y = 175 - (pt.gb / 80) * 155;
                  const isHovered = hoveredMonthIdx === idx;

                  return (
                    <g key={pt.month} onMouseEnter={() => setHoveredMonthIdx(idx)} onMouseLeave={() => setHoveredMonthIdx(null)} style={{ cursor: 'pointer' }}>
                      <circle
                        cx={x}
                        cy={y}
                        r={isHovered ? 7 : 5}
                        fill="#8b5cf6"
                        stroke="#12121a"
                        strokeWidth="2"
                      />

                      {/* Callout Label above dot (Hidden when hovered so tooltip doesn't overlap) */}
                      {!isHovered && (
                        <text x={x} y={y - 10} fill="#ffffff" fontSize="11" fontWeight="700" textAnchor="middle">
                          {pt.gb}
                        </text>
                      )}

                      {/* Tooltip on Hover */}
                      {isHovered && (
                        <g transform={`translate(${x}, ${y - 34})`}>
                          <rect x="-65" y="-14" width="130" height="26" rx="6" fill="#12121a" stroke="#8b5cf6" strokeWidth="1.5" />
                          <text x="0" y="3" fill="#ffffff" fontSize="10" fontWeight="700" textAnchor="middle">
                            {pt.month} 2026: {pt.gb} GB ({pt.delta})
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* X-Axis Month Labels */}
                {growthData.map((pt, idx) => {
                  const x = 70 + idx * 168;
                  return (
                    <text key={pt.month} x={x} y="195" fill="var(--text-muted)" fontSize="10" textAnchor="middle">
                      {pt.month}
                    </text>
                  );
                })}
              </svg>
            </div>

            <div style={{ fontSize: '0.8125rem', color: '#10b981', marginTop: 24, fontWeight: 600 }}>
              Current growth rate: ~3.5 GB/month · Estimated full in ~15 months at current rate
            </div>
          </div>

          {/* Right Panel: CAPACITY OVERVIEW (Matching Photo 2) */}
          <div className="panel" style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)', padding: 20 }}>
            <div style={{ fontSize: '0.75rem', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 16, fontWeight: 700 }}>
              CAPACITY OVERVIEW
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: 6 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Used</span>
                <strong style={{ color: '#8b5cf6', fontFamily: 'var(--font-mono)' }}>27.6 GB (35%)</strong>
              </div>
              <div style={{ height: 10, width: '100%', background: 'var(--bg-input)', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '35%', background: 'linear-gradient(90deg, #8b5cf6, #a855f7)', borderRadius: 5 }} />
              </div>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>
                80 GB total allocation
              </small>
            </div>

            {/* Table Allocation Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: '0.8125rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <code style={{ color: 'var(--text-primary)' }}>messages</code>
                  <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>4.2 GB</strong>
                </div>
                <div style={{ height: 6, width: '100%', background: 'var(--bg-input)', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: '30%', background: '#8b5cf6', borderRadius: 3 }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <code style={{ color: 'var(--text-primary)' }}>training_set</code>
                  <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>6.8 GB</strong>
                </div>
                <div style={{ height: 6, width: '100%', background: 'var(--bg-input)', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: '50%', background: '#a855f7', borderRadius: 3 }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <code style={{ color: 'var(--text-primary)' }}>audit_log</code>
                  <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>1.1 GB</strong>
                </div>
                <div style={{ height: 6, width: '100%', background: 'var(--bg-input)', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: '15%', background: '#60a5fa', borderRadius: 3 }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <code style={{ color: 'var(--text-primary)' }}>other tables</code>
                  <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>15.5 GB</strong>
                </div>
                <div style={{ height: 6, width: '100%', background: 'var(--bg-input)', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: '80%', background: '#34d399', borderRadius: 3 }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Panel: Table Details Table (Matching Photo 2) */}
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface-elevated)' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
              Table Details
            </h3>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>TABLE NAME</th>
                  <th>ROW COUNT</th>
                  <th>SIZE</th>
                  <th>INDEXES</th>
                  <th>LAST WRITE</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {DB_TABLES_DATA.map((tbl) => (
                  <tr key={tbl.tableName}>
                    <td>
                      <code style={{ color: '#8b5cf6', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        {tbl.tableName}
                      </code>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
                        {tbl.rowCount}
                      </strong>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>
                        {tbl.size}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{tbl.indexes}</span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{tbl.lastWrite}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedTable(tbl)}>
                        Inspect Table →
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: DB Table Schema Inspection Modal */}
      {selectedTable && (
        <Modal
          isOpen={Boolean(selectedTable)}
          onClose={() => setSelectedTable(null)}
          title={`Table Schema Inspection: ${selectedTable.tableName}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-surface-elevated)', padding: 14, borderRadius: 10 }}>
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Target PostgreSQL Table</small>
                <code style={{ fontSize: '1.125rem', color: '#8b5cf6', fontFamily: 'var(--font-mono)' }}>{selectedTable.tableName}</code>
              </div>
              <div>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Table Size</small>
                <strong style={{ fontSize: '1.125rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{selectedTable.size}</strong>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8 }}>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Row Count</small>
                <strong style={{ fontSize: '1.125rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{selectedTable.rowCount}</strong>
              </div>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8 }}>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Active Indexes</small>
                <strong style={{ fontSize: '1.125rem', color: 'var(--accent-light)', fontFamily: 'var(--font-mono)' }}>{selectedTable.indexes}</strong>
              </div>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: 12, borderRadius: 8 }}>
                <small style={{ color: 'var(--text-muted)', display: 'block' }}>Last Write Time</small>
                <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{selectedTable.lastWrite}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
              <Button variant="ghost" size="md" onClick={() => setSelectedTable(null)}>
                Close Audit
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </AdminShell>
  );
}

interface ScamTipItem {
  id: number;
  title: string;
  category: 'OTP Safety' | 'Link Safety' | 'Fake Domains' | 'General';
  language: 'English' | 'Tagalog' | 'Taglish';
  status: 'Published' | 'Draft';
  lastEdited: string;
  content: string;
}

const INITIAL_SCAM_TIPS: ScamTipItem[] = [
  {
    id: 1,
    title: 'Never share your OTP with anyone',
    category: 'OTP Safety',
    language: 'English',
    status: 'Published',
    lastEdited: 'May 10',
    content: 'One-Time Passwords (OTPs) are your final layer of account defense. Bank staff, GCash representatives, and customer support will NEVER ask for your OTP over text or call.',
  },
  {
    id: 2,
    title: 'Huwag i-click ang mga link mula sa hindi kilalang number',
    category: 'Link Safety',
    language: 'Tagalog',
    status: 'Published',
    lastEdited: 'May 9',
    content: 'Ang mga phishing SMS ay madalas na naglalaman ng mga pekeng link gaya ng gcash-verify-ph.net. Laging irecheck ang opisyal na domain sa pamamagitan ng browser app.',
  },
  {
    id: 3,
    title: 'How to identify fake GCash domains',
    category: 'Fake Domains',
    language: 'English',
    status: 'Published',
    lastEdited: 'May 8',
    content: 'Scammers register domain lookalikes such as gcash-security-update.com. Official GCash links only use the domain gcash.com or m.gcash.com.',
  },
  {
    id: 4,
    title: 'Recognizing urgency pressure tactics in scam messages',
    category: 'General',
    language: 'English',
    status: 'Published',
    lastEdited: 'May 7',
    content: 'Messages warning that your account will be "permanently suspended within 1 hour" are classic psychological manipulation tactics designed to trigger panic.',
  },
  {
    id: 5,
    title: 'Taglish scam detection guide',
    category: 'General',
    language: 'Taglish',
    status: 'Draft',
    lastEdited: 'May 13',
    content: 'Kapag nakatanggap ng text na nagsasabing "Your SIM will be blocked today unless you register link below", huwag mag-panic. Verify muna sa official telco app.',
  },
];

export function AdminTipsPage() {
  const [tips, setTips] = useState<ScamTipItem[]>(INITIAL_SCAM_TIPS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');

  // Modals state
  const [editingTip, setEditingTip] = useState<ScamTipItem | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [previewTip, setPreviewTip] = useState<ScamTipItem | null>(null);

  // Form State for Create / Edit
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<'OTP Safety' | 'Link Safety' | 'Fake Domains' | 'General'>('OTP Safety');
  const [formLanguage, setFormLanguage] = useState<'English' | 'Tagalog' | 'Taglish'>('English');
  const [formStatus, setFormStatus] = useState<'Published' | 'Draft'>('Published');
  const [formContent, setFormContent] = useState('');

  const openCreateModal = () => {
    setFormTitle('');
    setFormCategory('OTP Safety');
    setFormLanguage('English');
    setFormStatus('Published');
    setFormContent('');
    setIsCreatingNew(true);
  };

  const openEditModal = (tip: ScamTipItem) => {
    setEditingTip(tip);
    setFormTitle(tip.title);
    setFormCategory(tip.category);
    setFormLanguage(tip.language);
    setFormStatus(tip.status);
    setFormContent(tip.content);
  };

  const handleSaveTip = () => {
    if (!formTitle.trim()) return;

    if (isCreatingNew) {
      const newTip: ScamTipItem = {
        id: tips.length > 0 ? Math.max(...tips.map((t) => t.id)) + 1 : 1,
        title: formTitle,
        category: formCategory,
        language: formLanguage,
        status: formStatus,
        lastEdited: 'Just now',
        content: formContent || 'No additional content provided.',
      };
      setTips([newTip, ...tips]);
      setIsCreatingNew(false);
    } else if (editingTip) {
      setTips(
        tips.map((t) =>
          t.id === editingTip.id
            ? {
                ...t,
                title: formTitle,
                category: formCategory,
                language: formLanguage,
                status: formStatus,
                lastEdited: 'Just now',
                content: formContent,
              }
            : t
        )
      );
      setEditingTip(null);
    }
  };

  const handlePublishToggle = (id: number) => {
    setTips(
      tips.map((t) => (t.id === id ? { ...t, status: 'Published' as const, lastEdited: 'Just now' } : t))
    );
  };

  const handleDeleteTip = (id: number) => {
    if (confirm('Are you sure you want to delete this scam awareness tip?')) {
      setTips(tips.filter((t) => t.id !== id));
    }
  };

  // Filtered List
  const filteredTips = tips.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory;
    const matchesLanguage = selectedLanguage === 'All' || t.language === selectedLanguage;
    return matchesSearch && matchesCategory && matchesLanguage;
  });

  const publishedCount = tips.filter((t) => t.status === 'Published').length;
  const draftCount = tips.filter((t) => t.status === 'Draft').length;

  return (
    <AdminShell title="Scam Awareness Tips">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Top Action Header */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <Button variant="primary" size="md" onClick={openCreateModal} style={{ borderRadius: 8, padding: '10px 20px', fontSize: '0.875rem' }}>
            + Add New Tip
          </Button>
        </div>

        {/* Metrics Summary Strip (Maximized Space 3-Column Grid - No Overlap) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {/* Card 1: Published Tips */}
          <div
            className="panel campaign-card-interactive"
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 12,
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 124,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Published Tips</span>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                🟢
              </div>
            </div>
            <div>
              <strong style={{ fontSize: '1.5rem', color: '#10b981', fontFamily: 'var(--font-mono)', fontWeight: 800, lineHeight: 1.1 }}>
                {publishedCount}
              </strong>
              <small style={{ fontSize: '0.75rem', color: '#10b981', display: 'block', marginTop: 3, fontWeight: 600 }}>
                Active &amp; synced to mobile app
              </small>
            </div>
          </div>

          {/* Card 2: Draft Tips */}
          <div
            className="panel campaign-card-interactive"
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 12,
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 124,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Draft Tips</span>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                🟡
              </div>
            </div>
            <div>
              <strong style={{ fontSize: '1.5rem', color: '#f59e0b', fontFamily: 'var(--font-mono)', fontWeight: 800, lineHeight: 1.1 }}>
                {draftCount}
              </strong>
              <small style={{ fontSize: '0.75rem', color: '#f59e0b', display: 'block', marginTop: 3, fontWeight: 600 }}>
                Pending review &amp; translation
              </small>
            </div>
          </div>

          {/* Card 3: Last Updated */}
          <div
            className="panel campaign-card-interactive"
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 12,
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 124,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Last Updated</span>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(124, 58, 237, 0.15)', border: '1px solid rgba(124, 58, 237, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                🕒
              </div>
            </div>
            <div>
              <strong style={{ fontSize: '1.375rem', color: 'var(--text-primary)', fontWeight: 800, lineHeight: 1.1 }}>
                May 10, 2026
              </strong>
              <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: 3, fontWeight: 600 }}>
                Automated sync: 100% healthy
              </small>
            </div>
          </div>
        </div>

        {/* Category Analytics Cards (Maximized 4-Column Grid - No Overlap) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { cat: 'OTP Safety', count: tips.filter((t) => t.category === 'OTP Safety').length, icon: '🔑', color: '#a855f7', bgIcon: 'rgba(168, 85, 247, 0.15)', borderIcon: 'rgba(168, 85, 247, 0.3)' },
            { cat: 'Link Safety', count: tips.filter((t) => t.category === 'Link Safety').length, icon: '🔗', color: '#3b82f6', bgIcon: 'rgba(59, 130, 246, 0.15)', borderIcon: 'rgba(59, 130, 246, 0.3)' },
            { cat: 'Fake Domains', count: tips.filter((t) => t.category === 'Fake Domains').length, icon: '🌐', color: '#f59e0b', bgIcon: 'rgba(245, 158, 11, 0.15)', borderIcon: 'rgba(245, 158, 11, 0.3)' },
            { cat: 'General', count: tips.filter((t) => t.category === 'General').length, icon: '💡', color: '#10b981', bgIcon: 'rgba(16, 185, 129, 0.15)', borderIcon: 'rgba(16, 185, 129, 0.3)' },
          ].map((c) => (
            <div
              key={c.cat}
              onClick={() => setSelectedCategory(selectedCategory === c.cat ? 'All' : c.cat)}
              className="panel campaign-card-interactive"
              style={{
                background: selectedCategory === c.cat ? 'rgba(124, 58, 237, 0.15)' : 'var(--bg-surface-elevated)',
                border: `1px solid ${selectedCategory === c.cat ? 'var(--accent-light)' : 'var(--border-default)'}`,
                borderRadius: 12,
                padding: '14px 18px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: 124,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 700 }}>{c.cat}</span>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: c.bgIcon, border: `1px solid ${c.borderIcon}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                  {c.icon}
                </div>
              </div>

              <div>
                <strong style={{ fontSize: '1.5rem', color: c.color, fontFamily: 'var(--font-mono)', fontWeight: 800, lineHeight: 1.1 }}>
                  {c.count}
                </strong>
                <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: 3, fontWeight: 600 }}>
                  {c.count} active {c.count === 1 ? 'article' : 'articles'}
                </small>
              </div>
            </div>
          ))}
        </div>

        {/* Filter & Search Controls Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Category Select */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: '0.8125rem',
                outline: 'none',
              }}
            >
              <option value="All">All Categories</option>
              <option value="OTP Safety">OTP Safety</option>
              <option value="Link Safety">Link Safety</option>
              <option value="Fake Domains">Fake Domains</option>
              <option value="General">General</option>
            </select>

            {/* Language Select */}
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              style={{
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: '0.8125rem',
                outline: 'none',
              }}
            >
              <option value="All">All Languages</option>
              <option value="English">English</option>
              <option value="Tagalog">Tagalog</option>
              <option value="Taglish">Taglish</option>
            </select>
          </div>

          <input
            type="text"
            className="form-input"
            placeholder="🔍 Search scam tips..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 260, borderRadius: 8, fontSize: '0.8125rem' }}
          />
        </div>

        {/* Scam Tips Table (Matching Reference Screenshot) */}
        <div className="panel" style={{ padding: 0, overflow: 'hidden', borderRadius: 12, border: '1px solid var(--border-default)' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>TITLE</th>
                  <th>CATEGORY</th>
                  <th>LANGUAGE</th>
                  <th>STATUS</th>
                  <th>LAST EDITED</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredTips.map((tip) => (
                  <tr key={tip.id}>
                    <td>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>{tip.id}</span>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>{tip.title}</strong>
                    </td>
                    <td>
                      <span className="badge badge-purple">{tip.category}</span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{tip.language}</span>
                    </td>
                    <td>
                      {tip.status === 'Published' ? (
                        <span className="badge badge-green">Published</span>
                      ) : (
                        <span className="badge badge-amber">Draft</span>
                      )}
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>{tip.lastEdited}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewTip(tip)}
                          title="Preview in Mobile App View"
                          style={{ borderRadius: 6, fontSize: '0.75rem', padding: '4px 8px' }}
                        >
                          👁️ Mobile
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(tip)}
                          style={{ borderRadius: 6, fontSize: '0.75rem', padding: '4px 8px' }}
                        >
                          Edit
                        </Button>
                        {tip.status === 'Draft' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handlePublishToggle(tip.id)}
                            style={{ borderRadius: 6, fontSize: '0.75rem', padding: '4px 8px', background: '#10b981' }}
                          >
                            Publish
                          </Button>
                        )}
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeleteTip(tip.id)}
                          style={{ borderRadius: 6, fontSize: '0.75rem', padding: '4px 8px' }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal 1: Create / Edit Scam Tip Modal */}
      {(isCreatingNew || Boolean(editingTip)) && (
        <Modal
          isOpen={isCreatingNew || Boolean(editingTip)}
          onClose={() => { setIsCreatingNew(false); setEditingTip(null); }}
          title={isCreatingNew ? 'Create New Scam Tip' : `Edit Tip #${editingTip?.id}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: '0.875rem' }}>
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Tip Title
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Never share your OTP with anyone"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                style={{ width: '100%', borderRadius: 8 }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as any)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: '0.8125rem',
                  }}
                >
                  <option value="OTP Safety">OTP Safety</option>
                  <option value="Link Safety">Link Safety</option>
                  <option value="Fake Domains">Fake Domains</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Language
                </label>
                <select
                  value={formLanguage}
                  onChange={(e) => setFormLanguage(e.target.value as any)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: '0.8125rem',
                  }}
                >
                  <option value="English">English</option>
                  <option value="Tagalog">Tagalog</option>
                  <option value="Taglish">Taglish</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Status
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: '0.8125rem',
                  }}
                >
                  <option value="Published">Published</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Full Article Content (Mobile View Text)
              </label>
              <textarea
                className="form-input"
                rows={4}
                placeholder="Write the educational tip body text shown inside the mobile application..."
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                style={{ width: '100%', borderRadius: 8, fontSize: '0.8125rem', lineHeight: 1.5 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
              <Button variant="ghost" size="md" onClick={() => { setIsCreatingNew(false); setEditingTip(null); }}>
                Cancel
              </Button>
              <Button variant="primary" size="md" onClick={handleSaveTip}>
                {isCreatingNew ? 'Create & Publish Tip' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal 2: Mobile Application View Simulator Modal */}
      {previewTip && (
        <Modal
          isOpen={Boolean(previewTip)}
          onClose={() => setPreviewTip(null)}
          title={`Mobile App Preview: ${previewTip.category}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            {/* Realistic Smartphone Chassis Frame Mockup */}
            <div
              style={{
                width: 320,
                height: 610,
                background: '#090a0f',
                border: '10px solid #1e293b',
                borderRadius: 44,
                padding: '12px 14px 20px',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 0 2px #334155',
                color: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden',
                userSelect: 'none',
              }}
            >
              {/* Top Dynamic Island Notch */}
              <div
                style={{
                  width: 90,
                  height: 22,
                  background: '#000000',
                  borderRadius: 12,
                  margin: '0 auto 8px auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: 8,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.8)',
                }}
              >
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#1e293b' }} />
              </div>

              {/* Status Bar (Clock & Icons) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px 8px', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <span>9:41 AM</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span>📶 5G</span>
                  <span>🔋 98%</span>
                </div>
              </div>

              {/* Mobile App View Container */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 12, overflowY: 'auto' }}>
                {/* Mobile App Bar Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(37, 99, 235, 0.12)', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(59, 130, 246, 0.25)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.9375rem' }}>🛡️</span>
                    <strong style={{ fontSize: '0.8125rem', color: '#ffffff' }}>BantAI Mobile</strong>
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: '#60a5fa', fontWeight: 600 }}>Settings &gt; Learn</span>
                </div>

                {/* Tip Card in Mobile Screen */}
                <div style={{ background: '#131622', borderRadius: 14, padding: 16, border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <h3 style={{ fontSize: '1.05rem', margin: 0, color: '#ffffff', fontWeight: 800, lineHeight: 1.3 }}>
                    {previewTip.title}
                  </h3>

                  {/* Badges strip */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className="badge badge-purple" style={{ fontSize: '0.6875rem' }}>
                      {previewTip.category}
                    </span>
                    <span className="badge badge-gray" style={{ fontSize: '0.6875rem' }}>
                      🌐 {previewTip.language}
                    </span>
                  </div>

                  {/* Tip Content Body */}
                  <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: 12, borderRadius: 10, border: '1px solid var(--border-subtle)', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                    {previewTip.content}
                  </div>

                  {/* Helpful Button inside Mobile App */}
                  <button
                    type="button"
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 10,
                      padding: '10px 0',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
                    }}
                  >
                    Mark as Helpful 👍
                  </button>
                </div>
              </div>

              {/* iPhone Home Indicator Bar */}
              <div style={{ width: 120, height: 4, background: 'rgba(255, 255, 255, 0.35)', borderRadius: 2, margin: '12px auto 0 auto' }} />
            </div>

            <Button variant="ghost" size="md" onClick={() => setPreviewTip(null)}>
              Close Preview
            </Button>
          </div>
        </Modal>
      )}
    </AdminShell>
  );
}

export function AdminSettingsPage({ notifications }: { notifications?: boolean }) {
  const { adminAvatar, setAdminAvatar } = useUserAvatar();
  const [activeTab, setActiveTab] = React.useState<'profile' | 'security' | 'notifications' | 'access'>(
    notifications ? 'notifications' : 'profile'
  );

  // Editable Profile state
  const [fullName, setFullName] = React.useState('Gian Carlo Atienza');
  const [email, setEmail] = React.useState('g.atienza@bantai.research');
  const [department, setDepartment] = React.useState('Threat Intelligence & Security Engineering');
  const [location, setLocation] = React.useState('DLSL Innovation Hub, Lipa City, Batangas');
  const [phone, setPhone] = React.useState('+63 917 555 0192');
  const [extension, setExtension] = React.useState('Ext. 4082');

  // Avatar customization modal state
  const [isAvatarModalOpen, setIsAvatarModalOpen] = React.useState(false);
  const [customImageUrl, setCustomImageUrl] = React.useState('');

  // Activity Log Modal state
  const [isActivityModalOpen, setIsActivityModalOpen] = React.useState(false);
  const [activitySearch, setActivitySearch] = React.useState('');

  // Password & 2FA State
  const [currPass, setCurrPass] = React.useState('');
  const [newPass, setNewPass] = React.useState('');
  const [confirmPass, setConfirmPass] = React.useState('');
  const [showPass, setShowPass] = React.useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = React.useState(true);
  const [totpCode, setTotpCode] = React.useState('');

  // Notification Toggles State
  const [notifConfig, setNotifConfig] = React.useState({
    highSeverityAlerts: true,
    smsEscalation: true,
    dailyDigest: true,
    conceptDriftWarnings: true,
    licensingDispatches: true,
    weeklyReportPdf: false,
  });

  // Access & Permissions Matrix State
  const [permissionsFilter, setPermissionsFilter] = React.useState('');
  const [permissions, setPermissions] = React.useState<Record<string, boolean>>({
    'Overview & Dashboard': true,
    'Classification Log (Read/Write)': true,
    'Model Performance & Retraining': true,
    'Concept Drift Alerts': true,
    'Dataset Management & Export': true,
    'FP / FN Review Approval': true,
    'User Management & Licensing': true,
    'Server Monitoring & DB Tools': true,
    'API Key Generation': true,
  });

  const [toast, setToast] = React.useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('✓ Admin account settings saved successfully!');
  };

  const handleReset = () => {
    setFullName('Gian Carlo Atienza');
    setEmail('g.atienza@bantai.research');
    setDepartment('Threat Intelligence & Security Engineering');
    setLocation('DLSL Innovation Hub, Lipa City, Batangas');
    setPhone('+63 917 555 0192');
    setExtension('Ext. 4082');
    showToast('Form fields reset to original values.');
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currPass) {
      showToast('⚠️ Please enter your current password.');
      return;
    }
    if (newPass.length < 8) {
      showToast('⚠️ New password must be at least 8 characters long.');
      return;
    }
    if (newPass !== confirmPass) {
      showToast('⚠️ New password and confirmation do not match.');
      return;
    }
    setCurrPass('');
    setNewPass('');
    setConfirmPass('');
    showToast('✓ Password updated successfully! Next required rotation in 90 days.');
  };

  // Activity Log Mock Data
  const activityLogs = [
    { id: 1, action: 'Account Login Successful', ip: '110.54.128.4', timestamp: 'Today, 23:55:12', status: 'Success' },
    { id: 2, action: 'Updated Admin Account Settings', ip: '110.54.128.4', timestamp: 'Today, 23:42:05', status: 'Success' },
    { id: 3, action: 'Verified Organization License: Globe Telecom', ip: '110.54.128.4', timestamp: 'Today, 22:15:30', status: 'Success' },
    { id: 4, action: 'Exported Threat Intelligence Log (CSV)', ip: '110.54.128.4', timestamp: 'Yesterday, 18:04:19', status: 'Success' },
    { id: 5, action: 'Triggered Model Retraining Session', ip: '110.54.128.4', timestamp: 'Jul 26, 2026, 14:20:00', status: 'Success' },
    { id: 6, action: 'Password Policy Audit Check', ip: '110.54.128.4', timestamp: 'Jul 24, 2026, 09:11:44', status: 'Success' },
  ];

  const filteredLogs = activityLogs.filter(log =>
    log.action.toLowerCase().includes(activitySearch.toLowerCase()) ||
    log.timestamp.toLowerCase().includes(activitySearch.toLowerCase())
  );

  // Calculate Password Strength Score
  const getPassStrength = () => {
    if (!newPass) return { label: 'None', width: '0%', color: '#64748b' };
    if (newPass.length < 8) return { label: 'Weak', width: '33%', color: '#ef4444' };
    if (newPass.length >= 8 && /[A-Z]/.test(newPass) && /[0-9]/.test(newPass)) return { label: 'Strong', width: '100%', color: '#10b981' };
    return { label: 'Medium', width: '66%', color: '#f59e0b' };
  };

  const passStrength = getPassStrength();

  return (
    <AdminShell title="Account Settings">
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: '#10b981',
            color: '#ffffff',
            padding: '12px 22px',
            borderRadius: 10,
            fontWeight: 700,
            fontSize: '0.875rem',
            boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)',
            zIndex: 9999,
          }}
        >
          {toast}
        </div>
      )}

      {/* Main Container - Space Maximized (Full Width) */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <span className="badge badge-amber" style={{ padding: '6px 14px', fontSize: '0.8125rem' }}>
            👑 Super Administrator Control Center
          </span>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: 2,
            width: '100%',
          }}
        >
          {[
            { id: 'profile', label: '👤 Profile & Contact' },
            { id: 'security', label: '🔐 Password & 2FA' },
            { id: 'notifications', label: '🔔 Alert Preferences' },
            { id: 'access', label: '🛡️ Access & Permissions' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '10px 22px',
                  borderRadius: '8px 8px 0 0',
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                  background: isActive ? 'rgba(37, 99, 235, 0.2)' : 'transparent',
                  color: isActive ? '#60a5fa' : 'var(--text-secondary)',
                  borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                  transition: 'all 0.2s ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Profile & Contact (Maximizing Space in 3-Column Layout) */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
            {/* Top Banner Profile Summary Card */}
            <div
              className="panel"
              style={{
                padding: '24px 32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 20,
                background: 'linear-gradient(135deg, var(--bg-surface-elevated) 0%, rgba(15, 23, 42, 0.9) 100%)',
                border: '1px solid var(--border-default)',
                borderRadius: 16,
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                width: '100%',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                {/* Custom Avatar Circle */}
                <UserAvatar avatar={adminAvatar} role="admin" size={72} fallbackInitials="GA" />

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff' }}>{fullName}</h2>
                    <span className="badge badge-amber">Super Admin</span>
                    <span className="badge badge-green">Verified</span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginTop: 4 }}>
                    {department} · BantAI Research Team
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setIsAvatarModalOpen(true)}
                  className="btn btn-secondary btn-md"
                >
                  📷 Customize Avatar
                </button>
                <button
                  type="button"
                  onClick={() => setIsActivityModalOpen(true)}
                  className="btn btn-ghost btn-md"
                >
                  📜 Activity Audit Log
                </button>
              </div>
            </div>

            {/* 3-Column Space-Maximized Responsive Grid Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24, width: '100%' }}>
              {/* Card 1: Profile Information */}
              <div className="panel" style={{ padding: '24px 28px', borderRadius: 16 }}>
                <small style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 18 }}>
                  PROFILE DETAILS
                </small>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>
                      Primary Work Email *
                    </label>
                    <input
                      type="email"
                      className="form-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>
                      Role Title
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value="Super Administrator"
                      disabled
                      style={{ opacity: 0.7 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>
                      Department
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Contact Information */}
              <div className="panel" style={{ padding: '24px 28px', borderRadius: 16 }}>
                <small style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 18 }}>
                  CONTACT &amp; LOCATION
                </small>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>
                      Organization
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value="BantAI Research Team — De La Salle Lipa"
                      disabled
                      style={{ opacity: 0.7 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>
                      Office Location
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>
                        Phone Number
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>
                        Extension
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={extension}
                        onChange={(e) => setExtension(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: System & Security Metadata */}
              <div className="panel" style={{ padding: '24px 28px', borderRadius: 16 }}>
                <small style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 18 }}>
                  SYSTEM AUDIT METADATA
                </small>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: '0.8125rem' }}>
                  <div style={{ padding: '10px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Employee ID</span>
                    <strong style={{ color: '#ffffff', fontFamily: 'var(--font-mono)', fontSize: '0.9375rem' }}>EMP-ADMIN-001</strong>
                  </div>

                  <div style={{ padding: '10px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Access Level</span>
                    <strong style={{ color: '#60a5fa', fontWeight: 700 }}>Level 5 — Root Super Admin</strong>
                  </div>

                  <div style={{ padding: '10px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Date Joined</span>
                    <strong style={{ color: '#ffffff' }}>January 15, 2024</strong>
                  </div>

                  <div style={{ padding: '10px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Last Active Session</span>
                    <strong style={{ color: '#34d399' }}>Today, 23:55 (IP: 110.54.128.4)</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions Bottom Bar */}
            <div
              className="panel"
              style={{
                padding: '20px 28px',
                borderRadius: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 16,
                width: '100%',
              }}
            >
              <div style={{ display: 'flex', gap: 12 }}>
                <Button type="submit" variant="primary" size="md" style={{ padding: '12px 24px' }}>
                  💾 Save Profile Changes
                </Button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="btn btn-secondary btn-md"
                >
                  ↺ Reset Changes
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                <span>🟢 All changes remain frontend-only.</span>
              </div>
            </div>
          </form>
        )}

        {/* Tab 2: Password & 2FA (Interactive Form & TOTP Toggle) */}
        {activeTab === 'security' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: 24, width: '100%' }}>
            {/* Change Password Form Card */}
            <form onSubmit={handlePasswordSubmit} className="panel" style={{ padding: '28px 32px', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <small style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block' }}>
                CHANGE PASSWORD
              </small>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>
                  Current Password *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="form-input"
                    value={currPass}
                    onChange={(e) => setCurrPass(e.target.value)}
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{ position: 'absolute', right: 12, top: 10, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    {showPass ? '👁️' : '🙈'}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>
                  New Password *
                </label>
                <input
                  type={showPass ? 'text' : 'password'}
                  className="form-input"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Min 8 chars with uppercase & number"
                />

                {/* Password Strength Meter */}
                {newPass && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Strength:</span>
                      <strong style={{ color: passStrength.color }}>{passStrength.label}</strong>
                    </div>
                    <div style={{ height: 4, width: '100%', background: 'rgba(255, 255, 255, 0.1)', borderRadius: 2 }}>
                      <div style={{ height: '100%', width: passStrength.width, background: passStrength.color, transition: 'all 0.3s ease', borderRadius: 2 }} />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>
                  Confirm New Password *
                </label>
                <input
                  type={showPass ? 'text' : 'password'}
                  className="form-input"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Re-enter new password"
                />
              </div>

              <Button type="submit" variant="primary" size="md" style={{ marginTop: 8 }}>
                🔑 Update Password
              </Button>
            </form>

            {/* 2FA Interactive Toggle Card */}
            <div className="panel" style={{ padding: '28px 32px', borderRadius: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <small style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 18 }}>
                  TWO-FACTOR AUTHENTICATION (2FA)
                </small>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div>
                    <strong style={{ fontSize: '1rem', color: '#ffffff', display: 'block' }}>
                      TOTP Authenticator Status
                    </strong>
                    <small style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                      Require 6-digit verification code on login
                    </small>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIs2FAEnabled(!is2FAEnabled);
                      showToast(is2FAEnabled ? '2FA disabled.' : '2FA enabled successfully!');
                    }}
                    style={{
                      width: 50,
                      height: 26,
                      borderRadius: 13,
                      background: is2FAEnabled ? '#10b981' : 'var(--bg-input)',
                      border: 'none',
                      padding: 2,
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: '#ffffff',
                        transform: is2FAEnabled ? 'translateX(24px)' : 'translateX(0)',
                        transition: 'transform 0.3s ease',
                      }}
                    />
                  </button>
                </div>

                {is2FAEnabled && (
                  <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '1.25rem' }}>📱</span>
                      <div>
                        <strong style={{ color: '#ffffff', fontSize: '0.875rem', display: 'block' }}>Authenticator App Connected</strong>
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Google Authenticator / Authy / 1Password</small>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0, 0, 0, 0.3)', padding: '8px 12px', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                      <span>Secret: JBSWY3DPEHPK3PXP</span>
                      <button
                        type="button"
                        onClick={() => showToast('Secret key copied to clipboard!')}
                        style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontWeight: 700 }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 20, display: 'block' }}>
                Enforced Security Policy: Super Admin accounts must maintain active 2FA.
              </small>
            </div>
          </div>
        )}

        {/* Tab 3: Alert Preferences Toggles */}
        {activeTab === 'notifications' && (
          <div className="panel" style={{ padding: '28px 32px', borderRadius: 16, width: '100%' }}>
            <small style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 20 }}>
              SUPER ADMIN ALERT DISPATCH SETTINGS
            </small>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
              {[
                { key: 'highSeverityAlerts', title: 'High-Severity Smishing Surge Alerts', desc: 'Real-time alert when >500 messages match a critical campaign cluster' },
                { key: 'smsEscalation', title: 'SMS Critical Security Escalation', desc: 'Direct SMS alert for unhandled security events' },
                { key: 'dailyDigest', title: 'Daily Threat Intelligence Digest', desc: 'Automated 08:00 AM summary report sent to work email' },
                { key: 'conceptDriftWarnings', title: 'Model Concept Drift Warnings', desc: 'Notify when XLM-RoBERTa drift confidence drops below threshold' },
                { key: 'licensingDispatches', title: 'New License Request Notifications', desc: 'Notify when verified organization requests intelligence access' },
                { key: 'weeklyReportPdf', title: 'Weekly Executive PDF Attachment', desc: 'Include full PDF report in weekly summary email' },
              ].map((item) => (
                <div
                  key={item.key}
                  style={{
                    padding: '16px 20px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '0.9375rem', color: '#ffffff', display: 'block', marginBottom: 2 }}>
                      {item.title}
                    </strong>
                    <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                      {item.desc}
                    </small>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...notifConfig, [item.key]: !notifConfig[item.key as keyof typeof notifConfig] };
                      setNotifConfig(updated);
                      showToast('Notification preference toggled.');
                    }}
                    style={{
                      width: 48,
                      height: 26,
                      borderRadius: 13,
                      background: notifConfig[item.key as keyof typeof notifConfig] ? '#2563eb' : 'var(--bg-input)',
                      border: 'none',
                      padding: 2,
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: '#ffffff',
                        transform: notifConfig[item.key as keyof typeof notifConfig] ? 'translateX(22px)' : 'translateX(0)',
                        transition: 'transform 0.3s ease',
                      }}
                    />
                  </button>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="primary" onClick={() => showToast('✓ Notification preferences saved!')}>
                💾 Save Alert Settings
              </Button>
            </div>
          </div>
        )}

        {/* Tab 4: Access & Permissions Checklist Matrix */}
        {activeTab === 'access' && (
          <div className="panel" style={{ padding: '28px 32px', borderRadius: 16, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <small style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block' }}>
                  ROLE CAPABILITIES &amp; MODULE PERMISSIONS
                </small>
                <h3 style={{ fontSize: '1.25rem', color: '#ffffff', marginTop: 4 }}>Root Super Administrator Access Matrix</h3>
              </div>

              <input
                type="text"
                className="form-input"
                style={{ maxWidth: 280, height: 38 }}
                placeholder="🔍 Search permission module..."
                value={permissionsFilter}
                onChange={(e) => setPermissionsFilter(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
              {Object.entries(permissions)
                .filter(([mod]) => mod.toLowerCase().includes(permissionsFilter.toLowerCase()))
                .map(([moduleName, isGranted]) => (
                  <div
                    key={moduleName}
                    onClick={() => {
                      setPermissions({ ...permissions, [moduleName]: !isGranted });
                      showToast(`Permission for ${moduleName} toggled.`);
                    }}
                    style={{
                      padding: '14px 18px',
                      background: isGranted ? 'rgba(37, 99, 235, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${isGranted ? 'rgba(59, 130, 246, 0.4)' : 'var(--border-default)'}`,
                      borderRadius: 10,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <span style={{ fontSize: '0.875rem', color: isGranted ? '#ffffff' : 'var(--text-muted)', fontWeight: 600 }}>
                      {moduleName}
                    </span>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: isGranted ? '#60a5fa' : 'var(--text-muted)' }}>
                      {isGranted ? '✓ GRANTED' : '✕ RESTRICTED'}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal 1: Avatar Customizer Modal */}
      <Modal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        title="Customize Admin Avatar"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 520 }}>
          {/* Section 1: Character Avatars */}
          <div>
            <small style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 12 }}>
              SELECT CHARACTER AVATAR
            </small>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { id: 'analyst_female', icon: '👩‍💻', label: 'Security Analyst', role: 'Glasses' },
                { id: 'intel_lead', icon: '👩‍💼', label: 'Threat Intel Lead', role: 'Blazer' },
                { id: 'engineer_male', icon: '👨‍💻', label: 'Cyber Engineer', role: 'Scarf' },
                { id: 'responder', icon: '😷', label: 'Incident Responder', role: 'Mask' },
                { id: 'soc_sunglasses', icon: '😎', label: 'SOC Analyst', role: 'Sunglasses' },
                { id: 'researcher_hoodie', icon: '👨‍🔬', label: 'AI Researcher', role: 'Hoodie' },
                { id: 'investigator', icon: '🕵️', label: 'Investigator', role: 'Fedora' },
                { id: 'ai_bot', icon: '🤖', label: 'AI Guardian', role: 'Bot' },
                { id: 'super_admin', icon: '👑', label: 'Super Admin', role: 'Crown' },
                { id: 'shield_sentinel', icon: '🛡️', label: 'Shield Sentinel', role: 'Defense' },
                { id: 'red_team', icon: '🥷', label: 'Red Team', role: 'Ninja' },
                { id: 'scholar', icon: '🎓', label: 'Scholar Lead', role: 'Research' },
              ].map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setAdminAvatar({
                      type: 'preset',
                      presetIcon: item.icon,
                      gradient: adminAvatar.gradient || 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                      initials: 'GA',
                    });
                    setIsAvatarModalOpen(false);
                    showToast(`✓ Avatar updated to ${item.label} (${item.role})!`);
                  }}
                  style={{
                    padding: '12px 8px',
                    borderRadius: 12,
                    background: adminAvatar.presetIcon === item.icon ? 'rgba(37, 99, 235, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                    border: adminAvatar.presetIcon === item.icon ? '2px solid #3b82f6' : '1px solid var(--border-default)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span style={{ fontSize: '2rem' }}>{item.icon}</span>
                  <strong style={{ fontSize: '0.6875rem', color: '#ffffff', textAlign: 'center', lineHeight: 1.2 }}>
                    {item.label}
                  </strong>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Color Gradient Themes */}
          <div>
            <small style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 12 }}>
              BACKGROUND GRADIENT THEME
            </small>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
              {[
                { id: 'amber', grad: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', label: 'Amber' },
                { id: 'blue', grad: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', label: 'Cyber Blue' },
                { id: 'emerald', grad: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', label: 'Emerald' },
                { id: 'purple', grad: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', label: 'Purple' },
                { id: 'crimson', grad: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', label: 'Crimson' },
              ].map((preset) => (
                <div
                  key={preset.id}
                  onClick={() => {
                    setAdminAvatar({
                      ...adminAvatar,
                      gradient: preset.grad,
                    });
                    showToast(`Background theme changed to ${preset.label}!`);
                  }}
                  style={{
                    height: 40,
                    borderRadius: 10,
                    background: preset.grad,
                    cursor: 'pointer',
                    border: adminAvatar.gradient === preset.grad ? '2px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                  }}
                >
                  {preset.label}
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Custom Image Upload / URL Input */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
            <small style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
              CUSTOM PHOTO / IMAGE URL
            </small>

            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Paste image URL (https://...)"
                value={customImageUrl}
                onChange={(e) => setCustomImageUrl(e.target.value)}
                style={{ flex: 1 }}
              />
              <Button
                variant="primary"
                onClick={() => {
                  if (!customImageUrl) {
                    showToast('⚠️ Please enter an image URL first.');
                    return;
                  }
                  setAdminAvatar({
                    type: 'image',
                    imageUrl: customImageUrl,
                    gradient: adminAvatar.gradient,
                    initials: 'GA',
                  });
                  setIsAvatarModalOpen(false);
                  showToast('✓ Custom photo avatar applied successfully!');
                }}
              >
                Apply Image
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal 2: Activity Audit Log Modal */}
      <Modal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        title="Security Activity Audit Log"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search activity log..."
            value={activitySearch}
            onChange={(e) => setActivitySearch(e.target.value)}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                style={{
                  padding: '12px 14px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  fontSize: '0.8125rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <strong style={{ color: '#ffffff', display: 'block' }}>{log.action}</strong>
                  <small style={{ color: 'var(--text-muted)' }}>IP: {log.ip}</small>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>{log.timestamp}</span>
                  <span style={{ color: '#34d399', fontWeight: 700, fontSize: '0.75rem' }}>✓ {log.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </AdminShell>
  );
}
