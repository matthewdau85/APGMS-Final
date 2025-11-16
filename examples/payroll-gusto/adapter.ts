import { OnboardingClient } from '@apgms/sdk-typescript';
import type { CreateMigrationRequest } from '@apgms/sdk-typescript';

export async function syncGustoPayroll(): Promise<void> {
  const client = new OnboardingClient({
    baseUrl: process.env.APGMS_BASE_URL ?? 'https://api.apgms.local/v1',
    apiKey: process.env.APGMS_API_KEY ?? 'demo',
  });

  const payload: CreateMigrationRequest = {
    orgId: process.env.GUSTO_ORG_ID ?? '00000000-0000-0000-0000-000000000000',
    sourceSystem: 'gusto',
    targetLedger: 'netsuite',
    dryRun: true,
  };

  const response = await client.createMigration(payload);
  console.log('dry-run started', response);
}
