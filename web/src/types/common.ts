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
