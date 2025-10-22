import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AppShell, { getInitialTheme } from './components/layout/AppShell';
import Obligations from './pages/Obligations';
import PAYGW from './pages/PAYGW';
import GST from './pages/GST';
import Compliance from './pages/Compliance';
import Security from './pages/Security';
import './styles/tokens.css';
import './styles/global.css';

if (typeof window !== 'undefined') {
  const initialTheme = getInitialTheme();
  document.documentElement.dataset.theme = initialTheme;
  window.localStorage.setItem('apgms-theme', initialTheme);
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<Obligations />} />
          <Route path="paygw" element={<PAYGW />} />
          <Route path="gst" element={<GST />} />
          <Route path="compliance" element={<Compliance />} />
          <Route path="security" element={<Security />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
