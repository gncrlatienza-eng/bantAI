import { Injectable } from '@nestjs/common';

import { PassportStrategy } from '@nestjs/passport';

import { ExtractJwt, Strategy } from 'passport-jwt';

import { jwtConstants } from '../constants';
import { PrismaService } from '../../../database/prisma.service';
import { UnauthorizedException } from '@nestjs/common';
import { resolveStaffPermissions } from '../constants/staff-permissions';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConstants.secret,
    });
  }

  async validate(payload: { sub: string; mfaPending?: boolean }) {
    if (payload.mfaPending) {
      throw new UnauthorizedException('MFA verification required.');
    }
    // Role and account existence are read on every protected request so an
    // administrator demotion/deletion revokes an already-issued JWT at once.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, staffRole: true },
    });
    if (!user) throw new UnauthorizedException('Session is no longer valid.');
    const permissions = resolveStaffPermissions(user.role, user.staffRole);
    return {
      userId: user.id,
      role: user.role,
      staffRole: user.staffRole,
      permissions,
    };
  }
}
