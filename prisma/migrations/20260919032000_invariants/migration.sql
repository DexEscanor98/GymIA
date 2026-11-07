-- Database backstops: concurrent requests cannot duplicate an open visit or shift.
CREATE UNIQUE INDEX "one_open_visit_per_member" ON "Visit" ("tenantId", "memberId") WHERE "exitedAt" IS NULL;
CREATE UNIQUE INDEX "one_open_shift_per_user" ON "Shift" ("tenantId", "userId") WHERE "closedAt" IS NULL;
CREATE UNIQUE INDEX "one_open_staff_attendance" ON "StaffAttendance" ("tenantId", "userId") WHERE "exitedAt" IS NULL;
CREATE UNIQUE INDEX "one_session_per_day" ON "Appointment" ("tenantId", "memberId", "serviceDay") WHERE "status" <> 'CANCELLED';
CREATE UNIQUE INDEX "one_pending_freeze" ON "FreezeRequest" ("tenantId", "membershipId") WHERE "status" = 'PENDING';
ALTER TABLE "Product" ADD CONSTRAINT "stock_nonnegative" CHECK ("stock" >= 0), ADD CONSTRAINT "price_nonnegative" CHECK ("priceCents" >= 0);
ALTER TABLE "Plan" ADD CONSTRAINT "plan_positive_duration" CHECK ("days" > 0), ADD CONSTRAINT "plan_nonnegative_price" CHECK ("priceCents" >= 0);
ALTER TABLE "Sale" ADD CONSTRAINT "sale_valid_amount" CHECK ("quantity" > 0 AND "unitCents" >= 0 AND "totalCents" = "quantity" * "unitCents");
ALTER TABLE "Appointment" ADD CONSTRAINT "rating_range" CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5);
ALTER TABLE "Membership" ADD CONSTRAINT "membership_dates" CHECK ("endsAt" > "startsAt");
