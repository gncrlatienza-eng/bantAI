import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import { AuthService } from './auth.service';
import { FirebaseTokenVerifierService } from './firebase-token-verifier.service';

describe('AuthService', () => {
  const prisma = {
    user: { upsert: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
  };
  const firebase = { verifyPhoneIdToken: jest.fn() };
  const jwt = { signAsync: jest.fn() };
  let service: AuthService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: FirebaseTokenVerifierService, useValue: firebase },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it('does not persist an unverified registration profile', async () => {
    await expect(
      service.register({ phone: '0917 123 4567', firstName: 'A' }),
    ).resolves.toEqual({
      message: 'Verify this phone number before creating a profile.',
    });
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it('registers a portal user with a hashed password and issues a token', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'u-web', role: 'USER', ...data }),
    );
    jwt.signAsync.mockResolvedValue('portal-jwt');

    await expect(
      service.registerPortal({
        email: ' Client@Example.com ',
        password: 'strong-password',
        company: ' Example Co ',
      }),
    ).resolves.toMatchObject({ access_token: 'portal-jwt' });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'client@example.com',
        company: 'Example Co',
        role: 'USER',
        passwordHash: expect.not.stringMatching(/^strong-password$/),
      }),
    });
  });

  it('rejects duplicate portal registration', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      service.registerPortal({
        email: 'client@example.com',
        password: 'strong-password',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('authenticates a portal user with email and password', async () => {
    const registration = service.registerPortal({
      email: 'client@example.com',
      password: 'strong-password',
    });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'u-web', role: 'USER', ...data }),
    );
    jwt.signAsync.mockResolvedValue('portal-jwt');
    await registration;
    const created = prisma.user.create.mock.calls[0][0].data;
    prisma.user.findUnique.mockResolvedValue({
      id: 'u-web',
      role: 'USER',
      passwordHash: created.passwordHash,
    });

    await expect(
      service.login({
        email: 'CLIENT@example.com',
        password: 'strong-password',
      }),
    ).resolves.toMatchObject({ access_token: 'portal-jwt' });

    await expect(
      service.login({
        email: 'client@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('exchanges a Firebase phone token for a role-bearing bantAI token', async () => {
    const phone = '+639171234567';
    firebase.verifyPhoneIdToken.mockResolvedValue({
      phone_number: phone,
      firebase: { sign_in_provider: 'phone' },
    });
    prisma.user.upsert.mockResolvedValue({ id: 'u1', role: 'ADMIN' });
    jwt.signAsync.mockResolvedValue('jwt');

    await expect(
      service.firebaseLogin({ idToken: 'firebase-id-token' }),
    ).resolves.toMatchObject({ access_token: 'jwt' });
    expect(firebase.verifyPhoneIdToken).toHaveBeenCalledWith(
      'firebase-id-token',
    );
    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { phone },
      create: { phone, role: 'USER' },
      update: {},
    });
  });
});
