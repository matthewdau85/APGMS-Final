import { NavLink, Route, Routes } from 'react-router-dom';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import HomePage from './pages/Home';
import BankLinesPage from './pages/BankLines';
import './App.css';

type Theme = 'light' | 'dark';

type NavItem = {
  path: string;
  label: string;
  element: ReactNode;
  end?: boolean;
};

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

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="page">
      <header className="page__header">
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <section aria-label={`${title} insights`}>
        <p>
          Detailed playbooks for this area are being compiled. Review outstanding tasks, risk
          indicators, and policy updates with your operations team to stay compliant.
        </p>
      </section>
    </div>
  );
}

const navItems: NavItem[] = [
  {
    path: '/',
    label: 'Overview',
    element: <HomePage />,
    end: true
  },
  {
    path: '/bank-lines',
    label: 'Bank lines',
    element: <BankLinesPage />
  },
  {
    path: '/obligations',
    label: 'Obligations',
    element: (
      <PlaceholderPage
        title="Obligations dashboard"
        description="Track covenant timelines, repayment schedules, and sign-off workflows across mandates."
      />
    )
  },
  {
    path: '/paygw',
    label: 'PAYGW',
    element: (
      <PlaceholderPage
        title="PAYGW compliance"
        description="Monitor payroll withholding submissions, variance alerts, and follow-up actions with the finance pod."
      />
    )
  },
  {
    path: '/gst',
    label: 'GST',
    element: (
      <PlaceholderPage
        title="GST lodgements"
        description="Consolidate statement reviews, reconcile adjustments, and coordinate filings for cross-border portfolios."
      />
    )
  },
  {
    path: '/compliance',
    label: 'Compliance',
    element: (
      <PlaceholderPage
        title="Compliance operations"
        description="Align regulatory attestations, policy renewals, and audit responses with risk stakeholders."
      />
    )
  },
  {
    path: '/security',
    label: 'Security',
    element: (
      <PlaceholderPage
        title="Security oversight"
        description="Review incident queues, access provisioning, and resiliency readiness across your capital markets stack."
      />
    )
  }
];

export default function App() {
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
    <div className="app">
      <header className="app__header">
        <div className="app__brand">APGMS Pro+</div>
        <nav className="app__nav" aria-label="Primary">
          {navItems.map(({ path, label, end }) => (
            <NavLink
              key={path}
              to={path}
              end={end}
              className={({ isActive }) => `app__nav-link${isActive ? ' active' : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          className="app__theme-toggle"
          onClick={() => setTheme(nextTheme)}
          aria-label={`Switch to ${nextTheme} theme`}
        >
          {theme === 'light' ? '🌞' : '🌙'}
        </button>
      </header>
      <main className="app__content">
        <Routes>
          {navItems.map(({ path, element }) => (
            <Route key={path} path={path} element={element} />
          ))}
        </Routes>
      </main>
      <footer className="app__footer">
        <p>Portfolio monitoring built for institutional capital teams.</p>
      </footer>
    </div>
  );
}
