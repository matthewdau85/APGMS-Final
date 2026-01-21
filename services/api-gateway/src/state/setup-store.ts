// services/api-gateway/src/state/setup-store.ts
// Prototype-only in-memory store. Replace with DB later.

export type SetupUser = {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
};

export type ConnectorInstance = {
  instanceId: string;
  connectorId: string;
  mode: "mock" | "prod";
  displayName: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
};

export type SetupOrg = {
  id: string;
  name: string;
  setupComplete: boolean;
  createdAt: string;
};

export type SetupState = {
  org: SetupOrg;
  users: SetupUser[];
  connectors: ConnectorInstance[];
};

function nowIso(): string {
  return new Date().toISOString();
}

const state: SetupState = {
  org: {
    id: "org_demo",
    name: "APGMS Demo Org",
    setupComplete: false,
    createdAt: nowIso(),
  },
  users: [],
  connectors: [],
};

export function getSetupState(): SetupState {
  return state;
}

export function setOrgName(name: string): void {
  state.org.name = name;
}

export function setSetupComplete(v: boolean): void {
  state.org.setupComplete = v;
}

export function hasAdmin(): boolean {
  return state.users.length > 0;
}

export function addUser(u: SetupUser): void {
  state.users.push(u);
}

export function setConnectors(connectors: ConnectorInstance[]): void {
  state.connectors = connectors;
}

export function findConnector(instanceId: string): ConnectorInstance | undefined {
  return state.connectors.find((c) => c.instanceId === instanceId);
}
