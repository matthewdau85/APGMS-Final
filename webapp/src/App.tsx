import { Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import OverviewPage from './pages/Overview';
import PaygwPage from './pages/Paygw';
import GstPage from './pages/Gst';
import CompliancePage from './pages/Compliance';
import SecurityPage from './pages/Security';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/paygw" element={<PaygwPage />} />
        <Route path="/gst" element={<GstPage />} />
        <Route path="/compliance" element={<CompliancePage />} />
        <Route path="/security" element={<SecurityPage />} />
      </Route>
    </Routes>
  );
}
