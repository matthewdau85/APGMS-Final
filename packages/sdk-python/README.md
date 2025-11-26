# apgms-sdk (Python)

Async-first Python helper wrapping the onboarding API. Ships with type hints and httpx-based retries.

## Install

```bash
pip install -e packages/sdk-python
```

## Usage

```python
import asyncio
from apgms_sdk import OnboardingClient

async def main():
    client = OnboardingClient('https://api.apgms.local/v1', 'api-key')
    response = await client.create_migration(
        org_id='uuid',
        source_system='gusto',
        target_ledger='netsuite',
    )
    print(response)

asyncio.run(main())
```
