import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HomePage from '../Home';

describe('HomePage', () => {
  it('renders the primary heading and key workflow labels', () => {
    render(<HomePage />);

    expect(
      screen.getByRole('heading', { level: 1, name: /portfolio pulse/i })
    ).toBeInTheDocument();

    const metricsSection = screen.getByLabelText(/key metrics/i);
    expect(
      within(metricsSection).getByRole('heading', { level: 2, name: /active mandates/i })
    ).toBeInTheDocument();
    expect(
      within(metricsSection).getByRole('heading', {
        level: 2,
        name: /total committed capital/i
      })
    ).toBeInTheDocument();

    const activitySection = screen.getByLabelText(/latest activity/i);
    expect(
      within(activitySection).getByRole('heading', { level: 2, name: /workflow alerts/i })
    ).toBeInTheDocument();
    expect(
      within(activitySection).getByText(
        /curated tasks across deal teams and syndicate partners/i
      )
    ).toBeInTheDocument();
  });
});
