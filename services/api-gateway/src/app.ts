import fastify, { type FastifyInstance } from 'fastify';
import { registerHealthRoutes } from './routes/health.js';
import { registerVersionRoutes } from './routes/version.js';

import { registerAdminAgentRoutes } from './routes/admin-agent.js';
import { registerAdminRegWatcherRoutes } from './routes/admin-regwatcher.js';
import { registerAdminDemoOrchestratorRoutes } from './routes/admin-demo-orchestrator.js';

export function buildFastifyApp(): FastifyInstance {
  const app = fastify({
    logger: true,
  });

  registerHealthRoutes(app);
  registerVersionRoutes(app);
  registerAdminAgentRoutes(app);
  registerAdminRegWatcherRoutes(app);
  registerAdminDemoOrchestratorRoutes(app);

  return app;
}
