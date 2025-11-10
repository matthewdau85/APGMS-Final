import type { FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type { TLSSocket } from "node:tls";

interface MutualTlsOptions {
  required?: boolean;
  allowedSubjects?: string[];
  requireHttpsHeader?: boolean;
}

type CertificateSummary = {
  subject?: string;
  issuer?: string;
  validTo?: string;
  fingerprint256?: string;
};

function extractCertificate(request: FastifyRequest): CertificateSummary | null {
  const socket = request.raw.socket as TLSSocket | undefined;
  if (!socket || typeof socket.getPeerCertificate !== "function") {
    return null;
  }

  const cert = socket.getPeerCertificate();
  if (!cert || Object.keys(cert).length === 0) {
    return null;
  }

  return {
    subject: cert.subject?.CN ?? cert.subject?.commonName,
    issuer: cert.issuer?.CN ?? cert.issuer?.commonName,
    validTo: cert.valid_to,
    fingerprint256: cert.fingerprint256,
  };
}

function ensureHttpsHeader(request: FastifyRequest, reply: FastifyReply, enabled: boolean): boolean {
  if (!enabled) {
    return true;
  }
  const forwarded = request.headers["x-forwarded-proto"];
  if (typeof forwarded === "string" && forwarded.toLowerCase() === "https") {
    return true;
  }
  reply.code(400).send({
    error: {
      code: "https_required",
      message: "HTTPS required via X-Forwarded-Proto header",
    },
  });
  return false;
}

function ensureMutualTls(
  request: FastifyRequest,
  reply: FastifyReply,
  options: MutualTlsOptions,
): boolean {
  if (!options.required) {
    return true;
  }

  const socket = request.raw.socket as TLSSocket | undefined;
  if (!socket?.encrypted) {
    reply.code(495).send({
      error: {
        code: "mutual_tls_required",
        message: "Client TLS certificate missing",
      },
    });
    return false;
  }

  if (!socket.authorized) {
    reply.code(495).send({
      error: {
        code: "mutual_tls_unauthorized",
        message: socket.authorizationError ?? "Client certificate rejected",
      },
    });
    return false;
  }

  const certificate = extractCertificate(request);
  if (!certificate) {
    reply.code(495).send({
      error: {
        code: "mutual_tls_required",
        message: "Client TLS certificate missing",
      },
    });
    return false;
  }

  if (options.allowedSubjects && options.allowedSubjects.length > 0) {
    const allowed = options.allowedSubjects.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
    if (allowed.length > 0) {
      if (!certificate.subject || !allowed.includes(certificate.subject)) {
        reply.code(403).send({
          error: {
            code: "mutual_tls_forbidden",
            message: "Client certificate subject not permitted",
          },
        });
        return false;
      }
    }
  }

  (request as FastifyRequest & { mutualTls?: CertificateSummary }).mutualTls = certificate;
  return true;
}

export default fp<MutualTlsOptions>(async (app, options = {}) => {
  const settings: MutualTlsOptions = {
    required: options.required ?? false,
    allowedSubjects: options.allowedSubjects ?? [],
    requireHttpsHeader: options.requireHttpsHeader ?? false,
  };

  if (!settings.required && !settings.requireHttpsHeader) {
    return;
  }

  app.addHook("onRequest", (request, reply, done) => {
    if (!ensureHttpsHeader(request, reply, Boolean(settings.requireHttpsHeader))) {
      return;
    }
    if (!ensureMutualTls(request, reply, settings)) {
      return;
    }
    done();
  });
});
