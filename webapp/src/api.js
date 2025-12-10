// webapp/src/api.js
// Clean ESM version for Vite – named exports only.

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

function authHeaders(token) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error("Login failed");
  }
  return res.json();
}

export async function initiateMfa(token) {
  const res = await fetch(`${API_BASE}/auth/mfa/initiate`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) {
    throw new Error("failed_mfa_initiate");
  }
  return res.json();
}

export async function verifyMfa(token, code) {
  const res = await fetch(`${API_BASE}/auth/mfa/verify`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    throw new Error("failed_mfa_verify");
  }
  return res.json();
}

export async function fetchUsers(token) {
  const res = await fetch(`${API_BASE}/users`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("unauthorized");
  return res.json();
}

export async function fetchBankLines(token) {
  const res = await fetch(`${API_BASE}/bank-lines`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("unauthorized");
  return res.json();
}

// Backwards-compatible helper used by legacy components
export async function getBankLines(token) {
  return fetchBankLines(token);
}

export async function createBankLine(token, line) {
  const res = await fetch(`${API_BASE}/bank-lines`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(line),
  });
  if (!res.ok) throw new Error("create failed");
  return res.json();
}

export async function fetchCurrentObligations(token) {
  const res = await fetch(`${API_BASE}/org/obligations/current`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_obligations");
  return res.json();
}

export async function fetchPayrollFeeds(token) {
  const res = await fetch(`${API_BASE}/feeds/payroll`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_payroll");
  return res.json();
}

export async function fetchGstFeeds(token) {
  const res = await fetch(`${API_BASE}/feeds/gst`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_gst");
  return res.json();
}

export async function fetchAlerts(token) {
  const res = await fetch(`${API_BASE}/alerts`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_alerts");
  return res.json();
}

export async function resolveAlert(token, alertId, note, mfaCode) {
  const payload = { note };
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
    const errorCode = errorBody?.error?.code ?? "failed_resolve_alert";
    const error = new Error(errorCode);
    error.payload = errorBody;
    throw error;
  }

  return res.json();
}

export async function fetchBasPreview(token) {
  const res = await fetch(`${API_BASE}/bas/preview`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_bas_preview");
  return res.json();
}

export async function lodgeBas(token, options) {
  const payload = {};
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
    const errorCode = errorBody?.error?.code ?? "failed_bas_lodge";
    const error = new Error(errorCode);
    error.payload = errorBody;
    throw error;
  }

  return res.json();
}

export async function fetchComplianceReport(token) {
  const res = await fetch(`${API_BASE}/compliance/report`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_compliance");
  return res.json();
}

export async function fetchSecurityUsers(token) {
  const res = await fetch(`${API_BASE}/security/users`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_security_users");
  return res.json();
}

export async function fetchDesignatedAccounts(token) {
  const res = await fetch(`${API_BASE}/org/designated-accounts`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_designated_accounts");
  return res.json();
}

export async function fetchPaymentPlanRequest(token, basCycleId) {
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
  return res.json();
}

export async function createPaymentPlanRequest(token, payload) {
  const res = await fetch(`${API_BASE}/bas/payment-plan-request`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("failed_payment_plan_create");
  return res.json();
}

export async function fetchEvidenceArtifacts(token) {
  const res = await fetch(`${API_BASE}/compliance/evidence`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_evidence_list");
  return res.json();
}

export async function createEvidenceArtifact(token) {
  const res = await fetch(`${API_BASE}/compliance/evidence`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_evidence_create");
  return res.json();
}

export async function fetchEvidenceArtifactDetail(token, artifactId) {
  const res = await fetch(`${API_BASE}/compliance/evidence/${artifactId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_evidence_detail");
  return res.json();
}

export async function regulatorLogin(accessCode, orgId) {
  const trimmedCode = accessCode.trim();
  const resolvedOrgId =
    orgId?.trim() && orgId.trim().length > 0 ? orgId.trim() : undefined;

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
    const code = body?.error?.code ?? "regulator_login_failed";
    const error = new Error(code);
    error.payload = body;
    throw error;
  }

  const payload = await res.json();
  return {
    ...payload,
    orgId: resolvedOrgId ?? "dev-org",
  };
}

export async function fetchRegulatorComplianceReport(token) {
  const res = await fetch(`${API_BASE}/regulator/compliance/report`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_regulator_compliance");
  return res.json();
}

export async function fetchRegulatorAlerts(token) {
  const res = await fetch(`${API_BASE}/regulator/alerts`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_regulator_alerts");
  return res.json();
}

export async function fetchRegulatorMonitoringSnapshots(token, limit = 5) {
  const params = new URLSearchParams({ limit: String(limit) });
  const res = await fetch(
    `${API_BASE}/regulator/monitoring/snapshots?${params.toString()}`,
    {
      headers: authHeaders(token),
    }
  );
  if (!res.ok) throw new Error("failed_regulator_snapshots");
  return res.json();
}

export async function fetchRegulatorEvidenceList(token) {
  const res = await fetch(`${API_BASE}/regulator/evidence`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_regulator_evidence");
  return res.json();
}

export async function fetchRegulatorEvidenceDetail(token, artifactId) {
  const res = await fetch(`${API_BASE}/regulator/evidence/${artifactId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_regulator_evidence_detail");
  return res.json();
}

export async function generateDemoBankLines(token, payload = {}) {
  const res = await fetch(`${API_BASE}/demo/banking/generate`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("failed_demo_bank_lines");
  return res.json();
}

export async function runDemoPayroll(token, payload = {}) {
  const res = await fetch(`${API_BASE}/demo/payroll/run`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("failed_demo_payroll");
  return res.json();
}

export async function compileDemoBas(token, payload) {
  const res = await fetch(`${API_BASE}/demo/bas/compile`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("failed_demo_bas");
  return res.json();
}

export async function fetchRegulatorBankSummary(token) {
  const res = await fetch(`${API_BASE}/regulator/bank-lines/summary`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("failed_regulator_bank_summary");
  return res.json();
}
