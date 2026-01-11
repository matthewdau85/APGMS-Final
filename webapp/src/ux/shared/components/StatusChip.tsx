import React from 'react';
import { cn } from './ui/utils';

type Status = 
  | 'pending' 
  | 'active' 
  | 'completed' 
  | 'overdue' 
  | 'critical' 
  | 'warning' 
  | 'info' 
  | 'success'
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected';

interface StatusChipProps {
  status: Status;
  children?: React.ReactNode;
}

const statusStyles: Record<Status, string> = {
  pending: 'bg-muted text-muted-foreground border-border',
  active: 'bg-[var(--info)] text-[var(--info-foreground)]',
  completed: 'bg-[var(--success)] text-[var(--success-foreground)]',
  overdue: 'bg-destructive text-destructive-foreground',
  critical: 'bg-destructive text-destructive-foreground',
  warning: 'bg-[var(--warning)] text-[var(--warning-foreground)]',
  info: 'bg-[var(--info)] text-[var(--info-foreground)]',
  success: 'bg-[var(--success)] text-[var(--success-foreground)]',
  draft: 'bg-muted text-muted-foreground border border-border',
  submitted: 'bg-accent text-accent-foreground',
  approved: 'bg-[var(--success)] text-[var(--success-foreground)]',
  rejected: 'bg-destructive text-destructive-foreground',
};

const statusLabels: Record<Status, string> = {
  pending: 'Pending',
  active: 'Active',
  completed: 'Completed',
  overdue: 'Overdue',
  critical: 'Critical',
  warning: 'Warning',
  info: 'Info',
  success: 'Success',
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const StatusChip: React.FC<StatusChipProps> = ({ status, children }) => {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        statusStyles[status]
      )}
    >
      {children || statusLabels[status]}
    </span>
  );
};
