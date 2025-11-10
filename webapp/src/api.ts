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

export type ApiSession = {
  token: string;
  user: {
    id: string;
    orgId: string;
    role: string;
    mfaEnabled: boolean;
  };
  prototypeEnv?: string;
};

export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error("Login failed");
  }

  return res.json() as Promise<ApiSession>;
}

export async function initiateMfa(token: string) {
  const res = await fetch(`${API_BASE}/auth/mfa/initiate`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) {
    throw new Error("failed_mfa_initiate");
  }
  return res.json() as Promise<{
    delivery: string;
    code: string;
    expiresInSeconds: number;
  }>;
}

export async function verifyMfa(token: string, code: string) {
  const res = await fetch(`${API_BASE}/auth/mfa/verify`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    throw new Error("failed_mfa_verify");
  }
  return res.json() as Promise<{
    token: string;
    user: ApiSession["user"];
    session: {
      expiresInSeconds: number;
      verifiedAt: string;
    };
    prototypeEnv?: string;
  }>;
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
    basCycleId: string | null;
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
    nextBasDue: string | null;
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
  note: string,
  mfaCode?: string
) {
  const payload: Record<string, unknown> = { note };
  if (mfaCode) {
    payload.mfaCode = mfaCode;
  }
  const res = await fetch(`${API_BASE}/alerts/${alertId}/resolve`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    const errorCode =
      (errorBody as { error?: { code?: string } } | null)?.error?.code ??
      "failed_resolve_alert";
    const error = new Error(errorCode);
    (error as any).payload = errorBody;
    throw error;
  }
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
    basCycleId: string | null;
    periodStart: string | null;
    periodEnd: string | null;
    paygw: { required: number; secured: number; status: string };
    gst: { required: number; secured: number; status: string };
    overallStatus: string;
    blockers: string[];
  }>;
}

