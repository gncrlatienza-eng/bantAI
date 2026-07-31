-- AlterTable
ALTER TABLE "MessageFeature" ADD COLUMN     "suppressedLinks" TEXT[];

-- AlterTable
ALTER TABLE "SmsMessage" ADD COLUMN     "clusterId" TEXT;

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignCluster" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "centroid" JSONB,
    "urlDomains" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExplainableIndicator" (
    "id" TEXT NOT NULL,
    "classificationId" TEXT NOT NULL,
    "indicators" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExplainableIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedNumber" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SenderVerificationCache" (
    "id" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SenderVerificationCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contact_userId_phone_key" ON "Contact"("userId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "ExplainableIndicator_classificationId_key" ON "ExplainableIndicator"("classificationId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedNumber_userId_sender_key" ON "BlockedNumber"("userId", "sender");

-- CreateIndex
CREATE UNIQUE INDEX "SenderVerificationCache_sender_key" ON "SenderVerificationCache"("sender");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "CampaignCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExplainableIndicator" ADD CONSTRAINT "ExplainableIndicator_classificationId_fkey" FOREIGN KEY ("classificationId") REFERENCES "Classification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedNumber" ADD CONSTRAINT "BlockedNumber_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
