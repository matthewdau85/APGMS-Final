import { type ReactNode } from 'react';
import './VarianceBadge.css';
import type { VarianceTone } from '../store/useKpiStore';

type VarianceBadgeProps = {
  tone?: VarianceTone;
  children: ReactNode;
};

const icons: Record<VarianceTone, JSX.Element> = {
  positive: (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="variance-badge__icon">
      <path
        d="M8 2.5a.75.75 0 0 1 .53.22l4.25 4.25a.75.75 0 1 1-1.06 1.06L8.75 5.91v7.34a.75.75 0 0 1-1.5 0V5.9L4.28 8.03a.75.75 0 0 1-1.06-1.06l4.25-4.25A.75.75 0 0 1 8 2.5Z"
        fill="currentColor"
      />
    </svg>
  ),
  negative: (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="variance-badge__icon">
      <path
        d="M8 13.5a.75.75 0 0 1-.53-.22L3.22 9.03a.75.75 0 1 1 1.06-1.06l2.66 2.66V3.28a.75.75 0 0 1 1.5 0v7.35l2.66-2.66a.75.75 0 0 1 1.06 1.06l-4.25 4.25A.75.75 0 0 1 8 13.5Z"
        fill="currentColor"
      />
    </svg>
  ),
  neutral: (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="variance-badge__icon">
      <path d="M3.5 8.75h9a.75.75 0 0 0 0-1.5h-9a.75.75 0 0 0 0 1.5Z" fill="currentColor" />
    </svg>
  )
};

export function VarianceBadge({ tone = 'neutral', children }: VarianceBadgeProps) {
  return (
    <span className={`variance-badge variance-badge--${tone}`}>
      {icons[tone]}
      <span>{children}</span>
    </span>
  );
}
