import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart } from '../components/charts/BarChart';
import { DonutChart } from '../components/charts/DonutChart';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { UserAvatar } from '../components/common/UserAvatar';
import { useUserAvatar } from '../context/UserAvatarContext';
import { CampaignCard } from '../components/dashboard/CampaignCard';
import { StatCard } from '../components/dashboard/StatCard';
import { PortalShell } from '../components/layout/PortalShell';

import { campaigns, threatFeed } from '../mocks/referenceData';
import {
  getAnalyticsSummary,
  AnalyticsSummary,
} from '../services/analyticsService';
import {
  getActiveCampaigns,
  getInactiveCampaigns,
} from '../services/campaignsService';
import { getSmsAlerts } from '../services/smsService';

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

function ClientShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <PortalShell
      role="client"
      sidebarGroups={CLIENT_SIDEBAR_GROUPS}
      title={title}
      tag="Globe Telecom"
      userInitials="MS"
      userName="Maria Santos"
      userMeta="Threat Intelligence Analyst"
      org="Globe Telecom"
    >
      {children}
    </PortalShell>
  );
}

export function ClientOverviewPage() {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
    let isMounted = true;
    getAnalyticsSummary()
      .then((res) => {
        if (isMounted && res) setAnalytics(res);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const totalReportsVal =
    analytics?.totalMessages !== undefined
      ? analytics.totalMessages.toLocaleString()
      : '14,892';
  const smishingVal =
    analytics?.classificationsByLabel?.['Scam'] !== undefined
      ? analytics.classificationsByLabel['Scam'].toLocaleString()
      : '1,247';
  const suspiciousVal =
    analytics?.classificationsByLabel?.['Spam'] !== undefined
      ? analytics.classificationsByLabel['Spam'].toLocaleString()
      : '389';
  const blockedVal =
    analytics?.alertsByStatus?.['Blocked'] !== undefined
      ? analytics.alertsByStatus['Blocked'].toLocaleString()
      : '203';

  return (
    <ClientShell title="Executive Overview">
      {/* Stat Cards Grid */}
      <div className="stat-grid">
        <StatCard
          title="Reports Received"
          value={totalReportsVal}
          subtext="+372 received today"
          trend="12.4%"
          trendUp={true}
          icon="📬"
          iconBg="rgba(124, 58, 237, 0.15)"
        />
        <StatCard
          title="Likely Smishing"
          value={smishingVal}
          subtext="+23 flagged today"
          trend="8.1%"
          trendUp={true}
          icon="🚨"
          iconBg="rgba(239, 68, 68, 0.15)"
        />
        <StatCard
          title="Suspicious Reports"
          value={suspiciousVal}
          subtext="+6 pending review"
          trend="2.3%"
          trendUp={false}
          icon="⚠️"
          iconBg="rgba(245, 158, 11, 0.15)"
        />
        <StatCard
          title="Confirmed Blocked"
          value={blockedVal}
          subtext="SIM / IP deactivations"
          trend="15.8%"
          trendUp={true}
          icon="🛡️"
          iconBg="rgba(16, 185, 129, 0.15)"
        />
      </div>

      {/* Main Charts & Live Threat Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        <div className="panel">
          <div className="panel-head">
            <div>
              <strong>Weekly Smishing Volume Trends</strong>
              <small>
                User-reported suspicious messages over the past 7 days
              </small>
            </div>
          </div>
          <BarChart />
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <strong>Live Threat Feed</strong>
              <small>Real-time intercepted campaign outbreaks</small>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {threatFeed.map(([name, level]) => (
              <div
                key={name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 10,
                  borderRadius: 8,
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background:
                        level === 'Critical'
                          ? 'var(--red-text)'
                          : 'var(--amber-text)',
                    }}
                  />
                  <strong style={{ fontSize: '0.8125rem' }}>{name}</strong>
                </div>
                <span
                  className={`badge ${level === 'Critical' ? 'badge-red' : 'badge-amber'}`}
                >
                  {level}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Classification Distribution & Active Campaigns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 2fr',
          gap: 24,
          alignItems: 'stretch',
        }}
      >
        <div
          className="panel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div className="panel-head">
            <div>
              <strong>Classification Breakdown</strong>
              <small>XLM-RoBERTa confidence ratio</small>
            </div>
          </div>
          <DonutChart />
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <strong>Active Campaign Clusters</strong>
              <small>Targeting Globe Telecom subscribers</small>
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 16,
            }}
          >
            {campaigns.slice(0, 4).map((item) => (
              <CampaignCard
                key={item.title}
                title={item.title}
                messages={item.messages}
                domains={item.domains}
                since={item.since}
                status={item.status}
                tags={item.tags}
              />
            ))}
          </div>
          <div
            style={{
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 12,
              marginTop: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.8125rem',
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>
              Showing top 4 active threat clusters
            </span>
            <button
              type="button"
              onClick={() => navigate('/client/campaigns')}
              style={{
                background: 'none',
                border: 'none',
                color: '#60a5fa',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.8125rem',
              }}
            >
              View All 6 Clusters →
            </button>
          </div>
        </div>
      </div>
    </ClientShell>
  );
}

// Helper CSV exporter
function triggerCSVDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ----------------------------------------------------
// 1. CLIENT MESSAGES PAGE (Matching Screenshot 1)
// ----------------------------------------------------
export function ClientMessagesPage() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<
    'all' | 'smishing' | 'suspicious' | 'reviewed'
  >('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMessage, setSelectedMessage] = useState<any | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [apiMessages, setApiMessages] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    getSmsAlerts()
      .then((alerts) => {
        if (isMounted && alerts && alerts.length > 0) {
          const mapped = alerts.map((a) => ({
            id: a.id.startsWith('#')
              ? a.id
              : `#MSG-${a.id.slice(0, 4).toUpperCase()}`,
            sender: a.sender,
            preview: a.body,
            campaign: a.cluster?.label || 'General Smishing',
            confidence: a.classification
              ? `${Math.round(a.classification.score * 100)}%`
              : '90%',
            score: a.classification
              ? Math.round(a.classification.score * 100)
              : 90,
            status:
              a.classification?.label === 'Scam'
                ? 'Smishing'
                : a.classification?.label || 'Suspicious',
            timestamp: new Date(a.receivedAt).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            }),
            indicators: ['Interceptions', 'ML Score'],
            carrier: 'Telemetry Sync',
          }));
          setApiMessages(mapped);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const initialRawMessages = [
    {
      id: '#MSG-4821',
      sender: '+63 908 000 1234',
      preview:
        'Your GCash account has been flagged. Verify now at gcash-ph-support.net/login',
      campaign: 'Op. GCash Clone #17',
      confidence: '94%',
      score: 94,
      status: 'Smishing',
      timestamp: 'May 13, 9:01 AM',
      indicators: ['Fake Domain', 'Urgency', 'GCash Brand'],
      carrier: 'Smart Telecom',
    },
    {
      id: '#MSG-4820',
      sender: '+63 917 231 5500',
      preview:
        "Congratulations! You've been selected for a ₱5,000 GCash reward. Claim at reward-gcash.com",
      campaign: 'Op. GCash Clone #17',
      confidence: '91%',
      score: 91,
      status: 'Smishing',
      timestamp: 'May 13, 8:47 AM',
      indicators: ['Prize Lure', 'Fake Domain'],
      carrier: 'Globe Telecom',
    },
    {
      id: '#MSG-4819',
      sender: '+63 2 8631 8000',
      preview:
        'You have a pending transaction of ₱12,500. Tap to review and confirm: bdo-verify-sec.org',
      campaign: 'BDO Fake Support #5',
      confidence: '68%',
      score: 68,
      status: 'Suspicious',
      timestamp: 'May 13, 8:33 AM',
      indicators: ['Urgency Language', 'Bank Brand'],
      carrier: 'PLDT Landline',
    },
    {
      id: '#MSG-4818',
      sender: '+63 919 100 4567',
      preview:
        'Ang inyong BDO account ay nangangailangan ng verification. Mag-click dito: bdo-online-check.info',
      campaign: 'BDO Fake Support #5',
      confidence: '89%',
      score: 89,
      status: 'Smishing',
      timestamp: 'May 13, 8:20 AM',
      indicators: ['Taglish Code-Switching', 'Fake Domain'],
      carrier: 'Smart Telecom',
    },
    {
      id: '#MSG-4817',
      sender: '+63 927 888 3210',
      preview:
        'URGENT: Your LBC parcel #PH9812 is held at customs. Pay release fee at lbc-customs-pay.cc',
      campaign: 'LBC Parcel Scam #8',
      confidence: '96%',
      score: 96,
      status: 'Smishing',
      timestamp: 'May 13, 7:58 AM',
      indicators: ['Customs Fee Lure', 'Urgency Tactics'],
      carrier: 'Globe Telecom',
    },
    {
      id: '#MSG-4816',
      sender: '+63 908 111 2222',
      preview:
        'Your PLDT bill of ₱1,899 is overdue. Avoid disconnection — pay now at pldt-paybill-online.net',
      campaign: 'PLDT Impersonation #4',
      confidence: '82%',
      score: 82,
      status: 'Smishing',
      timestamp: 'May 13, 7:44 AM',
      indicators: ['Overdue Notice', 'Brand Impersonation'],
      carrier: 'Smart Telecom',
    },
    {
      id: '#MSG-4815',
      sender: '+63 955 321 0099',
      preview:
        'SHOPEE NOTICE: Your prize of ₱10,000 is waiting! Claim within 24 hours at shopee-reward-hub.tech',
      campaign: 'Shopee Prize Lure #11',
      confidence: '88%',
      score: 88,
      status: 'Smishing',
      timestamp: 'May 13, 7:12 AM',
      indicators: ['Prize Lure', 'Shortened URL'],
      carrier: 'Globe Telecom',
    },
    {
      id: '#MSG-4814',
      sender: '+63 917 000 5544',
      preview:
        'Meralco disconnection notice: Your account balance is overdue. Settle via meralco-pay-online.biz',
      campaign: 'Meralco Threat #2',
      confidence: '71%',
      score: 71,
      status: 'Suspicious',
      timestamp: 'May 13, 6:30 AM',
      indicators: ['Utility Disconnection', 'Fake Domain'],
      carrier: 'Globe Telecom',
    },
    {
      id: '#MSG-4813',
      sender: '+63 908 777 3321',
      preview:
        'Congratulations! You won a ₱5,000 Shopee voucher. Tap link to claim: shopee-ph-claim.me',
      campaign: 'Shopee Prize Lure #11',
      confidence: '85%',
      score: 85,
      status: 'Smishing',
      timestamp: 'May 13, 5:58 AM',
      indicators: ['Voucher Lure', 'Fake Domain'],
      carrier: 'Smart Telecom',
    },
    {
      id: '#MSG-4812',
      sender: '+63 932 441 8800',
      preview:
        'GCash Security Alert: Unusual login from new device. Verify immediately at gcash-sec-auth.app',
      campaign: 'Op. GCash Clone #17',
      confidence: '93%',
      score: 93,
      status: 'Smishing',
      timestamp: 'May 13, 5:21 AM',
      indicators: ['Device Verification', 'GCash Impersonation'],
      carrier: 'DITO Telecommunity',
    },
    {
      id: '#MSG-4811',
      sender: '+63 918 222 9911',
      preview:
        'Maya Alert: Your Wallet transfer of ₱8,400 requires OTP approval. Visit maya-sec-check.com',
      campaign: 'Maya Wallet Scam #3',
      confidence: '92%',
      score: 92,
      status: 'Smishing',
      timestamp: 'May 13, 4:50 AM',
      indicators: ['FinTech Scam', 'OTP Phishing'],
      carrier: 'Smart Telecom',
    },
    {
      id: '#MSG-4810',
      sender: '+63 927 334 1188',
      preview:
        'Landbank Advisory: Account suspended due to unverified KYC. Reactivate at landbank-kyc-verify.net',
      campaign: 'Landbank Impersonation #1',
      confidence: '95%',
      score: 95,
      status: 'Smishing',
      timestamp: 'May 13, 4:12 AM',
      indicators: ['KYC Fraud', 'Bank Impersonation'],
      carrier: 'Globe Telecom',
    },
    {
      id: '#MSG-4809',
      sender: '+63 909 555 1212',
      preview:
        'Lazada Notice: Claim your refund of ₱2,350 at lazada-ph-refunds.store',
      campaign: 'Lazada Refund Lure #7',
      confidence: '87%',
      score: 87,
      status: 'Smishing',
      timestamp: 'May 13, 3:35 AM',
      indicators: ['E-Commerce Scam', 'Fake Refund'],
      carrier: 'Smart Telecom',
    },
    {
      id: '#MSG-4808',
      sender: '+63 917 889 0011',
      preview:
        'Metrobank: Security notice for your debit card. Confirm details at metrobank-card-sec.info',
      campaign: 'Metrobank Impersonation #2',
      confidence: '69%',
      score: 69,
      status: 'Suspicious',
      timestamp: 'May 13, 2:50 AM',
      indicators: ['Card Verification', 'Suspicious URL'],
      carrier: 'Globe Telecom',
    },
    {
      id: '#MSG-4807',
      sender: '+63 945 112 3344',
      preview:
        'SSS Update: Your pension loan application approved. Check status at sss-pension-loan.biz',
      campaign: 'Govt Impersonation #9',
      confidence: '91%',
      score: 91,
      status: 'Smishing',
      timestamp: 'May 13, 2:10 AM',
      indicators: ['Govt Impersonation', 'Loan Lure'],
      carrier: 'Globe Telecom',
    },
    {
      id: '#MSG-4806',
      sender: '+63 922 778 9900',
      preview:
        'Globe Telecom: You have 1,500 unredeemed rewards points expiring today! Redeem at globe-rewards-points.site',
      campaign: 'Globe Rewards Scam #6',
      confidence: '89%',
      score: 89,
      status: 'Smishing',
      timestamp: 'May 13, 1:40 AM',
      indicators: ['Rewards Scam', 'Expiring Urgency'],
      carrier: 'DITO Telecommunity',
    },
    {
      id: '#MSG-4805',
      sender: '+63 908 667 8899',
      preview:
        'UnionBank: Transaction alert ₱45,000 to ACME Corp. Dispute at unionbank-dispute-sec.org',
      campaign: 'UnionBank Scam #4',
      confidence: '94%',
      score: 94,
      status: 'Smishing',
      timestamp: 'May 13, 1:05 AM',
      indicators: ['Dispute Phishing', 'Bank Fraud'],
      carrier: 'Smart Telecom',
    },
    {
      id: '#MSG-4804',
      sender: '+63 919 333 4455',
      preview:
        'Security Advisory: Never share your OTP with anyone calling from customer support.',
      campaign: 'System Advisory',
      confidence: '12%',
      score: 12,
      status: 'Suspicious',
      timestamp: 'May 13, 0:30 AM',
      indicators: ['Educational Note'],
      carrier: 'Smart Telecom',
    },
  ];

  const rawMessages = apiMessages.length > 0 ? apiMessages : initialRawMessages;

  const filteredMessages = rawMessages.filter((msg) => {
    const matchesSearch =
      msg.sender.toLowerCase().includes(search.toLowerCase()) ||
      msg.preview.toLowerCase().includes(search.toLowerCase()) ||
      msg.campaign.toLowerCase().includes(search.toLowerCase()) ||
      msg.id.toLowerCase().includes(search.toLowerCase());

    if (activeTab === 'smishing')
      return matchesSearch && msg.status === 'Smishing';
    if (activeTab === 'suspicious')
      return matchesSearch && msg.status === 'Suspicious';
    if (activeTab === 'reviewed') return matchesSearch && msg.score < 75;
    return matchesSearch;
  });

  const itemsPerPage = 6;
  const totalPages = Math.max(
    1,
    Math.ceil(filteredMessages.length / itemsPerPage),
  );
  const validPage = Math.min(currentPage, totalPages);
  const startIndex = (validPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredMessages.length);
  const paginatedMessages = filteredMessages.slice(startIndex, endIndex);

  const handleExportCSV = () => {
    const csvContent =
      'MSG ID,Sender,Preview,Campaign,Confidence,Status,Timestamp\n' +
      filteredMessages
        .map(
          (m) =>
            `"${m.id}","${m.sender}","${m.preview.replace(/"/g, '""')}","${m.campaign}","${m.confidence}","${m.status}","${m.timestamp}"`,
        )
        .join('\n');
    triggerCSVDownload('bantai-classification-log.csv', csvContent);
    showToast('📥 Classification log exported as CSV!');
  };

  return (
    <ClientShell title="Messages">
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: '#10b981',
            color: '#fff',
            padding: '12px 22px',
            borderRadius: 10,
            fontWeight: 700,
            zIndex: 9999,
            boxShadow: '0 8px 24px rgba(16,185,129,0.3)',
          }}
        >
          {toast}
        </div>
      )}

      {/* Main Container */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Top Controls Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Q Search sender or content..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ width: 280, paddingLeft: 14 }}
              />
            </div>
            <Button variant="secondary" size="md" onClick={handleExportCSV}>
              📥 Export CSV
            </Button>
          </div>
        </div>

        {/* Filter Pills */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <button
            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('all');
              setCurrentPage(1);
            }}
            style={{
              borderRadius: 20,
              padding: '6px 18px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              background:
                activeTab === 'all' ? '#2563eb' : 'var(--bg-surface-elevated)',
              color: activeTab === 'all' ? '#ffffff' : 'var(--text-secondary)',
              border: '1px solid var(--border-default)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            All {rawMessages.length}
          </button>
          <button
            className={`tab-btn ${activeTab === 'smishing' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('smishing');
              setCurrentPage(1);
            }}
            style={{
              borderRadius: 20,
              padding: '6px 18px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              background:
                activeTab === 'smishing'
                  ? '#2563eb'
                  : 'var(--bg-surface-elevated)',
              color:
                activeTab === 'smishing' ? '#ffffff' : 'var(--text-secondary)',
              border: '1px solid var(--border-default)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Likely Smishing{' '}
            {rawMessages.filter((m) => m.status === 'Smishing').length}
          </button>
          <button
            className={`tab-btn ${activeTab === 'suspicious' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('suspicious');
              setCurrentPage(1);
            }}
            style={{
              borderRadius: 20,
              padding: '6px 18px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              background:
                activeTab === 'suspicious'
                  ? '#2563eb'
                  : 'var(--bg-surface-elevated)',
              color:
                activeTab === 'suspicious'
                  ? '#ffffff'
                  : 'var(--text-secondary)',
              border: '1px solid var(--border-default)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Suspicious{' '}
            {rawMessages.filter((m) => m.status === 'Suspicious').length}
          </button>
          <button
            className={`tab-btn ${activeTab === 'reviewed' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('reviewed');
              setCurrentPage(1);
            }}
            style={{
              borderRadius: 20,
              padding: '6px 18px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              background:
                activeTab === 'reviewed'
                  ? '#2563eb'
                  : 'var(--bg-surface-elevated)',
              color:
                activeTab === 'reviewed' ? '#ffffff' : 'var(--text-secondary)',
              border: '1px solid var(--border-default)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Reviewed {rawMessages.filter((m) => m.score < 75).length}
          </button>
        </div>

        {/* Data Table */}
        <div
          className="panel no-lift"
          style={{
            padding: 0,
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid var(--border-default)',
          }}
        >
          <div className="table-wrap" style={{ overflowX: 'hidden' }}>
            <table
              style={{
                width: '100%',
                tableLayout: 'fixed',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '0.8125rem',
              }}
            >
              <thead>
                <tr
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderBottom: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontSize: '0.75rem',
                  }}
                >
                  <th style={{ padding: '14px 18px', width: '95px' }}>
                    MSG ID
                  </th>
                  <th style={{ padding: '14px 18px', width: '145px' }}>
                    SENDER
                  </th>
                  <th style={{ padding: '14px 18px' }}>PREVIEW</th>
                  <th style={{ padding: '14px 18px', width: '160px' }}>
                    CAMPAIGN
                  </th>
                  <th style={{ padding: '14px 18px', width: '95px' }}>
                    CONFIDENCE
                  </th>
                  <th style={{ padding: '14px 18px', width: '95px' }}>
                    STATUS
                  </th>
                  <th style={{ padding: '14px 18px', width: '125px' }}>
                    TIMESTAMP
                  </th>
                  <th
                    style={{
                      padding: '14px 18px',
                      width: '75px',
                      textAlign: 'right',
                    }}
                  >
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedMessages.map((msg) => (
                  <tr
                    key={msg.id}
                    className="subtle-row-hover"
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.15s ease',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedMessage(msg)}
                  >
                    <td
                      style={{
                        padding: '14px 18px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                      }}
                    >
                      {msg.id}
                    </td>
                    <td
                      style={{
                        padding: '14px 18px',
                        fontWeight: 600,
                        color: '#ffffff',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {msg.sender}
                    </td>
                    <td
                      style={{
                        padding: '14px 18px',
                        color: 'var(--text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {msg.preview}
                    </td>
                    <td
                      style={{
                        padding: '14px 18px',
                        color: '#60a5fa',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {msg.campaign}
                    </td>
                    <td
                      style={{
                        padding: '14px 18px',
                        fontWeight: 800,
                        color: msg.score >= 85 ? '#ef4444' : '#f59e0b',
                      }}
                    >
                      {msg.confidence}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span
                        className={`badge ${msg.status === 'Smishing' ? 'badge-red' : 'badge-amber'}`}
                      >
                        {msg.status}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '14px 18px',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {msg.timestamp}
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMessage(msg);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#60a5fa',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: '0.8125rem',
                        }}
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div
            style={{
              padding: '14px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid var(--border-subtle)',
              background: 'rgba(0, 0, 0, 0.2)',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Showing {filteredMessages.length === 0 ? 0 : startIndex + 1}–
              {endIndex} of {filteredMessages.length} results
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                disabled={validPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{
                  background: 'none',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  cursor: validPage <= 1 ? 'not-allowed' : 'pointer',
                  opacity: validPage <= 1 ? 0.4 : 1,
                }}
              >
                ‹ Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    style={{
                      background: validPage === pageNum ? '#2563eb' : 'none',
                      border: '1px solid var(--border-subtle)',
                      color:
                        validPage === pageNum
                          ? '#ffffff'
                          : 'var(--text-secondary)',
                      borderRadius: 6,
                      padding: '4px 10px',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    {pageNum}
                  </button>
                ),
              )}
              <button
                type="button"
                disabled={validPage >= totalPages}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                style={{
                  background: 'none',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  cursor: validPage >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: validPage >= totalPages ? 0.4 : 1,
                }}
              >
                Next ›
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Message Audit Modal */}
      {selectedMessage && (
        <Modal
          isOpen={!!selectedMessage}
          onClose={() => setSelectedMessage(null)}
          title={`Message Triage Audit — ${selectedMessage.id}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                padding: '14px',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: 10,
                border: '1px solid var(--border-subtle)',
              }}
            >
              <small
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                RAW SMS CONTENT
              </small>
              <p
                style={{
                  color: '#ffffff',
                  fontSize: '0.9375rem',
                  fontFamily: 'var(--font-mono)',
                  lineHeight: 1.5,
                }}
              >
                {selectedMessage.preview}
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                fontSize: '0.8125rem',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>
                  Sender Address
                </span>
                <strong style={{ color: '#ffffff' }}>
                  {selectedMessage.sender} ({selectedMessage.carrier})
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>
                  Assigned Cluster
                </span>
                <strong style={{ color: '#60a5fa' }}>
                  {selectedMessage.campaign}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>
                  NLP Confidence Score
                </span>
                <strong
                  style={{
                    color: selectedMessage.score >= 85 ? '#ef4444' : '#f59e0b',
                  }}
                >
                  {selectedMessage.confidence}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>
                  Timestamp Received
                </span>
                <strong style={{ color: '#ffffff' }}>
                  {selectedMessage.timestamp}
                </strong>
              </div>
            </div>

            <div>
              <small
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                FLAGGED PATTERN INDICATORS
              </small>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {selectedMessage.indicators.map((ind: string) => (
                  <span
                    key={ind}
                    className="badge badge-amber"
                    style={{ fontSize: '0.75rem' }}
                  >
                    ⚠️ {ind}
                  </span>
                ))}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 10,
              }}
            >
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedMessage(null);
                  showToast('Marked as Reviewed');
                }}
              >
                Mark False Positive
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setSelectedMessage(null);
                  showToast('✓ Smishing confirmation logged & SIM blocked');
                }}
              >
                🛡️ Confirm &amp; Block SIM
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </ClientShell>
  );
}

