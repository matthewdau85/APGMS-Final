import React from "react";
import { Link, Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-primary" aria-hidden="true" />
            <div>
              <div className="text-sm font-semibold leading-none">APGMS</div>
              <div className="text-xs text-muted-foreground leading-none">
                Compliance Webapp
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-3 text-sm">
            <Link className="hover:underline" to="/">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
