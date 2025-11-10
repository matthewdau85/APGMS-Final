import Fastify from 'fastify';
import { metricsPlugin } from './observability/metrics.js';
import { inferencePlugin } from './routes/inference.js';
import { feedbackPlugin } from './routes/feedback.js';
import { prisma } from './prisma.js';

const app = Fastify({
  logger: true,
});

app.get('/healthz', async () => ({ status: 'ok' }));

app.register(metricsPlugin);
app.register(inferencePlugin);
app.register(feedbackPlugin);

app.addHook('onClose', async () => {
  await prisma.$disconnect();
});

const port = Number(process.env.PORT ?? 8082);
const host = process.env.HOST ?? '0.0.0.0';

async function start() {
  try {
    await app.listen({ port, host });
    app.log.info({ port, host }, 'ml-service started');
  } catch (error) {
    app.log.error(error, 'failed to start ml-service');
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  start();
}

export default app;
