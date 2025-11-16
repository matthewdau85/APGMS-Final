// packages/payments/payto.ts
// PayTo service interface used by banking providers.

export interface PayToService {
  createMandate(accountNumber: string): Promise<string>;
  verifyMandate(mandateId: string): Promise<boolean>;
}
