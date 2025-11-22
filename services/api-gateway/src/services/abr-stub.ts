export type AbnTfnLookupInput = {
  abn?: string;
  tfn?: string;
};

export type AbnTfnLookupResult = {
  abn?: string;
  tfn?: string;
  legalName: string;
  obligations: Array<"GST" | "PAYGW" | "PAYGI">;
};

/**
 * Placeholder ABN/TFN validator.
 * Replace later with real ATO/ABR integration.
 */
export async function validateAbnOrTfnStub(
  input: AbnTfnLookupInput,
): Promise<AbnTfnLookupResult> {
  const abn = input.abn ?? "00000000000";
  const tfn = input.tfn;

  const obligations: Array<"GST" | "PAYGW" | "PAYGI"> = ["GST", "PAYGW"];
  if (Number(abn[abn.length - 1] ?? "0") % 2 === 0) {
    obligations.push("PAYGI");
  }

  return {
    abn,
    tfn,
    legalName: `Stubbed Entity ${abn.slice(-4)}`,
    obligations,
  };
}
