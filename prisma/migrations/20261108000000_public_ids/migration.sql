ALTER TABLE "User" ADD COLUMN "publicId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "publicId" TEXT;
ALTER TABLE "Branch" ADD COLUMN "publicId" TEXT;

UPDATE "User" AS u
SET "publicId" = COALESCE(
  (SELECT p."publicId" FROM "AthleteProfile" AS p WHERE p."userId" = u."id"),
  'PER-' || upper(substr(md5(u."id"), 1, 20))
);
UPDATE "Tenant"
SET "publicId" = 'GYM-' || upper(substr(md5("id"), 1, 20));
UPDATE "Branch"
SET "publicId" = 'SUC-' || upper(substr(md5("id"), 1, 20));

ALTER TABLE "User" ALTER COLUMN "publicId" SET NOT NULL;
ALTER TABLE "Tenant" ALTER COLUMN "publicId" SET NOT NULL;
ALTER TABLE "Branch" ALTER COLUMN "publicId" SET NOT NULL;

CREATE UNIQUE INDEX "User_publicId_key" ON "User"("publicId");
CREATE UNIQUE INDEX "Tenant_publicId_key" ON "Tenant"("publicId");
CREATE UNIQUE INDEX "Branch_publicId_key" ON "Branch"("publicId");
