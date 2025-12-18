export interface AuTaxConfigProvider {
  getActiveParameterSetWithTables(input: {
    taxType: "PAYGW" | "GST";
    onDate: Date;
  }): Promise<any>;
}

export const auTaxConfigProvider: AuTaxConfigProvider = {
  async getActiveParameterSetWithTables({
    taxType,
    onDate,
  }: {
    taxType: "PAYGW" | "GST";
    onDate: Date;
  }) {
    // Placeholder: real implementation will fetch from registry/config service
    throw new Error(
      `No tax config available for ${taxType} on ${onDate.toISOString()}`,
    );
  },
};
