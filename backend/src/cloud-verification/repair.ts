import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { PrismaModule } from '../../database/prisma.module';
import { AiService } from '../ai/ai.service';
import { CloudVerificationQueue } from './cloud-verification.queue';
import { CloudVerificationService } from './cloud-verification.service';

// Keep the scheduled repair job independent from portal auth, payments and
// provider configuration. It needs only the database, queue identity and the
// service whose repair method it invokes.
@Module({
  imports: [PrismaModule],
  providers: [AiService, CloudVerificationQueue, CloudVerificationService],
})
class CloudVerificationRepairModule {}

async function main() {
  process.env.CLOUD_VERIFY_RUN_CONSUMER = 'false';
  const context = await NestFactory.createApplicationContext(
    CloudVerificationRepairModule,
    {
      logger: ['error', 'warn', 'log'],
    },
  );
  try {
    const result = await context
      .get(CloudVerificationService)
      .repairOutbox(500);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await context.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'repair_failed';
  process.stderr.write(`Cloud verification repair failed: ${message}\n`);
  process.exitCode = 1;
});
