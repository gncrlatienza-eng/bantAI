import { NotFoundException } from '@nestjs/common';
import { ShieldApiScope } from '@prisma/client';
import { ShieldApiKeyService } from './shield-api-key.service';

describe('ShieldApiKeyService', () => {
  const prisma = {
    $transaction: jest.fn((operation: (tx: unknown) => Promise<unknown>) =>
      operation(prisma),
    ),
    shieldApiKey: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new ShieldApiKeyService(prisma as never, audit as never);

  beforeEach(() => jest.clearAllMocks());

  it('returns a secret once while persisting only its digest and masked parts', async () => {
    prisma.shieldApiKey.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'key-1',
        organizationId: data.organizationId,
        name: data.name,
        keyPrefix: data.keyPrefix,
        keySuffix: data.keySuffix,
        scopes: data.scopes,
        status: 'ACTIVE',
        createdAt: new Date(),
      }),
    );
    const created = await service.create('org-1', 'shield-1', {
      name: 'Feed reader',
      scopes: [ShieldApiScope.READ_CAMPAIGNS],
    });
    const data = prisma.shieldApiKey.create.mock.calls[0][0].data;
    expect(created.secret).toMatch(/^bnt_live_[A-Za-z0-9_-]{32,}$/);
    expect(data.secretHash).toMatch(/^[a-f0-9]{64}$/);
    expect(data.secretHash).not.toBe(created.secret);
    expect(JSON.stringify(data)).not.toContain(created.secret);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ keyId: 'key-1' }),
      }),
      prisma,
    );
  });

  it('lists only a tenant’s masked key fields', async () => {
    prisma.shieldApiKey.findMany.mockResolvedValue([]);
    await service.list('org-1');
    const args = prisma.shieldApiKey.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ organizationId: 'org-1' });
    expect(args.select.secretHash).toBeUndefined();
    expect(args.select.keySuffix).toBe(true);
  });

  it('cannot revoke a key belonging to another tenant', async () => {
    prisma.shieldApiKey.findFirst.mockResolvedValue(null);
    await expect(
      service.revoke('org-1', 'other-key', 'shield-1'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.shieldApiKey.findFirst).toHaveBeenCalledWith({
      where: { id: 'other-key', organizationId: 'org-1' },
      select: { id: true },
    });
    expect(prisma.shieldApiKey.update).not.toHaveBeenCalled();
  });
});
