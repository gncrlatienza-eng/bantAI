import { fetchApi, fetchApiBlob } from '../api/apiClient';

/*
 * One type covers both audiences. Admin sessions get the full cluster row;
 * Shield (client) sessions get the published DTO (campaigns.service.ts
 * toShieldCampaign): no messageCount/countVerified/revision/messages, plus
 * title/status/firstObserved/lastObserved/observedDomainCount, and urlDomains
 * defanged ("x[.]com"). Fields only one audience receives are optional.
 */
export interface CampaignCluster {
  id: string;
  label?: string | null;
  centroid?: unknown;
  urlDomains: string[];
  isActive: boolean;
  /** Admin only. */
  messageCount?: number;
  countVerified?: boolean;
  revision?: number;
  createdAt: string;
  updatedAt: string;
  summary?: string | null;
  risk?: string | null;
  category?: string | null;
  mitigation?: string | null;
  publishedAt?: string | null;
  archivedAt?: string | null;
  // Shield-only published fields.
  title?: string;
  status?: 'ACTIVE' | 'DORMANT';
  firstObserved?: string;
  lastObserved?: string;
  observedDomainCount?: number;
}

export interface CampaignMessageSummary {
  id: string;
  body: string;
  receivedAt: string;
  classification?: {
    label: string;
    score: number;
    bucket?: string | null;
  } | null;
}

/* The backend returns an explicit published DTO to Shield, all reviewed
 * campaign members to Admin, and only own messages to mobile users. */
export interface CampaignDetail extends CampaignCluster {
  /** Admin (all reviewed members) and mobile (own messages); absent for Shield. */
  messages?: CampaignMessageSummary[];
}

/** Admin-approved masked example (GET /campaigns/:id/masked-messages). */
export interface ShieldMaskedMessage {
  text: string;
  language?: string | null;
  classification?: string | null;
  confidence?: number | null;
  campaignId: string;
}

export async function getCampaignMaskedMessages(
  id: string,
): Promise<ShieldMaskedMessage[]> {
  return fetchApi<ShieldMaskedMessage[]>(
    `/campaigns/${encodeURIComponent(id)}/masked-messages`,
  );
}

export async function getActiveCampaigns(): Promise<CampaignCluster[]> {
  return fetchApi<CampaignCluster[]>('/campaigns/active');
}

export async function getInactiveCampaigns(): Promise<CampaignCluster[]> {
  return fetchApi<CampaignCluster[]>('/campaigns/inactive');
}

export async function getArchivedCampaigns(): Promise<CampaignCluster[]> {
  return fetchApi<CampaignCluster[]>('/campaigns/admin/archived');
}

export async function getCampaignById(id: string): Promise<CampaignDetail> {
  return fetchApi<CampaignDetail>(`/campaigns/${id}`);
}

export async function deactivateCampaign(id: string): Promise<CampaignCluster> {
  return fetchApi<CampaignCluster>(`/campaigns/${id}/deactivate`, {
    method: 'PATCH',
  });
}

export async function archiveCampaign(id: string): Promise<void> {
  await fetchApi(`/campaigns/${encodeURIComponent(id)}/archive`, {
    method: 'PATCH',
  });
}

export async function reactivateCampaign(id: string): Promise<void> {
  await fetchApi(`/campaigns/${encodeURIComponent(id)}/reactivate`, {
    method: 'PATCH',
  });
}

export interface CampaignIntelligenceUpdate {
  title: string;
  summary: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  mitigation: string;
}

export async function createAdminCampaign(
  draft: CampaignIntelligenceUpdate,
): Promise<{ id: string }> {
  return fetchApi<{ id: string }>('/campaigns/admin', {
    method: 'POST',
    body: JSON.stringify(draft),
  });
}

export async function setCampaignIndicators(
  id: string,
  domains: string[],
): Promise<void> {
  await fetchApi(`/campaigns/${encodeURIComponent(id)}/indicators`, {
    method: 'PUT',
    body: JSON.stringify({ domains }),
  });
}

export async function updateCampaignIntelligence(
  id: string,
  update: CampaignIntelligenceUpdate,
): Promise<void> {
  await fetchApi(`/campaigns/${encodeURIComponent(id)}/intelligence`, {
    method: 'PATCH',
    body: JSON.stringify(update),
  });
}

