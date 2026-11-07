CREATE TABLE "TenantLogo" (
  "tenantId" TEXT PRIMARY KEY REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "data" BYTEA NOT NULL CHECK (octet_length("data") <= 262144),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
