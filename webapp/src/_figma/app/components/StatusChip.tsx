import React from 'react';
import { cn } from '../components/ui/utils';
import type { 
  ObligationStatus, 
  AlertStatus, 
  IncidentStatus, 
  PackStatus,
  AlertSeverity,
  IncidentSeverity
} from '../types';

type Status = 
  | ObligationStatus
  | AlertStatus
  | IncidentStatus
  | PackStatus
  | AlertSeverity
  | IncidentSeverity
  | 'success';

interface StatusChipProps {
  status: Status;
  children?: React.ReactNode;
}

const statusStyles: Record<string, string> = {
  // Obligation statuses
  draft: 'bg-muted text-muted-foreground border border-border',
  pending: 'bg-muted text-muted-foreground border-border',
  active: 'bg-[var(--info)] text-[var(--info-foreground)]',
  completed: 'bg-[var(--success)] text-[var(--success-foreground)]',
  overdue: 'bg-destructive text-destructive-foreground',
  submitted: 'bg-accent text-accent-foreground',
  approved: 'bg-[var(--success)] text-[var(--success-foreground)]',
  rejected: 'bg-destructive text-destructive-foreground',
  critical: 'bg-destructive text-destructive-foreground',
  
  // Alert statuses
  open: 'bg-[var(--warning)] text-[var(--warning-foreground)]',
  acknowledged: 'bg-[var(--info)] text-[var(--info-foreground)]',
  resolved: 'bg-[var(--success)] text-[var(--success-foreground)]',
  
  // Incident statuses
  investigating: 'bg-[var(--info)] text-[var(--info-foreground)]',
  closed: 'bg-muted text-muted-foreground',
  
  // Pack statuses
  generating: 'bg-[var(--info)] text-[var(--info-foreground)]',
  ready: 'bg-[var(--success)] text-[var(--success-foreground)]',
  verified: 'bg-[var(--success)] text-[var(--success-foreground)]',
  archived: 'bg-muted text-muted-foreground',
  
  // Severity levels
  warning: 'bg-[var(--warning)] text-[var(--warning-foreground)]',
  info: 'bg-[var(--info)] text-[var(--info-foreground)]',
  high: 'bg-destructive text-destructive-foreground',
  medium: 'bg-[var(--warning)] text-[var(--warning-foreground)]',
  low: 'bg-muted text-muted-foreground',
  
  // Generic
  success: 'bg-[var(--success)] text-[var(--success-foreground)]',
};

const statusLabels: Record<string, string> = {
  // Obligation
  draft: 'Draft',
  pending: 'Pending',
  active: 'Active',
  completed: 'Completed',
  overdue: 'Overdue',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  critical: 'Critical',
  
  // Alert
  open: 'Open',
  acknowledged: 'Acknowledged',
  resolved: 'Resolved',
  
  // Incident
  investigating: 'Investigating',
  closed: 'Closed',
  
  // Pack
  generating: 'Generating',
  ready: 'Ready',
  verified: 'Verified',
  archived: 'Archived',
  
  // Severity
  warning: 'Warning',
  info: 'Info',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  
  success: 'Success',
};

export const StatusChip: React.FC<StatusChipProps> = ({ status, children }) => {
  const statusKey = status as string;
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        statusStyles[statusKey] || statusStyles.pending
      )}
    >
      {children || statusLabels[statusKey] || status}
    </span>
  );
};
