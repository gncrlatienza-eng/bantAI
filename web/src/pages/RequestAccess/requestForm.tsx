import React, { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api/apiClient';
import { Input } from '../../components/common/Input';
import {
  submitApplication,
  type ApplicationPayload,
  type ApplicationSummary,
} from '../../services/accountService';
import type {
  AccessRequestTier,
  OrganizationDataAccess,
} from '../../services/authService';
import { TickIcon } from './accessSteps';

const URL_RE = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i;
const DATA_ACCESS: Array<{ value: OrganizationDataAccess; label: string }> = [
  { value: 'EXPORTS', label: 'Campaign exports' },
  { value: 'API', label: 'Shield API, when enabled' },
  { value: 'EXPORTS_AND_API', label: 'Both' },
];

export interface WizardPrefill {
  fullName?: string;
  applicantRole?: string;
  organization?: string;
  website?: string;
  contactPerson?: string;
  expectedUsers?: string;
}

export function RequestStart({
  onBegin,
  previousReference,
}: {
  tier: AccessRequestTier;
  onBegin: () => void;
  onBack?: () => void;
  backLabel?: string;
  previousReference?: string;
}) {
  return (
    <section className="ra-flow" aria-labelledby="ra-start-title">
      <p className="ra-eyebrow">Shield subscription</p>
      <h1 id="ra-start-title" className="ra-title">
        Request Shield access{previousReference ? ' again' : ''}
      </h1>
      <p className="ra-lede">
        Tell BantAI how your team will use published Philippine smishing
        campaign intelligence.
      </p>
      <div className="ra-panel">
        <p className="ra-panel__head">You’ll need</p>
        <ul className="ra-card__list">
          <li>
            <TickIcon />
            Your organization and website
          </li>
          <li>
            <TickIcon />
            Your intended use and deployment context
          </li>
          <li>
            <TickIcon />
            The number of authorized users
          </li>
        </ul>
      </div>
      <p className="ra-note">
        No payment is taken when submitting this request.
      </p>
      <div className="ra-flow__actions">
        <button
          type="button"
          className="ra-button ra-button--primary"
          onClick={onBegin}
        >
          Begin request
        </button>
      </div>
    </section>
  );
}

type Form = {
  fullName: string;
  applicantRole: string;
  organization: string;
  website: string;
  contactPerson: string;
  reason: string;
  intendedUse: string;
  deployment: string;
  dataAccess: OrganizationDataAccess | '';
  expectedUsers: string;
  pilotInterest: boolean;
  accuracyConfirmed: boolean;
  productUpdatesOptIn: boolean;
};
type Errors = Partial<Record<keyof Form, string>>;
const TITLES = ['About you', 'Organization', 'Intended use', 'Review'];

export function AccessRequestWizard({
  initialPilot,
  accountEmail,
  prefill,
  onBack,
  onSubmitted,
}: {
  tier: AccessRequestTier;
  initialPilot: boolean;
  accountEmail: string;
  prefill?: WizardPrefill;
  previousReference?: string;
  onBack: () => void;
  onSubmitted: (response: ApplicationSummary) => void;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>({
    fullName: prefill?.fullName ?? '',
    applicantRole: prefill?.applicantRole ?? '',
    organization: prefill?.organization ?? '',
    website: prefill?.website ?? '',
    contactPerson: prefill?.contactPerson ?? '',
    reason: '',
    intendedUse: '',
    deployment: '',
    dataAccess: '',
    expectedUsers: prefill?.expectedUsers ?? '1',
    pilotInterest: initialPilot,
    accuracyConfirmed: false,
    productUpdatesOptIn: false,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setFormError(undefined);
  };
  const validate = (index: number) => {
    const e: Errors = {};
    const len = (value: string) => value.trim().length;
    if (index === 0) {
      if (len(form.fullName) < 2) e.fullName = 'Enter your full name.';
      if (len(form.applicantRole) < 2) e.applicantRole = 'Enter your role.';
    }
    if (index === 1) {
      if (len(form.organization) < 2)
        e.organization = 'Enter your organization.';
      if (!URL_RE.test(form.website.trim()))
        e.website = 'Enter a valid organization website.';
    }
    if (index === 2) {
      if (len(form.reason) < 10) e.reason = 'Add at least 10 characters.';
      if (len(form.intendedUse) < 10)
        e.intendedUse = 'Add at least 10 characters.';
      if (len(form.deployment) < 10)
        e.deployment = 'Describe the deployment in at least 10 characters.';
      if (!form.dataAccess) e.dataAccess = 'Choose the access you need.';
      const users = Number(form.expectedUsers);
      if (!Number.isInteger(users) || users < 1 || users > 500)
        e.expectedUsers = 'Enter a whole number from 1 to 500.';
    }
    if (index === 3 && !form.accuracyConfirmed)
      e.accuracyConfirmed = 'Confirm the information is accurate to submit.';
    return e;
  };
  const next = () => {
    const e = validate(step);
    setErrors(e);
    if (!Object.keys(e).length) setStep((value) => value + 1);
  };
  const buildPayload = (): ApplicationPayload => ({
    tier: 'shield',
    fullName: form.fullName.trim(),
    organization: form.organization.trim(),
    applicantRole: form.applicantRole.trim(),
    reason: form.reason.trim(),
    intendedUse: form.intendedUse.trim(),
    expectedUsers: Number(form.expectedUsers),
    accuracyConfirmed: true,
    productUpdatesOptIn: form.productUpdatesOptIn,
    pilotInterest: form.pilotInterest,
    organizationDetails: {
      website: form.website.trim(),
      deployment: form.deployment.trim(),
      dataAccess: form.dataAccess as OrganizationDataAccess,
      contactPerson: form.contactPerson.trim() || undefined,
    },
  });
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const e = validate(3);
    setErrors(e);
    if (Object.keys(e).length) return;
    setSubmitting(true);
    try {
      onSubmitted(await submitApplication(buildPayload()));
    } catch (error) {
      setFormError(
        error instanceof ApiError && error.status < 500
          ? error.message
          : 'We couldn’t submit your request right now.',
      );
    } finally {
      setSubmitting(false);
    }
  }
  const err = (key: keyof Form) => errors[key];
  return (
    <section className="ra-flow" aria-labelledby="ra-step-title">
      <button
        type="button"
        className="ra-back"
        onClick={() => (step === 0 ? onBack() : setStep((value) => value - 1))}
      >
        ← {step === 0 ? 'Back' : TITLES[step - 1]}
      </button>
      <p className="ra-eyebrow">
        Shield request · Step {step + 1} of {TITLES.length}
      </p>
      <div
        className="ra-progress"
        role="progressbar"
        aria-label="Request progress"
        aria-valuemin={1}
        aria-valuemax={TITLES.length}
        aria-valuenow={step + 1}
      >
        <span style={{ width: `${((step + 1) / TITLES.length) * 100}%` }} />
      </div>
      <h1
        id="ra-step-title"
        className="ra-title ra-title--step"
        ref={headingRef}
        tabIndex={-1}
      >
        {TITLES[step]}
      </h1>
      <form
        className="ra-form"
        noValidate
        onSubmit={(event) =>
          step < 3 ? (event.preventDefault(), next()) : void submit(event)
        }
      >
        {step === 0 && (
          <>
            <Input
              label="Full name"
              name="fullName"
              autoComplete="name"
              value={form.fullName}
              onChange={(e) => set('fullName', e.target.value)}
              error={err('fullName')}
              required
            />
            <dl className="ra-summary">
              <div>
                <dt>Account email</dt>
                <dd>{accountEmail}</dd>
              </div>
            </dl>
            <Input
              label="Role"
              name="applicantRole"
              autoComplete="organization-title"
              placeholder="e.g. Security analyst"
              value={form.applicantRole}
              onChange={(e) => set('applicantRole', e.target.value)}
              error={err('applicantRole')}
              required
            />
          </>
        )}
        {step === 1 && (
          <>
            <Input
              label="Organization"
              name="organization"
              autoComplete="organization"
              value={form.organization}
              onChange={(e) => set('organization', e.target.value)}
              error={err('organization')}
              required
            />
            <Input
              label="Organization website"
              name="website"
              inputMode="url"
              autoComplete="url"
              placeholder="example.ph"
              value={form.website}
              onChange={(e) => set('website', e.target.value)}
              error={err('website')}
              required
            />
            <Input
              label="Contact person (optional)"
              name="contactPerson"
              value={form.contactPerson}
              onChange={(e) => set('contactPerson', e.target.value)}
            />
          </>
        )}
        {step === 2 && (
          <>
            <Input
              label="What problem will BantAI help address?"
              name="reason"
              area
              rows={3}
              value={form.reason}
              onChange={(e) => set('reason', e.target.value)}
              error={err('reason')}
              required
            />
            <Input
              label="How will campaign intelligence be used?"
              name="intendedUse"
              area
              rows={3}
              value={form.intendedUse}
              onChange={(e) => set('intendedUse', e.target.value)}
              error={err('intendedUse')}
              required
            />
            <Input
              label="Where will it be deployed?"
              name="deployment"
              area
              rows={2}
              value={form.deployment}
              onChange={(e) => set('deployment', e.target.value)}
              error={err('deployment')}
              required
            />
            <RadioGroup
              legend="What access do you need?"
              name="dataAccess"
              options={DATA_ACCESS}
              value={form.dataAccess}
              onChange={(value) => set('dataAccess', value)}
              error={err('dataAccess')}
            />
            <Input
              label="How many people need access?"
              name="expectedUsers"
              type="number"
              min={1}
              max={500}
              value={form.expectedUsers}
              onChange={(e) => set('expectedUsers', e.target.value)}
              error={err('expectedUsers')}
              required
            />
            <label className="ra-check">
              <input
                type="checkbox"
                checked={form.pilotInterest}
                onChange={(e) => set('pilotInterest', e.target.checked)}
              />
              <span>Include this request in founding-pilot consideration</span>
            </label>
          </>
        )}
        {step === 3 && (
          <>
            <ReviewBlock title="About you" onEdit={() => setStep(0)}>
              <ReviewRow label="Name" value={form.fullName} />
              <ReviewRow label="Email" value={accountEmail} />
              <ReviewRow label="Role" value={form.applicantRole} />
            </ReviewBlock>
            <ReviewBlock title="Organization" onEdit={() => setStep(1)}>
              <ReviewRow label="Organization" value={form.organization} />
              <ReviewRow label="Website" value={form.website} />
            </ReviewBlock>
            <ReviewBlock title="Intended use" onEdit={() => setStep(2)}>
              <ReviewRow label="Problem" value={form.reason} />
              <ReviewRow label="Use" value={form.intendedUse} />
              <ReviewRow label="Deployment" value={form.deployment} />
              <ReviewRow label="People" value={form.expectedUsers} />
            </ReviewBlock>
            <label className="ra-check">
              <input
                type="checkbox"
                checked={form.accuracyConfirmed}
                onChange={(e) => set('accuracyConfirmed', e.target.checked)}
              />
              <span>
                I confirm this information is accurate and can be used to
                evaluate this Shield request.
              </span>
            </label>
            {err('accuracyConfirmed') && (
              <p className="error-text">{err('accuracyConfirmed')}</p>
            )}
            <label className="ra-check">
              <input
                type="checkbox"
                checked={form.productUpdatesOptIn}
                onChange={(e) => set('productUpdatesOptIn', e.target.checked)}
              />
              <span>Send occasional product updates (optional).</span>
            </label>
          </>
        )}
        {formError && (
          <div className="bantai-auth-card__form-error" role="alert">
            {formError}
          </div>
        )}
        <div className="ra-flow__actions">
          <button
            type="submit"
            className="ra-button ra-button--primary"
            disabled={submitting}
          >
            {step < 3
              ? 'Continue'
              : submitting
                ? 'Submitting…'
                : 'Submit request'}
          </button>
        </div>
      </form>
    </section>
  );
}
function RadioGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  error,
}: {
  legend: string;
  name: string;
  options: Array<{ value: T; label: string }>;
  value: T | '';
  onChange: (value: T) => void;
  error?: string;
}) {
  return (
    <fieldset className="ra-radio-group">
      <legend>{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className="ra-radio">
          <input
            type="radio"
            name={name}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
      {error && <p className="error-text">{error}</p>}
    </fieldset>
  );
}
function ReviewBlock({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="ra-review">
      <div className="ra-review__head">
        <h2>{title}</h2>
        <button type="button" className="ra-link-button" onClick={onEdit}>
          Edit
        </button>
      </div>
      <dl className="ra-summary">{children}</dl>
    </section>
  );
}
function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  );
}
