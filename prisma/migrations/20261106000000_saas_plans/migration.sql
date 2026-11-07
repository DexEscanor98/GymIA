CREATE TYPE "SaasPlan" AS ENUM ('FREE', 'LITE', 'BASIC', 'STANDARD', 'PREMIUM');
CREATE TYPE "SaasSubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'PAST_DUE', 'CANCELLED');

ALTER TABLE "Tenant" ADD COLUMN "saasPlan" "SaasPlan" NOT NULL DEFAULT 'FREE';
ALTER TABLE "Tenant" ADD COLUMN "subscriptionExpiresAt" TIMESTAMP(3);

CREATE TABLE "SaasSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plan" "SaasPlan" NOT NULL,
    "status" "SaasSubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "externalReference" TEXT NOT NULL,
    "mpPreapprovalId" TEXT,
    "checkoutUrl" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SaasSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaasPayment" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "providerPaymentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaasPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SaasSubscription_externalReference_key" ON "SaasSubscription"("externalReference");
CREATE UNIQUE INDEX "SaasSubscription_mpPreapprovalId_key" ON "SaasSubscription"("mpPreapprovalId");
CREATE INDEX "SaasSubscription_tenantId_status_idx" ON "SaasSubscription"("tenantId", "status");
CREATE UNIQUE INDEX "SaasPayment_providerPaymentId_key" ON "SaasPayment"("providerPaymentId");
CREATE INDEX "SaasPayment_subscriptionId_status_idx" ON "SaasPayment"("subscriptionId", "status");

ALTER TABLE "SaasSubscription" ADD CONSTRAINT "SaasSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaasPayment" ADD CONSTRAINT "SaasPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "SaasSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
