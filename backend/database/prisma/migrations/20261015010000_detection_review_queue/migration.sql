-- Detection review queue: an admin labels opted-in users' flagged messages
-- as training candidates. Nothing enters the dataset without that review.

-- Training consent (Privacy & data on the phone). Off by default; only
-- messages the server ingested after trainingOptInAt are ever eligible.
ALTER TABLE "User" ADD COLUMN     "trainingOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trainingOptInAt" TIMESTAMP(3);

-- Server ingest time (existing rows get the migration time, which predates
-- any possible opt-in) and the queue's "skip" marker.
ALTER TABLE "SmsMessage" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "reviewDismissedAt" TIMESTAMP(3);

-- A sample confirmed from the queue points at its message; SET NULL keeps the
-- already-copied masked sample if the message or account is deleted.
ALTER TABLE "DatasetSample" ADD COLUMN     "sourceMessageId" TEXT;
CREATE UNIQUE INDEX "DatasetSample_sourceMessageId_key" ON "DatasetSample"("sourceMessageId");
ALTER TABLE "DatasetSample" ADD CONSTRAINT "DatasetSample_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "SmsMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
