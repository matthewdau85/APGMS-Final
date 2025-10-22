import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BankLinesPage from '../BankLines';

describe('BankLinesPage', () => {
  it('renders the portfolio visibility heading and lender labels', () => {
    render(<BankLinesPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: /bank line visibility/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: /export exposure report/i })
    ).toBeInTheDocument();

    const table = screen.getByRole('table', {
      name: /breakdown of bank line utilization and statuses/i
    });

    expect(within(table).getByRole('columnheader', { name: /lender/i })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: /limit/i })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: /status/i })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: /notes/i })).toBeInTheDocument();
  });
});
