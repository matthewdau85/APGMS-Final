import type { FastifyPluginAsync } from 'fastify';

type Alert = {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'resolved';
  createdAt: string;
  resolvedAt?: string;
};

const store: Record<string, Alert> = {
  a1: {
    id: 'a1',
    title: 'Unreconciled bank lines',
    severity: 'high',
    status: 'open',
    createdAt: new Date().toISOString(),
  },
  a2: {
    id: 'a2',
    title: 'Designated account shortfall',
    severity: 'medium',
    status: 'open',
    createdAt: new Date().toISOString(),
  },
};

const alertsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { status?: 'open' | 'resolved' } }>(
    '/alerts',
    async (req) => {
      const status = req.query.status;
      const all = Object.values(store);
      return status ? all.filter(a => a.status === status) : all;
    }
  );

  app.post<{ Params: { id: string } }>(
    '/alerts/:id/resolve',
    async (req) => {
      const a = store[req.params.id];
      if (!a) return { ok: false };
      a.status = 'resolved';
      a.resolvedAt = new Date().toISOString();
      return { ok: true };
    }
  );
};

export default alertsRoutes;
