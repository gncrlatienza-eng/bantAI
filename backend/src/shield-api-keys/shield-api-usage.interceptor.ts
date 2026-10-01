import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, concatMap, from, throwError } from 'rxjs';
import { PrismaService } from '../../database/prisma.service';

/** Records only status and route metadata after an authenticated API call. */
@Injectable()
export class ShieldApiUsageInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<{ shieldApiRequestId?: string }>();
    const response = http.getResponse<{ statusCode: number }>();
    const usageId = request.shieldApiRequestId;
    if (!usageId) return next.handle();

    const record = (statusCode: number) =>
      this.prisma.shieldApiRequest.update({
        where: { id: usageId },
        data: { statusCode },
        select: { id: true },
      });

    return next.handle().pipe(
      concatMap((value: unknown) =>
        from(record(response.statusCode).then(() => value)),
      ),
      catchError((error: unknown) => {
        const status =
          typeof error === 'object' &&
          error !== null &&
          'getStatus' in error &&
          typeof error.getStatus === 'function'
            ? Number((error as { getStatus: () => unknown }).getStatus())
            : 500;
        // Record the failure, then rethrow the original error unchanged so
        // Nest's exception filters still see the same HttpException.
        return from(record(status)).pipe(
          concatMap(() => throwError(() => error)),
        );
      }),
    );
  }
}
