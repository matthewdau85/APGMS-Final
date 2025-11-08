import React, { useEffect, useState } from "react";

import { fetchRegulatorEvidenceAttestation } from "../api";

export type EvidenceVerifyProps = {
  token: string | null;
  artifactId: string;
  sha256: string;
  wormUri: string | null;
};

type AttestationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      attestation: {
        uri: string;
        sha256: string;
        lockState: string;
        retentionUntil: string | null;
        providerId: string;
        scope: string;
      };
    };

const containerStyle: React.CSSProperties = {
  marginTop: "20px",
  padding: "16px",
  borderRadius: "12px",
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
  display: "grid",
  gap: "12px",
};

const headlineStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "15px",
  fontWeight: 600,
  color: "#0f172a",
};

const hintStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#475569",
  margin: 0,
};

const successStyle: React.CSSProperties = {
  padding: "12px",
  borderRadius: "10px",
  background: "#dcfce7",
  color: "#166534",
  fontSize: "13px",
  display: "grid",
  gap: "4px",
};

export default function EvidenceVerify({
  token,
  artifactId,
  sha256,
  wormUri,
}: EvidenceVerifyProps) {
  const [state, setState] = useState<AttestationState>({ status: "idle" });

  useEffect(() => {
    if (!token) {
      setState({ status: "error", message: "Session expired" });
      return;
    }
    setState({ status: "loading" });
    let cancelled = false;

    async function load() {
      try {
        const response = await fetchRegulatorEvidenceAttestation(
          token,
          artifactId,
        );
        if (cancelled) return;
        setState({ status: "ready", attestation: response.attestation });
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "failed_attestation";
        setState({ status: "error", message });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token, artifactId]);

  return (
    <section style={containerStyle} aria-live="polite">
      <h3 style={headlineStyle}>Provider attestation</h3>
      <p style={hintStyle}>
        Content-addressed URI ensures the payload matches the immutable object.
      </p>
      {state.status === "loading" ? (
        <p style={hintStyle}>Verifying WORM retention…</p>
      ) : null}
      {state.status === "error" ? (
        <p style={{ ...hintStyle, color: "#b91c1c" }}>
          Unable to load attestation: {state.message}
        </p>
      ) : null}
      {state.status === "ready" ? (
        <div style={successStyle}>
          <strong>
            Verified &amp; locked until {formatDate(state.attestation.retentionUntil)}
          </strong>
          <span>
            URI: <code>{state.attestation.uri}</code>
          </span>
          <span>
            Provider: {state.attestation.providerId} ({state.attestation.lockState})
          </span>
          <span>
            SHA-256: <code>{state.attestation.sha256}</code>
          </span>
          {state.attestation.sha256.toLowerCase() !== sha256.toLowerCase() ? (
            <span style={{ color: "#92400e" }}>
              Warning: attested hash does not match stored digest {sha256}
            </span>
          ) : null}
          {wormUri && wormUri !== state.attestation.uri ? (
            <span style={{ color: "#92400e" }}>
              Warning: stored URI {wormUri} differs from attested URI {state.attestation.uri}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "no expiry";
  return new Date(value).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
