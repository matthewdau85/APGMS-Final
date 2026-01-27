import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Obligations } from './pages/Obligations';
import { ObligationDetail } from './pages/ObligationDetail';
import { Ledger } from './pages/Ledger';
import { Reconciliation } from './pages/Reconciliation';
import { EvidencePacks } from './pages/EvidencePacks';
import { Funding } from './pages/Funding';
import { Connectors } from './pages/Connectors';
import { AIAssistant } from './pages/AIAssistant';
import { Controls } from './pages/Controls';
import { Incidents } from './pages/Incidents';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { Alerts } from './pages/Alerts';
import { BAS } from './pages/BAS';
import { Toaster } from './components/ui/sonner';

// Protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/obligations" element={<Obligations />} />
                <Route path="/obligations/:id" element={<ObligationDetail />} />
                <Route path="/ledger" element={<Ledger />} />
                <Route path="/reconciliation" element={<Reconciliation />} />
                <Route path="/evidence-packs" element={<EvidencePacks />} />
                <Route path="/funding" element={<Funding />} />
                <Route path="/connectors" element={<Connectors />} />
                <Route path="/ai-assistant" element={<AIAssistant />} />
                <Route path="/controls" element={<Controls />} />
                <Route path="/incidents" element={<Incidents />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/bas" element={<BAS />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

const App: React.FC = () => {
  // Set document title
  React.useEffect(() => {
    document.title = 'ClearCompliance - Tax obligations. Clearly handled.';
  }, []);

  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster />
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
};

export default App;