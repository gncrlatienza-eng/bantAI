-- Sprint 5 hardening: validatedAt column + performance indexes (WBS 5.2.1, 5.3.1, 5.3.3)

-- Tracks the exact timestamp when a UserReport transitions to Validated.
-- Previously only updatedAt was available, which is imprecise (updatedAt also
-- changes on adminNote edits). The AI retraining pipeline uses this to filter
-- reports validated since the last model promotion.
ALTER TABLE "UserReport" ADD COLUMN "validatedAt" TIMESTAMP(3);

-- Indexes on hot-path query columns:

-- OtpCode: auth.service.ts looks up by phone + verified on every OTP request/verify
CREATE INDEX "OtpCode_phone_verified_idx" ON "OtpCode"("phone", "verified");

-- SmsMessage: every message query filters by userId; receivedAt is the sort key
CREATE INDEX "SmsMessage_userId_receivedAt_idx" ON "SmsMessage"("userId", "receivedAt");

-- Alert: sms.service.ts joins alerts to messages; status filtered in getAlerts()
CREATE INDEX "Alert_messageId_idx" ON "Alert"("messageId");
CREATE INDEX "Alert_status_idx" ON "Alert"("status");

-- Classification: retraining.service.ts scans createdAt >= lastPromotedAt (up to 2000 rows)
CREATE INDEX "Classification_createdAt_idx" ON "Classification"("createdAt");

-- CampaignCluster: campaigns.service.ts always filters WHERE isActive = true
CREATE INDEX "CampaignCluster_isActive_idx" ON "CampaignCluster"("isActive");

-- UserReport: retraining trigger and countValidatedSince filter by status + validatedAt
-- (validatedAt is the precise field; updatedAt would also bump on adminNote edits)
CREATE INDEX "UserReport_status_validatedAt_idx" ON "UserReport"("status", "validatedAt");
