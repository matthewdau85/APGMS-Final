import asyncio
from apgms_sdk import OnboardingClient


async def sync_square_pos() -> None:
    client = OnboardingClient('https://api.apgms.local/v1', 'demo-key')
    payload = await client.register_webhook('https://example.com/webhooks/apgms', ['migration.started', 'migration.completed'])
    print('webhook configured', payload)


if __name__ == '__main__':
    asyncio.run(sync_square_pos())
