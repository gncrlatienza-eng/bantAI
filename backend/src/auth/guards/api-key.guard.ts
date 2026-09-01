import { createHmac, timingSafeEqual } from 'crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const key = req.headers['x-api-key'];
    const expected = process.env.INTERNAL_API_KEY;

    if (!expected) {
      throw new UnauthorizedException(
        'INTERNAL_API_KEY is not configured on the server.',
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
