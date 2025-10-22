import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";
import { createContext, useContext } from "react";
import { cn } from "../../lib/utils";

interface TabsContextValue {
  value: string;
  onValueChange?: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

function useTabsContext(component: string): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error(`${component} must be used within Tabs`);
  }
  return context;
}

export interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
}

export function Tabs({ value, onValueChange, className, children }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function TabsList({ className, children, ...props }: TabsListProps) {
  return (
    <div
      role="tablist"
      className={cn("flex items-center gap-2", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function TabsTrigger({
  value,
  className,
  children,
  onClick,
  type = "button",
  ...props
}: TabsTriggerProps) {
  const { value: activeValue, onValueChange } = useTabsContext("TabsTrigger");
  const isActive = activeValue === value;

  return (
    <button
      type={type}
      role="tab"
      aria-selected={isActive}
      data-state={isActive ? "active" : "inactive"}
      onClick={(event) => {
        onValueChange?.(value);
        onClick?.(event);
      }}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[state=active]:shadow",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  children: ReactNode;
}

export function TabsContent({ value, className, children, ...props }: TabsContentProps) {
  const { value: activeValue } = useTabsContext("TabsContent");
  if (activeValue !== value) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      data-state="active"
      className={cn("mt-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}
