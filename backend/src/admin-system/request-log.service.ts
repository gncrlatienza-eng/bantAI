import { Injectable } from '@nestjs/common';

export interface SanitizedRequestLog {
  timestamp: string;
  method: string;
  path: string;
  status: number;
  latencyMs: number;
}

const MAX_LOG_ENTRIES = 500;

@Injectable()
export class RequestLogService {
  private readonly entries: SanitizedRequestLog[] = [];

  record(entry: SanitizedRequestLog) {
    this.entries.unshift(entry);
    if (this.entries.length > MAX_LOG_ENTRIES) {
      this.entries.length = MAX_LOG_ENTRIES;
    }
  }

  list(limit = 100) {
    const bounded = Math.max(1, Math.min(limit, 200));
    return {
      retention: 'process-memory',
      redaction:
        'query, body, headers, identity, IP, and path identifiers removed',
      entries: this.entries.slice(0, bounded),
    };
  }
}
