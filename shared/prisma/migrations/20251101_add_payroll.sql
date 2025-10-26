-- Employee table
CREATE TABLE IF NOT EXISTS "Employee" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "fullNameCiphertext" TEXT NOT NULL,
  "fullNameKid" TEXT NOT NULL,
  "tfnProvided" BOOLEAN NOT NULL DEFAULT FALSE,
  "employmentType" TEXT NOT NULL,
  "baseRate" NUMERIC(12,2) NOT NULL,
  "superRate" NUMERIC(5,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "Employee_orgId_fkey" FOREIGN KEY ("orgId")
    REFERENCES "Org"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "Employee_orgId_idx"
  ON "Employee"("orgId");

-- PayRun table
CREATE TABLE IF NOT EXISTS "PayRun" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "periodStart" TIMESTAMPTZ NOT NULL,
  "periodEnd" TIMESTAMPTZ NOT NULL,
  "paymentDate" TIMESTAMPTZ NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "PayRun_orgId_fkey" FOREIGN KEY ("orgId")
    REFERENCES "Org"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "PayRun_orgId_idx"
  ON "PayRun"("orgId");

-- Payslip table
CREATE TABLE IF NOT EXISTS "Payslip" (
  "id" TEXT PRIMARY KEY,
  "payRunId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "grossPay" NUMERIC(12,2) NOT NULL,
  "paygWithheld" NUMERIC(12,2) NOT NULL,
  "superAccrued" NUMERIC(12,2) NOT NULL,
  "notesCiphertext" TEXT NOT NULL,
  "notesKid" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "Payslip_payRunId_fkey" FOREIGN KEY ("payRunId")
    REFERENCES "PayRun"("id") ON DELETE CASCADE,

  CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId")
    REFERENCES "Employee"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "Payslip_payRunId_idx"
  ON "Payslip"("payRunId");

CREATE INDEX IF NOT EXISTS "Payslip_employeeId_idx"
  ON "Payslip"("employeeId");
