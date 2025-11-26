import assert from 'node:assert/strict';
import { OnboardingClient } from './index.js';

(async () => {
  const calls: any[] = [];
  const mockFetch: typeof fetch = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 202,
      json: async () => ({ migrationId: '11111111-1111-1111-1111-111111111111', status: 'pending', startedAt: '2024-11-05T00:00:00Z' }),
      text: async () => '',
    } as any;
  };

  const client = new OnboardingClient({
    baseUrl: 'https://api.example.com/v1/',
    apiKey: 'secret',
    fetchFn: mockFetch,
  });

  const response = await client.createMigration({
    orgId: '22222222-2222-2222-2222-222222222222',
    sourceSystem: 'gusto',
    targetLedger: 'netsuite',
  });

  assert.equal(response.status, 'pending');
  assert.equal(calls[0].url, 'https://api.example.com/v1/migrations');
  assert.equal(calls[0].init?.headers?.authorization, 'Bearer secret');
})();
