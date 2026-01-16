import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type Role = "admin" | "user";

function isSafeInternalPath(p: string | null): p is string {
  if (!p) return false;
  if (!p.startsWith("/")) return false;
  if (p.startsWith("//")) return false;
  return true;
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [name, setName] = useState<string>("");
  const [role, setRole] = useState<Role>("user");

  const nextPath = useMemo(() => {
    // Support ?next=/somewhere
    const sp = new URLSearchParams(location.search);
    const next = sp.get("next");
    return isSafeInternalPath(next) ? next : null;
  }, [location.search]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = name.trim() || "E2E Admin";
    login({ name: trimmed, role });

    // Your app/nav/tests expect real routes like /dashboard, not /admin.
    // Keep this deterministic for E2E.
    navigate(nextPath ?? "/dashboard", { replace: true });
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Sign in (Demo)</h1>
        <p className="mt-1 text-sm text-slate-600">
          Local demo auth for the prototype. No passwords.
        </p>

        <form className="mt-6 space-y-5" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label
              htmlFor="displayName"
              className="block text-sm font-medium text-slate-900"
            >
              Display name
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              inputMode="text"
              autoComplete="name"
              aria-label="Display name"
              placeholder="Your name"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-300"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="block text-sm font-medium text-slate-900">
              Role
            </legend>

            <div className="flex items-center gap-2">
              <input
                id="role-admin"
                type="radio"
                name="role"
                value="admin"
                aria-label="Admin"
                checked={role === "admin"}
                onChange={() => setRole("admin")}
              />
              <label htmlFor="role-admin" className="text-sm text-slate-800">
                Admin
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="role-user"
                type="radio"
                name="role"
                value="user"
                aria-label="User"
                checked={role === "user"}
                onChange={() => setRole("user")}
              />
              <label htmlFor="role-user" className="text-sm text-slate-800">
                User
              </label>
            </div>
          </fieldset>

          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Sign in
          </button>

          <div className="text-xs text-slate-500">
            Tip: E2E uses Display name + Admin.
          </div>
        </form>
      </section>
    </main>
  );
}
