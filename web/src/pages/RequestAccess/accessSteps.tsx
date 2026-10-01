import React from 'react';

/*
 * The applicant-visible steps of the account-first licensing lifecycle. They
 * mirror the server-enforced order (account → RECEIVED → UNDER_REVIEW →
 * APPROVED → AGREEMENT_ACCEPTED → PAYMENT_PENDING → ACTIVE); each step is a
 * different kind of decision, so none are merged.
 */
export type AccessStepKey =
  | 'account'
  | 'request'
  | 'review'
  | 'approval'
  | 'agreement'
  | 'payment'
  | 'access';

export interface AccessStep {
  key: AccessStepKey;
  label: string;
  who: string;
  body: string;
}

export const ACCESS_STEPS: AccessStep[] = [
  {
    key: 'account',
    label: 'Account',
    who: 'You',
    body: 'Create your BantAI account, verify your email, and finish a short setup.',
  },
  {
    key: 'request',
    label: 'Request',
    who: 'You',
    body: 'Tell us who you are and how the intelligence will be used. No payment is taken.',
  },
  {
    key: 'review',
    label: 'Review',
    who: 'BantAI',
    body: 'A person reviews the intended use, your affiliation and the requested scope. We may ask for more detail.',
  },
  {
    key: 'approval',
    label: 'Approval',
    who: 'BantAI',
    body: 'You receive a decision by email. If approved, the next step appears when you sign in.',
  },
  {
    key: 'agreement',
    label: 'Agreement',
    who: 'You',
    body: 'Review the exact license terms and accept them. Nothing is charged at this step.',
  },
  {
    key: 'payment',
    label: 'Payment',
    who: 'You',
    body: 'Pay on Stripe’s secure checkout. BantAI never sees your card details.',
  },
  {
    key: 'access',
    label: 'Access',
    who: 'BantAI',
    body: 'Access activates once Stripe confirms payment. Your workspace opens in the same account.',
  },
];

/* Which step is current for a given backend status (lowercase). */
export function stepForStatus(status: string): AccessStepKey {
  switch (status) {
    case 'received':
    case 'under_review':
    case 'more_info_required':
      return 'review';
    case 'approved':
      return 'agreement';
    case 'agreement_accepted':
    case 'payment_pending':
      return 'payment';
    case 'active':
      return 'access';
    default:
      return 'request';
  }
}

interface TrackerProps {
  /* Omit for a neutral explainer (no step marked done or current). */
  current?: AccessStepKey;
  /* Show each step's description (full workflow) or labels only (status). */
  detailed?: boolean;
  label: string;
}

/*
 * Ordered step list. Steps before `current` render as done, `current` is
 * marked with aria-current="step", later steps are upcoming. Status is
 * conveyed by text as well as by the marker, not colour alone.
 */
export function AccessTracker({
  current,
  detailed = false,
  label,
}: TrackerProps) {
  const currentIndex = current
    ? ACCESS_STEPS.findIndex((s) => s.key === current)
    : -1;
  return (
    <ol
      className={`ra-tracker${detailed ? ' ra-tracker--detailed' : ''}`}
      aria-label={label}
    >
      {ACCESS_STEPS.map((step, i) => {
        const state =
          i < currentIndex
            ? 'done'
            : i === currentIndex
              ? 'current'
              : 'upcoming';
        return (
          <li
            key={step.key}
            className="ra-tracker__step"
            data-state={state}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <span className="ra-tracker__marker" aria-hidden>
              {state === 'done' ? <TickIcon /> : String(i + 1).padStart(2, '0')}
            </span>
            <span className="ra-tracker__text">
              <span className="ra-tracker__label">
                {step.label}
                <span className="ra-visually-hidden">
                  {state === 'done'
                    ? ' (complete)'
                    : state === 'current'
                      ? ' (current step)'
                      : ''}
                </span>
              </span>
              {detailed && (
                <>
                  <span className="ra-tracker__who">{step.who}</span>
                  <span className="ra-tracker__body">{step.body}</span>
                </>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function TickIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      aria-hidden
      focusable="false"
    >
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DashIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      aria-hidden
      focusable="false"
    >
      <path
        d="M4 8h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
