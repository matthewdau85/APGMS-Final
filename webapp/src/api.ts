// webapp/src/api.ts
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

function authHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error("Login failed");
  }

  return res.json() as Promise<{ token: string }>;
}

export async function fetchUsers(token: string) {
  const res = await fetch(`${API_BASE}/users`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("unauthorized");
  return res.json() as Promise<{
    users: Array<{
      userId: string;
      email: string;
      createdAt: string;
    }>;
  }>;
}

export async function fetchBankLines(token: string) {
  const res = await fetch(`${API_BASE}/bank-lines`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("unauthorized");
  return res.json() as Promise<{
    lines: Array<{
      id: string;
      postedAt: string;
      amount: number;
      description: string; // "***"
      createdAt: string;
    }>;
  }>;
}

export async function createBankLine(
  token: string,
  line: { date: string; amount: string; payee: string; desc: string }
) {
  const res = await fetch(`${API_BASE}/bank-lines`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(line),
  });
  if (!res.ok) throw new Error("create failed");
  return res.json();
}

export async function fetchCurrentObligations(token: string) {
  const res = await fetch(`${API_BASE}/org/obligations/current`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_obligations");
  return res.json() as Promise<{
    basPeriodStart: string;
    basPeriodEnd: string;
    paygw: {
      required: number;
      secured: number;
      shortfall: number;
      status: string;
    };
    gst: {
      required: number;
      secured: number;
      shortfall: number;
      status: string;
    };
    nextBasDue: string;
  }>;
}

export async function fetchPayrollFeeds(token: string) {
  const res = await fetch(`${API_BASE}/feeds/payroll`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_payroll");
  return res.json() as Promise<{
    runs: Array<{
      id: string;
      date: string;
      grossWages: number;
      paygwCalculated: number;
      paygwSecured: number;
      status: string;
    }>;
  }>;
}

export async function fetchGstFeeds(token: string) {
  const res = await fetch(`${API_BASE}/feeds/gst`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_gst");
  return res.json() as Promise<{
    days: Array<{
      date: string;
      salesTotal: number;
      gstCalculated: number;
      gstSecured: number;
      status: string;
    }>;
  }>;
}

export async function fetchAlerts(token: string) {
  const res = await fetch(`${API_BASE}/alerts`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_alerts");
  return res.json() as Promise<{
    alerts: Array<{
      id: string;
      type: string;
      severity: string;
      message: string;
      createdAt: string;
      resolved: boolean;
      resolvedAt: string | null;
      resolutionNote: string | null;
    }>;
  }>;
}

export async function resolveAlert(
  token: string,
  alertId: string,
  note: string
) {
  const res = await fetch(`${API_BASE}/alerts/${alertId}/resolve`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ note }),
  });
  if (!res.ok) throw new Error("failed_resolve_alert");
  return res.json() as Promise<{
    alert: {
      id: string;
      resolved: boolean;
      resolvedAt: string | null;
      resolutionNote: string | null;
    };
  }>;
}

export async function fetchBasPreview(token: string) {
  const res = await fetch(`${API_BASE}/bas/preview`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_bas_preview");
  return res.json() as Promise<{
    periodStart: string | null;
    periodEnd: string | null;
    paygw: { required: number; secured: number; status: string };
    gst: { required: number; secured: number; status: string };
    overallStatus: string;
    blockers: string[];
  }>;
}

export async function lodgeBas(token: string) {
  const res = await fetch(`${API_BASE}/bas/lodge`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_bas_lodge");
  return res.json() as Promise<{
    basCycle: { id: string; status: string; lodgedAt: string };
  }>;
}

export async function fetchComplianceReport(token: string) {
  const res = await fetch(`${API_BASE}/compliance/report`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_compliance");
  return res.json() as Promise<{
    orgId: string;
    basHistory: Array<{
      period: string;
      lodgedAt: string;
      status: string;
      notes: string;
    }>;
    alertsSummary: {
      openHighSeverity: number;
      resolvedThisQuarter: number;
    };
    nextBasDue: string | null;
  }>;
}

export async function fetchSecurityUsers(token: string) {
  const res = await fetch(`${API_BASE}/security/users`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_security_users");
  return res.json() as Promise<{
    users: Array<{
      id: string;
      email: string;
      role: string;
      mfaEnabled: boolean;
      createdAt: string;
      lastLogin: string | null;
    }>;
  }>;
}
