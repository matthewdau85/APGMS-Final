import type { AbrLookupClient, AbnDetails } from "./types.js";

function isValidAbn(abn: string): boolean {
  const s = String(abn).replace(/\s+/g, "");
  if (!/^\d{11}$/.test(s)) return false;

  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits = s.split("").map((c) => Number(c));
  digits[0] = digits[0] - 1;

  let sum = 0;
  for (let i = 0; i < 11; i++) sum += digits[i] * weights[i];
  return sum % 89 === 0;
}

export function createStubAbrClient(): AbrLookupClient {
  return {
    async lookupAbn(abn: string): Promise<AbnDetails> {
      const valid = isValidAbn(abn);
      return {
        abn,
        isValid: valid,
        entityStatus: valid ? "ACTIVE" : "UNKNOWN",
        entityName: valid ? "STUB ENTITY" : undefined,
        raw: { stub: true },
      };
    },
  };
}
