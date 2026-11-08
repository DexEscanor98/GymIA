ALTER TABLE "User"
  ADD COLUMN "phoneNumber" TEXT,
  ADD COLUMN "phoneNumberVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pendingPhoneNumber" TEXT;

CREATE TABLE "AppNotification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tenantId" TEXT,
  "kind" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  "pushSentAt" TIMESTAMP(3),
  CONSTRAINT "AppNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppNotification_dedupeKey_key" ON "AppNotification"("dedupeKey");
CREATE INDEX "AppNotification_userId_createdAt_idx" ON "AppNotification"("userId", "createdAt");
CREATE INDEX "AppNotification_tenantId_createdAt_idx" ON "AppNotification"("tenantId", "createdAt");
