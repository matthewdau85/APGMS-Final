import './DeadlineCapsule.css';

type DeadlineCapsuleProps = {
  daysRemaining: number;
  label: string;
};

export function DeadlineCapsule({ daysRemaining, label }: DeadlineCapsuleProps) {
  return (
    <span className="deadline-capsule" aria-live="polite">
      <svg aria-hidden="true" viewBox="0 0 16 16" className="deadline-capsule__icon">
        <path
          d="M5 2.25a.75.75 0 0 1 1.5 0V3h3V2.25a.75.75 0 0 1 1.5 0V3h.75A1.75 1.75 0 0 1 13.5 4.75v7.5A1.75 1.75 0 0 1 11.75 14h-7.5A1.75 1.75 0 0 1 2.5 12.25v-7.5A1.75 1.75 0 0 1 4.25 3H5Zm6.75 3H4.25a.25.25 0 0 0-.25.25v6.75c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25V5.25a.25.25 0 0 0-.25-.25Z"
          fill="currentColor"
        />
      </svg>
      <span>
        <strong>{daysRemaining} days</strong> {label}
      </span>
    </span>
  );
}
