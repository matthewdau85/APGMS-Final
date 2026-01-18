import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from './api';

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: '1px solid #ccc', padding: 12, marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {children}
    </section>
  );
}

function App() {
  const [ready, setReady] = useState<any>();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [evidence, setEvidence] = useState<any>();
  const [err, setErr] = useState<string>();

  const load = async () => {
    try {
      setErr(undefined);
      const r = await api.ready();
      const a = await api.alerts('open');
      const e = await api.evidenceList();
      setReady(r);
      setAlerts(a);
      setEvidence(e);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    }
  };

  useEffect(() => { void load(); }, []);

  const resolve = async (id: string) => {
    try {
      await api.resolveAlert(id);
      await load();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    }
  };

  const createEvidence = async () => {
    try {
      await api.evidenceCreate();
      await load();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    }
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 1000, margin: '0 auto' }}>
      <h1>APGMS Dev Sandbox</h1>
      <p>API base: <code>http://127.0.0.1:3000</code></p>

      {err && (
        <div style={{ border: '1px solid #f99', padding: 12, marginBottom: 16 }}>
          <strong>Error</strong>
          <pre style={{ margin: 0 }}>{err}</pre>
        </div>
      )}

      <Box title="/ready">
        <pre>{JSON.stringify(ready, null, 2)}</pre>
      </Box>

      <Box title="Alerts (open)">
        {alerts.length === 0 ? (
          <div>No open alerts.</div>
        ) : (
          <ul>
            {alerts.map(a => (
              <li key={a.id}>
                <strong>{a.title}</strong> [{a.severity}] ({a.status})
                <button style={{ marginLeft: 8 }} onClick={() => resolve(a.id)}>Resolve</button>
              </li>
            ))}
          </ul>
        )}
      </Box>

      <Box title="Evidence">
        <button onClick={createEvidence}>Create Evidence</button>
        <pre>{JSON.stringify(evidence, null, 2)}</pre>
      </Box>

      <Box title="Reload">
        <button onClick={() => void load()}>Reload all</button>
      </Box>
    </div>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<App />);
