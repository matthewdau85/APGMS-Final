import type { ButtonHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "../../lib/utils";

type ButtonVariant = "default" | "outline" | "secondary" | "ghost";
type ButtonSize = "default" | "sm" | "lg" | "icon";

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  default:
    "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/40",
  outline:
    "border border-border bg-transparent text-foreground hover:bg-muted focus-visible:ring-border",
  secondary:
    "bg-muted text-foreground hover:bg-muted/80 focus-visible:ring-muted/60",
  ghost:
    "text-foreground hover:bg-muted focus-visible:ring-muted/60",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  default: "h-10 px-4 py-2 text-sm",
  sm: "h-8 px-3 text-xs",
  lg: "h-11 px-6 text-base",
  icon: "h-10 w-10 p-0",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "default", size = "default", type = "button", ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60",
          VARIANT_STYLES[variant],
          SIZE_STYLES[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
