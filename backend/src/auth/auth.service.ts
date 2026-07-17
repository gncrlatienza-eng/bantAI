import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../../database/prisma.service';

import { RegisterDto } from './dto/register.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: {
        phone: dto.phone,
      },
    });

    if (existing) {
      throw new BadRequestException('Phone number already registered.');
    }

    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
    });

    return {
      message: 'User registered successfully.',
      user,
    };
  }

  async requestOtp(dto: RequestOtpDto) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.prisma.otpCode.create({
      data: {
        phone: dto.phone,
        code: otp,
        expiresAt,
      },
    });

    console.log(`OTP for ${dto.phone}: ${otp}`);

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

    if (!otp) {
      throw new NotFoundException('Invalid OTP.');
    }

    if (otp.expiresAt < new Date()) {
      throw new BadRequestException('OTP expired.');
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

    const payload = {
      sub: user.id,
      phone: user.phone,
    };

    const access_token = await this.jwtService.signAsync(payload);

    return {
      message: 'Authentication successful.',
      access_token,
      user,
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }
}