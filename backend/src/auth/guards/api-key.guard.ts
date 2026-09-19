import { createHmac, timingSafeEqual } from 'crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

abstract class ScopedApiKeyGuard implements CanActivate {
  protected abstract readonly environmentVariable: string;

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const key = req.headers['x-api-key'];
    const expected = process.env[this.environmentVariable];

    if (!expected) {
      throw new UnauthorizedException(
        `${this.environmentVariable} is not configured on the server.`,
      );
    }

    // Compare HMAC-SHA256 digests so the comparison is constant-time and
    // length-independent — a direct timingSafeEqual rejects on length mismatch
    // first, leaking the expected key length in O(1) probes.
    const keyStr = Array.isArray(key) ? key[0] : (key ?? '');
    const hmacKey = Buffer.from(expected);
    const digest = (v: string) =>
      createHmac('sha256', hmacKey).update(v).digest();
    if (!timingSafeEqual(digest(keyStr), digest(expected))) {
      throw new UnauthorizedException('Invalid or missing API key.');
    }

    return true;
  }
}

/** Machine credential limited to campaign centroid/synchronization routes. */
@Injectable()
export class ApiKeyGuard extends ScopedApiKeyGuard {
  protected readonly environmentVariable = 'AI_CAMPAIGNS_API_KEY';
}

/** Machine credential limited to model registry reads/candidate registration. */
@Injectable()
export class AiModelsKeyGuard extends ScopedApiKeyGuard {
  protected readonly environmentVariable = 'AI_MODELS_API_KEY';
}

/** Machine credential limited to indicator storage. */
@Injectable()
export class AiIndicatorsKeyGuard extends ScopedApiKeyGuard {
  protected readonly environmentVariable = 'AI_INDICATORS_API_KEY';
}
