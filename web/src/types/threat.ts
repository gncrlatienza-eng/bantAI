import { Tone } from './common';

export interface CampaignCardItem {
  title: string;
  messages: string;
  domains: string;
  since: string;
  status: 'Active' | 'Inactive' | 'Under Review';
  tags: string[];
  tone?: Tone;
}

export interface FlaggedMessage {
  id: string;
  sender: string;
  body: string;
  category: 'Smishing' | 'Suspicious' | 'Safe';
  confidenceScore: number;
  timestamp: string;
  targetTelco: string;
  lureType: string;
  extractedUrls: string[];
}

export interface ModelMetrics {
  accuracy: string;
  falsePositiveRate: string;
  falseNegativeRate: string;
  f1Score: string;
  modelName: string;
  lastTrained: string;
}
