import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Shield,
  Wallet,
  AlertTriangle,
  Settings,
  HelpCircle,
  Wand2,
  Scale,
  Search,
} from "lucide-react";

import { useApp } from "../hooks/AppContext";
import { Button } from "./ui/button";
import { HelpDrawer } from "./HelpDrawer";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

type NavItem = { label: string; href: string; icon: React.ReactNode };

function joinBase(basePath: string, href: string): string {
  const base = basePath === "/" ? "" : basePath.replace(/\/+$/, "");
  if (href === "/") return base || "/";
  const h = href.startsWith("/") ? href : `/${href}`;
  return `${base}${h}`;
}

function normalizePath(p: string): string {
  if (p.length > 1) return p.replace(/\/+$/, "");
  return p;
}

export function Layout({
  children,
  basePath = "",
}: {
  children: React.ReactNode;
  basePath?: string;
}) {
  const location = useLocation();
  const nav = useNavigate();
  const { theme, setTheme, density, setDensity, setHelpOpen } = useApp();
  const [query, setQuery] = useState("");

  const navItems: NavItem[] = useMemo(
    () => [
      { label: "Dashboard", href: "/", icon: <LayoutDashboard className="w-4 h-4" /> },
      { label: "Obligations", href: "/obligations", icon: <Calendar className="w-4 h-4" /> },
      { label: "Evidence Packs", href: "/evidence-packs", icon: <FileText className="w-4 h-4" /> },
      { label: "Controls & Policies", href: "/controls", icon: <Shield className="w-4 h-4" /> },
      { label: "Payments", href: "/payments", icon: <Wallet className="w-4 h-4" /> },
      { label: "Incidents", href: "/incidents", icon: <AlertTriangle className="w-4 h-4" /> },
      { label: "Settings", href: "/settings", icon: <Settings className="w-4 h-4" /> },

      // Minimum required "missing" pages
      { label: "Setup Wizard", href: "/setup", icon: <Wand2 className="w-4 h-4" /> },
      { label: "Regulator Portal", href: "/regulator", icon: <Scale className="w-4 h-4" /> },
    ],
    []
  );

  const currentPath = normalizePath(location.pathname);

  const Sidebar = () => (
    <div className="w-64 bg-background border-r h-full flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-xl font-semibold">APGMS Console</h1>
        <p className="text-sm text-muted-foreground">Compliance Control Plane</p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const full = normalizePath(joinBase(basePath, item.href));
          const isActive = currentPath === full;

          return (
            <Link
              key={item.label}
              to={full}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => setHelpOpen(true)}
        >
          <HelpCircle className="w-4 h-4" />
          Help
        </Button>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar */}
      <Sheet>
        <SheetTrigger asChild className="md:hidden">
          <Button variant="outline" className="m-4">
            Menu
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <Sidebar />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="h-16 border-b bg-background flex items-center justify-between px-6 gap-4">
          <div className="flex items-center gap-2">
            <Select value={theme} onValueChange={(v) => setTheme(v as any)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compliance-light">Compliance Light</SelectItem>
                <SelectItem value="ops-dark">Ops Dark</SelectItem>
                <SelectItem value="calm-neutral">Calm Neutral</SelectItem>
                <SelectItem value="high-contrast">High Contrast</SelectItem>
              </SelectContent>
            </Select>

            <Select value={density} onValueChange={(v) => setDensity(v as any)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comfortable">Comfortable</SelectItem>
                <SelectItem value="compact">Compact</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <form
            className="flex-1 max-w-md"
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = query.trim();
              if (!trimmed) return;
              const target = joinBase(basePath, "/obligations");
              nav(`${target}?query=${encodeURIComponent(trimmed)}`);
            }}
          >
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search obligations, evidence, payments..."
                className="pl-9"
                aria-label="Global search"
              />
            </div>
          </form>

          <div className="text-xs text-muted-foreground">Compliance Console</div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </div>
      <HelpDrawer />
    </div>
  );
}

export default Layout;
