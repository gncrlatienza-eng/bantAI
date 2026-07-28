import { Test, TestingModule } from '@nestjs/testing';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const mockUsersService = {
  updateMe: jest.fn(),
};

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates updateMe to UsersService with userId from request', async () => {
    const req = { user: { userId: 'u1' } };
    const dto = { firstName: 'Reymark' };
    const updated = { id: 'u1', phone: '+639171234567', firstName: 'Reymark' };
    mockUsersService.updateMe.mockResolvedValue(updated);

    const result = await controller.updateMe(req, dto);

    expect(mockUsersService.updateMe).toHaveBeenCalledWith('u1', dto);
    expect(result).toEqual(updated);
  });
});
