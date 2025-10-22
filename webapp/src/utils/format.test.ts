import { describe, expect, it } from 'vitest';
import { fmtCurrency } from './format';

describe('fmtCurrency', () => {
  it('formats whole numbers as Australian dollars without cents', () => {
    expect(fmtCurrency(202000)).toBe('$202,000');
  });
});
