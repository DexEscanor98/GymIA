ALTER TABLE "User"
ADD COLUMN "gymAccessPendingVerification" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "User"
ADD COLUMN "gymInviteNeedsPasswordSetup" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Sale"
ADD COLUMN "offlineRecordedAt" TIMESTAMP(3);
