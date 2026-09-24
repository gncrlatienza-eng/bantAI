import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import {
  BadRequestException,
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../../database/prisma.service';

import { RegisterDto } from './dto/register.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpSmsService } from './otp-sms.service';
import { normalizePhilippineMobile } from './phone';
import { LoginDto } from './dto/login.dto';
import { PortalRegisterDto } from './dto/portal-register.dto';
import {
  resolveStaffPermissions,
  type StaffRole,
} from './constants/staff-permissions';

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_WINDOW_MS = 60 * 60 * 1000;
const OTP_MAX_REQUESTS_PER_WINDOW = 5;
const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private otpSmsService: OtpSmsService,
  ) {}

  register(dto: RegisterDto) {
    this.requirePhone(dto.phone);
    // Profile fields are deliberately not stored until the phone owner has
    // completed OTP verification and updates their own profile via /users/me.
    return Promise.resolve({
      message: 'Verify this phone number before creating a profile.',
    });
  }

  async registerPortal(dto: PortalRegisterDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('An account already exists for this email.');
    }
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(dto.password, 12),
        company: dto.company?.trim() || undefined,
        role: 'USER',
      },
    });

    // Check for pending invitations for this email
    let pendingInvites: any[] = [];
    if (this.prisma.organizationInvitation) {
      const res = await this.prisma.organizationInvitation.findMany({
        where: {
          email,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
      });
      if (Array.isArray(res)) {
        pendingInvites = res;
      }
    }

    for (const invite of pendingInvites) {
      await this.prisma.organizationMembership.upsert({
        where: {
          organizationId_userId: {
            organizationId: invite.organizationId,
            userId: user.id,
          },
        },
        create: {
          organizationId: invite.organizationId,
          userId: user.id,
          role: invite.role,
        },
        update: {
          role: invite.role,
        },
      });

      await this.prisma.organizationInvitation.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' },
      });

      // If org has no owner, make this user owner
      const org = await this.prisma.portalOrganization.findUnique({
        where: { id: invite.organizationId },
      });
      if (org && !org.ownerId) {
        await this.prisma.portalOrganization.update({
          where: { id: org.id },
          data: { ownerId: user.id },
        });
      }
    }

    return this.issueToken(user.id, user.role, user.staffRole as StaffRole | null);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (
      !user?.passwordHash ||
      !(await bcrypt.compare(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    return this.issueToken(user.id, user.role, user.staffRole as StaffRole | null);
  }

  private async issueToken(
    id: string,
    role: 'USER' | 'ADMIN',
    staffRole?: StaffRole | null,
  ) {
    const permissions = resolveStaffPermissions(role, staffRole);
    return {
      message: 'Authentication successful.',
      access_token: await this.jwtService.signAsync({
        sub: id,
        role,
        staffRole: staffRole ?? null,
        permissions,
      }),
    };
  }

  async requestOtp(dto: RequestOtpDto) {
    const phone = this.requirePhone(dto.phone);
    // crypto.randomInt is cryptographically secure; Math.random() is not
    const otp = randomInt(100_000, 1_000_000).toString();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
    const codeHash = this.hashOtp(phone, otp);

    // A serializable transaction and one row per phone make replacement of the
    // active challenge atomic under concurrent requests.
    await this.withSerializationRetry(async () =>
      this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.otpCode.findUnique({ where: { phone } });
          const inWindow =
            existing &&
            now.getTime() - existing.requestWindowStart.getTime() <
              OTP_WINDOW_MS;
          const requestCount = inWindow ? existing.requestCount + 1 : 1;
          if (requestCount > OTP_MAX_REQUESTS_PER_WINDOW) {
            throw new HttpException(
              'Too many OTP requests. Try again later.',
              HttpStatus.TOO_MANY_REQUESTS,
            );
          }
          await tx.otpCode.upsert({
            where: { phone },
            create: {
              phone,
              codeHash,
              expiresAt,
              requestCount: 1,
              requestWindowStart: now,
            },
            update: {
              codeHash,
              expiresAt,
              verified: false,
              attempts: 0,
              requestCount,
              requestWindowStart: inWindow ? existing.requestWindowStart : now,
            },
          });
        },
        { isolationLevel: 'Serializable' },
      ),
    );

    try {
      await this.otpSmsService.send(phone, otp);
    } catch {
      // An undelivered code must never remain usable.
      await this.prisma.otpCode.updateMany({
        where: { phone, codeHash, verified: false },
        data: { verified: true },
      });
      this.logger.warn(`OTP delivery failed for ${this.redactPhone(phone)}`);
      throw new ServiceUnavailableException(
        'OTP delivery is temporarily unavailable.',
      );
    }

    return {
      message: 'OTP generated successfully.',
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const phone = this.requirePhone(dto.phone);
    const codeHash = this.hashOtp(phone, dto.otp);
    const now = new Date();
    const result = await this.withSerializationRetry(async () =>
      this.prisma.$transaction(
        async (tx) => {
          const challenge = await tx.otpCode.findUnique({ where: { phone } });
          const valid =
            challenge &&
            !challenge.verified &&
            challenge.expiresAt > now &&
            challenge.attempts < OTP_MAX_ATTEMPTS &&
            this.hashesMatch(challenge.codeHash, codeHash);

          if (!valid) {
            if (
              challenge &&
              !challenge.verified &&
              challenge.attempts < OTP_MAX_ATTEMPTS
            ) {
              await tx.otpCode.update({
                where: { phone },
                data: { attempts: { increment: 1 } },
              });
            }
            // Do not throw inside this transaction: that would roll back the
            // durable attempt increment and make brute-force limits ineffective.
            return null;
          }

          const consumed = await tx.otpCode.updateMany({
            where: {
              phone,
              codeHash,
              verified: false,
              expiresAt: { gt: now },
              attempts: { lt: OTP_MAX_ATTEMPTS },
            },
            data: { verified: true },
          });
          if (consumed.count !== 1) {
            throw new BadRequestException('Invalid or expired OTP.');
          }
          /*
           * OTP-verified sign-in creates or updates the phone-owned user with
           * the USER role. Admin promotion is no longer derived from the
           * phone number - admin role is set on the User record directly
           * (seed, migration, or a dedicated admin
           * management endpoint). Do NOT overwrite an existing ADMIN role on
           * successful OTP verify.
           */
          return tx.user.upsert({
            where: { phone },
            create: { phone, role: 'USER' },
            update: {}, // preserve existing role
          });
        },
        { isolationLevel: 'Serializable' },
      ),
    );

    if (!result) throw new BadRequestException('Invalid or expired OTP.');

    // Minimal payload — no PII in the token; phone is fetched from DB when needed
    return this.issueToken(result.id, result.role, (result as { staffRole?: StaffRole | null }).staffRole);
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        email: true,
        company: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        updatedAt: true,
        role: true,
        staffRole: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const permissions = resolveStaffPermissions(
      user.role,
      user.staffRole as StaffRole | null,
    );

    return {
      ...user,
      permissions,
    };
  }

  private requirePhone(phone: string): string {
    const normalized = normalizePhilippineMobile(phone);
    if (!normalized)
      throw new BadRequestException('Enter a valid Philippine mobile number.');
    return normalized;
  }

  private hashOtp(phone: string, otp: string): string {
    const secret = process.env.OTP_HASH_SECRET;
    if (!secret)
      throw new Error('OTP_HASH_SECRET environment variable is not set.');
    return createHmac('sha256', secret).update(`${phone}:${otp}`).digest('hex');
  }

  private hashesMatch(left: string, right: string): boolean {
    const a = Buffer.from(left, 'hex');
    const b = Buffer.from(right, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private async withSerializationRetry<T>(work: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await work();
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2034' || attempt === 2)
          throw error;
      }
    }
    throw new Error('Unreachable serialization retry state.');
  }

  private redactPhone(phone: string): string {
    return `${phone.slice(0, 3)}****${phone.slice(-2)}`;
  }

  /*
   * isAdministratorPhone removed: admin role is stored on the User record,
   * not derived from env vars. If you need to promote a user, update
   * User.role in the database.
   */
}
