import { Route, Routes } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import HomePage from './pages/Home';
import BankLinesPage from './pages/BankLines';
import AppShell from './components/AppShell/AppShell';

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
    <AppShell
      theme={theme}
      nextTheme={nextTheme}
      onToggleTheme={() => setTheme(nextTheme)}
    >
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/bank-lines" element={<BankLinesPage />} />
      </Routes>
    </AppShell>
  );
}
