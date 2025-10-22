import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import './appshell.css';

type Theme = 'light' | 'dark';

type NavItem = {
  label: string;
  to: string;
  end?: boolean;
};

interface AppShellProps {
  children: ReactNode;
  theme: Theme;
  nextTheme: Theme;
  onToggleTheme: () => void;
}

const navItems: NavItem[] = [
  { label: 'Overview', to: '/', end: true },
  { label: 'Bank lines', to: '/bank-lines' }
];

export default function AppShell({
  children,
  theme,
  nextTheme,
  onToggleTheme
}: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__brand">APGMS Pro+</div>
        <nav className="app-shell__nav" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              className="app-shell__nav-link"
              to={item.to}
              end={item.end}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          className="app-shell__theme-toggle"
          onClick={onToggleTheme}
          aria-label={`Switch to ${nextTheme} theme`}
        >
          {theme === 'light' ? '🌞' : '🌙'}
        </button>
      </header>
      <main className="app-shell__content">{children}</main>
      <footer className="app-shell__footer">
        <p>Portfolio monitoring built for institutional capital teams.</p>
      </footer>
    </div>
  );
}
