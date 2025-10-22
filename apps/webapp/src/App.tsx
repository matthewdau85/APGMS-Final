import { useEffect } from "react";
import { NavLink, Route, Routes } from "react-router-dom";

import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import BankLinesPage from "@/pages/BankLines";
import HomePage from "@/pages/Home";
import { useThemeStore } from "@/stores/theme";

const navigation = [
  { name: "Overview", to: "/" },
  { name: "Bank lines", to: "/bank-lines" }
];

export default function App() {
  const initialize = useThemeStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex flex-col gap-6 border-b border-border bg-surface px-6 py-6 shadow-sm md:flex-row md:items-center md:justify-between md:px-10">
        <div className="text-2xl font-semibold tracking-tight">APGMS Pro+</div>
        <nav aria-label="Primary" className="flex flex-wrap items-center gap-3">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "ring-offset-background",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted hover:bg-surface-muted"
                )
              }
            >
              {item.name}
            </NavLink>
          ))}
        </nav>
        <ThemeToggle />
      </header>
      <main className="flex-1 px-6 pb-16 pt-10 sm:px-10">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/bank-lines" element={<BankLinesPage />} />
        </Routes>
      </main>
      <footer className="border-t border-border bg-surface-muted px-6 py-6 text-sm text-muted sm:px-10">
        Portfolio monitoring built for institutional capital teams.
      </footer>
    </div>
  );
}