export async function lodgeBas(
  token: string,
  options?: {
    mfaCode?: string;
  }
) {
  const payload: Record<string, unknown> = {};
  if (options?.mfaCode) {
    payload.mfaCode = options.mfaCode;
  }
  const res = await fetch(`${API_BASE}/bas/lodge`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    const errorCode =
      (errorBody as { error?: { code?: string } } | null)?.error?.code ??
      "failed_bas_lodge";
    const error = new Error(errorCode);
    (error as any).payload = errorBody;
    throw error;
  }
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
    designatedTotals: {
      paygw: number;
      gst: number;
    };
    paymentPlans: Array<{
      id: string;
      basCycleId: string;
      requestedAt: string;
      status: string;
      reason: string;
      details: Record<string, unknown>;
      resolvedAt: string | null;
    }>;
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

export async function fetchDesignatedAccounts(token: string) {
  const res = await fetch(`${API_BASE}/org/designated-accounts`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_designated_accounts");
  return res.json() as Promise<{
    totals: {
      paygw: number;
      gst: number;
    };
    accounts: Array<{
      id: string;
      type: string;
      balance: number;
      updatedAt: string;
      transfers: Array<{
        id: string;
        amount: number;
        source: string;
        createdAt: string;
      }>;
    }>;
  }>;
}

export async function fetchPaymentPlanRequest(
  token: string,
  basCycleId?: string
) {
  const url =
    basCycleId === undefined
      ? `${API_BASE}/bas/payment-plan-request`
      : `${API_BASE}/bas/payment-plan-request?basCycleId=${encodeURIComponent(
          basCycleId
        )}`;
  const res = await fetch(url, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_payment_plan_fetch");
  return res.json() as Promise<{
    request: {
      id: string;
      basCycleId: string;
      requestedAt: string;
      status: string;
      reason: string;
      details: Record<string, unknown>;
      resolvedAt: string | null;
    } | null;
  }>;
}

export async function createPaymentPlanRequest(
  token: string,
  payload: {
    basCycleId: string;
    reason: string;
    weeklyAmount: number;
    startDate: string;
    notes?: string;
  }
) {
  const res = await fetch(`${API_BASE}/bas/payment-plan-request`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("failed_payment_plan_create");
  return res.json() as Promise<{
    request: {
      id: string;
      basCycleId: string;
      requestedAt: string;
      status: string;
      reason: string;
      details: Record<string, unknown>;
      resolvedAt: string | null;
    };
  }>;
}

export async function fetchEvidenceArtifacts(token: string) {
  const res = await fetch(`${API_BASE}/compliance/evidence`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_evidence_list");
  return res.json() as Promise<{
    artifacts: Array<{
      id: string;
      kind: string;
      sha256: string;
      wormUri: string;
      createdAt: string;
    }>;
  }>;
}

export async function createEvidenceArtifact(token: string) {
  const res = await fetch(`${API_BASE}/compliance/evidence`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_evidence_create");
  return res.json() as Promise<{
    artifact: {
      id: string;
      sha256: string;
      createdAt: string;
      wormUri: string;
    };
  }>;
}

export async function fetchEvidenceArtifactDetail(token: string, artifactId: string) {
  const res = await fetch(`${API_BASE}/compliance/evidence/${artifactId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_evidence_detail");
  return res.json() as Promise<{
    artifact: {
      id: string;
      kind: string;
      sha256: string;
      wormUri: string;
      createdAt: string;
      payload: Record<string, unknown> | null;
    };
  }>;
}

export type RegulatorLoginResponse = {
  token: string;
  session: {
    id: string;
    issuedAt: string;
    expiresAt: string;
    sessionToken: string;
  };
};

export async function regulatorLogin(accessCode: string, orgId?: string) {
  const trimmedCode = accessCode.trim();
  const resolvedOrgId = orgId?.trim() && orgId.trim().length > 0 ? orgId.trim() : undefined;
  const res = await fetch(`${API_BASE}/regulator/login`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      accessCode: trimmedCode,
      orgId: resolvedOrgId,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const code =
      (body as { error?: { code?: string } } | null)?.error?.code ?? "regulator_login_failed";
    const error = new Error(code);
    (error as any).payload = body;
    throw error;
  }

  const payload = (await res.json()) as RegulatorLoginResponse;
  return {
    ...payload,
    orgId: resolvedOrgId ?? "dev-org",
  };
}

export async function fetchRegulatorComplianceReport(token: string) {
  const res = await fetch(`${API_BASE}/regulator/compliance/report`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_regulator_compliance");
  return res.json() as Promise<{
    orgId: string;
    basHistory: Array<{
      period: string;
      lodgedAt: string | null;
      status: string;
      notes: string;
    }>;
    paymentPlans: Array<{
      id: string;
      basCycleId: string;
      requestedAt: string;
      status: string;
      reason: string;
      details: Record<string, unknown>;
      resolvedAt: string | null;
    }>;
    alertsSummary: {
      openHighSeverity: number;
      resolvedThisQuarter: number;
    };
    nextBasDue: string | null;
    designatedTotals: {
      paygw: number;
      gst: number;
    };
  }>;
}

export async function fetchRegulatorAlerts(token: string) {
  const res = await fetch(`${API_BASE}/regulator/alerts`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_regulator_alerts");
  return res.json() as Promise<{
    alerts: Array<{
      id: string;
      type: string;
      severity: string;
      message: string;
      createdAt: string;
      resolved: boolean;
      resolvedAt: string | null;
    }>;
  }>;
}

export async function fetchRegulatorMonitoringSnapshots(token: string, limit = 5) {
  const params = new URLSearchParams({ limit: String(limit) });
  const res = await fetch(`${API_BASE}/regulator/monitoring/snapshots?${params.toString()}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_regulator_snapshots");
  return res.json() as Promise<{
    snapshots: Array<{
      id: string;
      type: string;
      createdAt: string;
      payload: {
        generatedAt: string;
        alerts: {
          total: number;
          openHigh: number;
          openMedium: number;
          recent: Array<{
            id: string;
            type: string;
            severity: string;
            createdAt: string;
            resolved: boolean;
          }>;
        };
        paymentPlansOpen: number;
        designatedTotals: {
          paygw: number;
          gst: number;
        };
        bas: null | {
          overallStatus: string;
          paygw: {
            required: number;
            secured: number;
            status: string;
            shortfall?: number;
          };
          gst: {
            required: number;
            secured: number;
            status: string;
            shortfall?: number;
          };
          blockers: string[];
        };
      };
    }>;
  }>;
}

export async function fetchRegulatorEvidenceList(token: string) {
  const res = await fetch(`${API_BASE}/regulator/evidence`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_regulator_evidence");
  return res.json() as Promise<{
    artifacts: Array<{
      id: string;
      kind: string;
      sha256: string;
      wormUri: string | null;
      createdAt: string;
    }>;
  }>;
}

export async function fetchRegulatorEvidenceDetail(token: string, artifactId: string) {
  const res = await fetch(`${API_BASE}/regulator/evidence/${artifactId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_regulator_evidence_detail");
  return res.json() as Promise<{
    artifact: {
      id: string;
      kind: string;
      sha256: string;
      wormUri: string | null;
      createdAt: string;
      payload: Record<string, unknown> | null;
    };
  }>;
}

export async function fetchRegulatorBankSummary(token: string) {
  const res = await fetch(`${API_BASE}/regulator/bank-lines/summary`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_regulator_bank_summary");
  return res.json() as Promise<{
    summary: {
      totalEntries: number;
      totalAmount: number;
      firstEntryAt: string | null;
      lastEntryAt: string | null;
    };
    recent: Array<{
      id: string;
      date: string;
      amount: number;
    }>;
  }>;
}
