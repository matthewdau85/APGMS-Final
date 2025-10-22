export type AuthTokenPayload = {
  id: string;
  sub: string;
  orgId: string;
  email: string;
  role: "user" | "admin";
  aud?: string | string[];
  iss?: string;
  exp?: number;
  iat?: number;
};
