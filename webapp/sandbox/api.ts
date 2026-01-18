const BASE = 'http://127.0.0.1:3000';

async function j<T>(p: Promise<Response>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json() as Promise<T>;
}

export const api = {
  ready: () => j(fetch(`${BASE}/ready`)),
  basPreview: () => j(fetch(`${BASE}/bas/preview`)),
  alerts: (status?: 'open' | 'resolved') =>
    j(fetch(`${BASE}/alerts${status ? `?status=${status}` : ''}`)),
  resolveAlert: (id: string) =>
    j(fetch(`${BASE}/alerts/${encodeURIComponent(id)}/resolve`, { method: 'POST' })),
  designated: () => j(fetch(`${BASE}/designated-accounts`)),
  evidenceCreate: () =>
    j(fetch(`${BASE}/compliance/evidence/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'ad-hoc' }),
    })),
  evidenceList: () => j(fetch(`${BASE}/compliance/evidence`)),
};
