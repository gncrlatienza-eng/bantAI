/*
 * Reusable Commerce Disclosures Card (P1 — W7).
 *
 * Displays seller identity, contact/redress info, clear pricing, license scope,
 * policy links, and agreement versions on checkout and workspace pages.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import {
  SELLER_IDENTITY,
  AGREEMENT_VERSIONS,
  PRICING_SCHEDULE,
} from '../../pages/Legal/LegalDisclosuresPage';

interface CommerceDisclosuresCardProps {
  tier?: 'RESEARCH' | 'ORGANIZATION';
  billingPeriod?: 'ANNUAL' | 'MONTHLY';
  showAgreeCheckbox?: boolean;
  agreed?: boolean;
  onAgreeChange?: (agreed: boolean) => void;
  compact?: boolean;
}

export function CommerceDisclosuresCard({
  tier = 'ORGANIZATION',
  billingPeriod = 'ANNUAL',
  showAgreeCheckbox = false,
  agreed = false,
  onAgreeChange,
  compact = false,
}: CommerceDisclosuresCardProps) {
  const tierPricing =
    tier === 'RESEARCH'
      ? PRICING_SCHEDULE.research
      : PRICING_SCHEDULE.organization;
  const currentPrice =
    billingPeriod === 'ANNUAL'
      ? tierPricing.annualPrice
      : tierPricing.monthlyPrice;

  return (
    <div
      className="commerce-disclosures-card"
      style={{
        background: 'var(--surface-raised, #161822)',
        border: '1px solid var(--border-default, #2d3748)',
        borderRadius: 10,
        padding: compact ? '16px' : '20px 24px',
        marginTop: 20,
        marginBottom: 20,
        fontSize: '0.85rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          borderBottom: '1px solid var(--border-subtle, #2d3748)',
          paddingBottom: 10,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.75rem',
            color: 'var(--brand-primary, #b794f4)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 600,
          }}
        >
          Commerce Disclosures &amp; Terms
        </span>
        <span
          style={{
            fontSize: '0.7rem',
            background: 'var(--surface-subtle, #1e2130)',
            padding: '2px 6px',
            borderRadius: 4,
            color: 'var(--text-secondary, #a0aec0)',
          }}
        >
          Agreement v{AGREEMENT_VERSIONS.LICENSE.version}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compact
            ? '1fr'
            : 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <div
            style={{
              color: 'var(--text-secondary, #a0aec0)',
              fontSize: '0.75rem',
            }}
          >
            SELLER / LICENSOR
          </div>
          <div
            style={{ color: 'var(--text-primary, #ffffff)', fontWeight: 500 }}
          >
            {SELLER_IDENTITY.sellerName}
          </div>
          <div
            style={{
              color: 'var(--text-secondary, #a0aec0)',
              fontSize: '0.75rem',
            }}
          >
            {SELLER_IDENTITY.location}
          </div>
        </div>

        <div>
          <div
            style={{
              color: 'var(--text-secondary, #a0aec0)',
              fontSize: '0.75rem',
            }}
          >
            CONTACT &amp; REDRESS
          </div>
          <div style={{ color: 'var(--text-primary, #ffffff)' }}>
            Support: {SELLER_IDENTITY.supportEmail}
          </div>
          <div
            style={{
              color: 'var(--text-secondary, #a0aec0)',
              fontSize: '0.75rem',
            }}
          >
            DPO: {SELLER_IDENTITY.dpoEmail} &middot; Billing:{' '}
            {SELLER_IDENTITY.billingEmail}
          </div>
        </div>

        <div>
          <div
            style={{
              color: 'var(--text-secondary, #a0aec0)',
              fontSize: '0.75rem',
            }}
          >
            PRICING &amp; SCOPE
          </div>
          <div
            style={{ color: 'var(--text-primary, #ffffff)', fontWeight: 600 }}
          >
            {currentPrice} {PRICING_SCHEDULE.currency} /{' '}
            {billingPeriod.toLowerCase()}
          </div>
          <div
            style={{
              color: 'var(--text-secondary, #a0aec0)',
              fontSize: '0.75rem',
            }}
          >
            {tierPricing.seatLimit} seat limit &middot; {tierPricing.scope}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '10px 12px',
          background: 'var(--surface-subtle, #1a1d29)',
          borderRadius: 6,
          marginBottom: showAgreeCheckbox ? 16 : 8,
          fontSize: '0.8rem',
          color: 'var(--text-secondary, #cbd5e0)',
          lineHeight: 1.5,
        }}
      >
        <strong>Legal Policies &amp; Agreements: </strong>
        <Link
          to="/legal?tab=terms"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--brand-primary, #b794f4)',
            textDecoration: 'underline',
          }}
        >
          Terms of Service (v{AGREEMENT_VERSIONS.TERMS.version})
        </Link>{' '}
        &middot;{' '}
        <Link
          to="/legal?tab=privacy"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--brand-primary, #b794f4)',
            textDecoration: 'underline',
          }}
        >
          Privacy Policy (v{AGREEMENT_VERSIONS.PRIVACY.version})
        </Link>{' '}
        &middot;{' '}
        <Link
          to="/legal?tab=license"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--brand-primary, #b794f4)',
            textDecoration: 'underline',
          }}
        >
          License Agreement (v{AGREEMENT_VERSIONS.LICENSE.version})
        </Link>{' '}
        &middot;{' '}
        <Link
          to="/legal?tab=redress"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--brand-primary, #b794f4)',
            textDecoration: 'underline',
          }}
        >
          DPO Redress Protocol (v{AGREEMENT_VERSIONS.REDRESS.version})
        </Link>
      </div>

      {showAgreeCheckbox && (
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            cursor: 'pointer',
            fontSize: '0.825rem',
            color: 'var(--text-primary, #ffffff)',
          }}
        >
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => onAgreeChange?.(e.target.checked)}
            style={{ marginTop: 2, cursor: 'pointer' }}
          />
          <span>
            I acknowledge and agree to the{' '}
            <strong>Terms of Service (v1.0)</strong>,{' '}
            <strong>Privacy Policy (v1.0)</strong>, and{' '}
            <strong>Threat Intelligence License Agreement (v1.0)</strong>,
            including the automatic recurring {billingPeriod.toLowerCase()}{' '}
            renewal of {currentPrice} {PRICING_SCHEDULE.currency} via Stripe
            until cancelled.
          </span>
        </label>
      )}

      <div
        style={{
          marginTop: 10,
          fontSize: '0.725rem',
          color: 'var(--text-muted, #718096)',
          fontStyle: 'italic',
        }}
      >
        [Notice: Copy is PENDING HUMAN APPROVAL by Product Owner and DPO/Legal
        Reviewer.]
      </div>
    </div>
  );
}

export default CommerceDisclosuresCard;
