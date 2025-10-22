export const fmtCurrency = (n: number) =>
  n.toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0
  });

export const fmtPct = (p: number, digits = 1) => `${p.toFixed(digits)}%`;

export const trendColor = (p: number) => (p >= 0 ? 'text-success' : 'text-danger');
