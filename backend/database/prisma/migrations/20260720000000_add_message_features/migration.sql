-- CreateTable
CREATE TABLE "MessageFeature" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "normalizedBody" TEXT NOT NULL,
    "maskedBody" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageFeature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageFeature_messageId_key" ON "MessageFeature"("messageId");

-- AddForeignKey
ALTER TABLE "MessageFeature" ADD CONSTRAINT "MessageFeature_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "SmsMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
