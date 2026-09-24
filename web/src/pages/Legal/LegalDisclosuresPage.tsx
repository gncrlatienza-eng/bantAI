/*
 * Legal & Commerce Disclosures Page (P1 — W7).
 *
 * Provides authoritative disclosures for:
 * 1. Seller Identity & Operational Base
 * 2. Contact & DPO Redress Information
 * 3. Transparent Pricing & Currency Schedule
 * 4. License Scope & Entitlements
 * 5. Policy Links & Agreement Versions (Traceable v1.0)
 */

import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import './legal.css';

export interface AgreementVersionMeta {
  id: string;
  name: string;
  version: string;
  effectiveDate: string;
  status: 'PENDING_HUMAN_APPROVAL' | 'APPROVED';
}

export const AGREEMENT_VERSIONS: Record<string, AgreementVersionMeta> = {
  TERMS: {
    id: 'terms-of-service',
    name: 'Terms of Service',
    version: '1.0',
    effectiveDate: 'September 2026',
    status: 'PENDING_HUMAN_APPROVAL',
  },
  PRIVACY: {
    id: 'privacy-policy',
    name: 'Privacy Policy',
    version: '1.0',
    effectiveDate: 'September 2026',
    status: 'PENDING_HUMAN_APPROVAL',
  },
  LICENSE: {
    id: 'license-agreement',
    name: 'Threat Intelligence License Agreement',
    version: '1.0',
    effectiveDate: 'September 2026',
    status: 'PENDING_HUMAN_APPROVAL',
  },
  REDRESS: {
    id: 'dpo-redress',
    name: 'DPO Grievance & Redress Protocol',
    version: '1.0',
    effectiveDate: 'September 2026',
    status: 'PENDING_HUMAN_APPROVAL',
  },
};

export const SELLER_IDENTITY = {
  sellerName: 'BantAI Threat Intelligence Research',
  projectType: 'Academic Research Prototype & Threat Intelligence Platform',
  academicAffiliation: 'De La Salle University — College of Computer Studies',
  location: 'Manila, Metro Manila, Republic of the Philippines',
  governingLaw: 'Republic Act No. 10173 (Data Privacy Act of 2012), Philippines',
  supportEmail: 'research@bantai.ph',
  billingEmail: 'billing@bantai.ph',
  dpoEmail: 'dpo@bantai.ph',
  paymentProcessor: 'Stripe, Inc. (PCI-DSS Level 1 Compliant)',
};

export const PRICING_SCHEDULE = {
  currency: 'PHP (₱)',
  research: {
    name: 'Academic Research License',
    annualPrice: '₱24,900',
    monthlyPrice: '₱2,490',
    seatLimit: 1,
    scope: 'Non-commercial research, thesis validation, and academic study.',
  },
  organization: {
    name: 'Organization Enterprise License',
    annualPrice: '₱299,000',
    monthlyPrice: '₱29,900',
    seatLimit: 10,
    scope: 'Commercial internal threat intelligence and security operations.',
  },
  foundingPilot: {
    name: 'Founding Organization Pilot',
    pricingRange: '₱149,000 – ₱199,000 / year',
    scope: 'Discounted first-year deployment for integration feedback and pilot testing.',
  },
};

