-- Employees table
CREATE TABLE "Employee" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "fullNameCiphertext" TEXT NOT NULL,
  "fullNameKid" TEXT NOT NULL,
  "tfnProvided" BOOLEAN NOT NULL DEFAULT false,
  "employmentType" TEXT NOT NULL, -- 'full_time' | 'part_time' | 'contractor' | etc.
  "baseRate" NUMERIC(12,2) NOT NULL DEFAULT 0, -- hourly or derived salary rate
  "superRate" NUMERIC(5,2) NOT NULL DEFAULT 11.0,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PayRun table: e.g. "Fortnight ending 2025-11-14"
CREATE TABLE "PayRun" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Org"("id") ON DELETE CASCADE,
  "periodStart" TIMESTAMP WITH TIME ZONE NOT NULL,
  "periodEnd" TIMESTAMP WITH TIME ZONE NOT NULL,
  "paymentDate" TIMESTAMP WITH TIME ZONE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'committed'
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payslip table: amounts per worker inside a run
CREATE TABLE "Payslip" (
  "id" TEXT PRIMARY KEY,
  "payRunId" TEXT NOT NULL REFERENCES "PayRun"("id") ON DELETE CASCADE,
  "employeeId" TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,

  "grossPay" NUMERIC(12,2) NOT NULL,
  "paygWithheld" NUMERIC(12,2) NOT NULL,
  "superAccrued" NUMERIC(12,2) NOT NULL,

  "notesCiphertext" TEXT NOT NULL,
  "notesKid" TEXT NOT NULL,

  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- helpful indexes
CREATE INDEX "Employee_orgId_idx" ON "Employee"("orgId");
CREATE INDEX "PayRun_orgId_idx" ON "PayRun"("orgId");
CREATE INDEX "Payslip_payRunId_idx" ON "Payslip"("payRunId");
CREATE INDEX "Payslip_employeeId_idx" ON "Payslip"("employeeId");
