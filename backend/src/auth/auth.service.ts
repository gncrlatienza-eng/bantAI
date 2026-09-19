import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import {
  BadRequestException,
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../../database/prisma.service';

import { RegisterDto } from './dto/register.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpSmsService } from './otp-sms.service';
import { normalizePhilippineMobile } from './phone';

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
          const role = this.isAdministratorPhone(phone) ? 'ADMIN' : 'USER';
          return tx.user.upsert({
            where: { phone },
            create: { phone, role },
            update: { role },
          });
        },
        { isolationLevel: 'Serializable' },
      ),
    );

    if (!result) throw new BadRequestException('Invalid or expired OTP.');

    // Minimal payload — no PII in the token; phone is fetched from DB when needed
    const access_token = await this.jwtService.signAsync({
      sub: result.id,
      role: result.role,
    });

    return {
      message: 'Authentication successful.',
      access_token,
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        updatedAt: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
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

  private isAdministratorPhone(phone: string): boolean {
    return (process.env.ADMIN_PHONES ?? '')
      .split(',')
      .map((item) => normalizePhilippineMobile(item.trim()))
      .includes(phone);
  }
}
