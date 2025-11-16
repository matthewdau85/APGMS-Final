import asyncio

import httpx

from apgms_sdk import OnboardingClient


async def test_create_migration_uses_headers(monkeypatch):
    captured = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        captured['headers'] = request.headers
        return httpx.Response(202, json={
            'migrationId': '33333333-3333-3333-3333-333333333333',
            'status': 'running',
            'startedAt': '2024-11-05T00:00:00Z',
        })

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        sdk = OnboardingClient('https://api.example.com/v1', 'secret', client=client)
        response = await sdk.create_migration(
            org_id='44444444-4444-4444-4444-444444444444',
            source_system='gusto',
            target_ledger='netsuite'
        )

    assert response.status == 'running'
    assert captured['headers']['authorization'] == 'Bearer secret'


def run():
    asyncio.run(test_create_migration_uses_headers(None))


if __name__ == '__main__':
    run()
