// packages/regwatcher/src/targets.ts
export type RegwatcherTarget = {
  id: string;
  url: string;
  kind: "html";
  enabled: boolean;
};

export const TARGETS: RegwatcherTarget[] = [
  {
    id: "ato-whats-new",
    url: "https://www.ato.gov.au/whats-new",
    kind: "html",
    enabled: true,
  },
  {
    id: "ato-tax-professionals-newsroom",
    url: "https://www.ato.gov.au/Tax-professionals/Newsroom",
    kind: "html",
    enabled: true,
  },
  {
    id: "ato-paygw-overview",
    url: "https://www.ato.gov.au/business/payg-withholding",
    kind: "html",
    enabled: true,
  },
];
