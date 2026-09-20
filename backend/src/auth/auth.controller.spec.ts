import { Test, TestingModule } from '@nestjs/testing';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const mockAuthService = {
  register: jest.fn(),
  registerPortal: jest.fn(),
  login: jest.fn(),
  firebaseLogin: jest.fn(),
  getMe: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
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

  it('delegates portal registration to AuthService', async () => {
    const dto = {
      email: 'client@example.com',
      password: 'strong-password',
      company: 'Example Co',
    };
    mockAuthService.registerPortal.mockResolvedValue({ access_token: 'tok' });

    await controller.portalRegister(dto);

    expect(mockAuthService.registerPortal).toHaveBeenCalledWith(dto);
  });

  it('delegates email/password login to AuthService', async () => {
    const dto = { email: 'client@example.com', password: 'strong-password' };
    mockAuthService.login.mockResolvedValue({ access_token: 'tok' });

    await controller.login(dto);

    expect(mockAuthService.login).toHaveBeenCalledWith(dto);
  });

  it('delegates Firebase mobile login to AuthService', async () => {
    const dto = { idToken: 'firebase-id-token' };
    mockAuthService.firebaseLogin.mockResolvedValue({
      message: 'Authentication successful.',
      access_token: 'tok',
    });

    await controller.firebaseLogin(dto);

    expect(mockAuthService.firebaseLogin).toHaveBeenCalledWith(dto);
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
