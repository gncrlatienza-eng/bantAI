import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import { ModelsService } from './models.service';

const mockPrisma = {
  modelVersion: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('ModelsService', () => {
  let service: ModelsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((ops: unknown[]) =>
      Promise.all(ops),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModelsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ModelsService>(ModelsService);
  });

  // --- findAll ---

  it('findAll returns all versions ordered by promotedAt desc', async () => {
    const versions = [{ id: 'v2' }, { id: 'v1' }];
    mockPrisma.modelVersion.findMany.mockResolvedValue(versions);
    const result = await service.findAll();
    expect(result).toEqual(versions);
    expect(mockPrisma.modelVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { promotedAt: 'desc' } }),
    );
  });

  // --- findActive ---

  it('findActive returns the currently active model', async () => {
    const active = { id: 'v1', isActive: true };
    mockPrisma.modelVersion.findFirst.mockResolvedValue(active);
    const result = await service.findActive();
    expect(result).toEqual(active);
    expect(mockPrisma.modelVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });

  // --- register ---

  describe('register', () => {
    const dto = { versionTag: 'v1.0.0', f1Score: 0.9438, accuracy: 0.9544 };

    it('throws ConflictException when versionTag already exists', async () => {
      mockPrisma.modelVersion.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('creates a new inactive model version', async () => {
      mockPrisma.modelVersion.findUnique.mockResolvedValue(null);
      const created = { id: 'v1', ...dto, isActive: false };
      mockPrisma.modelVersion.create.mockResolvedValue(created);

      const result = await service.register(dto);
      expect(result).toEqual(created);
      expect(mockPrisma.modelVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isActive: false,
            versionTag: 'v1.0.0',
          }),
        }),
      );
    });
  });

  // --- promote ---

  describe('promote', () => {
    it('throws NotFoundException when version not found', async () => {
      mockPrisma.modelVersion.findUnique.mockResolvedValue(null);
      await expect(service.promote('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deactivates all current versions then activates the target', async () => {
      mockPrisma.modelVersion.findUnique
        .mockResolvedValueOnce({ id: 'v2', isActive: false })
        .mockResolvedValueOnce({ id: 'v2', isActive: true });
      mockPrisma.modelVersion.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.modelVersion.update.mockResolvedValue({
        id: 'v2',
        isActive: true,
      });

      await service.promote('v2');

      expect(mockPrisma.modelVersion.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          data: expect.objectContaining({ isActive: false }),
        }),
      );
      expect(mockPrisma.modelVersion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'v2' },
          data: expect.objectContaining({ isActive: true }),
        }),
      );
    });
  });

  // --- rollback ---

  describe('rollback', () => {
    it('throws NotFoundException when target version not found', async () => {
      mockPrisma.modelVersion.findUnique.mockResolvedValue(null);
      await expect(service.rollback('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('marks rollback as isRollback=true', async () => {
      mockPrisma.modelVersion.findUnique
        .mockResolvedValueOnce({ id: 'v1' })
        .mockResolvedValueOnce({ id: 'v1', isActive: true, isRollback: true });
      mockPrisma.modelVersion.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.modelVersion.update.mockResolvedValue({});

      await service.rollback('v1');

      expect(mockPrisma.modelVersion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isRollback: true, isActive: true }),
        }),
      );
    });
  });
});
