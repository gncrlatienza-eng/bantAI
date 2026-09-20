import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../../database/prisma.service';

import { RegisterDto } from './dto/register.dto';
import { normalizePhilippineMobile } from './phone';
import { LoginDto } from './dto/login.dto';
import { PortalRegisterDto } from './dto/portal-register.dto';
import { FirebaseLoginDto } from './dto/firebase-login.dto';
import { FirebaseTokenVerifierService } from './firebase-token-verifier.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private firebaseTokenVerifier: FirebaseTokenVerifierService,
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
    return this.issueToken(user.id, user.role);
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
    return this.issueToken(user.id, user.role);
  }

  private async issueToken(id: string, role: 'USER' | 'ADMIN') {
    return {
      message: 'Authentication successful.',
      access_token: await this.jwtService.signAsync({ sub: id, role }),
    };
  }

  async firebaseLogin(dto: FirebaseLoginDto) {
    const decoded = await this.firebaseTokenVerifier.verifyPhoneIdToken(
      dto.idToken,
    );
    const phone = this.requirePhone(decoded.phone_number!);
    const user = await this.prisma.user.upsert({
      where: { phone },
      create: { phone, role: 'USER' },
      update: {},
    });
    return this.issueToken(user.id, user.role);
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

  /*
   * isAdministratorPhone removed: admin role is stored on the User record,
   * not derived from env vars. If you need to promote a user, update
   * User.role in the database.
   */
}
