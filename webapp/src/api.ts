// services/webapp/src/api.ts

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export interface LoginResult {
  token: string;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error("Login failed");
  }

  return res.json();
}

export interface BankLine {
  id: string;
  postedAt: string;
  amount: number;
  description: string; // will be "***"
  createdAt: string;
}

export async function fetchBankLines(token: string): Promise<BankLine[]> {
  const res = await fetch(`${API_BASE}/bank-lines`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch bank lines");
  }
  const data = await res.json();
  return data.lines ?? [];
}

export async function createBankLine(
  token: string,
  payload: { date: string; amount: string; payee: string; desc: string },
): Promise<BankLine> {
  const res = await fetch(`${API_BASE}/bank-lines`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      date: payload.date,
      amount: payload.amount,
      payee: payload.payee,
      desc: payload.desc,
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to create bank line");
  }

  const data = await res.json();
  return data.line;
}
