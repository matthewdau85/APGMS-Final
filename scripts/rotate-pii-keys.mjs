#!/usr/bin/env node
import { writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes, generateKeyPairSync } from "node:crypto";

const args = process.argv.slice(2);
let envPath = null;
let dryRun = true;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--write-env" && args[i + 1]) {
    envPath = resolve(args[i + 1]);
    dryRun = false;
  }
}

const piiKeyMaterial = randomBytes(32).toString("base64");
const piiSaltMaterial = randomBytes(32).toString("base64");
const activeKid = `kid-${Date.now()}`;
const activeSid = `sid-${Date.now()}`;

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

const publicJwk = publicKey.export({ format: "jwk" });
publicJwk.alg = "RS256";
publicJwk.use = "sig";
publicJwk.kid = activeKid;

const envUpdates = {
  AUTH_JWKS: JSON.stringify({ keys: [publicJwk] }),
  PII_KEYS: JSON.stringify([{ kid: activeKid, material: piiKeyMaterial }]),
  PII_ACTIVE_KEY: activeKid,
  PII_SALTS: JSON.stringify([{ sid: activeSid, secret: piiSaltMaterial }]),
  PII_ACTIVE_SALT: activeSid,
};

console.log("# Generated secrets");
console.log(JSON.stringify(envUpdates, null, 2));
console.log("\n# Private key (store securely)");
console.log(privateKey.export({ format: "pem", type: "pkcs8" }).toString());

if (dryRun) {
  console.log("\nNo changes written. Pass --write-env <path> to update an env file.");
  process.exit(0);
}

const envFile = envPath ?? resolve(".env");
let existing = "";
try {
  existing = readFileSync(envFile, "utf8");
} catch {
  // New file; leave existing empty
}

let updated = existing;
for (const [key, value] of Object.entries(envUpdates)) {
  const pattern = new RegExp(`^${escapeRegex(key)}=.*$`, "m");
  const line = `${key}=${value}`;
  if (pattern.test(updated)) {
    updated = updated.replace(pattern, line);
  } else {
    if (updated.length && !updated.endsWith("\n")) {
      updated += "\n";
    }
    updated += `${line}\n`;
  }
}

writeFileSync(envFile, updated, "utf8");
console.log(`Updated ${envFile} with new key material.`);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
