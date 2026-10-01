import { AccessRequestTier } from '@prisma/client';

/*
 * Server-side source of truth for the license scope an applicant accepts
 * before payment. The web agreement step renders this summary verbatim and
 * must echo AGREEMENT_VERSION back when accepting, so a stale page cannot
 * accept terms the applicant never saw. Bump the version whenever any scope
 * line changes.
 */
export const AGREEMENT_VERSION = '2026-09';

export interface LicenseScope {
  name: string;
  purpose: string;
  dataset: string;
  users: string;
  exports: string;
  api: string;
  redistribution: string;
  reidentification: string;
  term: string;
}

export const LICENSE_SCOPES: Record<AccessRequestTier, LicenseScope> = {
  [AccessRequestTier.SHIELD]: {
    name: 'Shield Subscription',
    purpose: 'Consume approved BantAI campaign intelligence',
    dataset: 'No dataset access',
    users: 'Authorized users within the subscribed account',
    exports: 'Current or explicitly authorized campaign intelligence only',
    api: 'Included when released',
    redistribution: 'Not permitted',
    reidentification: 'Not permitted',
    term: '12 months, or monthly billing',
    // Prices are not part of the static scope: the account state attaches
    // the real recurring amounts from LicensePricingService.
  },
};

/* Rendered as BAI-<year>-<00000>. */
export function formatReference(referenceNumber: number, createdAt: Date) {
  return `BAI-${createdAt.getFullYear()}-${String(referenceNumber).padStart(5, '0')}`;
}
