import type { FastifyPluginAsync } from 'fastify';
import alerts from './alerts.js';
import designated from './designated-accounts.js';
import basPreview from './bas-preview.js';
import mfa from './auth-mfa.js';
import evidence from './evidence.js';

const newRoutes: FastifyPluginAsync = async (app) => {
  await app.register(alerts);
  await app.register(designated);
  await app.register(basPreview);
  await app.register(mfa);
  await app.register(evidence);
};

export default newRoutes;
