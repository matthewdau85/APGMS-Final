import { NavLink, Route, Routes } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import HomePage from './pages/Home';
import BankLinesPage from './pages/BankLines';
import PaygwPage from './pages/Paygw';
import GstPage from './pages/Gst';
import CompliancePage from './pages/Compliance';
import SecurityPage from './pages/Security';
import './App.css';

type Theme = 'light' | 'dark';

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
          <NavLink className="app__nav-link" to="/" end>
            Obligations
          </NavLink>
          <NavLink className="app__nav-link" to="/paygw">
            PAYGW
          </NavLink>
          <NavLink className="app__nav-link" to="/gst">
            GST
          </NavLink>
          <NavLink className="app__nav-link" to="/compliance">
            Compliance
          </NavLink>
          <NavLink className="app__nav-link" to="/security">
            Security
          </NavLink>
          <NavLink className="app__nav-link" to="/bank-lines">
            Bank lines
          </NavLink>
        </nav>
        <button
          type="button"
          className="app__theme-toggle"
          onClick={() => setTheme(nextTheme)}
          aria-label={`Switch to ${nextTheme} theme`}
        >
          {theme === 'light' ? 'ðŸŒž' : 'ðŸŒ™'}
        </button>
      </header>
      <main className="app__content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/paygw" element={<PaygwPage />} />
          <Route path="/gst" element={<GstPage />} />
          <Route path="/compliance" element={<CompliancePage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/bank-lines" element={<BankLinesPage />} />
        </Routes>
      </main>
      <footer className="app__footer">
        <p>Obligation management built for institutional finance teams.</p>
      </footer>
    </div>
  );
}
