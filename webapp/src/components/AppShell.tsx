import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import '../App.css';

type Theme = 'light' | 'dark';

type NavItem = {
  label: string;
  to: string;
  end?: boolean;
};

const navItems: NavItem[] = [
  { label: 'Overview', to: '/', end: true },
  { label: 'PAYGW', to: '/paygw' },
  { label: 'GST', to: '/gst' },
  { label: 'Compliance', to: '/compliance' },
  { label: 'Security', to: '/security' }
];

const themeOrder: Theme[] = ['light', 'dark'];

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const stored = window.localStorage.getItem('apgms-theme');
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

export default function AppShell() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('apgms-theme', theme);
  }, [theme]);

  const nextTheme = useMemo<Theme>(() => {
    const index = themeOrder.indexOf(theme);
    const nextIndex = (index + 1) % themeOrder.length;
    return themeOrder[nextIndex];
  }, [theme]);

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__header-content">
          <div className="app-shell__brand">APGMS Pro+</div>
          <nav className="app-shell__nav" aria-label="Primary">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'app-shell__nav-link',
                    isActive ? 'app-shell__nav-link--active' : ''
                  ]
                    .filter(Boolean)
                    .join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            className="app-shell__theme-toggle"
            onClick={() => setTheme(nextTheme)}
            aria-label={`Switch to ${nextTheme} theme`}
          >
            {theme === 'light' ? '🌞' : '🌙'}
          </button>
        </div>
      </header>
      <main className="app-shell__main">
        <div className="app-shell__main-content">
          <Outlet />
        </div>
      </main>
      <footer className="app-shell__footer">
        <div className="app-shell__footer-content">
          <p>Portfolio monitoring built for institutional capital teams.</p>
        </div>
      </footer>
    </div>
  );
}