export async function publishCampaignIntelligence(id: string): Promise<void> {
  await fetchApi(`/campaigns/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
  });
}

export async function approveMaskedCampaignMessage(
  id: string,
  text: string,
): Promise<void> {
  await fetchApi(
    `/campaigns/${encodeURIComponent(id)}/masked-messages/approve`,
    {
      method: 'POST',
      body: JSON.stringify({ text }),
    },
  );
}

/**
 * Shield exports are scoped to one published campaign. The server applies the
 * same allowlist as the Shield campaign DTO; this UI never assembles exports
 * from message, alert, or dataset endpoints.
 */
export async function exportCampaignIntelligence(id: string): Promise<Blob> {
  return fetchApiBlob(`/campaigns/${encodeURIComponent(id)}/export`, {
    params: { format: 'json' },
  });
}

export interface CampaignEvidenceInput {
  reason: string;
  evidenceReferences: string[];
}

export interface CampaignEvolutionEvent {
  id: string;
  type: string;
  summary: string;
  evidenceReferences: string[];
  status: 'DRAFT' | 'APPROVED';
  /** ADMIN when written by hand; ANALYSIS when proposed from an observation. */
  origin: 'ADMIN' | 'ANALYSIS';
  observationId: string | null;
  createdAt: string;
  approvedAt: string | null;
  revokedAt: string | null;
}

export type CampaignActivityChange =
  'NEW' | 'STABLE' | 'SPIKE' | 'DECLINE' | 'DORMANT' | 'RESURGENCE';

/** One deterministic 7-day window summary of a campaign. */
export interface CampaignObservation {
  id: string;
  campaignId: string;
  algorithmVersion: string;
  windowStart: string;
  windowEnd: string;
  messageCount: number;
  previousMessageCount: number;
  domains: string[];
  newDomains: string[];
  languageCounts: { en: number; fil: number; mixed: number; unknown: number };
  dominantLanguage: string | null;
  previousDominantLanguage: string | null;
  activityChange: CampaignActivityChange;
  evidenceMessageIds: string[];
  createdAt: string;
}

export interface CampaignAnalysisSummary {
  algorithmVersion: string;
  windowStart: string;
  windowEnd: string;
  campaigns: number;
  observations: Record<'created' | 'updated' | 'unchanged' | 'skipped', number>;
  proposals: number;
}

export function runCampaignAnalysis(campaignId: string) {
  return fetchApi<CampaignAnalysisSummary>(
    `/campaigns/admin/${encodeURIComponent(campaignId)}/analysis`,
    { method: 'POST' },
  );
}

export function listCampaignObservations(campaignId: string) {
  return fetchApi<CampaignObservation[]>(
    `/campaigns/admin/${encodeURIComponent(campaignId)}/observations`,
  );
}

export function mergeCampaigns(
  targetId: string,
  input: CampaignEvidenceInput & {
    sourceId: string;
    expectedSourceRevision: number;
    expectedTargetRevision: number;
  },
) {
  return fetchApi(`/campaigns/admin/${encodeURIComponent(targetId)}/merge`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function splitCampaign(
  sourceId: string,
  input: CampaignEvidenceInput & {
    expectedRevision: number;
    title: string;
    messageIds: string[];
    domains: string[];
  },
) {
  return fetchApi(`/campaigns/admin/${encodeURIComponent(sourceId)}/split`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function correctCampaignAssignment(
  input: CampaignEvidenceInput & {
    messageId: string;
    targetCampaignId?: string;
  },
) {
  return fetchApi('/campaigns/admin/assignments/correct', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listCampaignEvolution(campaignId: string) {
  return fetchApi<CampaignEvolutionEvent[]>(
    `/campaigns/admin/${encodeURIComponent(campaignId)}/evolution`,
  );
}

export function draftCampaignEvolution(
  campaignId: string,
  input: {
    type:
      | 'INDICATOR_SHIFT'
      | 'TACTIC_CHANGE'
      | 'CAMPAIGN_RELATION'
      | 'STATUS_CHANGE';
    summary: string;
    evidenceReferences: string[];
  },
) {
  return fetchApi<{ id: string }>(
    `/campaigns/admin/${encodeURIComponent(campaignId)}/evolution`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function approveCampaignEvolution(eventId: string) {
  return fetchApi(
    `/campaigns/admin/evolution/${encodeURIComponent(eventId)}/approve`,
    {
      method: 'POST',
    },
  );
}
