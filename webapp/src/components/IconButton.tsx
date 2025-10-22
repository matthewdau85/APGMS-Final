import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import './IconButton.css';

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, children, type = 'button', className = '', ...props }, ref) => (
    <button
      {...props}
      ref={ref}
      type={type}
      className={`icon-button ${className}`.trim()}
      aria-label={label}
    >
      {children}
    </button>
  )
);

IconButton.displayName = 'IconButton';
