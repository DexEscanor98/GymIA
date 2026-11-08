CREATE TABLE "LegalAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT,
    "subscriptionReference" TEXT NOT NULL,
    "flow" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "billingInterval" TEXT NOT NULL DEFAULT 'MONTHLY',
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidence" JSONB NOT NULL,
    CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LegalAcceptance_userId_acceptedAt_idx" ON "LegalAcceptance"("userId", "acceptedAt");
CREATE INDEX "LegalAcceptance_tenantId_acceptedAt_idx" ON "LegalAcceptance"("tenantId", "acceptedAt");
CREATE INDEX "LegalAcceptance_subscriptionReference_idx" ON "LegalAcceptance"("subscriptionReference");
