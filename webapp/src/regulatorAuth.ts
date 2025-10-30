const REGULATOR_SESSION_KEY = "apgms_regulator_session";

export type RegulatorSession = {
  token: string;
  orgId: string;
  session: {
    id: string;
    issuedAt: string;
    expiresAt: string;
    sessionToken: string;
  };
};

function readSession(): RegulatorSession | null {
  const raw = localStorage.getItem(REGULATOR_SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as RegulatorSession;
  } catch {
    localStorage.removeItem(REGULATOR_SESSION_KEY);
    return null;
  }
}

export function saveRegulatorSession(session: RegulatorSession) {
  localStorage.setItem(REGULATOR_SESSION_KEY, JSON.stringify(session));
}

export function getRegulatorSession(): RegulatorSession | null {
  return readSession();
}

export function getRegulatorToken(): string | null {
  return readSession()?.token ?? null;
}

export function clearRegulatorSession() {
  localStorage.removeItem(REGULATOR_SESSION_KEY);
}
