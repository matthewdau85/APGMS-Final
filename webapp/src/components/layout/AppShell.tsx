import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import './appshell.css';

export type Theme = 'light' | 'dark';

export function getInitialTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const stored = window.localStorage.getItem('apgms-theme');
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

const navLinks = [
  { to: '/', label: 'Obligations', end: true },
  { to: '/paygw', label: 'PAYGW' },
  { to: '/gst', label: 'GST' },
  { to: '/compliance', label: 'Compliance' },
  { to: '/security', label: 'Security' },
];

export default function AppShell() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('apgms-theme', theme);
  }, [theme]);

  const nextTheme = useMemo<Theme>(() => (theme === 'light' ? 'dark' : 'light'), [theme]);

  return (
    <div className="app-shell">
      <header className="app-shell__topbar">
        <div className="app-shell__brand">APGMS Pro+</div>
        <button
          type="button"
          className="app-shell__theme-toggle"
          onClick={() => setTheme(nextTheme)}
          aria-label={`Switch to ${nextTheme} theme`}
        >
          {theme === 'light' ? '🌞' : '🌜'}
        </button>
      </header>
      <div className="app-shell__layout">
        <nav className="app-shell__nav" aria-label="Primary">
          {navLinks.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                isActive
                  ? 'app-shell__nav-link app-shell__nav-link--active'
                  : 'app-shell__nav-link'
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <main className="app-shell__main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
