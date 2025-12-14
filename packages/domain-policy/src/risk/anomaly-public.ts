type RiskBand = "LOW" | "MEDIUM" | "HIGH";

function toNum(v: any): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = v.trim();
    if (t !== "" && /^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  }
  return 0;
}

function getCents(obj: any, keys: string[]): number {
  if (!obj) return 0;
  for (const k of keys) {
    if (obj[k] != null) return Math.trunc(toNum(obj[k]));
  }
  return 0;
}

function pickObligations(o: any): any {
  return o?.obligations ?? o?.obligation ?? o?.due ?? o?.totals ?? o?.total ?? o ?? {};
}

function pickPaid(o: any): any {
  return o?.paid ?? o?.payments ?? o?.remitted ?? o?.settled ?? o?.ledger ?? o?.balances ?? o ?? {};
}

function bandForCoverage(c: number): RiskBand {
  if (c >= 0.95) return "LOW";
  if (c >= 0.6) return "MEDIUM";
  return "HIGH";
}

export async function computeOrgRisk(...args: any[]): Promise<{ riskBand: RiskBand; basCoverageRatio: number; score: number }> {
  // Accept common shapes:
  //  - computeOrgRisk({ obligations, paid })
  //  - computeOrgRisk(obligations, paid)
  let obligations: any = {};
  let paid: any = {};

  const objs = args.filter((x) => x && typeof x === "object");
  if (objs.length >= 2) {
    obligations = objs[0];
    paid = objs[1];
  } else if (objs.length === 1) {
    const one = objs[0];
    obligations = pickObligations(one);
    paid = pickPaid(one);
  }

  const ob = pickObligations(obligations);
  const pd = pickPaid(paid);

  const paygwOb = getCents(ob, ["paygwCents", "paygwDueCents", "paygwObligationCents", "paygwTotalCents"]);
  const gstOb   = getCents(ob, ["gstCents", "gstDueCents", "gstObligationCents", "gstTotalCents"]);

  const paygwPaid = getCents(pd, ["paygwCents", "paygwPaidCents", "paygwRemittedCents", "paygwSettledCents", "paygwHeldCents", "paygwAvailableCents"]);
  const gstPaid   = getCents(pd, ["gstCents", "gstPaidCents", "gstRemittedCents", "gstSettledCents", "gstHeldCents", "gstAvailableCents"]);

  const totalOb = paygwOb + gstOb;
  const totalPaid = paygwPaid + gstPaid;

  const basCoverageRatio = totalOb <= 0 ? 1 : Math.max(0, Math.min(1, totalPaid / totalOb));
  const riskBand = bandForCoverage(basCoverageRatio);
  const score = Math.round((1 - basCoverageRatio) * 100);

  return { riskBand, basCoverageRatio, score };
}
