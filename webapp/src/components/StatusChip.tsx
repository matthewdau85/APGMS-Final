import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { cva } from '../lib/cva';
import { cn } from '../lib/utils';

const variantStyles = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  secure: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  monitor: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  info: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  pending: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  inProgress: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20'
} as const;

const dotStyles = {
  active: 'bg-emerald-500',
  secure: 'bg-emerald-500',
  monitor: 'bg-indigo-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
  pending: 'bg-amber-500',
  resolved: 'bg-emerald-500',
  inProgress: 'bg-indigo-500'
} as const;

export type StatusChipVariant = keyof typeof variantStyles;

const statusChipVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium leading-5 ring-1 ring-inset text-nowrap',
  {
    variants: {
      variant: variantStyles
    },
    defaultVariants: {
      variant: 'info'
    }
  }
);

type StatusChipBaseProps = ComponentPropsWithoutRef<'span'>;

export interface StatusChipProps extends StatusChipBaseProps {
  variant?: StatusChipVariant;
  children: ReactNode;
}

export default function StatusChip({
  children,
  className,
  variant = 'info',
  ...props
}: StatusChipProps) {
  return (
    <span className={cn(statusChipVariants({ variant }), className)} {...props}>
      <span aria-hidden className={cn('h-2 w-2 rounded-full', dotStyles[variant])} />
      <span>{children}</span>
    </span>
  );
}
