import { ShieldApiScope } from '@prisma/client';

import { entitlementPolicyFor } from '../portal-organizations/entitlement-policy';

/**
 * Curated Shield guidance served by the backend so the portal never shows
 * documentation for behaviour the API does not have. Every route, scope,
 * limit and error message below mirrors shield-campaign-api.controller.ts and
 * shield-api-key.guard.ts; update them together.
 */

export interface DocEndpoint {
  method: 'GET';
  path: string;
  scope: ShieldApiScope;
  description: string;
}

export interface DocError {
  status: number;
  message: string;
  action: string;
}

export interface DocSection {
  id: string;
  title: string;
  summary: string;
  paragraphs?: string[];
  list?: string[];
  code?: string;
  endpoints?: DocEndpoint[];
  errors?: DocError[];
}

export interface ShieldDocumentation {
  updatedAt: string;
  api: { released: boolean; basePath: string };
  sections: DocSection[];
}

const BASE_PATH = '/api/shield/v1/campaigns';
const CONTENT_UPDATED_AT = '2026-09-30T00:00:00.000Z';

export const SHIELD_API_ENDPOINTS: DocEndpoint[] = [
  {
    method: 'GET',
    path: BASE_PATH,
    scope: ShieldApiScope.READ_CAMPAIGNS,
    description: 'Every published campaign available to your subscription.',
  },
  {
    method: 'GET',
    path: `${BASE_PATH}/active`,
    scope: ShieldApiScope.READ_CAMPAIGNS,
    description: 'Published campaigns whose status is ACTIVE.',
  },
  {
    method: 'GET',
    path: `${BASE_PATH}/updates`,
    scope: ShieldApiScope.READ_CAMPAIGNS,
    description:
      'The published campaign list, for polling integrations that track changes by updatedAt.',
  },
  {
    method: 'GET',
    path: `${BASE_PATH}/:id`,
    scope: ShieldApiScope.READ_CAMPAIGNS,
    description:
      'One published campaign: summary, risk, category and mitigation.',
  },
  {
    method: 'GET',
    path: `${BASE_PATH}/:id/timeline`,
    scope: ShieldApiScope.READ_CAMPAIGNS,
    description: 'Admin-approved evolution entries for one campaign.',
  },
  {
    method: 'GET',
    path: `${BASE_PATH}/:id/indicators`,
    scope: ShieldApiScope.READ_INDICATORS,
    description: 'Approved link domains associated with one campaign.',
  },
  {
    method: 'GET',
    path: `${BASE_PATH}/:id/masked-messages`,
    scope: ShieldApiScope.READ_MASKED_MESSAGES,
    description:
      'Admin-approved masked examples. Personal identifiers are removed before approval.',
  },
  {
    method: 'GET',
    path: `${BASE_PATH}/:id/export`,
    scope: ShieldApiScope.EXPORT_CAMPAIGNS,
    description: 'The same published campaign record, packaged for export.',
  },
];

// Ordered by precedence: the release check runs before any key check, so
// while the API is unreleased every request gets 403, with or without a key
// (manual QA 2026-10-01, F9).
export const SHIELD_API_ERRORS: DocError[] = [
  {
    status: 403,
    message: 'Shield API access is not enabled.',
    action:
      'Returned for every request, with or without a key, while subscriber API access is not released for this deployment. Key checks (401) apply only after release. Use the portal until BantAI announces availability.',
  },
  {
    status: 401,
    message: 'Shield API key is required.',
    action:
      'After release only. Send the key as "Authorization: Bearer bnt_live_…". Query-string keys are not accepted.',
  },
  {
    status: 401,
    message: 'Shield API key is invalid or inactive.',
    action:
      'After release only. The key is unknown, revoked or expired, or your subscription or membership ended. Create a new key from the API page once access is active.',
  },
  {
    status: 403,
    message: 'API key lacks the required scope.',
    action:
      'Create a key that includes the scope listed for the endpoint. Scopes cannot be added to an existing key.',
  },
  {
    status: 404,
    message: 'Campaign not found',
    action:
      'The campaign id is wrong, or the campaign is no longer published (it may have been merged, split or archived).',
  },
  {
    status: 429,
    message: 'Shield API rate limit or monthly quota exceeded.',
    action:
      'Back off and retry after a minute for the per-key rate limit. The monthly quota resets on the first day of each month (UTC).',
  },
];

