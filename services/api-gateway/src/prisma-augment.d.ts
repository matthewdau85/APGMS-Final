// services/api-gateway/src/prisma-augment.d.ts

// Ensure the module exists so we can augment it
import '@prisma/client';

declare module '@prisma/client' {
  // --- Model types that old code still refers to --------------------------
  // These are used only in types, so `any` is fine for now.
  // Add more here if TS complains about missing exports later.

  // e.g. src/lib/mfa-store.ts used to import this
  type MfaCredential = any;

  // e.g. bank-lines, demo, regulator routes used to import this
  type BankLine = any;

  // Monitoring / evidence used in regulator routes
  type MonitoringSnapshot = any;
  type EvidenceArtifact = any;

  // --- PrismaClient delegate augmentation ---------------------------------
  // The real PrismaClient is a generic class; we declare a matching generic
  // interface so TypeScript will merge these members into it.

  interface PrismaClient<_T = any, _U = any, _V = any> {
    // From src/auth.ts, src/routes/auth.ts
    user: any;

    // From src/lib/audit.ts
    auditLog: any;

    // From src/lib/idempotency.ts
    idempotencyEntry: any;

    // From src/lib/mfa-store.ts and src/routes/auth.ts
    mfaCredential: any;

    // From src/lib/regulator-session.ts
    regulatorSession: any;

    // From bank-lines/regulator/compliance-proxy/demo routes
    bankLine: any;

    // From regulator/compliance-proxy
    basCycle: any;
    paymentPlanRequest: any;
    alert: any;

    // From regulator
    monitoringSnapshot: any;
    evidenceArtifact: any;

    // From compliance-proxy/regulator
    org: any;

    // From demo.ts
    employee: any;
    payRun: any;
    payslip: any;
  }
}
