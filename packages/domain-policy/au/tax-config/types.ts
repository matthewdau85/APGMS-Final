export type AuTaxType = "PAYGW" | "GST" | "HELP" | "STSL";

export type AuTaxRateTableKind =
  | "PAYGW_WITHHOLDING"
  | "GST_RULES"
  | "HELP_STSL_SCHEDULE";

export type TaxConfigStatus = "DRAFT" | "ACTIVE" | "RETIRED";

export type AuTaxRateTable = {
  kind: AuTaxRateTableKind;
  payload: unknown;
  payloadHash?: string | null;
  name?: string | null;
};

export type AuTaxParameterSet = {
  id: string;
  taxType: AuTaxType;
  status: TaxConfigStatus;
  effectiveFrom: Date;
  effectiveTo?: Date | null;

  sourceName: string;
  sourceRef?: string | null;
  sourceHash: string;
  retrievedAt?: Date | null;

  tables: AuTaxRateTable[];
};
