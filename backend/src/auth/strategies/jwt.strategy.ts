import { Injectable, UnauthorizedException } from '@nestjs/common';

import { PassportStrategy } from '@nestjs/passport';

import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

import {
  ADMIN_SESSION_COOKIE,
  AuthAudience,
  CLIENT_SESSION_COOKIE,
  JWT_ISSUER,
  jwtSecretFor,
} from '../constants';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: Request) => {
          const header = request?.headers?.cookie;
          if (!header) return null;
          const cookies = new Map<string, string>();
          for (const part of header.split(';')) {
            const [name, ...value] = part.trim().split('=');
            if (!name || value.length === 0) continue;
            try {
              cookies.set(name, decodeURIComponent(value.join('=')));
            } catch {
              // A malformed cookie is ignored and must never crash auth.
            }
          }
          return (
            cookies.get(ADMIN_SESSION_COOKIE) ??
            cookies.get(CLIENT_SESSION_COOKIE) ??
            null
          );
        },
      ]),
      ignoreExpiration: false,
      algorithms: ['HS256'],
      secretOrKeyProvider: (_request, rawToken: string, done) => {
        try {
          const audience = readUnverifiedAudience(rawToken);
          done(null, jwtSecretFor(audience ?? AuthAudience.MOBILE));
        } catch (error) {
          done(error as Error);
        }
      },
    });
  }

  async validate(payload: { sub: string; aud?: AuthAudience; iss?: string }) {
    const audience = payload.aud ?? AuthAudience.MOBILE;
    if (payload.aud && payload.iss !== JWT_ISSUER) {
      throw new UnauthorizedException('Invalid session issuer.');
    }
    // Role and account existence are read on every protected request so an
    // administrator demotion/deletion revokes an already-issued JWT at once.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true },
    });
    if (!user) throw new UnauthorizedException('Session is no longer valid.');
    return { userId: user.id, role: user.role, audience };
  }
}

function readUnverifiedAudience(rawToken: string): AuthAudience | undefined {
  const payloadPart = rawToken.split('.')[1];
  if (!payloadPart) throw new UnauthorizedException('Invalid session token.');
  let decoded: { aud?: string | string[] };
  try {
    decoded = JSON.parse(
      Buffer.from(payloadPart, 'base64url').toString('utf8'),
    ) as { aud?: string | string[] };
  } catch {
    throw new UnauthorizedException('Invalid session token.');
  }
  const value = Array.isArray(decoded.aud) ? decoded.aud[0] : decoded.aud;
  if (!value) return undefined;
  if (!Object.values(AuthAudience).includes(value as AuthAudience)) {
    throw new UnauthorizedException('Invalid session audience.');
  }
  return value as AuthAudience;
}
