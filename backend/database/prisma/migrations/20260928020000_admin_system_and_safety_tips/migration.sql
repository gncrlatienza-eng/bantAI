CREATE TABLE "SafetyTip" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "region" TEXT,
    "campaign" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafetyTip_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SafetyTip_isPublished_updatedAt_idx"
ON "SafetyTip"("isPublished", "updatedAt");
