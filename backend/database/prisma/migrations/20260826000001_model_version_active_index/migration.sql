-- retraining.service.ts queries findFirst({ where: { isActive: true } }) every hour
-- and on every manual trigger. Without an index this is a sequential scan on ModelVersion.
CREATE INDEX "ModelVersion_isActive_idx" ON "ModelVersion"("isActive");
