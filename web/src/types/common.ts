export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'gray';

export interface MetricItem {
  label: string;
  value: string;
  meta?: string;
  tone?: Tone;
}

export interface TableColumn {
  key: string;
  label: string;
}

export interface TableData {
  headers: string[];
  rows: string[][];
  footer?: string;
}

export type Metric = MetricItem;

export interface NavItem {
  label: string;
  path: string;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export interface CampaignCard {
  title: string;
  status: string;
  tone: 'green' | 'gray';
  messages: string;
  domains: string;
  since: string;
  tags: string[];
}
