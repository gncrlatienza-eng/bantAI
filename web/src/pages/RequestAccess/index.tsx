import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../../components/appshell/AuthLayout';
import { Input } from '../../components/common/Input';
import {
  submitAccessRequest,
  type AccessRequestResponse,
  type AccessRequestTier,
} from '../../services/authService';
import {
  LicensingCards,
  LicensingComparison,
  LicensingIntro,
  LicensingPilot,
  LicensingTerms,
  LicensingWorkflow,
} from './licensing';
import './licensing.css';

/*
 * RequestAccessPage — the licensing entry point described in the manuscript
 * as "Request Licensing" (Figure 53). Three views:
 *
 *   browse    → intro, two licensing cards, full comparison, workflow,
 *               founding-pilot note, license / data-use panel.
 *   form      → single-column form for the selected tier. No admin option.
 *               Real POST to /access-requests; failures surface honestly.
 *   submitted → confirmation from the backend (id + status). Never faked.
 *
 * Payment happens post-approval on a separate confirmation-before-Stripe
 * screen (not this page). Access activation is backend + webhook only —
 * arriving at a checkout success URL never grants access.
 */

type View = 'browse' | 'form' | 'submitted';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TIER_LABEL: Record<AccessRequestTier, string> = {
  research: 'Research license',
  organization: 'Organization license',
};

const TIER_ANNUAL: Record<AccessRequestTier, string> = {
  research: '₱24,900 / year (or ₱2,490 / month)',
  organization: '₱299,000 / year (or ₱29,900 / month)',
};

export function RequestAccessPage() {
  const [view, setView] = useState<View>('browse');
  const [tier, setTier] = useState<AccessRequestTier | null>(null);
  const [confirmation, setConfirmation] =
    useState<AccessRequestResponse | null>(null);

  const formRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Move focus into the form when the user picks a tier so keyboard and
    // screen-reader users land at the top of the application.
    if (view === 'form' && formRef.current) {
      formRef.current.scrollIntoView({ block: 'start' });
      const firstInput =
        formRef.current.querySelector<HTMLInputElement>('input');
      firstInput?.focus();
    }
  }, [view]);

  function pickTier(next: AccessRequestTier) {
    setTier(next);
    setView('form');
  }

  function cancelForm() {
    setView('browse');
  }

  function handleSubmitted(response: AccessRequestResponse) {
    setConfirmation(response);
    setView('submitted');
  }

  return (
    <AuthLayout decor="paused">
      <div className="licensing">
        {view === 'browse' && (
          <>
            <LicensingIntro />
            <LicensingCards onPick={pickTier} />
            <LicensingComparison />
            <LicensingWorkflow />
            <LicensingPilot />
            <LicensingTerms />
          </>
        )}

        {view === 'form' && tier && (
          <div ref={formRef}>
            <AccessRequestForm
              tier={tier}
              onCancel={cancelForm}
              onSubmitted={handleSubmitted}
            />
          </div>
        )}

        {view === 'submitted' && tier && confirmation && (
          <SubmissionConfirmation tier={tier} confirmation={confirmation} />
        )}
      </div>
    </AuthLayout>
  );
}

interface FormProps {
  tier: AccessRequestTier;
  onCancel: () => void;
  onSubmitted: (response: AccessRequestResponse) => void;
}

