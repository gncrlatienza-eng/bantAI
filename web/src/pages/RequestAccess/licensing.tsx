import React from 'react';
import type { AccessRequestTier } from '../../services/authService';

/*
 * Presentational pieces of the Request Licensing page.
 *
 * These read as a licensing catalog — cards, comparison, workflow, founding
 * pilot, license terms — with no promotional gloss. Everything mounts inside
 * the AuthLayout so the visual system (cream, plum, warm ink, editorial
 * network SVG) stays consistent with Sign In.
 *
 * The parent orchestrator owns state; these components take the selected
 * tier / handlers as props and stay stateless.
 */

type PickTier = (tier: AccessRequestTier) => void;

export function LicensingIntro() {
  return (
    <header className="licensing__intro">
      <p className="licensing__eyebrow">Licensing</p>
      <h1 className="licensing__title">
        Request access to BantAI’s Philippine smishing intelligence.
      </h1>
      <p className="licensing__lede">
        Specialized Tagalog, English, and Taglish SMS threat intelligence —
        masked datasets, campaign relationships, and campaign evolution.
        Requests are manually reviewed. No payment is taken at this stage.
      </p>
    </header>
  );
}

interface CardsProps {
  onPick: PickTier;
}

export function LicensingCards({ onPick }: CardsProps) {
  return (
    <section className="licensing__cards" aria-label="License options">
      <TierCard
        tier="research"
        eyebrow="Research"
        descriptor="For academic and non-commercial research"
        annual="₱24,900"
        monthly="₱2,490 / month"
        highlights={[
          'Masked dataset access',
          'Historical dataset',
          'Campaign intelligence',
          'CSV / JSON export',
          'Research-only license',
        ]}
        cta="Request Research Access"
        onPick={onPick}
      />
      <TierCard
        tier="organization"
        eyebrow="Organization"
        descriptor="For commercial internal use"
        annual="₱299,000"
        monthly="₱29,900 / month"
        highlights={[
          'Everything in Research',
          'Highest available freshness',
          'Multiple users',
          'Full bulk access',
          'Commercial internal use',
        ]}
        cta="Request Organization Access"
        onPick={onPick}
      />
    </section>
  );
}

interface TierCardProps {
  tier: AccessRequestTier;
  eyebrow: string;
  descriptor: string;
  annual: string;
  monthly: string;
  highlights: string[];
  cta: string;
  onPick: PickTier;
}

