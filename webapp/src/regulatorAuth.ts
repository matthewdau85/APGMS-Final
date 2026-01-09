export type RegulatorSession = {
  token: string;
  orgId: string;
  createdAt: number;
};

const KEY = "apgms:regulatorSession";

export function saveRegulatorSession(token: string, orgId: string) {
  const session: RegulatorSession = {
    token,
    orgId,
    createdAt: Date.now(),
  };
  localStorage.setItem(KEY, JSON.stringify(session));
  return session;
}

export function getRegulatorSession(): RegulatorSession | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<RegulatorSession>;
    if (!parsed || typeof parsed.token !== "string" || typeof parsed.orgId !== "string") return null;
    return {
      token: parsed.token,
      orgId: parsed.orgId,
      createdAt: typeof parsed.createdAt === "number" ? parsed.createdAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function clearRegulatorSession() {
  localStorage.removeItem(KEY);
}

export function getRegulatorToken(): string | null {
  return getRegulatorSession()?.token ?? null;
}

export function isRegulatorAuthed(): boolean {
  return Boolean(getRegulatorToken());
}