function AccessRequestForm({ tier, onCancel, onSubmitted }: FormProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [intendedUse, setIntendedUse] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  function validate() {
    const next: Record<string, string> = {};
    if (!fullName.trim()) next.fullName = 'Enter your full name.';
    if (!EMAIL_RE.test(email.trim()))
      next.email = 'Enter a valid work or school email.';
    if (!organization.trim())
      next.organization = 'Enter your organization or institution.';
    if (!intendedUse.trim() || intendedUse.trim().length < 10)
      next.intendedUse = 'Describe the intended use in a sentence or two.';
    if (!reason.trim() || reason.trim().length < 10)
      next.reason = 'Add a brief reason so reviewers have context.';
    return next;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(undefined);
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      const response = await submitAccessRequest({
        tier,
        fullName: fullName.trim(),
        email: email.trim(),
        organization: organization.trim(),
        intendedUse: intendedUse.trim(),
        reason: reason.trim(),
      });
      onSubmitted(response);
    } catch (err) {
      // Surface a real failure — never fake success. The user-facing message
      // stays generic so we don't leak server internals or fetch machinery
      // (e.g. "Failed to fetch"). If the backend returns a validation message
      // it comes through as a Response error via fetchApi; anything else we
      // treat as a transient outage.
      const message =
        err instanceof Error &&
        !/failed to fetch|networkerror/i.test(err.message)
          ? err.message
          : 'We couldn’t submit your request right now. Please try again shortly, or contact the research team if this keeps happening.';
      setFormError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="licensing-form" aria-labelledby="licensing-form-title">
      <button type="button" className="licensing-form__back" onClick={onCancel}>
        ← Back to licenses
      </button>

      <div className="licensing-form__selected" aria-live="polite">
        <span className="licensing-form__selected-label">Selected license</span>
        <span className="licensing-form__selected-value">
          {TIER_LABEL[tier]}
          <span className="licensing-form__selected-price">
            {' · '}
            {TIER_ANNUAL[tier]}
          </span>
        </span>
      </div>

      <header className="licensing-form__head">
        <p className="licensing__eyebrow">Access request</p>
        <h1 id="licensing-form-title" className="licensing__title">
          Tell us about your access request.
        </h1>
        <p className="licensing-form__subtitle">
          No payment is taken at this stage. A reviewer will follow up with next
          steps by email.
        </p>
      </header>

      <form
        className="licensing-form__form"
        onSubmit={(e) => void handleSubmit(e)}
        noValidate
      >
        <Input
          label="Full name"
          name="fullName"
          autoComplete="name"
          value={fullName}
          onChange={(e) => {
            setFullName(e.target.value);
            setErrors((x) => ({ ...x, fullName: '' }));
          }}
          error={errors.fullName || undefined}
          required
        />

        <Input
          label="Work or school email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="name@organization.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setErrors((x) => ({ ...x, email: '' }));
          }}
          error={errors.email || undefined}
          required
        />

        <Input
          label="Organization or institution"
          name="organization"
          autoComplete="organization"
          value={organization}
          onChange={(e) => {
            setOrganization(e.target.value);
            setErrors((x) => ({ ...x, organization: '' }));
          }}
          error={errors.organization || undefined}
          required
        />

        <Input
          label="Intended use"
          name="intendedUse"
          area
          rows={3}
          placeholder="What will you use BantAI’s intelligence for?"
          value={intendedUse}
          onChange={(e) => {
            setIntendedUse(e.target.value);
            setErrors((x) => ({ ...x, intendedUse: '' }));
          }}
          error={errors.intendedUse || undefined}
          required
        />

        <Input
          label="Reason for access"
          name="reason"
          area
          rows={3}
          placeholder="Give reviewers a bit of context — a research question, a defensive use case, or a specific dataset need."
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setErrors((x) => ({ ...x, reason: '' }));
          }}
          error={errors.reason || undefined}
          required
        />

        {formError && (
          <div
            className="bantai-auth-card__form-error"
            role="alert"
            aria-live="polite"
          >
            {formError}
          </div>
        )}

        <div className="licensing-form__actions">
          <button
            type="submit"
            className="bantai-auth-card__primary"
            disabled={loading}
            aria-disabled={loading}
          >
            {loading ? 'Submitting request…' : 'Submit request'}
          </button>
          <p className="licensing-form__actions-helper">
            You will not be charged. Payment happens later, only after your
            request is reviewed and approved.
          </p>
        </div>
      </form>

      <p className="licensing-form__return">
        <Link to="/login">Return to sign in</Link>
      </p>
    </section>
  );
}

interface ConfirmationProps {
  tier: AccessRequestTier;
  confirmation: AccessRequestResponse;
}

function SubmissionConfirmation({ tier, confirmation }: ConfirmationProps) {
  return (
    <section
      className="licensing-confirm"
      aria-labelledby="licensing-confirm-title"
    >
      <span className="bantai-auth-card__status" aria-hidden>
        <span
          className="bantai-auth-card__status-dot"
          data-tone="verified"
          aria-hidden
        />
        Request received
      </span>

      <header>
        <p className="licensing__eyebrow">Access request</p>
        <h1 id="licensing-confirm-title" className="licensing__title">
          Your {TIER_LABEL[tier].toLowerCase()} request is in review.
        </h1>
      </header>

      <p className="licensing__lede">
        Reference{' '}
        <span className="licensing-confirm__ref">{confirmation.id}</span> —
        submitted {new Date(confirmation.submittedAt).toLocaleString()}.
      </p>

      <ol className="licensing-confirm__next">
        <li>
          <strong>Manual review.</strong> A reviewer will confirm the license
          fit and follow up by email.
        </li>
        <li>
          <strong>Approval &amp; payment.</strong> If approved, you will receive
          a proposal, an invoice, and a secure Stripe link.
        </li>
        <li>
          <strong>Access.</strong> The license activates only after payment is
          confirmed. Arriving at a payment success URL never grants access on
          its own.
        </li>
      </ol>

      <div className="licensing-form__actions licensing-confirm__actions">
        <Link to="/" className="bantai-auth-card__primary">
          Back to website
        </Link>
        <Link to="/login" className="bantai-auth-card__link">
          Return to sign in
        </Link>
      </div>
    </section>
  );
}

export default RequestAccessPage;