function TierCard({
  tier,
  eyebrow,
  descriptor,
  annual,
  monthly,
  highlights,
  cta,
  onPick,
}: TierCardProps) {
  return (
    <article className="licensing-card">
      <header className="licensing-card__head">
        <p className="licensing-card__eyebrow">{eyebrow}</p>
        <p className="licensing-card__descriptor">{descriptor}</p>
      </header>

      <div className="licensing-card__price">
        <span className="licensing-card__price-annual">
          {annual}
          <span className="licensing-card__price-period"> / year</span>
        </span>
        <span className="licensing-card__price-monthly">{monthly}</span>
      </div>

      <ul className="licensing-card__list">
        {highlights.map((item) => (
          <li key={item}>
            <CheckMark />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="licensing-card__cta"
        onClick={() => onPick(tier)}
      >
        {cta}
      </button>
      <p className="licensing-card__helper">
        No payment is taken at this stage.
      </p>
    </article>
  );
}

function CheckMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="licensing-card__check"
      aria-hidden
      focusable="false"
    >
      <path
        d="M3.5 8.5 L6.5 11.5 L12.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ————— Comparison ————— */

interface Row {
  label: string;
  research: string;
  organization: string;
}

const COMPARISON: Row[] = [
  { label: 'License', research: 'Non-commercial research', organization: 'Commercial internal use' },
  { label: 'Masked dataset', research: 'Included', organization: 'Included' },
  { label: 'Historical dataset', research: 'Included', organization: 'Included' },
  { label: 'Campaign intelligence', research: 'Included', organization: 'Included' },
  { label: 'CSV / JSON export', research: 'Included', organization: 'Included' },
  { label: 'Freshness', research: 'Standard updates', organization: 'Highest available' },
  { label: 'Bulk download', research: 'Reasonable research limits', organization: 'Full' },
  { label: 'Multiple users', research: 'Limited', organization: 'Included' },
  { label: 'Commercial use', research: 'Not permitted', organization: 'Included' },
  { label: 'API access', research: 'Not included', organization: 'Included when released' },
  { label: 'Redistribution', research: 'Not permitted', organization: 'Not permitted, unless separately licensed' },
];

export function LicensingComparison() {
  return (
    <section className="licensing__compare" aria-labelledby="licensing-compare-title">
      <header className="licensing__compare-head">
        <p className="licensing__section-eyebrow">Compare full access</p>
        <h2 id="licensing-compare-title" className="licensing__section-title">
          What each license actually includes.
        </h2>
      </header>

      <div className="licensing__compare-scroll">
        <table className="licensing-table">
          <thead>
            <tr>
              <th scope="col" className="licensing-table__row-head">&nbsp;</th>
              <th scope="col">Research</th>
              <th scope="col">Organization</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="licensing-table__row-head">
                  {row.label}
                </th>
                <td>{row.research}</td>
                <td>{row.organization}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ————— Workflow ————— */

export function LicensingWorkflow() {
  const steps = [
    { n: '01', label: 'Request', body: 'Submit the short access form.' },
    { n: '02', label: 'Review', body: 'Manual review of use case and license fit.' },
    { n: '03', label: 'Approval & Payment', body: 'Proposal, invoice, and secure payment via Stripe.' },
    { n: '04', label: 'Access', body: 'License activated after payment is confirmed.' },
  ];
  return (
    <section className="licensing__workflow" aria-labelledby="licensing-workflow-title">
      <header className="licensing__compare-head">
        <p className="licensing__section-eyebrow">Access workflow</p>
        <h2 id="licensing-workflow-title" className="licensing__section-title">
          From request to activated license.
        </h2>
      </header>
      <ol className="licensing-steps">
        {steps.map((s) => (
          <li key={s.n} className="licensing-step">
            <span className="licensing-step__n">{s.n}</span>
            <span className="licensing-step__label">{s.label}</span>
            <span className="licensing-step__body">{s.body}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ————— Founding pilot ————— */

export function LicensingPilot() {
  return (
    <aside className="licensing__pilot" aria-label="Founding pilot">
      <p className="licensing__section-eyebrow">Founding pilot</p>
      <p className="licensing__pilot-body">
        A limited number of founding-pilot organizations receive first-year
        pricing between ₱149,000 and ₱199,000 in exchange for feedback,
        integration testing, and case-study permission. Mention pilot interest
        in the intended-use field.
      </p>
    </aside>
  );
}

/* ————— License & data-use ————— */

export function LicensingTerms() {
  return (
    <section className="licensing__terms" aria-labelledby="licensing-terms-title">
      <header className="licensing__compare-head">
        <p className="licensing__section-eyebrow">License &amp; data use</p>
        <h2 id="licensing-terms-title" className="licensing__section-title">
          What you receive, and what stays with BantAI.
        </h2>
      </header>
      <ul className="licensing__terms-list">
        <li>
          You receive a license to <strong>use</strong> the intelligence for the
          scope defined by your tier. You do not receive ownership of the
          dataset.
        </li>
        <li>
          Redistribution and resale of the intelligence are prohibited unless
          separately licensed.
        </li>
        <li>
          Attempts to re-identify individuals from masked data are prohibited.
        </li>
        <li>
          All data is masked and aggregated in line with Philippine privacy
          principles.
        </li>
      </ul>
      <p className="licensing__terms-links">
        <a href="/#about">Privacy</a>
        <span aria-hidden>·</span>
        <a href="/#about">Security</a>
        <span aria-hidden>·</span>
        <a href="/#about">License Terms</a>
      </p>
    </section>
  );
}
