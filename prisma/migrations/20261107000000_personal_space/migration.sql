CREATE TYPE "AthletePlan" AS ENUM ('FREE', 'COACH');
CREATE TYPE "AthleteSubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELLED');

CREATE TABLE "AthleteProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "goal" TEXT NOT NULL DEFAULT 'Mejorar mi condición',
  "weightKg" INTEGER,
  "heightCm" INTEGER,
  "dailyCalories" INTEGER NOT NULL DEFAULT 2000,
  "proteinGrams" INTEGER NOT NULL DEFAULT 120,
  "carbsGrams" INTEGER NOT NULL DEFAULT 220,
  "fatGrams" INTEGER NOT NULL DEFAULT 65,
  "personalPlan" "AthletePlan" NOT NULL DEFAULT 'FREE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AthleteProfile_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AthleteNote" (
  "id" TEXT NOT NULL, "profileId" TEXT NOT NULL, "title" TEXT NOT NULL, "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AthleteNote_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AthleteRoutine" (
  "id" TEXT NOT NULL, "profileId" TEXT NOT NULL, "title" TEXT NOT NULL, "details" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AthleteRoutine_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AthleteWorkout" (
  "id" TEXT NOT NULL, "profileId" TEXT NOT NULL, "title" TEXT NOT NULL, "startsAt" TIMESTAMP(3) NOT NULL,
  "durationMinutes" INTEGER NOT NULL DEFAULT 60, "notes" TEXT, "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AthleteWorkout_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AthleteMeal" (
  "id" TEXT NOT NULL, "profileId" TEXT NOT NULL, "eatenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "mealName" TEXT NOT NULL, "foods" TEXT NOT NULL, "calories" INTEGER NOT NULL,
  "proteinGrams" INTEGER NOT NULL, "carbsGrams" INTEGER NOT NULL, "fatGrams" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AthleteMeal_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CoachMessage" (
  "id" TEXT NOT NULL, "profileId" TEXT NOT NULL, "question" TEXT NOT NULL, "answer" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoachMessage_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "NutritionistRequest" (
  "id" TEXT NOT NULL, "profileId" TEXT NOT NULL, "goal" TEXT NOT NULL, "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NutritionistRequest_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AthleteSubscription" (
  "id" TEXT NOT NULL, "profileId" TEXT NOT NULL,
  "status" "AthleteSubscriptionStatus" NOT NULL DEFAULT 'PENDING', "amountCents" INTEGER NOT NULL,
  "externalReference" TEXT NOT NULL, "mpPreapprovalId" TEXT, "checkoutUrl" TEXT, "currentPeriodEnd" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AthleteSubscription_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AthletePayment" (
  "id" TEXT NOT NULL, "subscriptionId" TEXT NOT NULL, "providerPaymentId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL, "status" TEXT NOT NULL, "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AthletePayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AthleteProfile_userId_key" ON "AthleteProfile"("userId");
CREATE UNIQUE INDEX "AthleteProfile_publicId_key" ON "AthleteProfile"("publicId");
CREATE INDEX "AthleteNote_profileId_createdAt_idx" ON "AthleteNote"("profileId", "createdAt");
CREATE INDEX "AthleteRoutine_profileId_createdAt_idx" ON "AthleteRoutine"("profileId", "createdAt");
CREATE INDEX "AthleteWorkout_profileId_startsAt_idx" ON "AthleteWorkout"("profileId", "startsAt");
CREATE INDEX "AthleteMeal_profileId_eatenAt_idx" ON "AthleteMeal"("profileId", "eatenAt");
CREATE INDEX "CoachMessage_profileId_createdAt_idx" ON "CoachMessage"("profileId", "createdAt");
CREATE INDEX "NutritionistRequest_profileId_createdAt_idx" ON "NutritionistRequest"("profileId", "createdAt");
CREATE UNIQUE INDEX "AthleteSubscription_externalReference_key" ON "AthleteSubscription"("externalReference");
CREATE UNIQUE INDEX "AthleteSubscription_mpPreapprovalId_key" ON "AthleteSubscription"("mpPreapprovalId");
CREATE INDEX "AthleteSubscription_profileId_status_idx" ON "AthleteSubscription"("profileId", "status");
CREATE UNIQUE INDEX "AthletePayment_providerPaymentId_key" ON "AthletePayment"("providerPaymentId");
CREATE INDEX "AthletePayment_subscriptionId_status_idx" ON "AthletePayment"("subscriptionId", "status");

ALTER TABLE "AthleteProfile" ADD CONSTRAINT "AthleteProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AthleteNote" ADD CONSTRAINT "AthleteNote_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AthleteRoutine" ADD CONSTRAINT "AthleteRoutine_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AthleteWorkout" ADD CONSTRAINT "AthleteWorkout_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AthleteMeal" ADD CONSTRAINT "AthleteMeal_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoachMessage" ADD CONSTRAINT "CoachMessage_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NutritionistRequest" ADD CONSTRAINT "NutritionistRequest_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AthleteSubscription" ADD CONSTRAINT "AthleteSubscription_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AthletePayment" ADD CONSTRAINT "AthletePayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "AthleteSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
