-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'RECEPTION', 'TRAINER', 'CLIENT');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('BOOKED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#c5f36b',
    "logoUrl" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Mexico_City',
    "capacity" INTEGER NOT NULL DEFAULT 80,
    "comfortableCapacity" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Access" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "userId" TEXT,
    "trainerId" TEXT,
    "preference" TEXT NOT NULL DEFAULT 'ANY',
    "qrToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "days" INTEGER NOT NULL,
    "personalTraining" BOOLEAN NOT NULL DEFAULT false,
    "allBranches" BOOLEAN NOT NULL DEFAULT true,
    "branchIds" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "personalTraining" BOOLEAN NOT NULL DEFAULT false,
    "allBranches" BOOLEAN NOT NULL DEFAULT true,
    "branchIds" TEXT[],
    "frozenAt" TIMESTAMP(3),
    "remainingMs" BIGINT,
    "freezeReason" TEXT,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreezeRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "FreezeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "saleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingCents" INTEGER NOT NULL,
    "countedCents" INTEGER,
    "expectedCents" INTEGER,
    "transferCents" INTEGER,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashMovement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "memberId" TEXT,
    "productId" TEXT,
    "membershipId" TEXT,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "refundShiftId" TEXT,
    "refundMethod" "PaymentMethod",
    "restocked" BOOLEAN,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitedAt" TIMESTAMP(3),
    "actorId" TEXT NOT NULL,
    "automaticExit" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAttendance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitedAt" TIMESTAMP(3),

    CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "serviceDay" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'BOOKED',
    "completedAt" TIMESTAMP(3),
    "rating" INTEGER,
    "comment" TEXT,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "opens" TEXT NOT NULL,
    "closes" TEXT NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleException" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT true,
    "opens" TEXT,
    "closes" TEXT,
    "reason" TEXT NOT NULL,

    CONSTRAINT "ScheduleException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Access_tenantId_userId_key" ON "Access"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "Branch_tenantId_idx" ON "Branch"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_qrToken_key" ON "Member"("qrToken");

-- CreateIndex
CREATE INDEX "Member_tenantId_name_idx" ON "Member"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Member_tenantId_userId_key" ON "Member"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "Plan_tenantId_idx" ON "Plan"("tenantId");

-- CreateIndex
CREATE INDEX "Membership_tenantId_memberId_idx" ON "Membership"("tenantId", "memberId");

-- CreateIndex
CREATE INDEX "FreezeRequest_tenantId_status_idx" ON "FreezeRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Product_tenantId_idx" ON "Product"("tenantId");

-- CreateIndex
CREATE INDEX "StockMovement_tenantId_productId_idx" ON "StockMovement"("tenantId", "productId");

-- CreateIndex
CREATE INDEX "Shift_tenantId_openedAt_idx" ON "Shift"("tenantId", "openedAt");

-- CreateIndex
CREATE INDEX "CashMovement_tenantId_shiftId_idx" ON "CashMovement"("tenantId", "shiftId");

-- CreateIndex
CREATE INDEX "Sale_tenantId_createdAt_idx" ON "Sale"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_tenantId_idempotencyKey_key" ON "Sale"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Visit_tenantId_enteredAt_idx" ON "Visit"("tenantId", "enteredAt");

-- CreateIndex
CREATE INDEX "StaffAttendance_tenantId_userId_idx" ON "StaffAttendance"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "Appointment_tenantId_trainerId_startsAt_idx" ON "Appointment"("tenantId", "trainerId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_tenantId_branchId_weekday_key" ON "Schedule"("tenantId", "branchId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleException_tenantId_branchId_date_key" ON "ScheduleException"("tenantId", "branchId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_tenantId_memberId_idx" ON "Notification"("tenantId", "memberId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Access" ADD CONSTRAINT "Access_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Access" ADD CONSTRAINT "Access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_refundShiftId_fkey" FOREIGN KEY ("refundShiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
