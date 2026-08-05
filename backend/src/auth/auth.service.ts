import { randomInt } from 'crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../../database/prisma.service';

import { RegisterDto } from './dto/register.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    // Return the same response whether the phone is new or already registered.
    // This prevents attackers from enumerating which phone numbers have accounts.
    if (!existing) {
      await this.prisma.user.create({
        data: {
          phone: dto.phone,
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
      });
    }

    return { message: 'If this number is new, your account has been created.' };
  }

  async requestOtp(dto: RequestOtpDto) {
    // crypto.randomInt is cryptographically secure; Math.random() is not
    const otp = randomInt(100_000, 1_000_000).toString();

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Invalidate any previous unused OTPs so old codes can't be replayed
    await this.prisma.otpCode.updateMany({
      where: { phone: dto.phone, verified: false },
      data: { verified: true },
    });

    await this.prisma.otpCode.create({
      data: {
        phone: dto.phone,
        code: otp,
        expiresAt,
      },
    });

    // TODO: deliver OTP via SMS provider (currently no provider integrated)
    this.logger.warn(
      `OTP generated for [redacted] — SMS delivery not yet implemented`,
    );

    return {
      message: 'OTP generated successfully.',
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const otp = await this.prisma.otpCode.findFirst({
      where: {
        phone: dto.phone,
        code: dto.otp,
        verified: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Unified error message — don't distinguish "wrong code" from "expired code"
    // so attackers can't tell whether a guessed code would have been valid.
    if (!otp || otp.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired OTP.');
    }

    await this.prisma.otpCode.update({
      where: {
        id: otp.id,
      },
      data: {
        verified: true,
      },
    });

    let user = await this.prisma.user.findUnique({
      where: {
        phone: dto.phone,
      },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone: dto.phone,
        },
      });
    }

    // Minimal payload — no PII in the token; phone is fetched from DB when needed
    const access_token = await this.jwtService.signAsync({ sub: user.id });

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
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }
}
