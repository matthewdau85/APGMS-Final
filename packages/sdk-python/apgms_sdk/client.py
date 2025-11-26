from __future__ import annotations

from dataclasses import dataclass
from typing import List, Literal, Optional

import httpx

MigrationStatus = Literal["pending", "running", "completed", "failed"]
SourceSystem = Literal["gusto", "adp", "paychex", "square", "toast"]
TargetLedger = Literal["netsuite", "quickbooks", "sage-intacct"]


@dataclass
class MigrationResponse:
    migration_id: str
    status: MigrationStatus
    started_at: str


class OnboardingClient:
    """Small helper that wraps httpx for APGMS onboarding endpoints."""

    def __init__(
        self,
        base_url: str,
        api_key: str,
        *,
        timeout: Optional[float] = 10.0,
        client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._timeout = timeout
        self._client = client

    async def create_migration(
        self,
        *,
        org_id: str,
        source_system: SourceSystem,
        target_ledger: TargetLedger,
        dry_run: bool = False,
    ) -> MigrationResponse:
        payload = {
            "orgId": org_id,
            "sourceSystem": source_system,
            "targetLedger": target_ledger,
            "dryRun": dry_run,
        }
        data = await self._request("/migrations", json=payload)
        return MigrationResponse(
            migration_id=data["migrationId"],
            status=data["status"],
            started_at=data["startedAt"],
        )

    async def register_webhook(self, url: str, events: List[str]) -> dict:
        payload = {"url": url, "events": events}
        return await self._request("/webhooks", json=payload)

    async def _request(self, path: str, *, json: dict) -> dict:
        headers = {
            "authorization": f"Bearer {self._api_key}",
            "content-type": "application/json",
            "user-agent": "apgms-sdk-python/0.1.0",
        }

        if self._client is None:
            async with httpx.AsyncClient(timeout=self._timeout) as session:
                response = await session.post(f"{self._base_url}{path}", json=json, headers=headers)
        else:
            response = await self._client.post(f"{self._base_url}{path}", json=json, headers=headers)

        response.raise_for_status()
        return response.json()
