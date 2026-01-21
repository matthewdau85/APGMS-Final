// services/api-gateway/src/lib/setup-state.ts
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export type ConnectorMode = "mock" | "production";

export type ConfiguredConnector = {
  id: string;
  sector: string;
  vendor: string;
  mode: ConnectorMode;
  displayName: string;
  config: Record<string, unknown>;
  createdAt: string;
};

export type FirstAdmin = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
};

export type SetupState = {
  setupComplete: boolean;
  createdAt: string;
  updatedAt: string;
  firstAdmin: FirstAdmin | null;
  connectors: ConfiguredConnector[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function defaultState(): SetupState {
  const t = nowIso();
  return {
    setupComplete: false,
    createdAt: t,
    updatedAt: t,
    firstAdmin: null,
    connectors: [],
  };
}

export function getSetupStatePath(): string {
  const explicit = process.env.SETUP_STATE_PATH;
  if (explicit && explicit.trim()) return explicit.trim();

  // Run location is typically services/api-gateway, so keep state local to that service.
  // Example: services/api-gateway/.apgms/setup-state.json
  return path.join(process.cwd(), ".apgms", "setup-state.json");
}

async function ensureDirForFile(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

export async function loadSetupState(): Promise<SetupState> {
  const p = getSetupStatePath();
  try {
    const raw = await fs.readFile(p, "utf8");
    const parsed = JSON.parse(raw) as SetupState;

    // Minimal shape hardening
    if (!parsed || typeof parsed !== "object") return defaultState();
    if (typeof parsed.setupComplete !== "boolean") return defaultState();
    if (!Array.isArray(parsed.connectors)) parsed.connectors = [];
    if (!("firstAdmin" in parsed)) parsed.firstAdmin = null;

    return parsed;
  } catch {
    return defaultState();
  }
}

export async function saveSetupState(state: SetupState): Promise<void> {
  const p = getSetupStatePath();
  await ensureDirForFile(p);

  state.updatedAt = nowIso();
  const json = JSON.stringify(state, null, 2);
  await fs.writeFile(p, json, "utf8");
}

export function newId(): string {
  // Node 20 has randomUUID.
  return crypto.randomUUID();
}
