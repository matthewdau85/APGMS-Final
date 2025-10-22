import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import type { LucideIcon } from "lucide-react";
import {
  DollarSign,
  FileWarning,
  Lock,
  Menu,
  Shield,
  Upload,
  X,
} from "lucide-react";

interface NavItem {
  label: string;
  value: string;
  href: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Overview",
    value: "overview",
    href: "/",
    icon: Shield,
  },
  {
    label: "$ PAYGW",
    value: "paygw",
    href: "/paygw",
    icon: DollarSign,
  },
  {
    label: "$ GST",
    value: "gst",
    href: "/gst",
    icon: DollarSign,
  },
  {
    label: "Compliance",
    value: "compliance",
    href: "/compliance",
    icon: FileWarning,
  },
  {
    label: "Security",
    value: "security",
    href: "/security",
    icon: Lock,
  },
];

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeValue = useMemo(() => {
    const activeItem = NAV_ITEMS.find((item) =>
      item.href === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(item.href)
    );

    return activeItem?.value ?? NAV_ITEMS[0].value;
  }, [location.pathname]);

  const handleValueChange = (value: string) => {
    const target = NAV_ITEMS.find((item) => item.value === value);
    if (target) {
      navigate(target.href);
    }
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-6">
            <span className="rounded-full bg-primary/10 px-4 py-2 text-lg font-semibold tracking-tight text-primary">
              APGMS
            </span>
            <Tabs
              value={activeValue}
              onValueChange={handleValueChange}
              className="hidden md:block"
            >
              <TabsList className="flex gap-1 rounded-full bg-muted/60 p-1">
                {NAV_ITEMS.map((item) => (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label="Toggle navigation menu"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
            <Button className="gap-2 rounded-full bg-primary px-4 py-2 text-primary-foreground shadow-sm hover:bg-primary/90">
              <Upload className="h-4 w-4" />
              Export Data
            </Button>
          </div>
        </div>
        <div className={`${mobileOpen ? "block" : "hidden"} border-t border-border/60 bg-background/95 px-4 pb-4 pt-2 md:hidden`}>
          <Tabs value={activeValue} onValueChange={handleValueChange} className="w-full">
            <TabsList className="flex w-full flex-col gap-2 bg-transparent p-0">
              {NAV_ITEMS.map((item) => (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className="flex w-full items-center gap-3 rounded-full border border-border/60 px-4 py-2 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}

export default AppShell;
