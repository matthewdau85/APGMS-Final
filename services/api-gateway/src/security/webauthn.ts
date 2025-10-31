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

type ChallengeRecord = { challenge: string; expiresAt: number };

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

  registrationChallenges.set(options.userId, {
    challenge: registrationOptions.challenge,
    expiresAt: now() + CHALLENGE_TTL_MS,
  });

  return registrationOptions;
}

export async function verifyPasskeyRegistration(
  userId: string,
  response: RegistrationResponseJSON,
) {
  const challenge = registrationChallenges.get(userId);
  if (!challenge) {
    throw new Error("registration_challenge_missing");
  }
  registrationChallenges.delete(userId);

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

  authenticationChallenges.set(options.userId, {
    challenge: authenticationOptions.challenge,
    expiresAt: now() + CHALLENGE_TTL_MS,
  });

  return authenticationOptions;
}

export async function verifyPasskeyAuthentication(
  userId: string,
  response: AuthenticationResponseJSON,
  credential: WebAuthnCredential,
) {
  const challenge = authenticationChallenges.get(userId);
  if (!challenge) {
    throw new Error("authentication_challenge_missing");
  }
  authenticationChallenges.delete(userId);

  return verifyAuthenticationResponse({
    response,
    credential,
    expectedChallenge: challenge.challenge,
    expectedOrigin: config.webauthn.origin,
    expectedRPID: config.webauthn.rpId,
    requireUserVerification: true,
  });
}
