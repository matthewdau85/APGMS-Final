export type StatusBadgeVariant = 'active' | 'monitoring' | 'pending';

export const statusBadgeClasses = {
  root: 'status-badge',
  label: 'status-badge__label',
  hint: 'status-badge__hint',
  variants: {
    active: 'status-badge--active',
    monitoring: 'status-badge--monitoring',
    pending: 'status-badge--pending'
  } satisfies Record<StatusBadgeVariant, string>
};

export type StatusBadgeProps = {
  variant: StatusBadgeVariant;
  label: string;
  hint?: string;
  ariaLabel?: string;
};

export function StatusBadge({ variant, label, hint, ariaLabel }: StatusBadgeProps) {
  return (
    <span
      className={`${statusBadgeClasses.root} ${statusBadgeClasses.variants[variant]}`}
      aria-label={ariaLabel}
    >
      <span className={statusBadgeClasses.label}>{label}</span>
      {hint ? <span className={statusBadgeClasses.hint}>{hint}</span> : null}
    </span>
  );
}

export default StatusBadge;
