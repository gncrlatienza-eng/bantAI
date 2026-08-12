-- CreateTable
CREATE TABLE "UserReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "originalLabel" TEXT NOT NULL,
    "reportedLabel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelVersion" (
    "id" TEXT NOT NULL,
    "versionTag" TEXT NOT NULL,
    "f1Score" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isRollback" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "promotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rolledBackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserReport_userId_messageId_key" ON "UserReport"("userId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelVersion_versionTag_key" ON "ModelVersion"("versionTag");

-- AddForeignKey
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "SmsMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
