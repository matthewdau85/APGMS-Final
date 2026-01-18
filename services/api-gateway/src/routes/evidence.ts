import type { FastifyPluginAsync } from 'fastify';

type Evidence = { id: string; type: string; createdAt: string; notes?: string };
const ev: Record<string, Evidence> = {
  e1: { id: 'e1', type: 'bank-reconciliation', createdAt: new Date().toISOString(), notes: 'Auto-generated pack' },
};

const evidenceRoutes: FastifyPluginAsync = async (app) => {
  app.get('/compliance/evidence', async () => {
    const items = Object.values(ev).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
    return { items, total: items.length };
  });

  app.post<{ Body: { type?: string; notes?: string } }>('/compliance/evidence/create', async (req, reply) => {
    const id = 'e' + (Object.keys(ev).length + 1);
    const item: Evidence = {
      id, type: req.body?.type || 'generic', notes: req.body?.notes, createdAt: new Date().toISOString()
    };
    ev[id] = item;
    return reply.code(201).send({ ok: true, id });
  });

  app.get<{ Params: { id: string } }>('/compliance/evidence/:id', async (req, reply) => {
    const item = ev[req.params.id];
    if (!item) return reply.code(404).send({ ok: false, error: 'not_found' });
    return { ok: true, item };
  });
};

export default evidenceRoutes;
