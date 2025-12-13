export type AbnEntityStatus = "ACTIVE" | "CANCELLED" | "UNKNOWN" | string;

export type AbnDetails = {
  abn: string;
  isValid: boolean;
  entityName?: string;
  entityStatus?: AbnEntityStatus;
  raw?: unknown;
};

export interface AbrLookupClient {
  lookupAbn(abn: string): Promise<AbnDetails>;
}
