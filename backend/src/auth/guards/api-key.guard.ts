import { timingSafeEqual } from 'crypto';
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

    // timingSafeEqual prevents brute-force timing attacks on the key value.
    // A length mismatch is itself a distinguishable signal, so we reject
    // before comparing rather than padding.
    const keyStr = Array.isArray(key) ? key[0] : (key ?? '');
    if (
      keyStr.length !== expected.length ||
      !timingSafeEqual(Buffer.from(keyStr), Buffer.from(expected))
    ) {
      throw new UnauthorizedException('Invalid or missing API key.');
    }

    return true;
  }
}