// ----------------------------------------------------
// 2. CLIENT CAMPAIGNS PAGE
// ----------------------------------------------------
export function ClientCampaignsPage() {
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedCampaign, setSelectedCampaign] = useState<any | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [apiActive, setApiActive] = useState<any[]>([]);
  const [apiInactive, setApiInactive] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    getActiveCampaigns()
      .then((clusters) => {
        if (isMounted && clusters && clusters.length > 0) {
          const mapped = clusters.map((c) => ({
            title: c.label || 'Active Smishing Cluster',
            icon: '🛡️',
            status: 'Active',
            riskScore: 90,
            messages: c.messageCount ? c.messageCount.toLocaleString() : '100+',
            domains: c.urlDomains?.length || 1,
            since: new Date(c.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
            tags: ['Cluster Interceptions', 'Active Campaign'],
            desc: 'Intercepted smishing cluster automatically grouped by AI domain/vector matching.',
            samplePayload: 'Smishing cluster telemetry payload sample.',
            domainsList: c.urlDomains || [],
          }));
          setApiActive(mapped);
        }
      })
      .catch(() => {});

    getInactiveCampaigns()
      .then((clusters) => {
        if (isMounted && clusters && clusters.length > 0) {
          const mapped = clusters.map((c) => ({
            title: c.label || 'Inactive Campaign Cluster',
            icon: '🔑',
            status: 'Inactive',
            riskScore: 70,
            messages: c.messageCount ? c.messageCount.toLocaleString() : '50+',
            domains: c.urlDomains?.length || 1,
            since: new Date(c.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
            tags: ['Archived Campaign'],
            desc: 'Deactivated smishing campaign cluster.',
            samplePayload: 'Deactivated payload sample.',
            domainsList: c.urlDomains || [],
          }));
          setApiInactive(mapped);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const initialActiveCampaignsList = [
    {
      title: 'Operation GCash Clone #17',
      icon: '🛡️',
      status: 'Active',
      riskScore: 96,
      messages: '142,847',
      domains: 4,
      since: 'May 11, 2026',
      tags: ['Prize Lure', 'Fake Domain', 'Taglish Wording'],
      desc: 'Aggressive scam campaign impersonating GCash account verification & prize rewards.',
      samplePayload:
        'URGENT: Your GCash account has been flagged due to security maintenance. Verify now at http://gcash-ph-support.net/login',
      domainsList: [
        'gcash-ph-support.net',
        'reward-gcash.com',
        'gcash-sec-auth.app',
        'claim-gcash-reward.tech',
      ],
    },
    {
      title: 'BDO Fake Support Wave #5',
      icon: '🏦',
      status: 'Active',
      riskScore: 91,
      messages: '84,291',
      domains: 2,
      since: 'May 9, 2026',
      tags: ['Urgency Tactics', 'OTP Harvesting', 'Bank Impersonation'],
      desc: 'Targeted banking phishing wave luring users to fake OTP verification pages.',
      samplePayload:
        'You have a pending transaction of ₱12,500. Tap to review and confirm: http://bdo-verify-sec.org',
      domainsList: ['bdo-verify-sec.org', 'bdo-online-check.info'],
    },
    {
      title: 'LBC Parcel Delivery Scam #8',
      icon: '📦',
      status: 'Active',
      riskScore: 94,
      messages: '67,128',
      domains: 3,
      since: 'May 8, 2026',
      tags: ['Fake Domain', 'Shortened URL', 'Urgency Tactics'],
      desc: 'Fake courier notification requesting customs clearance fee payment.',
      samplePayload:
        'URGENT: Your LBC parcel #PH9812 is held at customs. Pay release fee at http://lbc-customs-pay.cc',
      domainsList: [
        'lbc-customs-pay.cc',
        'lbc-express-track.info',
        'parcel-lbc-delivery.com',
      ],
    },
    {
      title: 'PLDT Bill Impersonation #4',
      icon: '⚡',
      status: 'Active',
      riskScore: 88,
      messages: '43,912',
      domains: 1,
      since: 'May 7, 2026',
      tags: ['Brand Impersonation', 'Overdue Notice'],
      desc: 'Utility disconnection threats demanding immediate payment via bogus gateway.',
      samplePayload:
        'Your PLDT bill of ₱1,899 is overdue. Avoid disconnection — pay now at http://pldt-paybill-online.net',
      domainsList: ['pldt-paybill-online.net'],
    },
    {
      title: 'Maya Wallet Phishing Wave #3',
      icon: '💳',
      status: 'Active',
      riskScore: 93,
      messages: '38,410',
      domains: 3,
      since: 'May 5, 2026',
      tags: ['OTP Harvesting', 'Fake Domain', 'FinTech Scam'],
      desc: 'Unauthorized transfer notification harvesting Maya OTP security credentials.',
      samplePayload:
        'Maya Alert: Your Wallet transfer of ₱8,400 requires OTP approval. Visit http://maya-sec-check.com',
      domainsList: [
        'maya-sec-check.com',
        'maya-auth-verify.net',
        'maya-wallet-login.online',
      ],
    },
    {
      title: 'Shopee Voucher Lure #11',
      icon: '🛒',
      status: 'Active',
      riskScore: 85,
      messages: '29,150',
      domains: 2,
      since: 'May 3, 2026',
      tags: ['Prize Lure', 'Shortened URL'],
      desc: 'Fake e-commerce voucher giveaway scam directing victims to credential stealing forms.',
      samplePayload:
        'SHOPEE NOTICE: Your prize of ₱10,000 is waiting! Claim within 24 hours at http://shopee-reward-hub.tech',
      domainsList: ['shopee-reward-hub.tech', 'shopee-ph-claim.me'],
    },
  ];

  const initialInactiveCampaignsList = [
    {
      title: 'BDO OTP Harvester Wave #3',
      icon: '🔑',
      status: 'Inactive',
      riskScore: 78,
      messages: '18,920',
      domains: 2,
      since: 'Apr 22, 2026',
      tags: ['OTP Harvesting'],
      desc: 'Deactivated banking credentials harvester.',
      samplePayload:
        'BDO Notice: Unrecognized login attempt detected. Secure your account at http://bdo-sec-check.org',
      domainsList: ['bdo-sec-check.org', 'bdo-mobile-auth.info'],
    },
    {
      title: 'Piso Fare Lure #6',
      icon: '✈️',
      status: 'Inactive',
      riskScore: 65,
      messages: '12,456',
      domains: 1,
      since: 'Apr 15, 2026',
      tags: ['Prize Lure'],
      desc: 'Fake airline promotional ticket giveaway scam.',
      samplePayload:
        'CEB PISO FARE ALERT: Book ₱1 flights today! Claim tickets at http://cebu-pacific-piso.site',
      domainsList: ['cebu-pacific-piso.site'],
    },
    {
      title: 'Landline OTP Intercept #1',
      icon: '📞',
      status: 'Inactive',
      riskScore: 72,
      messages: '7,231',
      domains: 2,
      since: 'Apr 8, 2026',
      tags: ['OTP Harvesting'],
      desc: 'Targeted landline verification code interception attempt.',
      samplePayload:
        'PLDT Landline Security: Verify voice OTP at http://pldt-voice-auth.net',
      domainsList: ['pldt-voice-auth.net', 'landline-verify-pldt.com'],
    },
  ];

  const activeCampaignsList =
    apiActive.length > 0 ? apiActive : initialActiveCampaignsList;
  const inactiveCampaignsList =
    apiInactive.length > 0 ? apiInactive : initialInactiveCampaignsList;

  const handleExportCampaigns = () => {
    const csvContent =
      'Campaign Title,Status,Risk Score,Messages,Domains,Date Since,Tags\n' +
      [...activeCampaignsList, ...inactiveCampaignsList]
        .map(
          (c) =>
            `"${c.title}","${c.status}","${c.riskScore}%","${c.messages}","${c.domains}","${c.since}","${c.tags.join('; ')}"`,
        )
        .join('\n');
    triggerCSVDownload('bantai-campaign-clusters.csv', csvContent);
    showToast('📥 Campaign clusters dataset exported as CSV!');
  };

  const handleExportSingleCampaign = (campaign: any) => {
    const csvContent =
      'Campaign Title,Status,Risk Score,Messages,Domains,Date Since,Tags,Description,Sample Payload\n' +
      `"${campaign.title}","${campaign.status}","${campaign.riskScore}%","${campaign.messages}","${campaign.domains}","${campaign.since}","${campaign.tags.join('; ')}","${campaign.desc}","${campaign.samplePayload}"`;
    triggerCSVDownload(
      `${campaign.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-report.csv`,
      csvContent,
    );
    showToast(`📥 Exported report for ${campaign.title}`);
  };

  return (
    <ClientShell title="Campaigns">
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: '#10b981',
            color: '#fff',
            padding: '12px 22px',
            borderRadius: 10,
            fontWeight: 700,
            zIndex: 9999,
            boxShadow: '0 8px 24px rgba(16,185,129,0.3)',
          }}
        >
          {toast}
        </div>
      )}

      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* Top Header Metrics Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
            width: '100%',
          }}
        >
          <div
            className="panel campaign-card-interactive"
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 14,
              padding: '16px 20px',
              minHeight: 120,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                }}
              >
                Total Clusters
              </span>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgba(168, 85, 247, 0.15)',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                }}
              >
                🛡️
              </div>
            </div>
            <strong
              style={{
                color: '#ffffff',
                fontSize: '1.75rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
              }}
            >
              9
            </strong>
          </div>

          <div
            className="panel campaign-card-interactive"
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 14,
              padding: '16px 20px',
              minHeight: 120,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                }}
              >
                Active Campaigns
              </span>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                }}
              >
                🟢
              </div>
            </div>
            <strong
              style={{
                color: '#10b981',
                fontSize: '1.75rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
              }}
            >
              6
            </strong>
          </div>

          <div
            className="panel campaign-card-interactive"
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: 14,
              padding: '16px 20px',
              minHeight: 120,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                }}
              >
                Logged Messages
              </span>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                }}
              >
                💬
              </div>
            </div>
            <strong
              style={{
                color: '#60a5fa',
                fontSize: '1.75rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
              }}
            >
              405,738
            </strong>
          </div>

          <div
            className="panel campaign-card-interactive"
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 14,
              padding: '16px 20px',
              minHeight: 120,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                }}
              >
                Tracked Domains
              </span>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                }}
              >
                🌐
              </div>
            </div>
            <strong
              style={{
                color: '#ef4444',
                fontSize: '1.75rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
              }}
            >
              15
            </strong>
          </div>
        </div>

        {/* Filter Pills & Export Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setFilter('all')}
              style={{
                borderRadius: 20,
                padding: '6px 18px',
                fontSize: '0.8125rem',
                fontWeight: 700,
                background:
                  filter === 'all' ? '#2563eb' : 'var(--bg-surface-elevated)',
                color: filter === 'all' ? '#ffffff' : 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              All (9)
            </button>
            <button
              onClick={() => setFilter('active')}
              style={{
                borderRadius: 20,
                padding: '6px 18px',
                fontSize: '0.8125rem',
                fontWeight: 700,
                background:
                  filter === 'active'
                    ? '#2563eb'
                    : 'var(--bg-surface-elevated)',
                color:
                  filter === 'active' ? '#ffffff' : 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Active (6)
            </button>
            <button
              onClick={() => setFilter('inactive')}
              style={{
                borderRadius: 20,
                padding: '6px 18px',
                fontSize: '0.8125rem',
                fontWeight: 700,
                background:
                  filter === 'inactive'
                    ? '#2563eb'
                    : 'var(--bg-surface-elevated)',
                color:
                  filter === 'inactive' ? '#ffffff' : 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Inactive (3)
            </button>
          </div>

          <Button
            variant="secondary"
            size="md"
            onClick={handleExportCampaigns}
            style={{
              borderRadius: 10,
              padding: '8px 18px',
              fontSize: '0.8125rem',
            }}
          >
            📥 Export All Clusters CSV
          </Button>
        </div>

        {/* Active Campaigns 3-Column Grid */}
        {(filter === 'all' || filter === 'active') && (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 16,
              }}
            >
              <h3
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Active Campaigns
              </h3>
              <span
                className="badge badge-green"
                style={{ fontSize: '0.75rem' }}
              >
                6 Live
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 20,
              }}
            >
              {activeCampaignsList.map((item) => (
                <div
                  key={item.title}
                  onClick={() => setSelectedCampaign(item)}
                  className="panel campaign-card-interactive"
                  style={{
                    background:
                      'linear-gradient(145deg, #13182a 0%, #0d121f 100%)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    borderRadius: 16,
                    padding: '20px 22px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 16,
                    minHeight: 240,
                    boxShadow: '0 4px 20px rgba(37, 99, 235, 0.1)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                    >
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 12,
                          background: 'rgba(37, 99, 235, 0.18)',
                          border: '1px solid rgba(59, 130, 246, 0.35)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.25rem',
                        }}
                      >
                        {item.icon}
                      </div>
                      <div>
                        <strong
                          style={{
                            fontSize: '0.9375rem',
                            color: '#ffffff',
                            display: 'block',
                            lineHeight: 1.3,
                          }}
                        >
                          {item.title}
                        </strong>
                        <div
                          style={{
                            display: 'flex',
                            gap: 6,
                            alignItems: 'center',
                            marginTop: 4,
                          }}
                        >
                          <span
                            className="badge badge-green"
                            style={{ fontSize: '0.6875rem' }}
                          >
                            ● Active
                          </span>
                          <span
                            className="badge badge-red"
                            style={{ fontSize: '0.6875rem' }}
                          >
                            🔥 {item.riskScore}% Risk
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Metrics Bar */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: 8,
                      background: 'rgba(0, 0, 0, 0.35)',
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div>
                      <small
                        style={{
                          color: 'var(--text-muted)',
                          fontSize: '0.6875rem',
                          display: 'block',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        Messages
                      </small>
                      <strong
                        style={{
                          color: '#ffffff',
                          fontSize: '1.05rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                        }}
                      >
                        {item.messages}
                      </strong>
                    </div>
                    <div>
                      <small
                        style={{
                          color: 'var(--text-muted)',
                          fontSize: '0.6875rem',
                          display: 'block',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        Domains
                      </small>
                      <strong
                        style={{
                          color: '#60a5fa',
                          fontSize: '1.05rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                        }}
                      >
                        {item.domains}
                      </strong>
                    </div>
                    <div>
                      <small
                        style={{
                          color: 'var(--text-muted)',
                          fontSize: '0.6875rem',
                          display: 'block',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        Since
                      </small>
                      <strong
                        style={{
                          color: 'var(--text-secondary)',
                          fontSize: '0.8125rem',
                        }}
                      >
                        {item.since}
                      </strong>
                    </div>
                  </div>

                  {/* Pattern Tags */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {item.tags.map((t: string) => (
                      <span
                        key={t}
                        className="badge badge-purple"
                        style={{ fontSize: '0.6875rem', padding: '3px 9px' }}
                      >
                        🏷️ {t}
                      </span>
                    ))}
                  </div>

                  {/* Action Link Footer */}
                  <div
                    style={{
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: 10,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.75rem',
                      color: '#60a5fa',
                      fontWeight: 700,
                    }}
                  >
                    <span>Inspect Cluster Intelligence</span>
                    <span>→</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inactive Campaigns 3-Column Grid */}
        {(filter === 'all' || filter === 'inactive') && (
          <div style={{ marginTop: 8 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 16,
              }}
            >
              <h3
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Inactive Campaigns
              </h3>
              <span
                className="badge badge-gray"
                style={{ fontSize: '0.75rem' }}
              >
                3 Inactive
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 20,
              }}
            >
              {inactiveCampaignsList.map((item) => (
                <div
                  key={item.title}
                  onClick={() => setSelectedCampaign(item)}
                  className="panel campaign-card-interactive"
                  style={{
                    background: 'rgba(15, 23, 42, 0.4)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 16,
                    padding: '20px 22px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 16,
                    minHeight: 240,
                    opacity: 0.85,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                    >
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 12,
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.25rem',
                          opacity: 0.7,
                        }}
                      >
                        {item.icon}
                      </div>
                      <div>
                        <strong
                          style={{
                            fontSize: '0.9375rem',
                            color: 'var(--text-secondary)',
                            display: 'block',
                            lineHeight: 1.3,
                          }}
                        >
                          {item.title}
                        </strong>
                        <div
                          style={{
                            display: 'flex',
                            gap: 6,
                            alignItems: 'center',
                            marginTop: 4,
                          }}
                        >
                          <span
                            className="badge badge-gray"
                            style={{ fontSize: '0.6875rem' }}
                          >
                            Inactive
                          </span>
                          <span
                            className="badge badge-amber"
                            style={{ fontSize: '0.6875rem' }}
                          >
                            {item.riskScore}% Risk
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: 8,
                      background: 'rgba(0, 0, 0, 0.2)',
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div>
                      <small
                        style={{
                          color: 'var(--text-muted)',
                          fontSize: '0.6875rem',
                          display: 'block',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        Messages
                      </small>
                      <strong
                        style={{
                          color: 'var(--text-secondary)',
                          fontSize: '1.05rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                        }}
                      >
                        {item.messages}
                      </strong>
                    </div>
                    <div>
                      <small
                        style={{
                          color: 'var(--text-muted)',
                          fontSize: '0.6875rem',
                          display: 'block',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        Domains
                      </small>
                      <strong
                        style={{
                          color: 'var(--text-secondary)',
                          fontSize: '1.05rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                        }}
                      >
                        {item.domains}
                      </strong>
                    </div>
                    <div>
                      <small
                        style={{
                          color: 'var(--text-muted)',
                          fontSize: '0.6875rem',
                          display: 'block',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        Since
                      </small>
                      <strong
                        style={{
                          color: 'var(--text-muted)',
                          fontSize: '0.8125rem',
                        }}
                      >
                        {item.since}
                      </strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {item.tags.map((t: string) => (
                      <span
                        key={t}
                        className="badge badge-gray"
                        style={{ fontSize: '0.6875rem', padding: '3px 9px' }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  <div
                    style={{
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: 10,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                    }}
                  >
                    <span>View Historical Log</span>
                    <span>→</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Campaign Details Modal */}
      {selectedCampaign && (
        <Modal
          isOpen={Boolean(selectedCampaign)}
          onClose={() => setSelectedCampaign(null)}
          title={`Threat Cluster: ${selectedCampaign.title}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-surface-elevated)',
                padding: 14,
                borderRadius: 10,
                border: '1px solid var(--border-default)',
              }}
            >
              <div>
                <small
                  style={{
                    color: 'var(--text-muted)',
                    display: 'block',
                    fontSize: '0.75rem',
                  }}
                >
                  Status &amp; Risk Score
                </small>
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    marginTop: 4,
                  }}
                >
                  <span
                    className={`badge ${selectedCampaign.status === 'Active' ? 'badge-green' : 'badge-gray'}`}
                  >
                    {selectedCampaign.status}
                  </span>
                  <span className="badge badge-red">
                    🔥 {selectedCampaign.riskScore}% Threat Risk
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <small
                  style={{
                    color: 'var(--text-muted)',
                    display: 'block',
                    fontSize: '0.75rem',
                  }}
                >
                  Active Since
                </small>
                <strong style={{ color: '#ffffff', fontSize: '0.9375rem' }}>
                  {selectedCampaign.since}
                </strong>
              </div>
            </div>

            <div>
              <small
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  display: 'block',
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  fontWeight: 700,
                }}
              >
                Cluster Description
              </small>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.875rem',
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {selectedCampaign.desc}
              </p>
            </div>

            {selectedCampaign.samplePayload && (
              <div
                style={{
                  padding: 14,
                  background: 'rgba(0, 0, 0, 0.35)',
                  borderRadius: 10,
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <small
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    display: 'block',
                    marginBottom: 6,
                    fontWeight: 700,
                  }}
                >
                  REPRESENTATIVE SMS PAYLOAD
                </small>
                <code
                  style={{
                    color: '#ffffff',
                    fontSize: '0.84375rem',
                    fontFamily: 'var(--font-mono)',
                    lineHeight: 1.5,
                    display: 'block',
                  }}
                >
                  {selectedCampaign.samplePayload}
                </code>
              </div>
            )}

            {selectedCampaign.domainsList && (
              <div>
                <small
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    display: 'block',
                    marginBottom: 6,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  Tracked Malicious Domains (
                  {selectedCampaign.domainsList.length})
                </small>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {selectedCampaign.domainsList.map((domain: string) => (
                    <span
                      key={domain}
                      className="badge badge-red"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                      }}
                    >
                      🌐 {domain}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: 14,
              }}
            >
              <Button variant="ghost" onClick={() => setSelectedCampaign(null)}>
                Close
              </Button>
              <Button
                variant="primary"
                onClick={() => handleExportSingleCampaign(selectedCampaign)}
              >
                📥 Download Cluster Report
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </ClientShell>
  );
}

// ----------------------------------------------------
// 3. CLIENT ANALYTICS PAGE (Matching Screenshot 3)
// ----------------------------------------------------
export function ClientAnalyticsPage() {
  const [selectedCampaign, setSelectedCampaign] = useState(
    'Operation GCash Clone #17',
  );
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [hoveredTactic, setHoveredTactic] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const tacticBreakdown = [
    {
      label: 'Suspicious Shortened URLs',
      val: '90%',
      count: '128,562 msgs',
      tone: '#ef4444',
    },
    {
      label: 'Fake Domain Usage',
      val: '84%',
      count: '120,011 msgs',
      tone: '#ef4444',
    },
    {
      label: 'Brand Impersonation (GCash)',
      val: '79%',
      count: '112,849 msgs',
      tone: '#ef4444',
    },
    {
      label: 'Prize / Reward Lure Language',
      val: '71%',
      count: '101,421 msgs',
      tone: '#f59e0b',
    },
    {
      label: 'Urgency Pressure Wording',
      val: '65%',
      count: '92,850 msgs',
      tone: '#f59e0b',
    },
    {
      label: 'Taglish Code-Switching',
      val: '57%',
      count: '81,422 msgs',
      tone: '#f59e0b',
    },
    {
      label: 'Unknown Sender Number',
      val: '48%',
      count: '68,566 msgs',
      tone: '#f59e0b',
    },
  ];

  const variants = [
    {
      id: 'Variant A',
      score: '97.4%',
      text: 'Your GCash account has been flagged for suspicious activity. Verify now at gcash-ph-support.net/login',
      tone: '#ef4444',
    },
    {
      id: 'Variant B',
      score: '89.1%',
      text: 'GCASH NOTICE: Unusual login detected. Secure your account immediately at gcash-sec-auth.app',
      tone: '#ef4444',
    },
    {
      id: 'Variant C',
      score: '81.7%',
      text: 'Congratulations! Your GCash wallet has been selected for a ₱5,000 reward. Claim at reward-gcash.com',
      tone: '#f59e0b',
    },
  ];

  const handleExportCSV = () => {
    const csvContent =
      'Evasion Tactic,Prevalence Rate,Sample Count\n' +
      tacticBreakdown
        .map((t) => `"${t.label}","${t.val}","${t.count}"`)
        .join('\n');
    triggerCSVDownload('bantai-analytics-breakdown.csv', csvContent);
    showToast('📥 Evasion tactic breakdown exported as CSV!');
  };

  return (
    <ClientShell title="Analytics">
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: '#10b981',
            color: '#fff',
            padding: '12px 22px',
            borderRadius: 10,
            fontWeight: 700,
            zIndex: 9999,
            boxShadow: '0 8px 24px rgba(16,185,129,0.3)',
          }}
        >
          {toast}
        </div>
      )}

      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Top Controls Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <select
              className="form-input"
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              style={{ padding: '8px 16px', fontWeight: 700, width: 260 }}
            >
              <option value="Operation GCash Clone #17">
                Operation GCash Clone #17
              </option>
              <option value="BDO Fake Support Wave #5">
                BDO Fake Support Wave #5
              </option>
              <option value="LBC Parcel Delivery Scam #8">
                LBC Parcel Delivery Scam #8
              </option>
              <option value="PLDT Bill Impersonation #4">
                PLDT Bill Impersonation #4
              </option>
            </select>

            <Button variant="secondary" size="md" onClick={handleExportCSV}>
              📥 Export CSV
            </Button>
          </div>
        </div>

        {/* 2-Column Analytics Grid */}
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}
        >
          {/* Left Panel: Campaign Pattern Breakdown */}
          <div
            className="panel"
            style={{ padding: '24px 28px', borderRadius: 16 }}
          >
            <strong
              style={{
                fontSize: '1.125rem',
                color: '#ffffff',
                display: 'block',
                marginBottom: 4,
              }}
            >
              Campaign Pattern Breakdown
            </strong>
            <small
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.8125rem',
                display: 'block',
                marginBottom: 20,
              }}
            >
              Evasion tactic prevalence within selected campaign:{' '}
              <span style={{ color: '#60a5fa', fontWeight: 700 }}>
                {selectedCampaign}
              </span>
            </small>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {tacticBreakdown.map((tactic) => (
                <div
                  key={tactic.label}
                  onMouseEnter={() => setHoveredTactic(tactic.label)}
                  onMouseLeave={() => setHoveredTactic(null)}
                  style={{ position: 'relative', cursor: 'pointer' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.8125rem',
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{ color: 'var(--text-primary)', fontWeight: 600 }}
                    >
                      {tactic.label}
                    </span>
                    <strong style={{ color: tactic.tone, fontWeight: 800 }}>
                      {tactic.val}
                    </strong>
                  </div>
                  <div
                    style={{
                      height: 8,
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: 4,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      className="progress-bar-hover"
                      style={{
                        height: '100%',
                        width: tactic.val,
                        background: tactic.tone,
                        borderRadius: 4,
                        transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                    />
                  </div>
                  {hoveredTactic === tactic.label && (
                    <div
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: -24,
                        background: '#000',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: '0.75rem',
                        color: '#60a5fa',
                        border: '1px solid var(--border-subtle)',
                        zIndex: 10,
                      }}
                    >
                      Prevalence Count: {tactic.count}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel: Similarity Scores by Variant */}
          <div
            className="panel"
            style={{
              padding: '24px 28px',
              borderRadius: 16,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <strong
                style={{
                  fontSize: '1.125rem',
                  color: '#ffffff',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Similarity Scores by Variant
              </strong>
              <small
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.8125rem',
                  display: 'block',
                  marginBottom: 20,
                }}
              >
                Message variants ranked by detection match
              </small>

              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
              >
                {variants.map((varItem) => (
                  <div
                    key={varItem.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      padding: '14px 16px',
                      borderRadius: 10,
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 6,
                      }}
                    >
                      <strong
                        style={{ fontSize: '0.875rem', color: '#ffffff' }}
                      >
                        {varItem.id}
                      </strong>
                      <span
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 800,
                          color: varItem.tone,
                        }}
                      >
                        {varItem.score}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 6,
                        width: '100%',
                        background: 'rgba(255, 255, 255, 0.08)',
                        borderRadius: 3,
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: varItem.score,
                          background: varItem.tone,
                          borderRadius: 3,
                        }}
                      />
                    </div>
                    <p
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      "{varItem.text}"
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsVariantModalOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#60a5fa',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.8125rem',
                textAlign: 'left',
                marginTop: 16,
              }}
            >
              View all variants →
            </button>
          </div>
        </div>
      </div>

      {/* Variant Inspection Modal */}
      {isVariantModalOpen && (
        <Modal
          isOpen={isVariantModalOpen}
          onClose={() => setIsVariantModalOpen(false)}
          title="Full Cluster Variant Catalog"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {variants.map((v) => (
              <div
                key={v.id}
                style={{
                  padding: '14px',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: 10,
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <strong style={{ color: '#ffffff' }}>
                    {v.id} — Match Score {v.score}
                  </strong>
                  <button
                    type="button"
                    onClick={() => showToast('Variant text copied!')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#60a5fa',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                    }}
                  >
                    Copy Text
                  </button>
                </div>
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {v.text}
                </p>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </ClientShell>
  );
}

// ----------------------------------------------------
// 4. CLIENT EXPORT REPORTS PAGE (Matching Screenshot 4)
// ----------------------------------------------------
export function ClientExportPage() {
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const recentExportLogs = [
    {
      filename: 'classification-log-may13.csv',
      type: 'Full Log',
      date: 'May 13, 2026',
      records: '12,847 records',
      size: '2.4 MB',
      status: 'Complete',
    },
    {
      filename: 'campaign-report-may10.csv',
      type: 'Campaign',
      date: 'May 10, 2026',
      records: '1,247 records',
      size: '340 KB',
      status: 'Complete',
    },
    {
      filename: 'custom-export-may8.csv',
      type: 'Custom Range',
      date: 'May 8, 2026',
      records: '3,420 records',
      size: '890 KB',
      status: 'Complete',
    },
    {
      filename: 'weekly-report-may5.pdf',
      type: 'Summary PDF',
      date: 'May 5, 2026',
      records: '1 report',
      size: '1.1 MB',
      status: 'Complete',
    },
    {
      filename: 'full-dataset-apr30.csv',
      type: 'Dataset',
      date: 'Apr 30, 2026',
      records: '18,001 records',
      size: '4.8 MB',
      status: 'Complete',
    },
  ];

  const handleDownloadFile = (filename: string) => {
    triggerCSVDownload(
      filename,
      `BantAI Export Dataset - ${filename}\nTimestamp,ID,Carrier,Status\n2026-05-13,MSG-101,Globe Telecom,Smishing`,
    );
    showToast(`📥 Started download: ${filename}`);
  };

  return (
    <ClientShell title="Export Reports">
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: '#10b981',
            color: '#fff',
            padding: '12px 22px',
            borderRadius: 10,
            fontWeight: 700,
            zIndex: 9999,
            boxShadow: '0 8px 24px rgba(16,185,129,0.3)',
          }}
        >
          {toast}
        </div>
      )}

      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* Quick Export 3 Cards */}
        <div>
          <small
            style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              color: 'var(--text-muted)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              display: 'block',
              marginBottom: 14,
            }}
          >
            QUICK EXPORT
          </small>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 20,
            }}
          >
            {/* Card 1 */}
            <div
              className="panel card-hover-effect"
              style={{
                padding: '24px 28px',
                borderRadius: 16,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: 'rgba(37, 99, 235, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    color: '#60a5fa',
                    marginBottom: 16,
                  }}
                >
                  📄
                </div>
                <strong
                  style={{
                    fontSize: '1.125rem',
                    color: '#ffffff',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  Full Classification Log
                </strong>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.8125rem',
                    lineHeight: 1.5,
                    marginBottom: 12,
                  }}
                >
                  All flagged messages with labels, scores, timestamps, and
                  indicators
                </p>
                <small
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    display: 'block',
                  }}
                >
                  Format: CSV · Last updated: May 13, 2026 02:00 AM
                </small>
              </div>
              <Button
                variant="primary"
                style={{ marginTop: 20 }}
                onClick={() =>
                  handleDownloadFile('full-classification-log.csv')
                }
              >
                📥 Download CSV
              </Button>
            </div>

            {/* Card 2 */}
            <div
              className="panel card-hover-effect"
              style={{
                padding: '24px 28px',
                borderRadius: 16,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: 'rgba(37, 99, 235, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    color: '#60a5fa',
                    marginBottom: 16,
                  }}
                >
                  📊
                </div>
                <strong
                  style={{
                    fontSize: '1.125rem',
                    color: '#ffffff',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  Campaign Summary Report
                </strong>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.8125rem',
                    lineHeight: 1.5,
                    marginBottom: 12,
                  }}
                >
                  All campaign clusters with pattern breakdowns and variant
                  listings
                </p>
                <small
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    display: 'block',
                  }}
                >
                  Format: CSV + PDF · Last updated: May 13, 2026 02:00 AM
                </small>
              </div>
              <Button
                variant="primary"
                style={{ marginTop: 20 }}
                onClick={() =>
                  handleDownloadFile('campaign-summary-report.pdf')
                }
              >
                📥 Download
              </Button>
            </div>

            {/* Card 3 */}
            <div
              className="panel card-hover-effect"
              style={{
                padding: '24px 28px',
                borderRadius: 16,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: 'rgba(37, 99, 235, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    color: '#60a5fa',
                    marginBottom: 16,
                  }}
                >
                  ⚙️
                </div>
                <strong
                  style={{
                    fontSize: '1.125rem',
                    color: '#ffffff',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  Custom Date Range Export
                </strong>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.8125rem',
                    lineHeight: 1.5,
                    marginBottom: 12,
                  }}
                >
                  Define a specific time window and campaign filter for your
                  export
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#60a5fa',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginTop: 20,
                }}
              >
                Configure Export →
              </button>
            </div>
          </div>
        </div>

        {/* Recent Exports Table */}
        <div
          className="panel"
          style={{
            padding: 0,
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid var(--border-default)',
          }}
        >
          <div
            style={{
              padding: '20px 24px 14px',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <strong
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              RECENT EXPORTS
            </strong>
          </div>

          <div className="table-wrap">
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '0.8125rem',
              }}
            >
              <thead>
                <tr
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderBottom: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    fontSize: '0.75rem',
                  }}
                >
                  <th style={{ padding: '14px 20px' }}>FILENAME</th>
                  <th style={{ padding: '14px 20px' }}>TYPE</th>
                  <th style={{ padding: '14px 20px' }}>DATE</th>
                  <th style={{ padding: '14px 20px' }}>RECORDS</th>
                  <th style={{ padding: '14px 20px' }}>SIZE</th>
                  <th style={{ padding: '14px 20px' }}>STATUS</th>
                  <th style={{ padding: '14px 20px', textAlign: 'right' }}>
                    ACTION
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentExportLogs.map((row) => (
                  <tr
                    key={row.filename}
                    className="table-row-hover"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  >
                    <td
                      style={{
                        padding: '14px 20px',
                        fontFamily: 'var(--font-mono)',
                        color: '#ffffff',
                        fontWeight: 600,
                      }}
                    >
                      {row.filename}
                    </td>
                    <td
                      style={{
                        padding: '14px 20px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {row.type}
                    </td>
                    <td
                      style={{
                        padding: '14px 20px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {row.date}
                    </td>
                    <td
                      style={{
                        padding: '14px 20px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {row.records}
                    </td>
                    <td
                      style={{
                        padding: '14px 20px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {row.size}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span className="badge badge-green">Complete</span>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadFile(row.filename)}
                        title={`Download ${row.filename}`}
                        style={{
                          borderRadius: 6,
                          fontSize: '0.75rem',
                          padding: '4px 10px',
                        }}
                      >
                        Download ↓
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Custom Export Configuration Modal */}
      {isConfigModalOpen && (
        <Modal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          title="Configure Custom Data Export"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                  marginBottom: 4,
                }}
              >
                Date Range
              </label>
              <select className="form-input">
                <option>Last 7 Days (May 6 - May 13)</option>
                <option>Last 30 Days (Apr 13 - May 13)</option>
                <option>Custom Date Range...</option>
              </select>
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                  marginBottom: 4,
                }}
              >
                Campaign Scope
              </label>
              <select className="form-input">
                <option>All Campaigns (Global Feed)</option>
                <option>Operation GCash Clone #17</option>
                <option>BDO Fake Support Wave #5</option>
              </select>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 10,
              }}
            >
              <Button
                variant="primary"
                onClick={() => {
                  setIsConfigModalOpen(false);
                  handleDownloadFile('custom-filtered-export.csv');
                }}
              >
                Generate Custom Export
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </ClientShell>
  );
}

// ----------------------------------------------------
// 5. CLIENT HELP PAGE (Matching Screenshot 5)
// ----------------------------------------------------
export function ClientHelpPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const detailedFaqs = [
    {
      q: 'What does the Confidence score mean?',
      a: "The confidence score (0-100%) reflects the model's certainty that a message is smishing. Scores above 80% are flagged as Likely Smishing; 50-79% are Suspicious. Scores below 50% are generally treated as Unknown / Safe.",
    },
    {
      q: 'What is a Campaign?',
      a: 'A campaign is a coordinated cluster of smishing messages that share similar patterns — same fake domain, brand, or phrasing. BantAI groups related messages into named campaigns so you can track them over time.',
    },
    {
      q: 'Can I export my data?',
      a: 'Yes. Go to Export Reports to download your classification log as a CSV. Exports are scoped to your organization and do not include raw sender numbers.',
    },
    {
      q: 'How do I interpret the Analytics page?',
      a: "The analytics page shows pattern breakdowns per campaign. Use the campaign selector to switch context. The progress bars show how frequently each evasion tactic appears in that cluster's messages.",
    },
    {
      q: 'Why do some messages show "Suspicious" instead of "Smishing"?',
      a: 'Suspicious messages contain some smishing indicators but not enough for a high-confidence classification. They are included in your log so your team can manually review borderline cases.',
    },
    {
      q: 'How often is the data updated?',
      a: 'Classifications are processed in near real-time as BantAI app users submit reports. Campaign clusters are updated daily. Your dashboard data refreshes continuously.',
    },
    {
      q: 'How are false positives handled by the system?',
      a: 'If a legitimate SMS is incorrectly flagged as smishing, click the "Mark False Positive" button in the Message Audit modal. Our NLP machine learning team reviews all reported false positives during retraining sessions.',
    },
  ];

  return (
    <ClientShell title="Help">
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: '#10b981',
            color: '#fff',
            padding: '12px 22px',
            borderRadius: 10,
            fontWeight: 700,
            zIndex: 9999,
            boxShadow: '0 8px 24px rgba(16,185,129,0.3)',
          }}
        >
          {toast}
        </div>
      )}

      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* 2-Column Grid */}
        <div
          style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}
        >
          {/* Left Column: FAQ Accordion */}
          <div>
            <small
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: 14,
              }}
            >
              FREQUENTLY ASKED QUESTIONS
            </small>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {detailedFaqs.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={faq.q}
                    className="panel card-hover-effect"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    style={{
                      padding: '18px 22px',
                      borderRadius: 14,
                      cursor: 'pointer',
                      transition: 'all 0.25s ease',
                      border: isOpen
                        ? '1px solid #3b82f6'
                        : '1px solid var(--border-default)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        <span
                          style={{ color: '#60a5fa', fontSize: '1.125rem' }}
                        >
                          ❓
                        </span>
                        <strong
                          style={{ fontSize: '0.9375rem', color: '#ffffff' }}
                        >
                          {faq.q}
                        </strong>
                      </div>
                      <span
                        style={{
                          color: 'var(--text-muted)',
                          fontSize: '0.875rem',
                        }}
                      >
                        {isOpen ? '▲' : '▼'}
                      </span>
                    </div>

                    {isOpen && (
                      <p
                        style={{
                          color: 'var(--text-secondary)',
                          fontSize: '0.875rem',
                          lineHeight: 1.6,
                          marginTop: 14,
                          paddingTop: 14,
                          borderTop: '1px solid var(--border-subtle)',
                        }}
                      >
                        {faq.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Contact Support Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <small
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                display: 'block',
              }}
            >
              CONTACT SUPPORT
            </small>

            {/* Email Card */}
            <div
              className="panel"
              style={{ padding: '20px 24px', borderRadius: 14 }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>📧</span>
                <strong style={{ color: '#ffffff', fontSize: '1rem' }}>
                  Email Support
                </strong>
              </div>
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                  marginBottom: 12,
                }}
              >
                For access issues, data questions, or bug reports:
              </p>
              <a
                href="mailto:support@bantai.research"
                style={{
                  color: '#60a5fa',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  textDecoration: 'underline',
                }}
                onClick={() => {
                  navigator.clipboard.writeText('support@bantai.research');
                  showToast('Email address copied: support@bantai.research');
                }}
              >
                support@bantai.research
              </a>
              <small
                style={{
                  display: 'block',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  marginTop: 10,
                }}
              >
                Response time: 24–48 hours on business days
              </small>
            </div>

            {/* Documentation Card */}
            <div
              className="panel"
              style={{ padding: '20px 24px', borderRadius: 14 }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>📄</span>
                <strong style={{ color: '#ffffff', fontSize: '1rem' }}>
                  Documentation
                </strong>
              </div>
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                  marginBottom: 12,
                }}
              >
                Full API and portal usage guide for client administrators.
              </p>
              <button
                type="button"
                onClick={() => setIsGuideModalOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#60a5fa',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                ↗ View Portal Guide
              </button>
            </div>

            {/* BantAI Research Team Card */}
            <div
              className="panel"
              style={{
                padding: '20px 24px',
                borderRadius: 14,
                background:
                  'linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}
            >
              <strong
                style={{
                  color: '#ffffff',
                  fontSize: '0.9375rem',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                BantAI Research Team
              </strong>
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                College of IT and Engineering
                <br />
                De La Salle Lipa · CS Department
                <br />
                Group 7 — Atienza · De Castro D. · De Castro R. · Mendoza
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Portal Guide Modal */}
      {isGuideModalOpen && (
        <Modal
          isOpen={isGuideModalOpen}
          onClose={() => setIsGuideModalOpen(false)}
          title="BantAI Client Portal Documentation Guide"
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}
          >
            <h4 style={{ color: '#ffffff', fontSize: '1rem' }}>
              1. Overview &amp; Real-Time Threat Feed
            </h4>
            <p>
              Monitors suspicious SMS submissions processed through the
              XLM-RoBERTa NLP pipeline.
            </p>

            <h4 style={{ color: '#ffffff', fontSize: '1rem' }}>
              2. Campaign Aggregation
            </h4>
            <p>
              Clusters related scam messages by shared URLs, phone patterns, and
              brand impersonation tactics using DBSCAN.
            </p>

            <h4 style={{ color: '#ffffff', fontSize: '1rem' }}>
              3. Data Export Options
            </h4>
            <p>
              Export full classification datasets in CSV format or download PDF
              executive summaries directly from the Export tab.
            </p>
          </div>
        </Modal>
      )}
    </ClientShell>
  );
}

export function ClientSettingsPage({
  notifications,
}: {
  notifications?: boolean;
}) {
  const { clientAvatar, setClientAvatar } = useUserAvatar();
  const [activeTab, setActiveTab] = React.useState<
    'profile' | 'notifications' | 'security'
  >(notifications ? 'notifications' : 'profile');

  const [contactPerson, setContactPerson] = React.useState('Maria Santos');
  const [email, setEmail] = React.useState('analyst@globe.com.ph');
  const [position, setPosition] = React.useState(
    'Senior Threat Intelligence Analyst',
  );
  const [phone, setPhone] = React.useState('+63 917 800 1234');
  const [department, setDepartment] = React.useState(
    'Fraud Operations & Cybersecurity',
  );

  // Avatar state
  const [isAvatarModalOpen, setIsAvatarModalOpen] = React.useState(false);
  const [customImageUrl, setCustomImageUrl] = React.useState('');

  // Activity Log modal state
  const [isActivityModalOpen, setIsActivityModalOpen] = React.useState(false);
  const [activitySearch, setActivitySearch] = React.useState('');

  // Notifications State
  const [notifConfig, setNotifConfig] = React.useState({
    threatSurgeAlerts: true,
    dailyDigestEmail: true,
    smsUrgentAlerts: false,
    campaignClusteringDigest: true,
  });

  // Password & 2FA State for Client
  const [currPass, setCurrPass] = React.useState('');
  const [newPass, setNewPass] = React.useState('');
  const [confirmPass, setConfirmPass] = React.useState('');
  const [showPass, setShowPass] = React.useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = React.useState(true);

  const [toast, setToast] = React.useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
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
    showToast('✓ Client account password updated successfully!');
  };

  const getPassStrength = () => {
    if (!newPass) return { label: 'None', width: '0%', color: '#64748b' };
    if (newPass.length < 8)
      return { label: 'Weak', width: '33%', color: '#ef4444' };
    if (newPass.length >= 8 && /[A-Z]/.test(newPass) && /[0-9]/.test(newPass))
      return { label: 'Strong', width: '100%', color: '#10b981' };
    return { label: 'Medium', width: '66%', color: '#f59e0b' };
  };

  const passStrength = getPassStrength();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('✓ Client account settings updated successfully!');
  };

  const handleReset = () => {
    setContactPerson('Maria Santos');
    setEmail('analyst@globe.com.ph');
    setPosition('Senior Threat Intelligence Analyst');
    setPhone('+63 917 800 1234');
    setDepartment('Fraud Operations & Cybersecurity');
    showToast('Form reset to saved values.');
  };

  const activityLogs = [
    {
      id: 1,
      action: 'Client Portal Login',
      ip: '112.198.102.14',
      timestamp: 'Today, 23:40:10',
      status: 'Success',
    },
    {
      id: 2,
      action: 'Exported Threat Intelligence Report',
      ip: '112.198.102.14',
      timestamp: 'Yesterday, 16:20:45',
      status: 'Success',
    },
    {
      id: 3,
      action: 'Downloaded Campaign Clusters CSV',
      ip: '112.198.102.14',
      timestamp: 'Jul 25, 2026, 11:05:12',
      status: 'Success',
    },
  ];

  const filteredLogs = activityLogs.filter((l) =>
    l.action.toLowerCase().includes(activitySearch.toLowerCase()),
  );

  return (
    <ClientShell title="Account Settings">
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

      {/* Main Full Width Space Maximized Container */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* Page Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <span
            className="badge badge-blue"
            style={{ padding: '6px 14px', fontSize: '0.8125rem' }}
          >
            🏢 Licensed Subscriber Hub
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
            { id: 'profile', label: '🏢 Organization & Profile' },
            { id: 'notifications', label: '🔔 Alert Notifications' },
            { id: 'security', label: '🔐 Security & Login' },
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
                  background: isActive
                    ? 'rgba(37, 99, 235, 0.2)'
                    : 'transparent',
                  color: isActive ? '#60a5fa' : 'var(--text-secondary)',
                  borderBottom: isActive
                    ? '2px solid #3b82f6'
                    : '2px solid transparent',
                  transition: 'all 0.2s ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Profile & Contact */}
        {activeTab === 'profile' && (
          <form
            onSubmit={handleSave}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              width: '100%',
            }}
          >
            {/* Top Profile Summary Card */}
            <div
              className="panel"
              style={{
                padding: '24px 32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 20,
                background:
                  'linear-gradient(135deg, var(--bg-surface-elevated) 0%, rgba(15, 23, 42, 0.9) 100%)',
                border: '1px solid var(--border-default)',
                borderRadius: 16,
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                width: '100%',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                {/* Avatar MS */}
                <UserAvatar
                  avatar={clientAvatar}
                  role="client"
                  size={72}
                  fallbackInitials="MS"
                />

                <div>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                  >
                    <h2
                      style={{
                        fontSize: '1.5rem',
                        fontWeight: 800,
                        color: '#ffffff',
                      }}
                    >
                      {contactPerson}
                    </h2>
                    <span className="badge badge-blue">Globe Telecom</span>
                    <span className="badge badge-green">Active License</span>
                  </div>
                  <p
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.9375rem',
                      marginTop: 4,
                    }}
                  >
                    {position} — {department}
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
                  📜 Account Audit Log
                </button>
              </div>
            </div>

            {/* 3-Column Responsive Grid Layout */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                gap: 24,
                width: '100%',
              }}
            >
              {/* Card 1: Contact Person */}
              <div
                className="panel"
                style={{ padding: '24px 28px', borderRadius: 16 }}
              >
                <small
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    display: 'block',
                    marginBottom: 18,
                  }}
                >
                  CONTACT PERSON DETAILS
                </small>

                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                >
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.8125rem',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      Contact Person *
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.8125rem',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      Work Email *
                    </label>
                    <input
                      type="email"
                      className="form-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.8125rem',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      Position / Title
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.8125rem',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      Phone Number
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Organization Details */}
              <div
                className="panel"
                style={{ padding: '24px 28px', borderRadius: 16 }}
              >
                <small
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    display: 'block',
                    marginBottom: 18,
                  }}
                >
                  ORGANIZATION DETAILS
                </small>

                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                >
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.8125rem',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      Organization Name
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value="Globe Telecom, Inc."
                      disabled
                      style={{ opacity: 0.7 }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.8125rem',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      Department / Division
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.8125rem',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      Primary Industry
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value="Telecommunications & Network Services"
                      disabled
                      style={{ opacity: 0.7 }}
                    />
                  </div>
                </div>
              </div>

              {/* Card 3: Subscription Metadata */}
              <div
                className="panel"
                style={{ padding: '24px 28px', borderRadius: 16 }}
              >
                <small
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    display: 'block',
                    marginBottom: 18,
                  }}
                >
                  SUBSCRIPTION &amp; LICENSE
                </small>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                    fontSize: '0.8125rem',
                  }}
                >
                  <div
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--text-muted)',
                        display: 'block',
                        fontSize: '0.75rem',
                      }}
                    >
                      Company ID
                    </span>
                    <strong
                      style={{
                        color: '#ffffff',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.9375rem',
                      }}
                    >
                      GLB-SEC-2024-88
                    </strong>
                  </div>

                  <div
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--text-muted)',
                        display: 'block',
                        fontSize: '0.75rem',
                      }}
                    >
                      License Status
                    </span>
                    <strong style={{ color: '#34d399', fontWeight: 700 }}>
                      🟢 Active (Full Feed License)
                    </strong>
                  </div>

                  <div
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--text-muted)',
                        display: 'block',
                        fontSize: '0.75rem',
                      }}
                    >
                      Member Since
                    </span>
                    <strong style={{ color: '#ffffff' }}>March 10, 2024</strong>
                  </div>

                  <div
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--text-muted)',
                        display: 'block',
                        fontSize: '0.75rem',
                      }}
                    >
                      Last Active Session
                    </span>
                    <strong style={{ color: '#60a5fa' }}>
                      Today, 23:40 (IP: 112.198.102.14)
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions Bar */}
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
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  style={{ padding: '12px 24px' }}
                >
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

              <div
                style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}
              >
                🟢 Changes saved locally in component state.
              </div>
            </div>
          </form>
        )}

        {/* Tab 2: Alert Notifications */}
        {activeTab === 'notifications' && (
          <div
            className="panel"
            style={{ padding: '28px 32px', borderRadius: 16, width: '100%' }}
          >
            <small
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: 20,
              }}
            >
              CLIENT THREAT ALERT DISPATCH PREFERENCES
            </small>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
                gap: 20,
              }}
            >
              {[
                {
                  key: 'threatSurgeAlerts',
                  title: 'Smishing Surge Email Alerts',
                  desc: 'Real-time alert when critical threat volume exceeds threshold',
                },
                {
                  key: 'dailyDigestEmail',
                  title: 'Daily Threat Summary Digest',
                  desc: 'Automated 08:30 AM summary email with campaign metrics',
                },
                {
                  key: 'smsUrgentAlerts',
                  title: 'SMS Urgent Security Notifications',
                  desc: 'Instant SMS alert for high confidence fraud campaigns',
                },
                {
                  key: 'campaignClusteringDigest',
                  title: 'New Campaign Cluster Detection',
                  desc: 'Alert when AI identifies a new active smishing cluster',
                },
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
                    <strong
                      style={{
                        fontSize: '0.9375rem',
                        color: '#ffffff',
                        display: 'block',
                        marginBottom: 2,
                      }}
                    >
                      {item.title}
                    </strong>
                    <small
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        display: 'block',
                      }}
                    >
                      {item.desc}
                    </small>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const updated = {
                        ...notifConfig,
                        [item.key]:
                          !notifConfig[item.key as keyof typeof notifConfig],
                      };
                      setNotifConfig(updated);
                      showToast('Notification preference toggled.');
                    }}
                    style={{
                      width: 48,
                      height: 26,
                      borderRadius: 13,
                      background: notifConfig[
                        item.key as keyof typeof notifConfig
                      ]
                        ? '#2563eb'
                        : 'var(--bg-input)',
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
                        transform: notifConfig[
                          item.key as keyof typeof notifConfig
                        ]
                          ? 'translateX(22px)'
                          : 'translateX(0)',
                        transition: 'transform 0.3s ease',
                      }}
                    />
                  </button>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 24,
                paddingTop: 16,
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <Button
                variant="primary"
                onClick={() => showToast('✓ Notification preferences saved!')}
              >
                💾 Save Alert Settings
              </Button>
            </div>
          </div>
        )}

        {/* Tab 3: Security & Login (Matching Password & 2FA 2-Card Layout) */}
        {activeTab === 'security' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))',
              gap: 24,
              width: '100%',
            }}
          >
            {/* Change Password Form Card */}
            <form
              onSubmit={handlePasswordSubmit}
              className="panel"
              style={{
                padding: '28px 32px',
                borderRadius: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
              }}
            >
              <small
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  display: 'block',
                }}
              >
                CHANGE PASSWORD
              </small>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
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
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: 10,
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {showPass ? '👁️' : '🙈'}
                  </button>
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
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
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.75rem',
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ color: 'var(--text-muted)' }}>
                        Strength:
                      </span>
                      <strong style={{ color: passStrength.color }}>
                        {passStrength.label}
                      </strong>
                    </div>
                    <div
                      style={{
                        height: 4,
                        width: '100%',
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: 2,
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: passStrength.width,
                          background: passStrength.color,
                          transition: 'all 0.3s ease',
                          borderRadius: 2,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
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

              <Button
                type="submit"
                variant="primary"
                size="md"
                style={{ marginTop: 8 }}
              >
                🔑 Update Password
              </Button>
            </form>

            {/* 2FA Interactive Toggle Card */}
            <div
              className="panel"
              style={{
                padding: '28px 32px',
                borderRadius: 16,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <small
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    display: 'block',
                    marginBottom: 18,
                  }}
                >
                  TWO-FACTOR AUTHENTICATION (2FA)
                </small>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 20,
                  }}
                >
                  <div>
                    <strong
                      style={{
                        fontSize: '1rem',
                        color: '#ffffff',
                        display: 'block',
                      }}
                    >
                      TOTP Authenticator Status
                    </strong>
                    <small
                      style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.8125rem',
                      }}
                    >
                      Require 6-digit verification code on login
                    </small>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIs2FAEnabled(!is2FAEnabled);
                      showToast(
                        is2FAEnabled
                          ? '2FA disabled for account.'
                          : '2FA enabled successfully!',
                      );
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
                        transform: is2FAEnabled
                          ? 'translateX(24px)'
                          : 'translateX(0)',
                        transition: 'transform 0.3s ease',
                      }}
                    />
                  </button>
                </div>

                {is2FAEnabled && (
                  <div
                    style={{
                      padding: '16px',
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                    >
                      <span style={{ fontSize: '1.25rem' }}>📱</span>
                      <div>
                        <strong
                          style={{
                            color: '#ffffff',
                            fontSize: '0.875rem',
                            display: 'block',
                          }}
                        >
                          Authenticator App Connected
                        </strong>
                        <small
                          style={{
                            color: 'var(--text-muted)',
                            fontSize: '0.75rem',
                          }}
                        >
                          Google Authenticator / Authy / 1Password
                        </small>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(0, 0, 0, 0.3)',
                        padding: '8px 12px',
                        borderRadius: 8,
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.8125rem',
                      }}
                    >
                      <span>Secret: JBSWY3DPEHPK3PXP</span>
                      <button
                        type="button"
                        onClick={() =>
                          showToast('Secret key copied to clipboard!')
                        }
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#60a5fa',
                          cursor: 'pointer',
                          fontWeight: 700,
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <small
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  marginTop: 20,
                  display: 'block',
                }}
              >
                Enforced Security Policy: Client subscriber accounts must
                maintain active 2FA.
              </small>
            </div>
          </div>
        )}
      </div>

      {/* Avatar Modal */}
      <Modal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        title="Customize Client Avatar"
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            maxWidth: 520,
          }}
        >
          {/* Section 1: Character Avatars */}
          <div>
            <small
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: 12,
              }}
            >
              SELECT CHARACTER AVATAR
            </small>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 12,
              }}
            >
              {[
                {
                  id: 'analyst_female',
                  icon: '👩‍💻',
                  label: 'Security Analyst',
                  role: 'Glasses',
                },
                {
                  id: 'intel_lead',
                  icon: '👩‍💼',
                  label: 'Threat Intel Lead',
                  role: 'Blazer',
                },
                {
                  id: 'engineer_male',
                  icon: '👨‍💻',
                  label: 'Cyber Engineer',
                  role: 'Scarf',
                },
                {
                  id: 'responder',
                  icon: '😷',
                  label: 'Incident Responder',
                  role: 'Mask',
                },
                {
                  id: 'soc_sunglasses',
                  icon: '😎',
                  label: 'SOC Analyst',
                  role: 'Sunglasses',
                },
                {
                  id: 'researcher_hoodie',
                  icon: '👨‍🔬',
                  label: 'AI Researcher',
                  role: 'Hoodie',
                },
                {
                  id: 'investigator',
                  icon: '🕵️',
                  label: 'Investigator',
                  role: 'Fedora',
                },
                { id: 'ai_bot', icon: '🤖', label: 'AI Guardian', role: 'Bot' },
                {
                  id: 'shield_sentinel',
                  icon: '🛡️',
                  label: 'Shield Sentinel',
                  role: 'Defense',
                },
                {
                  id: 'red_team',
                  icon: '🥷',
                  label: 'Red Team',
                  role: 'Ninja',
                },
                {
                  id: 'scholar',
                  icon: '🎓',
                  label: 'Scholar Lead',
                  role: 'Research',
                },
                {
                  id: 'super_admin',
                  icon: '👑',
                  label: 'Enterprise Admin',
                  role: 'Crown',
                },
              ].map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setClientAvatar({
                      type: 'preset',
                      presetIcon: item.icon,
                      gradient:
                        clientAvatar.gradient ||
                        'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                      initials: 'MS',
                    });
                    setIsAvatarModalOpen(false);
                    showToast(
                      `✓ Avatar updated to ${item.label} (${item.role})!`,
                    );
                  }}
                  style={{
                    padding: '12px 8px',
                    borderRadius: 12,
                    background:
                      clientAvatar.presetIcon === item.icon
                        ? 'rgba(37, 99, 235, 0.25)'
                        : 'rgba(255, 255, 255, 0.03)',
                    border:
                      clientAvatar.presetIcon === item.icon
                        ? '2px solid #3b82f6'
                        : '1px solid var(--border-default)',
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
                  <strong
                    style={{
                      fontSize: '0.6875rem',
                      color: '#ffffff',
                      textAlign: 'center',
                      lineHeight: 1.2,
                    }}
                  >
                    {item.label}
                  </strong>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Color Gradient Themes */}
          <div>
            <small
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: 12,
              }}
            >
              BACKGROUND GRADIENT THEME
            </small>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 10,
              }}
            >
              {[
                {
                  id: 'blue',
                  grad: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  label: 'Cyber Blue',
                },
                {
                  id: 'emerald',
                  grad: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  label: 'Emerald',
                },
                {
                  id: 'purple',
                  grad: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                  label: 'Purple',
                },
                {
                  id: 'amber',
                  grad: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                  label: 'Amber',
                },
                {
                  id: 'crimson',
                  grad: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                  label: 'Crimson',
                },
              ].map((preset) => (
                <div
                  key={preset.id}
                  onClick={() => {
                    setClientAvatar({
                      ...clientAvatar,
                      gradient: preset.grad,
                    });
                    showToast(`Background theme changed to ${preset.label}!`);
                  }}
                  style={{
                    height: 40,
                    borderRadius: 10,
                    background: preset.grad,
                    cursor: 'pointer',
                    border:
                      clientAvatar.gradient === preset.grad
                        ? '2px solid #ffffff'
                        : '1px solid rgba(255, 255, 255, 0.2)',
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
          <div
            style={{
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 14,
            }}
          >
            <small
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: 8,
              }}
            >
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
                  setClientAvatar({
                    type: 'image',
                    imageUrl: customImageUrl,
                    gradient: clientAvatar.gradient,
                    initials: 'MS',
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

      {/* Activity Log Modal */}
      <Modal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        title="Client Account Audit Log"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search activity log..."
            value={activitySearch}
            onChange={(e) => setActivitySearch(e.target.value)}
          />

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              maxHeight: 340,
              overflowY: 'auto',
            }}
          >
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
                  <strong style={{ color: '#ffffff', display: 'block' }}>
                    {log.action}
                  </strong>
                  <small style={{ color: 'var(--text-muted)' }}>
                    IP: {log.ip}
                  </small>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      color: 'var(--text-secondary)',
                      display: 'block',
                      fontSize: '0.75rem',
                    }}
                  >
                    {log.timestamp}
                  </span>
                  <span
                    style={{
                      color: '#34d399',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                    }}
                  >
                    ✓ {log.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </ClientShell>
  );
}
