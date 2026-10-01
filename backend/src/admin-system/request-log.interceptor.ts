import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { RequestLogService } from './request-log.service';

@Injectable()
export class RequestLogInterceptor implements NestInterceptor {
  constructor(private readonly logs: RequestLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const started = performance.now();

    return next.handle().pipe(
      finalize(() => {
        const route = request.route as { path?: string } | undefined;
        const routeTemplate = route?.path
          ? `${request.baseUrl}${route.path}`
          : request.originalUrl || request.path;
        const path = sanitizePath(routeTemplate, request.params);
        if (path === '/api/admin/api-logs') return;
        this.logs.record({
          timestamp: new Date().toISOString(),
          method: request.method,
          path,
          status: response.statusCode,
          latencyMs: Math.max(0, Math.round(performance.now() - started)),
        });
      }),
    );
  }
}

export function sanitizePath(
  value: string,
  params: Record<string, string | string[]> = {},
): string {
  let sanitized = value;
  for (const [name, rawValue] of Object.entries(params)) {
    const rawValues = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const item of rawValues) {
      for (const candidate of [item, encodeURIComponent(item)]) {
        if (!candidate) continue;
        sanitized = sanitized.replaceAll(candidate, `:${name}`);
      }
    }
  }
  return sanitized
    .split('?')[0]
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      ':id',
    )
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ':email')
    .replace(/\+?\d[\d(). -]{7,}\d/g, ':phone')
    .replace(/\/[A-Za-z0-9_-]{32,}(?=\/|$)/g, '/:redacted')
    .slice(0, 240);
}
