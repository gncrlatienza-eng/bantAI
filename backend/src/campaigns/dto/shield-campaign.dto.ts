/** Explicit public shape. Never spread a Prisma campaign or SMS record here. */
export interface ShieldCampaignDto {
  id: string;
  title: string;
  // Compatibility names for the current Shield campaign components.
  label: string;
  risk: string;
  category: string;
  status: 'ACTIVE' | 'DORMANT';
  isActive: boolean;
  firstObserved: Date;
  createdAt: Date;
  lastObserved: Date;
  updatedAt: Date;
  summary: string;
  mitigation: string;
  observedDomainCount: number;
  urlDomains: string[];
}

export interface ShieldMaskedMessageDto {
  text: string;
  language: string | null;
  classification: string | null;
  confidence: number | null;
  campaignId: string;
}
