// webapp/src/api.ts
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error("Login failed");
  }

  return res.json() as Promise<{ token: string }>;
}

export async function fetchUsers(token: string) {
  const res = await fetch(`${API_BASE}/users`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
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
    headers: {
      Authorization: `Bearer ${token}`,
    },
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
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(line),
  });
  if (!res.ok) throw new Error("create failed");
  return res.json();
}
