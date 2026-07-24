-- AlterTable
ALTER TABLE "Classification" ADD COLUMN "bucket" TEXT;
ALTER TABLE "Classification" ADD COLUMN "scores" JSONB;
