import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Obligations } from './pages/Obligations';
import { ObligationDetail } from './pages/ObligationDetail';
import { Ledger } from './pages/Ledger';
import { Reconciliation } from './pages/Reconciliation';
import { EvidencePacks } from './pages/EvidencePacks';
import { Controls } from './pages/Controls';
import { Incidents } from './pages/Incidents';
import { Settings } from './pages/Settings';
import { Toaster } from './components/ui/sonner';

const App: React.FC = () => {
  return (
    <AppProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/obligations" element={<Obligations />} />
            <Route path="/obligations/:id" element={<ObligationDetail />} />
            <Route path="/ledger" element={<Ledger />} />
            <Route path="/reconciliation" element={<Reconciliation />} />
            <Route path="/evidence-packs" element={<EvidencePacks />} />
            <Route path="/controls" element={<Controls />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
        <Toaster />
      </BrowserRouter>
    </AppProvider>
  );
};

export default App;
