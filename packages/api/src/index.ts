import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { onboardingRoutes } from './routes/onboarding.js';

export interface OnboardingApiOptions extends FastifyPluginOptions {
  /** Name of the product or platform embedding the API */
  productName: string;
  /** Optional logger, defaults to Fastify instance logger */
  logger?: Pick<Console, 'info' | 'error' | 'warn'>;
}

/**
 * Registers onboarding routes that power the payroll/POS migration workflows.
 * The implementation focuses on schema validation and hand-offs between
 * onboarding milestones exposed via the SDKs.
 */
export async function registerOnboardingApi(
  app: FastifyInstance,
  options: OnboardingApiOptions
): Promise<void> {
  const logger = options.logger ?? app.log;
  logger.info({ product: options.productName }, 'registering onboarding api');

  app.decorate('onboardingProductName', options.productName);
  app.register(onboardingRoutes, { prefix: '/v1' });
}

export * from './routes/onboarding.js';
