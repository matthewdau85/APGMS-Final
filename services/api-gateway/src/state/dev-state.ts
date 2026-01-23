// services/api-gateway/src/state/dev-state.ts
import fs from "node:fs";
import path from "node:path";

export type AddonsSettings = {
  clearComplianceTraining: boolean;
};

export type OrgSettings = {
  addons: AddonsSettings;
};

export type SetupState = {
  setupComplete: boolean;
  firstAdminCreated: boolean;
  connectorsConfigured: boolean;
};

export type ConnectorState = {
  enabled: boolean;
  config: Record<string, unknown>;
};

export type DevState = {
  setup: SetupState;
  orgSettings: OrgSettings;
  connectors: Record<string, ConnectorState>;
  firstAdmin: {
    email: string | null;
    name: string | null;
    passwordHash: string | null;
  };
};

const DEFAULT_STATE: DevState = {
  setup: {
    setupComplete: false,
    firstAdminCreated: false,
    connectorsConfigured: false,
  },
  orgSettings: {
    addons: {
      clearComplianceTraining: false,
    },
  },
  connectors: {},
  firstAdmin: {
    email: null,
    name: null,
    passwordHash: null,
  },
};

function stateFilePath(): string {
  // Dev-only state persistence. Override for local workflows if needed.
  const fromEnv = process.env.APGMS_DEV_STATE_FILE;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  return path.join(process.cwd(), ".apgms-dev-state.json");
}

function safeParseJson(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function coerceState(raw: unknown): DevState {
  if (!isPlainObject(raw)) return { ...DEFAULT_STATE };

  const next: DevState = { ...DEFAULT_STATE };

  if (isPlainObject(raw.setup)) {
    next.setup.setupComplete = Boolean(raw.setup.setupComplete);
    next.setup.firstAdminCreated = Boolean(raw.setup.firstAdminCreated);
    next.setup.connectorsConfigured = Boolean(raw.setup.connectorsConfigured);
  }

  if (isPlainObject(raw.orgSettings) && isPlainObject(raw.orgSettings.addons)) {
    const addons = raw.orgSettings.addons;
    next.orgSettings.addons.clearComplianceTraining = Boolean(
      (addons as Record<string, unknown>).clearComplianceTraining
    );
  }

  if (isPlainObject(raw.connectors)) {
    for (const [k, v] of Object.entries(raw.connectors)) {
      if (!isPlainObject(v)) continue;
      const enabled = Boolean((v as Record<string, unknown>).enabled);
      const configRaw = (v as Record<string, unknown>).config;
      const config = isPlainObject(configRaw) ? configRaw : {};
      next.connectors[k] = { enabled, config };
    }
  }

  if (isPlainObject(raw.firstAdmin)) {
    const fa = raw.firstAdmin as Record<string, unknown>;
    next.firstAdmin.email = typeof fa.email === "string" ? fa.email : null;
    next.firstAdmin.name = typeof fa.name === "string" ? fa.name : null;
    next.firstAdmin.passwordHash =
      typeof fa.passwordHash === "string" ? fa.passwordHash : null;
  }

  return next;
}

export function readState(): DevState {
  const fp = stateFilePath();
  if (!fs.existsSync(fp)) return { ...DEFAULT_STATE };
  const txt = fs.readFileSync(fp, "utf8");
  const raw = safeParseJson(txt);
  return coerceState(raw);
}

export function writeState(next: DevState): void {
  const fp = stateFilePath();
  const tmp = `${fp}.tmp`;

  const dir = path.dirname(fp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const body = JSON.stringify(next, null, 2) + "\n";
  fs.writeFileSync(tmp, body, "utf8");
  fs.renameSync(tmp, fp);
}

export function updateState(mutator: (s: DevState) => void): DevState {
  const s = readState();
  mutator(s);
  writeState(s);
  return s;
}
