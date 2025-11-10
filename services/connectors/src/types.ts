export interface OAuthClientConfig {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
  audience?: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
  scope?: string;
  received_at: number;
}

export type ConnectorEnvironment = "sandbox" | "production";

export interface BankingConnectorConfig {
  oauth: OAuthClientConfig;
  apiBaseUrl: string;
  signingCert: string;
  environment: ConnectorEnvironment;
}

export interface PayrollConnectorConfig {
  oauth: OAuthClientConfig;
  apiBaseUrl: string;
  signingCert: string;
  environment: ConnectorEnvironment;
}

export interface PosConnectorConfig {
  oauth: OAuthClientConfig;
  apiBaseUrl: string;
  signingCert: string;
  environment: ConnectorEnvironment;
}

export interface SignedPayload {
  id: string;
  payload: unknown;
  issuedAt: string;
  signature: string;
  signatureHeader?: string;
}

export interface ReplayProtectionStore {
  has(id: string): Promise<boolean> | boolean;
  store(id: string, expiresAt: number): Promise<void> | void;
  purge?(now?: number): Promise<void> | void;
}

export interface ConnectorSubmissionResult {
  submissionId: string;
  status: "queued" | "submitted" | "settled";
  submittedAt: string;
  metadata?: Record<string, unknown>;
}

export interface ConnectorFetchOptions {
  since?: string;
  until?: string;
  limit?: number;
}

export interface BankingTransaction {
  id: string;
  occurredAt: string;
  amountCents: number;
  currency: string;
  counterparty: string;
  description?: string;
  externalReference?: string;
}

export interface PayrollEvent {
  id: string;
  payRunReference: string;
  grossAmountCents: number;
  paygWithheldCents: number;
  superAccruedCents: number;
  paidAt: string;
  employeeCount: number;
}

export interface PosSettlement {
  id: string;
  settlementDate: string;
  grossTakingsCents: number;
  gstCollectedCents: number;
  cardVolumeCents: number;
  cashVolumeCents: number;
}