export function LegalDisclosuresPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = useMemo(() => {
    const tab = searchParams.get('tab');
    if (tab && ['seller', 'pricing', 'license', 'terms', 'privacy', 'redress'].includes(tab)) {
      return tab;
    }
    return 'seller';
  }, [searchParams]);

  const setTab = (tab: string) => {
    setSearchParams({ tab }, { replace: true });
  };

  return (
    <div className="legal-page">
      <div className="legal-container">
        <header className="legal-header">
          <p className="legal-eyebrow">Commerce &amp; Regulatory Disclosures</p>
          <h1 className="legal-title">BantAI Commerce &amp; Legal Transparency</h1>
          <p className="legal-lede">
            Complete seller identity, pricing schedule, license boundaries, redress
            mechanisms, and versioned legal agreements for the BantAI Threat Intelligence Platform.
          </p>

          <div className="legal-status-banner" role="alert">
            <span className="legal-status-badge">Notice</span>
            <span>
              <strong>Review Status:</strong> Copy is currently{' '}
              <strong>PENDING HUMAN APPROVAL</strong> by the Product Owner and
              Data Protection Officer (DPO)/Legal Counsel.
            </span>
          </div>
        </header>

        <nav className="legal-tabs" aria-label="Legal disclosure sections">
          <button
            type="button"
            className={`legal-tab-btn ${currentTab === 'seller' ? 'active' : ''}`}
            onClick={() => setTab('seller')}
          >
            Seller &amp; Contact
          </button>
          <button
            type="button"
            className={`legal-tab-btn ${currentTab === 'pricing' ? 'active' : ''}`}
            onClick={() => setTab('pricing')}
          >
            Pricing &amp; Billing
          </button>
          <button
            type="button"
            className={`legal-tab-btn ${currentTab === 'license' ? 'active' : ''}`}
            onClick={() => setTab('license')}
          >
            License Scope
          </button>
          <button
            type="button"
            className={`legal-tab-btn ${currentTab === 'terms' ? 'active' : ''}`}
            onClick={() => setTab('terms')}
          >
            Terms of Service
          </button>
          <button
            type="button"
            className={`legal-tab-btn ${currentTab === 'privacy' ? 'active' : ''}`}
            onClick={() => setTab('privacy')}
          >
            Privacy Policy
          </button>
          <button
            type="button"
            className={`legal-tab-btn ${currentTab === 'redress' ? 'active' : ''}`}
            onClick={() => setTab('redress')}
          >
            DPO &amp; Redress
          </button>
        </nav>

        <main className="legal-content">
          {currentTab === 'seller' && (
            <article className="legal-card">
              <h2 className="legal-section-title">
                Seller Identity &amp; Operational Information
                <span className="legal-version-badge">Identity v1.0</span>
              </h2>
              <div className="legal-grid-2">
                <div className="legal-info-block">
                  <div className="legal-info-label">Seller / Licensor</div>
                  <div className="legal-info-value">{SELLER_IDENTITY.sellerName}</div>
                </div>
                <div className="legal-info-block">
                  <div className="legal-info-label">Organization Type</div>
                  <div className="legal-info-value">{SELLER_IDENTITY.projectType}</div>
                </div>
                <div className="legal-info-block">
                  <div className="legal-info-label">Academic Affiliation</div>
                  <div className="legal-info-value">{SELLER_IDENTITY.academicAffiliation}</div>
                </div>
                <div className="legal-info-block">
                  <div className="legal-info-label">Operating Jurisdiction</div>
                  <div className="legal-info-value">{SELLER_IDENTITY.location}</div>
                </div>
                <div className="legal-info-block">
                  <div className="legal-info-label">Applicable Privacy Law</div>
                  <div className="legal-info-value">{SELLER_IDENTITY.governingLaw}</div>
                </div>
                <div className="legal-info-block">
                  <div className="legal-info-label">Payment Processing</div>
                  <div className="legal-info-value">{SELLER_IDENTITY.paymentProcessor}</div>
                </div>
              </div>
            </article>
          )}

          {currentTab === 'pricing' && (
            <article className="legal-card">
              <h2 className="legal-section-title">
                Transparent Pricing &amp; Billing Terms
                <span className="legal-version-badge">Pricing v1.0</span>
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                All transactions are billed in <strong>Philippine Pesos (PHP)</strong>. Access requests
                are manually reviewed before payment is initiated via Stripe Checkout.
              </p>

              <div className="legal-table-wrapper">
                <table className="legal-table">
                  <thead>
                    <tr>
                      <th>Plan / Tier</th>
                      <th>Annual Billing</th>
                      <th>Monthly Billing</th>
                      <th>Seat Limit</th>
                      <th>License Scope</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <strong>{PRICING_SCHEDULE.research.name}</strong>
                      </td>
                      <td>{PRICING_SCHEDULE.research.annualPrice} / year</td>
                      <td>{PRICING_SCHEDULE.research.monthlyPrice} / month</td>
                      <td>{PRICING_SCHEDULE.research.seatLimit} seat</td>
                      <td>{PRICING_SCHEDULE.research.scope}</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>{PRICING_SCHEDULE.organization.name}</strong>
                      </td>
                      <td>{PRICING_SCHEDULE.organization.annualPrice} / year</td>
                      <td>{PRICING_SCHEDULE.organization.monthlyPrice} / month</td>
                      <td>{PRICING_SCHEDULE.organization.seatLimit} seats</td>
                      <td>{PRICING_SCHEDULE.organization.scope}</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>{PRICING_SCHEDULE.foundingPilot.name}</strong>
                      </td>
                      <td colSpan={2}>{PRICING_SCHEDULE.foundingPilot.pricingRange}</td>
                      <td>Custom (up to 10)</td>
                      <td>{PRICING_SCHEDULE.foundingPilot.scope}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="legal-info-block" style={{ marginTop: 20 }}>
                <div className="legal-info-label">Subscription &amp; Renewal Terms</div>
                <ul className="legal-list" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                  <li>
                    <strong>Recurring Billing:</strong> Subscriptions renew automatically at the selected interval (Monthly or Annual) unless cancelled prior to the renewal date.
                  </li>
                  <li>
                    <strong>Activation Policy:</strong> Licenses activate solely upon verified webhook confirmation from Stripe (`checkout.session.completed`).
                  </li>
                  <li>
                    <strong>Cancellation &amp; Refunds:</strong> Workspace administrators may cancel renewal via Workspace Settings. Prorated refunds are governed by our redress mechanism upon written notice.
                  </li>
                </ul>
              </div>
            </article>
          )}

          {currentTab === 'license' && (
            <article className="legal-card">
              <h2 className="legal-section-title">
                Threat Intelligence License Scope
                <span className="legal-version-badge">
                  {AGREEMENT_VERSIONS.LICENSE.name} v{AGREEMENT_VERSIONS.LICENSE.version}
                </span>
              </h2>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                BantAI grants a non-exclusive, non-transferable, revocable license to access threat intelligence datasets and campaign cluster metadata subject to tier rules:
              </p>

              <ul className="legal-list">
                <li>
                  <strong>Dataset Ownership:</strong> Customers receive a license to <em>use</em> intelligence data. BantAI and its research partners retain all underlying intellectual property rights.
                </li>
                <li>
                  <strong>Prohibition on Redistribution:</strong> Sublicensing, reselling, or public dissemination of raw intelligence records is strictly prohibited without prior written consent.
                </li>
                <li>
                  <strong>Non-Reidentification Guarantee:</strong> Licensees agree not to reverse-engineer, de-anonymize, or attempt to identify individuals from pseudonymized hashes or masked sender evidence.
                </li>
                <li>
                  <strong>Seat Enforcement:</strong> User seat access is bound to the customer’s organization domain and authorized workspace members.
                </li>
              </ul>
            </article>
          )}

          {currentTab === 'terms' && (
            <article className="legal-card">
              <h2 className="legal-section-title">
                Terms of Service
                <span className="legal-version-badge">
                  {AGREEMENT_VERSIONS.TERMS.name} v{AGREEMENT_VERSIONS.TERMS.version}
                </span>
              </h2>

              <ul className="legal-list">
                <li>
                  <strong>Service Purpose:</strong> BantAI is an AI-powered smishing detection and campaign clustering system designed to identify and analyze SMS phishing attacks in Tagalog, English, and Taglish.
                </li>
                <li>
                  <strong>Account Security:</strong> Users and workspace members are responsible for maintaining the confidentiality of their credentials and session tokens.
                </li>
                <li>
                  <strong>Acceptable Use:</strong> Users shall not submit malicious payloads, disrupt platform availability, or utilize telemetry services for unlawful purposes.
                </li>
                <li>
                  <strong>Limitation of Liability:</strong> BantAI provides intelligence on an "as-is" and "as-available" basis. Automated AI classifications are decision-support indicators and not guarantees of threat elimination.
                </li>
              </ul>
            </article>
          )}

          {currentTab === 'privacy' && (
            <article className="legal-card">
              <h2 className="legal-section-title">
                Privacy Policy &amp; Data Boundary
                <span className="legal-version-badge">
                  {AGREEMENT_VERSIONS.PRIVACY.name} v{AGREEMENT_VERSIONS.PRIVACY.version}
                </span>
              </h2>

              <ul className="legal-list">
                <li>
                  <strong>Stays-on-Device Principle:</strong> On mobile clients, raw SMS message bodies and personal address book contacts remain on the user’s device and are never transmitted to backend servers.
                </li>
                <li>
                  <strong>Telemetry Minimization:</strong> Only classification scores, explainable indicators, and extracted URL domains cross the boundary for server-side campaign clustering.
                </li>
                <li>
                  <strong>Sender Pseudonymization:</strong> Phone numbers and senders are immediately hashed using cryptographic HMAC fingerprints; raw contact names are never stored.
                </li>
                <li>
                  <strong>Data Subject Rights:</strong> Users may exercise rights of access, rectification, and erasure under RA 10173 by contacting our Data Protection Officer.
                </li>
              </ul>
            </article>
          )}

          {currentTab === 'redress' && (
            <article className="legal-card">
              <h2 className="legal-section-title">
                Contact, Redress &amp; Grievance Redressal
                <span className="legal-version-badge">
                  {AGREEMENT_VERSIONS.REDRESS.name} v{AGREEMENT_VERSIONS.REDRESS.version}
                </span>
              </h2>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                BantAI provides formal channels for operational inquiries, billing adjustments, and data privacy rights redressal:
              </p>

              <div className="legal-grid-2" style={{ marginTop: 16 }}>
                <div className="legal-info-block">
                  <div className="legal-info-label">General &amp; Research Support</div>
                  <div className="legal-info-value">{SELLER_IDENTITY.supportEmail}</div>
                </div>
                <div className="legal-info-block">
                  <div className="legal-info-label">Billing &amp; Invoice Disputes</div>
                  <div className="legal-info-value">{SELLER_IDENTITY.billingEmail}</div>
                </div>
                <div className="legal-info-block">
                  <div className="legal-info-label">Data Protection Officer (DPO)</div>
                  <div className="legal-info-value">{SELLER_IDENTITY.dpoEmail}</div>
                </div>
                <div className="legal-info-block">
                  <div className="legal-info-label">Resolution SLA</div>
                  <div className="legal-info-value">Formal response within 15 business days</div>
                </div>
              </div>

              <div className="legal-info-block" style={{ marginTop: 20 }}>
                <div className="legal-info-label">Redress Protocol Steps</div>
                <ol className="legal-list" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                  <li>
                    Submit a written grievance describing the disputed charge, data record, or licensing issue to{' '}
                    <strong>{SELLER_IDENTITY.dpoEmail}</strong> or <strong>{SELLER_IDENTITY.billingEmail}</strong>.
                  </li>
                  <li>
                    The research compliance lead logs the case and reviews server-side audit logs within 5 business days.
                  </li>
                  <li>
                    A formal resolution or corrective adjustment is executed within 15 business days.
                  </li>
                </ol>
              </div>
            </article>
          )}
        </main>

        <footer className="legal-footer-nav">
          <Link to="/" className="legal-back-link">
            &larr; Return to BantAI Home
          </Link>
          <Link to="/request-access" className="legal-back-link">
            View Licensing Catalog &rarr;
          </Link>
        </footer>
      </div>
    </div>
  );
}

export default LegalDisclosuresPage;
