import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import Fastify from "fastify";

import {
  configurePIIProviders,
  decryptPII,
  encryptPII,
  registerPIIRoutes,
  tokenizeTFN,
  type AuditEvent,
  type AuditLogger,
  type KeyManagementService,
  type TokenSaltProvider,
} from "../src/lib/pii";
import { isValidABN, isValidTFN } from "../src/lib/au";

const TEST_KEY = Buffer.alloc(32, 7);
const TEST_SALT = Buffer.from("test-salt-secret", "utf8");

const kms: KeyManagementService = {
  getActiveKey: () => ({ kid: "test-kid", material: TEST_KEY }),
  getKeyById: (kid) => (kid === "test-kid" ? { kid, material: TEST_KEY } : undefined),
};

const saltProvider: TokenSaltProvider = {
  getActiveSalt: () => ({ sid: "salt-v1", secret: TEST_SALT }),
  getSaltById: (sid) => (sid === "salt-v1" ? { sid, secret: TEST_SALT } : undefined),
};

const events: AuditEvent[] = [];

function setupProviders() {
  events.length = 0;
  const auditLogger: AuditLogger = {
    record: (event) => {
      events.push(event);
    },
  };
  configurePIIProviders({ kms, saltProvider, auditLogger });
}

beforeEach(() => {
  setupProviders();
});

afterEach(() => {
  events.length = 0;
});

describe("ABN validation", () => {
  it("accepts known valid ABNs", () => {
    const valid = ["51824753556", "51 824 753 556", "10 000 000 032"];
    for (const abn of valid) {
      assert.equal(isValidABN(abn), true);
    }
  });

  it("rejects invalid ABNs", () => {
    const invalid = ["51824753555", "1234567890", "ABCDEFGHIJK", "00 000 000 000", "83 004 085 616"];
    for (const abn of invalid) {
      assert.equal(isValidABN(abn), false);
    }
  });
});

describe("TFN handling", () => {
  it("never exposes the original TFN", () => {
    const tfn = "123 456 788";
    assert.equal(isValidTFN(tfn), true);

    const token = tokenizeTFN(tfn);
    assert.equal(token.includes("123456788"), false);
    assert.equal(token.startsWith("salt-v1."), true);

    assert.throws(() => decryptPII({ ciphertext: token, kid: "test-kid" }));
  });

  it("normalises formatted TFNs before tokenising", () => {
    const formatted = "123-456-788";
    const dotted = "123.456.788";

    const baseToken = tokenizeTFN(formatted);
    const dottedToken = tokenizeTFN(dotted);

    assert.equal(isValidTFN(formatted), true);
    assert.equal(isValidTFN(dotted), true);
    assert.equal(baseToken.startsWith("salt-v1."), true);
    assert.equal(baseToken.includes("123456788"), false);
    assert.equal(baseToken, dottedToken);
  });
});

describe("admin decryption", () => {
  it("emits an audit event when decryption succeeds", async () => {
    const app = Fastify();
    registerPIIRoutes(app, () => ({ allowed: true, actorId: "admin-user" }));
    await app.ready();

    const secret = encryptPII("sensitive payload");
    const response = await app.inject({
      method: "POST",
      url: "/admin/pii/decrypt",
      payload: secret,
    });

    assert.equal(response.statusCode, 200);
    const body = response.json() as { value: string };
    assert.equal(body.value, "sensitive payload");

    assert.equal(events.length, 1);
    assert.deepEqual(events[0], {
      actorId: "admin-user",
      action: "pii.decrypt",
      timestamp: events[0].timestamp,
      metadata: { kid: secret.kid },
    });
    assert.equal(JSON.stringify(events[0]).includes("sensitive payload"), false);

    await app.close();
  });

  it("denies non-admin access", async () => {
    const app = Fastify();
    registerPIIRoutes(app, () => ({ allowed: false, actorId: "guest" }));
    await app.ready();

    const secret = encryptPII("payload");
    const response = await app.inject({
      method: "POST",
      url: "/admin/pii/decrypt",
      payload: secret,
    });

    assert.equal(response.statusCode, 403);
    assert.equal(events.length, 0);

    await app.close();
  });
});