export function buildShieldDocumentation(): ShieldDocumentation {
  const released = entitlementPolicyFor().api.released;
  return {
    updatedAt: CONTENT_UPDATED_AT,
    api: { released, basePath: BASE_PATH },
    sections: [
      {
        id: 'getting-started',
        title: 'Getting started',
        summary:
          'Shield gives your organization reviewed smishing campaign intelligence for the Philippines.',
        list: [
          'Overview shows the current published campaigns and their risk.',
          'Campaigns lists every published campaign; open one for its summary, mitigation, indicators and approved timeline.',
          'Exports and the API (when released) deliver the same published records to your own tools.',
          'Notifications tell you when campaigns are published or change, and when your subscription or API usage needs attention.',
        ],
      },
      {
        id: 'data-boundary',
        title: 'Data boundary and masking',
        summary:
          'Raw SMS never leaves the phone that received it. Shield only receives reviewed intelligence.',
        paragraphs: [
          'The BantAI mobile app masks personal identifiers on the device before anything is sent. The backend stores masked text only, and an Admin reviews a campaign before it is published to Shield.',
          'Shield never includes mobile-user identities, phone numbers, message senders, model internals, training data or unpublished drafts. Masked examples appear only after an Admin approves each one.',
        ],
      },
      {
        id: 'campaigns',
        title: 'Reading campaign intelligence',
        summary:
          'Each campaign is a reviewed record, not a live feed of messages.',
        list: [
          'Risk and category are assigned by an analyst reviewing the campaign.',
          'Indicators are link domains an Admin approved for this campaign. Adding a domain sends the campaign back to review before it is republished.',
          'The timeline lists Admin-approved changes, such as new domains, a language shift or a rise in activity. Proposed changes that have not been approved are never shown.',
          'A campaign can be withdrawn from Shield if it is merged, split, corrected or archived. Its identifier then returns 404.',
        ],
      },
      {
        id: 'api-access',
        title: 'API access and keys',
        summary: released
          ? 'The read-only Shield API is available to active subscriptions.'
          : 'The Shield API is not released yet. Until BantAI enables it, every request returns 403, including requests without a key.',
        paragraphs: [
          'Create keys on the API page. The full secret is shown once, when the key is created. BantAI stores only a digest, so neither you nor an administrator can recover it later. Rotate a key if its secret may have been exposed, and revoke keys you no longer need.',
          'Keys stop working when they are revoked or expire, when the member who created them loses access, or when your subscription is no longer active.',
        ],
        code: `curl -H "Authorization: Bearer bnt_live_<your key>" \\\n  https://<bantai-host>${BASE_PATH}/active`,
      },
      {
        id: 'endpoints',
        title: 'Endpoints and scopes',
        summary:
          'All endpoints are read-only GET requests. Each needs the scope shown.',
        endpoints: SHIELD_API_ENDPOINTS,
      },
      {
        id: 'limits',
        title: 'Limits',
        summary:
          'Usage is counted per organization and per key. Your current limits are shown on the API page.',
        list: [
          'Monthly quota: total requests for your organization in a calendar month (UTC). The default is 50,000.',
          'Rate limit: requests per minute for each key. The default is 100.',
          'Requests over either limit return 429 and are not counted against your quota.',
          'You receive a notification at 80% and 100% of the monthly quota if API usage alerts are on.',
        ],
      },
      {
        id: 'errors',
        title: 'Errors',
        summary:
          'Error responses use standard HTTP status codes with the messages below.',
        errors: SHIELD_API_ERRORS,
      },
      {
        id: 'exports',
        title: 'Exports',
        summary: 'Exports package one published campaign at a time.',
        paragraphs: [
          'An export contains the same approved intelligence you see in Shield. It never contains message records, datasets or account data.',
        ],
      },
      {
        id: 'support',
        title: 'Access and support',
        summary:
          'Your subscription and your role in your organization control what you can use.',
        paragraphs: [
          'If an expected campaign, export or API action is unavailable, contact the BantAI administrator with your organization name, the endpoint or page, and the time of the issue. Never include an API secret in a support message.',
        ],
      },
    ],
  };
}
