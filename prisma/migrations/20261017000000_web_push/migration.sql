ALTER TABLE "Notification" ADD COLUMN "pushSentAt" TIMESTAMP(3);

CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushSubscription_tenantId_userId_endpoint_key"
ON "PushSubscription"("tenantId", "userId", "endpoint");

CREATE INDEX "PushSubscription_tenantId_userId_idx"
ON "PushSubscription"("tenantId", "userId");

ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
