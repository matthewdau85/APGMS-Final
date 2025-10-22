const DEFAULT_LOCALE = 'en-AU';

const DEFAULT_CURRENCY_OPTIONS: Intl.NumberFormatOptions = {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
};

/**
 * Format a numeric value as an Australian dollar currency string.
 */
export function fmtCurrency(
  value: number,
  options: Intl.NumberFormatOptions = {},
  locale: string = DEFAULT_LOCALE
): string {
  const formatter = new Intl.NumberFormat(locale, {
    ...DEFAULT_CURRENCY_OPTIONS,
    ...options
  });

  return formatter.format(value);
}
