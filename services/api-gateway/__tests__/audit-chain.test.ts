import crypto from "node:crypto";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const findFirst = jest.fn();
const create = jest.fn();

async function loadRecordAuditLog() {
  jest.resetModules();

  const db = await import("../src/db.js");
  Object.assign(db.prisma, {
    auditLog: {
      findFirst,
      create,
    },
  });

  const module = await import("../src/lib/audit.js");
  return module.recordAuditLog;
}

describe("recordAuditLog", () => {
  beforeEach(() => {
    findFirst.mockReset();
    create.mockReset();
  });

  it("chains prevHash and computes deterministic hash", async () => {
    const timestamp = new Date("2025-03-01T12:34:56.000Z");

    findFirst.mockResolvedValue({
      hash: "prev-hash-value",
    });

    const recordAuditLog = await loadRecordAuditLog();

    await recordAuditLog({
      orgId: "org-123",
      actorId: "actor-456",
      action: "regulator.evidence.list",
      metadata: { count: 5 },
      timestamp,
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: { orgId: "org-123" },
      orderBy: { createdAt: "desc" },
    });

    expect(create).toHaveBeenCalledTimes(1);
    const [{ data }] = create.mock.calls[0];

    expect(data.prevHash).toBe("prev-hash-value");
    expect(data.orgId).toBe("org-123");
    expect(data.actorId).toBe("actor-456");
    expect(data.action).toBe("regulator.evidence.list");
    expect(data.createdAt).toBe(timestamp);

    const expectedHashPayload = JSON.stringify({
      orgId: "org-123",
      actorId: "actor-456",
      action: "regulator.evidence.list",
      metadata: { count: 5 },
      createdAt: timestamp.toISOString(),
      prevHash: "prev-hash-value",
    });
    const expectedHash = crypto
      .createHash("sha256")
      .update(expectedHashPayload)
      .digest("hex");

    expect(data.hash).toBe(expectedHash);
  });

  it("sets prevHash to null when there is no prior entry", async () => {
    const timestamp = new Date("2025-03-02T00:00:00.000Z");

    findFirst.mockResolvedValue(null);

    const recordAuditLog = await loadRecordAuditLog();

    await recordAuditLog({
      orgId: "org-789",
      actorId: "actor-999",
      action: "users.list",
      metadata: undefined,
      timestamp,
    });

    expect(create).toHaveBeenCalledTimes(1);
    const [{ data }] = create.mock.calls[0];

    expect(data.prevHash).toBeNull();

    const expectedHashPayload = JSON.stringify({
      orgId: "org-789",
      actorId: "actor-999",
      action: "users.list",
      metadata: null,
      createdAt: timestamp.toISOString(),
      prevHash: null,
    });

    const expectedHash = crypto
      .createHash("sha256")
      .update(expectedHashPayload)
      .digest("hex");

    expect(data.hash).toBe(expectedHash);
  });

  it("swallows errors when throwOnError is false", async () => {
    const recordAuditLog = await loadRecordAuditLog();
    const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    create.mockRejectedValueOnce(new Error("db down"));

    await expect(
      recordAuditLog({
        orgId: "org-err",
        actorId: "actor-err",
        action: "users.update",
        metadata: null,
      }),
    ).resolves.toBeUndefined();

    expect(warning).toHaveBeenCalledWith("audit-log failure", expect.objectContaining({ orgId: "org-err", action: "users.update" }));

    warning.mockRestore();
  });

  it("rethrows errors when throwOnError is true", async () => {
    const recordAuditLog = await loadRecordAuditLog();
    const error = new Error("db down");
    create.mockRejectedValueOnce(error);

    await expect(
      recordAuditLog({
        orgId: "org-err",
        actorId: "actor-err",
        action: "users.update",
        metadata: null,
        throwOnError: true,
      }),
    ).rejects.toBe(error);
  });
});
