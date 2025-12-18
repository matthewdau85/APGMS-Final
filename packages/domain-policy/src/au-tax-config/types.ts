// packages/domain-policy/src/au-tax-config/types.ts

export type AuTaxType = "PAYGW" | "GST" | "HELP" | "STSL";

export type AuTaxRateTableKind =
  | "PAYGW_WITHHOLDING"
  | "GST_RULES"
  | "HELP_STSL_SCHEDULE";

export type TaxConfigStatus = "DRAFT" | "ACTIVE" | "RETIRED";

export type AuTaxRateTable = {
  id?: string;
  kind: AuTaxRateTableKind;
  name?: string | null;
  payload: unknown;
  payloadHash?: string | null;
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

export type AuTaxConfigProvider = {
  findActiveParameterSet(args: {
    taxType: AuTaxType;
    asOf: Date;
  }): Promise<AuTaxParameterSet | null>;
};
