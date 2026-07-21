import { Test, TestingModule } from '@nestjs/testing';

import { UsersService } from './users.service';
import { PrismaService } from '../../database/prisma.service';

const mockPrisma = {
  user: { update: jest.fn() },
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('updateMe', () => {
    const userId = 'u1';

    it('updates all profile fields and returns the updated user', async () => {
      const dto = {
        firstName: 'Reymark',
        lastName: 'De Castro',
        email: 'r@example.com',
      };
      const updated = { id: userId, phone: '+639171234567', ...dto };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updateMe(userId, dto);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
        },
      });
      expect(result).toEqual(updated);
    });

    it('updates with only firstName when other fields are omitted', async () => {
      const dto = { firstName: 'Reymark' };
      const updated = {
        id: userId,
        phone: '+639171234567',
        firstName: 'Reymark',
        lastName: null,
        email: null,
      };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updateMe(userId, dto);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { firstName: 'Reymark', lastName: undefined, email: undefined },
      });
      expect(result).toEqual(updated);
    });

    it('passes the correct userId to the where clause', async () => {
      const dto = { firstName: 'Gio' };
      mockPrisma.user.update.mockResolvedValue({ id: 'u2' });

      await service.updateMe('u2', dto);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u2' } }),
      );
    });
  });
});
