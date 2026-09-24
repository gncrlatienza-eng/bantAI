import { Test, TestingModule } from '@nestjs/testing';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import type { Response } from 'express';

const mockAuthService = {
  register: jest.fn(),
  registerPortal: jest.fn(),
  login: jest.fn(),
  requestClientEmailOtp: jest.fn(),
  verifyClientEmailOtp: jest.fn(),
  requestClientClaimEmailOtp: jest.fn(),
  verifyClientClaimEmailOtp: jest.fn(),
  requestAdminEmailOtp: jest.fn(),
  verifyAdminEmailOtp: jest.fn(),
  requestOtp: jest.fn(),
  verifyOtp: jest.fn(),
  getMe: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;
  let response: Response;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    } as unknown as Response;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates register to AuthService', async () => {
    const dto = { phone: '+639171234567' };
    mockAuthService.register.mockResolvedValue({
      message: 'User registered successfully.',
      user: {},
    });

    await controller.register(dto);

    expect(mockAuthService.register).toHaveBeenCalledWith(dto);
  });

  it('delegates requestOtp to AuthService', async () => {
    const dto = { phone: '+639171234567' };
    mockAuthService.requestOtp.mockResolvedValue({
      message: 'OTP generated successfully.',
    });

    await controller.requestOtp(dto);

    expect(mockAuthService.requestOtp).toHaveBeenCalledWith(dto);
  });

  it('delegates portal registration to AuthService', async () => {
    const dto = {
      checkoutSessionId: 'cs_test_active_checkout_123',
      password: 'strong-password',
    };
    mockAuthService.registerPortal.mockResolvedValue({
      message: 'Authentication successful.',
      access_token: 'tok',
    });

    await controller.portalRegister(dto, response);

    expect(mockAuthService.registerPortal).toHaveBeenCalledWith(dto);
    expect(response.cookie).toHaveBeenCalledWith(
      'bantai_client_session',
      'tok',
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
    );
  });

  it('delegates email/password login to AuthService', async () => {
    const dto = { email: 'client@example.com', password: 'strong-password' };
    mockAuthService.login.mockResolvedValue({
      message: 'Authentication successful.',
      access_token: 'tok',
      audience: 'bantai-client-api',
    });

    await controller.login(dto, response);

    expect(mockAuthService.login).toHaveBeenCalledWith(dto);
  });

  it('clears the portal session cookie on logout', () => {
    controller.logout(response);
    expect(response.clearCookie).toHaveBeenCalledWith('bantai_client_session', {
      path: '/api',
    });
    expect(response.clearCookie).toHaveBeenCalledWith('bantai_admin_session', {
      path: '/api',
    });
  });

  it('sets a client-only cookie after web email OTP verification', async () => {
    const dto = { email: 'client@example.com', otp: '123456' };
    mockAuthService.verifyClientEmailOtp.mockResolvedValue({
      message: 'Authentication successful.',
      access_token: 'client-token',
    });

    await controller.verifyClientEmailOtp(dto, response);

    expect(response.cookie).toHaveBeenCalledWith(
      'bantai_client_session',
      'client-token',
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
    );
    expect(response.clearCookie).toHaveBeenCalledWith('bantai_admin_session', {
      path: '/api',
    });
    expect(response.cookie).not.toHaveBeenCalledWith(
      'bantai_admin_session',
      expect.anything(),
      expect.anything(),
    );
  });

  it('delegates verifyOtp to AuthService', async () => {
    const dto = { phone: '+639171234567', otp: '123456' };
    mockAuthService.verifyOtp.mockResolvedValue({
      message: 'Authentication successful.',
      access_token: 'tok',
    });

    await controller.verifyOtp(dto);

    expect(mockAuthService.verifyOtp).toHaveBeenCalledWith(dto);
  });

  it('delegates me to AuthService.getMe using userId from request', async () => {
    const req = { user: { userId: 'u1', phone: '+639171234567' } };
    mockAuthService.getMe.mockResolvedValue({
      id: 'u1',
      phone: '+639171234567',
    });

    await controller.me(req);

    expect(mockAuthService.getMe).toHaveBeenCalledWith('u1');
  });
});
