import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateClusterDto } from './create-cluster.dto';

async function errorsFor(lexical: unknown) {
  const dto = plainToInstance(CreateClusterDto, {
    label: 'cluster-1',
    centroid: [0.1],
    lexical,
  });
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}

describe('CreateClusterDto lexical profile', () => {
  it('accepts a v1 template profile', async () => {
    await expect(
      errorsFor({
        version: 1,
        shingles: ['click <url>', 'verify', 'gcash account'],
        memberCount: 12,
      }),
    ).resolves.toHaveLength(0);
  });

  it.each([
    ['an unknown version', { version: 2, shingles: [], memberCount: 1 }],
    [
      'a shingle carrying a URL',
      { version: 1, shingles: ['https://evil.example'], memberCount: 1 },
    ],
    [
      'a shingle carrying a long number',
      { version: 1, shingles: ['acct 12345678'], memberCount: 1 },
    ],
    [
      'a trigram (more than template phrasing)',
      { version: 1, shingles: ['hi juan dela'], memberCount: 1 },
    ],
    [
      'an unexpected field',
      { version: 1, shingles: [], memberCount: 1, domains: ['x.ph'] },
    ],
  ])('rejects %s', async (_name, lexical) => {
    expect((await errorsFor(lexical)).length).toBeGreaterThan(0);
  });
});
