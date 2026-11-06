import { Injectable } from '@nestjs/common';
import { DefaultAzureCredential } from '@azure/identity';
import { QueueClient } from '@azure/storage-queue';

import { cloudVerificationConfig } from './cloud-verification.config';

@Injectable()
export class CloudVerificationQueue {
  private readonly config = cloudVerificationConfig();
  private readonly queue = this.config.queueUrl
    ? new QueueClient(this.config.queueUrl, new DefaultAzureCredential())
    : null;
  private readonly poisonQueue = this.config.poisonQueueUrl
    ? new QueueClient(this.config.poisonQueueUrl, new DefaultAzureCredential())
    : null;

  configured() {
    return Boolean(this.queue);
  }

  async publish(jobId: string, delaySeconds = 0) {
    if (!this.queue) throw new Error('queue_not_configured');
    await this.queue.sendMessage(JSON.stringify({ jobId }), {
      visibilityTimeout: Math.max(0, delaySeconds),
    });
  }

  async receive() {
    if (!this.queue) return null;
    const response = await this.queue.receiveMessages({
      numberOfMessages: 1,
      visibilityTimeout: this.config.visibilitySeconds,
    });
    return response.receivedMessageItems[0] ?? null;
  }

  async renew(
    messageId: string,
    popReceipt: string,
    visibilitySeconds = this.config.visibilitySeconds,
  ): Promise<string> {
    if (!this.queue) throw new Error('queue_not_configured');
    const result = await this.queue.updateMessage(
      messageId,
      popReceipt,
      undefined,
      visibilitySeconds,
    );
    // Azure normally rotates the receipt on update. Keep the current receipt
    // if an emulator or SDK response omits the optional field.
    return result.popReceipt ?? popReceipt;
  }

  async delete(messageId: string, popReceipt: string) {
    if (!this.queue) throw new Error('queue_not_configured');
    await this.queue.deleteMessage(messageId, popReceipt);
  }

  async poison(jobId: string) {
    if (!this.poisonQueue) return;
    await this.poisonQueue.sendMessage(JSON.stringify({ jobId }));
  }
}
