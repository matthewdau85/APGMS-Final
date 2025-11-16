import { readFile } from "node:fs/promises";

async function main() {
  const addr = process.env.VAULT_ADDR;
  const token = process.env.VAULT_TOKEN;
  const path = process.env.VAULT_SYNC_PATH ?? "kv/data/apgms";
  if (!addr || !token) {
    throw new Error("VAULT_ADDR and VAULT_TOKEN must be set to sync secrets");
  }

  const envContents = await readFile(".env", "utf8");
  const payload: Record<string, string> = {};
  for (const line of envContents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    payload[key] = rest.join("=");
  }

  const url = `${addr.replace(/\/$/, "")}/v1/${path.replace(/^\//, "")}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-Vault-Token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: payload }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Vault sync failed: ${response.status} ${text}`);
  }

  console.log(`✅ Synced ${Object.keys(payload).length} secrets to ${path}`);
}

main().catch((error) => {
  console.error("Vault sync failed", error);
  process.exitCode = 1;
});
