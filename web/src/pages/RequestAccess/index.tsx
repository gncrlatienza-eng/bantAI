import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/appshell/AuthLayout';
import { rememberIntendedAccess } from '../account/intendedAccess';
import {
  ChooseAccess,
  ControlledAccess,
  FinalCta,
  Hero,
  HowAccessWorks,
  WhatYouGet,
} from './licensing';
import './licensing.css';
import './request-access.css';

/*
 * RequestAccessPage — the public licensing page and plan-selection entry
 * point. It never collects an application: choosing Shield starts the account-first lifecycle (create account or sign
 * in → verify email → setup → application), where the request belongs to a
 * verified account (docs/backend/ACCESS_LIFECYCLE_AUDIT_2026-09-29.md §A.1).
 *
 * Signed-in visitors never reach this page: SignedOutOnly sends them to
 * their current lifecycle state instead.
 */
export function RequestAccessPage() {
  const navigate = useNavigate();

  function pick(opts?: { pilot?: boolean }) {
    rememberIntendedAccess({ tier: 'shield', pilot: Boolean(opts?.pilot) });
    void navigate('/signup?tier=shield');
  }

  return (
    <AuthLayout decor="none">
      <div className="ra-page">
        <Hero />
        <ChooseAccess onPick={pick} />
        <WhatYouGet />
        <ControlledAccess />
        <HowAccessWorks />
        <FinalCta onPick={pick} />
      </div>
    </AuthLayout>
  );
}

export default RequestAccessPage;
