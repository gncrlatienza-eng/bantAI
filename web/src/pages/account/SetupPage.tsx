import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/apiClient';
import { AccountLayout } from '../../components/appshell/AccountLayout';
import { Input } from '../../components/common/Input';
import { useAccountState } from '../../context/AccountStateContext';
import {
  completeAccountSetup,
  getAccountTermsVersion,
} from '../../services/accountService';
import '../RequestAccess/request-access.css';

/*
 * SetupPage — mandatory account setup (audit §A.1, spec K/AH).
 *
 * The person is signed in. There is no Back to site, no Back to sign in, no
 * public navigation: "Previous" only moves between setup steps, and Log out
 * (in the layout) is the one way to end the session. The route guard sends
 * every other URL back here until the server reports setup COMPLETE.
 */

const STEPS = ['Profile', 'Terms', 'Finish'] as const;

export function SetupPage() {
  const navigate = useNavigate();
  const { state, refresh } = useAccountState();
  const account = state?.account;
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState(account?.firstName ?? '');
  const [lastName, setLastName] = useState(account?.lastName ?? '');
  const [organization, setOrganization] = useState(account?.organization ?? '');
  const [termsVersion, setTermsVersion] = useState<string>();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    void getAccountTermsVersion()
      .then((terms) => setTermsVersion(terms.version))
      .catch(() => setTermsVersion(undefined));
  }, []);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  function validate(index: number) {
    const next: Record<string, string> = {};
    if (index === 0) {
      if (!firstName.trim()) next.firstName = 'Enter your first name.';
      if (!lastName.trim()) next.lastName = 'Enter your last name.';
      if (organization.trim().length < 2)
        next.organization = 'Enter your institution or organization.';
    }
    if (index === 1 && !termsAccepted) {
      next.terms = 'Accept the terms and privacy notice to continue.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goNext(e: React.FormEvent) {
    e.preventDefault();
    if (!validate(step)) return;
    setStep((current) => current + 1);
  }

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    if (!termsVersion) {
      setFormError('The account terms could not be loaded. Reload the page.');
      return;
    }
    setBusy(true);
    setFormError(undefined);
    try {
      await completeAccountSetup({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        organization: organization.trim(),
        acceptedTermsVersion: termsVersion,
      });
      const next = await refresh();
      void navigate(next?.destination ?? '/access/request', { replace: true });
    } catch (err) {
      setFormError(
        err instanceof ApiError && err.status < 500
          ? err.message
          : 'We couldn’t finish setup right now. Your answers are kept — try again in a moment.',
      );
      setBusy(false);
    }
  }

  return (
    <AccountLayout context="Account setup" focused>
      <section className="ra-flow" aria-labelledby="setup-title">
        <p className="ra-eyebrow">
          Step {step + 1} of {STEPS.length}
        </p>
        <ol className="acct-steps" aria-label="Setup steps">
          {STEPS.map((label, index) => (
            <li
              key={label}
              aria-current={index === step ? 'step' : undefined}
              data-done={index < step ? '' : undefined}
            >
              <span className="acct-steps__n" aria-hidden>
                {index + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>
        <h1
          id="setup-title"
          className="ra-title ra-title--step"
          ref={headingRef}
          tabIndex={-1}
        >
          {step === 0 && 'Set up your account'}
          {step === 1 && 'What access do you need?'}
          {step === 1 && 'Terms and privacy'}
          {step === 2 && 'Review and finish'}
        </h1>

        <form
          className="ra-form"
          noValidate
          onSubmit={(e) => (step < 2 ? goNext(e) : void finish(e))}
        >
          {step === 0 && (
            <>
              <p className="ra-lede">
                Signed in as <strong>{account?.email}</strong>.
              </p>
              <Input
                label="First name"
                name="given-name"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                error={errors.firstName}
                required
              />
              <Input
                label="Last name"
                name="family-name"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                error={errors.lastName}
                required
              />
              <Input
                label="Institution or organization"
                name="organization"
                autoComplete="organization"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                error={errors.organization}
                required
              />
            </>
          )}

          {step === 1 && (
            <>
              <div
                className="acct-terms"
                tabIndex={0}
                aria-label="Account terms"
              >
                <h2>BantAI account terms (version {termsVersion ?? '…'})</h2>
                <ul>
                  <li>
                    This account identifies you. Keep your password and
                    verification codes private; BantAI staff will never ask for
                    them.
                  </li>
                  <li>
                    An account does not grant access to intelligence. Access
                    starts only after your request is reviewed, approved, its
                    license terms accepted, and any payment confirmed.
                  </li>
                  <li>
                    Licensed data may not be redistributed, re-identified, or
                    used outside the purpose approved in your license.
                  </li>
                  <li>
                    Privacy: we keep your name, email, and affiliation to
                    operate your account and evaluate access requests, and we
                    keep a record of your requests and licenses after they end.
                    You can ask to access or correct your data under the Data
                    Privacy Act of 2012.
                  </li>
                </ul>
              </div>
              <label className="ra-check">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => {
                    setTermsAccepted(e.target.checked);
                    setErrors({});
                  }}
                  aria-invalid={errors.terms ? true : undefined}
                  aria-describedby={errors.terms ? 'terms-error' : undefined}
                />
                <span>I accept the account terms and privacy notice.</span>
              </label>
              {errors.terms && (
                <span id="terms-error" className="error-text">
                  {errors.terms}
                </span>
              )}
            </>
          )}

          {step === 2 && (
            <dl className="ra-summary">
              <div>
                <dt>Name</dt>
                <dd>
                  {firstName.trim()} {lastName.trim()}
                </dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{account?.email}</dd>
              </div>
              <div>
                <dt>Affiliation</dt>
                <dd>{organization.trim()}</dd>
              </div>
              <div>
                <dt>Subscription</dt>
                <dd>Shield</dd>
              </div>
            </dl>
          )}

          {formError && (
            <div className="bantai-auth-card__form-error" role="alert">
              {formError}
            </div>
          )}

          <div className="ra-flow__actions">
            {step > 0 && (
              <button
                type="button"
                className="ra-button ra-button--ghost"
                onClick={() => setStep((current) => current - 1)}
                disabled={busy}
              >
                ← Previous
              </button>
            )}
            <button
              type="submit"
              className="ra-button ra-button--primary"
              disabled={busy}
              aria-busy={busy}
            >
              {step < 2 ? 'Continue' : busy ? 'Finishing…' : 'Finish setup'}
            </button>
          </div>
        </form>
      </section>
    </AccountLayout>
  );
}

export default SetupPage;
