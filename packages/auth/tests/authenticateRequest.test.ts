jest.mock("jose", () => ({
  importJWK: jest.fn(),
  jwtVerify: jest.fn(),
}));

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  AuthError,
  authenticateRequest,
  authInternals,
  type Principal,
} from "../src/index";

describe("authenticateRequest", () => {
  const metrics = { recordSecurityEvent: jest.fn() };
  const app = { metrics } as unknown as FastifyInstance;

  let originalVerify: typeof authInternals.verifyRequest;

  beforeEach(() => {
    metrics.recordSecurityEvent.mockClear();
    originalVerify = authInternals.verifyRequest;
  });

  afterEach(() => {
    authInternals.verifyRequest = originalVerify;
  });

  function buildRequest(): FastifyRequest {
    return { headers: {}, log: { debug: jest.fn() } } as unknown as FastifyRequest;
  }

  function buildReply(): FastifyReply {
    return {
      code: jest.fn().mockReturnThis(),
      send: jest.fn(),
    } as unknown as FastifyReply;
  }

  it("authenticates and records success", async () => {
    const verifyMock = jest.fn<Promise<Principal>, [FastifyRequest, FastifyReply]>().mockResolvedValue({
      id: "user-123",
      orgId: "org-456",
      roles: ["admin"],
      token: "token",
    });
    authInternals.verifyRequest = verifyMock;

    const request = buildRequest();
    const reply = buildReply();

    const principal = await authenticateRequest(app, request, reply, ["admin"]);

    expect(principal).toEqual(
      expect.objectContaining({ id: "user-123", orgId: "org-456", roles: ["admin"] }),
    );
    expect(metrics.recordSecurityEvent).toHaveBeenCalledWith("auth.success");
    expect(reply.code).not.toHaveBeenCalled();
  });

  it("blocks principals without required roles", async () => {
    const verifyMock = jest.fn<Promise<Principal>, [FastifyRequest, FastifyReply]>().mockResolvedValue({
      id: "user-123",
      orgId: "org-456",
      roles: ["analyst"],
      token: "token",
    });
    authInternals.verifyRequest = verifyMock;

    const request = buildRequest();
    const reply = buildReply();

    const principal = await authenticateRequest(app, request, reply, ["auditor"]);

    expect(principal).toBeNull();
    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({ error: "forbidden" });
    expect(metrics.recordSecurityEvent).toHaveBeenCalledWith("auth.forbidden");
  });

  it("maps AuthErrors from verification to HTTP 401", async () => {
    const verifyMock = jest
      .fn<Promise<Principal>, [FastifyRequest, FastifyReply]>()
      .mockRejectedValue(new AuthError("unauthorized"));
    authInternals.verifyRequest = verifyMock;

    const request = buildRequest();
    const reply = buildReply();

    const principal = await authenticateRequest(app, request, reply, ["admin"]);

    expect(principal).toBeNull();
    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: "unauthorized" });
    expect(metrics.recordSecurityEvent).toHaveBeenCalledWith("auth.unauthorized");
  });
});
