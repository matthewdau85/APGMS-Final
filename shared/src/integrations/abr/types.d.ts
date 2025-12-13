export type AbnDetails = {
  abn: string;
  isValid: boolean;
  entityName?: string;
  entityStatus?: string;
  raw?: unknown;
};

export type AbrLookupClient = {
  lookupAbn(abn: string): Promise<AbnDetails>;
};

export type AbrMode = "auto" | "http" | "stub";

export type AbrEnv = {
  mode: AbrMode;
  baseUrl?: string;
  apiKey?: string;
  timeoutMs: number;
};
