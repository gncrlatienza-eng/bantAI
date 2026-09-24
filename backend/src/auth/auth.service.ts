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

import { OrganizationInvitation } from '@prisma/client';
import { RegisterDto } from './dto/register.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpSmsService } from './otp-sms.service';
import { OtpEmailService } from './otp-email.service';
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
    private otpEmailService: OtpEmailService,
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
    let pendingInvites: OrganizationInvitation[] = [];
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

    return this.issueToken(user.id, user.role, user.staffRole);
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
    if (user.role === 'ADMIN') {
      return {
        message: 'MFA verification required.',
        requiresMfa: true,
        email: user.email,
      };
    }
    return this.issueToken(user.id, user.role, user.staffRole);
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
    if (dto.email) {
      return this.requestEmailOtp(dto.email);
    }
    if (dto.phone) {
      return this.requestPhoneOtp(dto.phone);
    }
    throw new BadRequestException('Either phone or email must be provided.');
  }

  private async requestEmailOtp(rawEmail: string) {
    const email = rawEmail.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'ADMIN') {
      throw new UnauthorizedException(
        'Staff account not found or unauthorized.',
      );
    }

    const otp = randomInt(100_000, 1_000_000).toString();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
    const codeHash = this.hashOtp(email, otp);

    await this.withSerializationRetry(async () =>
      this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.otpCode.findUnique({ where: { email } });
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
            where: { email },
            create: {
              email,
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
      await this.otpEmailService.send(email, otp);
    } catch {
      await this.prisma.otpCode.updateMany({
        where: { email, codeHash, verified: false },
        data: { verified: true },
      });
      this.logger.warn(
        `Staff email OTP delivery failed for ${this.redactEmail(email)}`,
      );
      throw new ServiceUnavailableException(
        'OTP delivery is temporarily unavailable.',
      );
    }

    return {
      message: 'OTP generated successfully.',
    };
  }

  private async requestPhoneOtp(rawPhone: string) {
    const phone = this.requirePhone(rawPhone);
    const otp = randomInt(100_000, 1_000_000).toString();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
    const codeHash = this.hashOtp(phone, otp);

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
    if (dto.email) {
      return this.verifyEmailOtp(dto.email, dto.otp);
    }
    if (dto.phone) {
      return this.verifyPhoneOtp(dto.phone, dto.otp);
    }
    throw new BadRequestException('Either phone or email must be provided.');
  }

  private async verifyEmailOtp(rawEmail: string, otp: string) {
    const email = rawEmail.trim().toLowerCase();
    const codeHash = this.hashOtp(email, otp);
    const now = new Date();
    const result = await this.withSerializationRetry(async () =>
      this.prisma.$transaction(
        async (tx) => {
          const challenge = await tx.otpCode.findUnique({ where: { email } });
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
                where: { email },
                data: { attempts: { increment: 1 } },
              });
            }
            return null;
          }

          const consumed = await tx.otpCode.updateMany({
            where: {
              email,
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

          const user = await tx.user.findUnique({ where: { email } });
          if (!user || user.role !== 'ADMIN') {
            throw new UnauthorizedException(
              'Administrator access is required.',
            );
          }

          return user;
        },
        { isolationLevel: 'Serializable' },
      ),
    );

    if (!result) throw new BadRequestException('Invalid or expired OTP.');

    return this.issueToken(
      result.id,
      result.role,
      (result as { staffRole?: StaffRole | null }).staffRole,
    );
  }

  private async verifyPhoneOtp(rawPhone: string, otp: string) {
    const phone = this.requirePhone(rawPhone);
    const codeHash = this.hashOtp(phone, otp);
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

    return this.issueToken(
      result.id,
      result.role,
      (result as { staffRole?: StaffRole | null }).staffRole,
    );
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

    const permissions = resolveStaffPermissions(user.role, user.staffRole);

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

  private redactEmail(email: string): string {
    const parts = email.split('@');
    if (parts.length !== 2) return '***';
    const [name, domain] = parts;
    const maskedName =
      name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : '***';
    return `${maskedName}@${domain}`;
  }

  /*
   * isAdministratorPhone removed: admin role is stored on the User record,
   * not derived from env vars. If you need to promote a user, update
   * User.role in the database.
   */
}
