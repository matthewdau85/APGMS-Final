import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
  type WebAuthnCredential,
} from "@simplewebauthn/server";

import { config } from "../config.js";

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type ChallengeRecord = {
  userId: string;
  challenge: string;
  expiresAt: number;
  allowedCredentialIds?: Set<string>;
};

const registrationChallenges = new Map<string, ChallengeRecord>();
const authenticationChallenges = new Map<string, ChallengeRecord>();

const now = () => Date.now();

function cleanup(store: Map<string, ChallengeRecord>): void {
  const ts = now();
  for (const [key, record] of store.entries()) {
    if (record.expiresAt <= ts) {
      store.delete(key);
    }
  }
}

function base64UrlToBase64(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalized.length % 4)) % 4;
  return normalized + "=".repeat(padding);
}

function extractChallengeFromClientData(
  clientDataJSON: string | ArrayBuffer | Buffer | null | undefined,
): string | null {
  if (!clientDataJSON) {
    return null;
  }
  let raw: string;
  if (typeof clientDataJSON === "string") {
    raw = clientDataJSON;
  } else if (ArrayBuffer.isView(clientDataJSON)) {
    raw = Buffer.from(clientDataJSON.buffer).toString("base64");
  } else {
    raw = Buffer.from(clientDataJSON).toString("base64");
  }
  try {
    const decoded = Buffer.from(base64UrlToBase64(raw), "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    if (typeof parsed.challenge === "string") {
      return parsed.challenge;
    }
  } catch {
    // fall through
  }
  return null;
}

export async function createRegistrationOptions(options: {
  userId: string;
  username: string;
  displayName: string;
  excludeCredentialIds: string[];
}) {
  cleanup(registrationChallenges);

  const registrationOptions = await generateRegistrationOptions({
    rpName: config.webauthn.rpName,
    rpID: config.webauthn.rpId,
    userName: options.username,
    userID: Buffer.from(options.userId, "utf8"),
    userDisplayName: options.displayName,
    attestationType: "none",
    excludeCredentials: options.excludeCredentialIds.map((id) => ({ id })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  registrationChallenges.set(registrationOptions.challenge, {
    userId: options.userId,
    challenge: registrationOptions.challenge,
    expiresAt: now() + CHALLENGE_TTL_MS,
  });

  return registrationOptions;
}

export async function verifyPasskeyRegistration(
  userId: string,
  response: RegistrationResponseJSON,
) {
  const challengeKey = extractChallengeFromClientData(response.response.clientDataJSON);
  if (!challengeKey) {
    throw new Error("registration_challenge_missing");
  }
  const challenge = registrationChallenges.get(challengeKey);
  if (!challenge || challenge.userId !== userId) {
    throw new Error("registration_challenge_missing");
  }
  registrationChallenges.delete(challengeKey);

  return verifyRegistrationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: config.webauthn.origin,
    expectedRPID: config.webauthn.rpId,
    requireUserVerification: true,
  });
}

export async function createAuthenticationOptions(options: {
  userId: string;
  allowCredentialIds: string[];
}) {
  cleanup(authenticationChallenges);

  const authenticationOptions = await generateAuthenticationOptions({
    rpID: config.webauthn.rpId,
    userVerification: "preferred",
    allowCredentials: options.allowCredentialIds.map((id) => ({ id })),
  });

  authenticationChallenges.set(authenticationOptions.challenge, {
    userId: options.userId,
    challenge: authenticationOptions.challenge,
    expiresAt: now() + CHALLENGE_TTL_MS,
    allowedCredentialIds: new Set(options.allowCredentialIds),
  });

  return authenticationOptions;
}

export async function verifyPasskeyAuthentication(
  userId: string,
  response: AuthenticationResponseJSON,
  credential: WebAuthnCredential,
) {
  const challengeKey = extractChallengeFromClientData(response.response.clientDataJSON);
  if (!challengeKey) {
    throw new Error("authentication_challenge_missing");
  }
  const challenge = authenticationChallenges.get(challengeKey);
  if (!challenge || challenge.userId !== userId) {
    throw new Error("authentication_challenge_missing");
  }
  authenticationChallenges.delete(challengeKey);

  if (challenge.allowedCredentialIds && !challenge.allowedCredentialIds.has(credential.id)) {
    throw new Error("authentication_credential_mismatch");
  }

  return verifyAuthenticationResponse({
    response,
    credential,
    expectedChallenge: challenge.challenge,
    expectedOrigin: config.webauthn.origin,
    expectedRPID: config.webauthn.rpId,
    requireUserVerification: true,
  });
}
