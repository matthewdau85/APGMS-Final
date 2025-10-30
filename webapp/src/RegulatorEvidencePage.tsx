import React, { useEffect, useMemo, useState } from "react";
import {
  fetchRegulatorEvidenceDetail,
  fetchRegulatorEvidenceList,
} from "./api";
import { getRegulatorToken } from "./regulatorAuth";

type EvidenceList = Awaited<ReturnType<typeof fetchRegulatorEvidenceList>>;
type EvidenceDetail = Awaited<ReturnType<typeof fetchRegulatorEvidenceDetail>>;

type ListState = {
  loading: boolean;
  error: string | null;
  artifacts: EvidenceList["artifacts"];
};

type DetailState = {
  loading: boolean;
  error: string | null;
  artifact: EvidenceDetail["artifact"] | null;
  verification: {
    status: "idle" | "busy" | "match" | "mismatch" | "unavailable";
    computedHash?: string;
  };
};

const initialListState: ListState = {
  loading: true,
  error: null,
  artifacts: [],
};

const initialDetailState: DetailState = {
  loading: false,
  error: null,
  artifact: null,
  verification: { status: "idle" },
};

export default function RegulatorEvidencePage() {
  const token = getRegulatorToken();
  const [listState, setListState] = useState(initialListState);
  const [detailState, setDetailState] = useState(initialDetailState);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setListState({ loading: false, error: "Session expired", artifacts: [] });
      return;
    }

    let cancelled = false;
    async function loadList() {
      setListState(initialListState);
      try {
        const data = await fetchRegulatorEvidenceList(token);
        if (cancelled) return;
        setListState({ loading: false, error: null, artifacts: data.artifacts });
        if (data.artifacts.length > 0) {
          setSelectedId(data.artifacts[0].id);
        }
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "failed_evidence_list";
        setListState({ loading: false, error: message, artifacts: [] });
      }
    }
    loadList();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !selectedId) {
      setDetailState(initialDetailState);
      return;
    }
    let cancelled = false;
    async function loadDetail() {
      setDetailState({
        loading: true,
        error: null,
        artifact: null,
        verification: { status: "idle" },
      });
      try {
        const data = await fetchRegulatorEvidenceDetail(token, selectedId);
        if (cancelled) return;
        setDetailState({
          loading: false,
          error: null,
          artifact: data.artifact,
          verification: { status: "idle" },
        });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "failed_evidence_detail";
        setDetailState({
          loading: false,
          error: message,
          artifact: null,
          verification: { status: "idle" },
        });
      }
    }
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [token, selectedId]);

  const sortedArtifacts = useMemo(() => {
    return [...listState.artifacts].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [listState.artifacts]);

  async function handleVerify() {
    if (!detailState.artifact) {
      return;
    }
    if (!window.crypto?.subtle) {
      setDetailState((prev) => ({
        ...prev,
        verification: { status: "unavailable" },
      }));
      return;
    }
    setDetailState((prev) => ({
      ...prev,
      verification: { status: "busy" },
    }));
    const payloadJson = JSON.stringify(detailState.artifact.payload ?? null);
    const encoder = new TextEncoder();
    const digest = await window.crypto.subtle.digest("SHA-256", encoder.encode(payloadJson));
    const computed = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const matches = computed.toLowerCase() === detailState.artifact.sha256.toLowerCase();
    setDetailState((prev) => ({
      ...prev,
      verification: {
        status: matches ? "match" : "mismatch",
        computedHash: computed,
      },
    }));
  }

  if (!token) {
    return renderPanel("Session expired", "Please sign in again to review evidence.");
  }

  if (listState.loading) {
    return renderPanel("Loading evidence library...", null);
  }

  if (listState.error) {
    return renderPanel("Unable to load evidence", listState.error);
  }

  return (
    <div style={pageLayoutStyle}>
      <aside style={sidebarStyle}>
        <div>
          <h2 style={sidebarTitleStyle}>Evidence library</h2>
          <p style={sidebarSubtitleStyle}>
            Append-only package of regulator evidence stored with hash digests.
          </p>
        </div>
        <div style={listStyle}>
          {sortedArtifacts.length === 0 ? (
            <div style={emptyStateStyle}>No artifacts generated yet.</div>
          ) : (
            sortedArtifacts.map((artifact) => {
              const isSelected = artifact.id === selectedId;
              return (
                <button
                  key={artifact.id}
                  type="button"
                  onClick={() => setSelectedId(artifact.id)}
                  style={{
                    ...artifactButtonStyle,
                    borderColor: isSelected ? "#0b5fff" : "transparent",
                    backgroundColor: isSelected ? "rgba(11, 95, 255, 0.1)" : "transparent",
                  }}
                >
                  <div style={artifactTitleStyle}>{artifact.kind}</div>
                  <div style={artifactMetaStyle}>{formatDate(artifact.createdAt)}</div>
                  <code style={artifactHashStyle}>{artifact.sha256.slice(0, 12)}...</code>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section style={detailPaneStyle}>
        {detailState.loading ? (
          <div style={emptyStateStyle}>Loading artifact details...</div>
        ) : detailState.error ? (
          <div style={emptyStateStyle}>Failed to load artifact: {detailState.error}</div>
        ) : detailState.artifact ? (
          <ArtifactDetailView
            artifact={detailState.artifact}
            verification={detailState.verification}
            onVerify={handleVerify}
          />
        ) : (
          <div style={emptyStateStyle}>Select an artifact to inspect the payload.</div>
        )}
      </section>
    </div>
  );
}

function ArtifactDetailView({
  artifact,
  verification,
  onVerify,
}: {
  artifact: EvidenceDetail["artifact"];
  verification: DetailState["verification"];
  onVerify: () => void;
}) {
  return (
    <div style={detailContentStyle}>
      <header style={detailHeaderStyle}>
        <div>
          <div style={detailTitleStyle}>{artifact.kind}</div>
          <div style={detailMetaStyle}>Captured {formatDate(artifact.createdAt)}</div>
        </div>
        <button
          type="button"
          onClick={onVerify}
          style={verifyButtonStyle}
          disabled={verification.status === "busy"}
        >
          {verification.status === "busy" ? "Verifying..." : "Verify hash"}
        </button>
      </header>

      <div style={hashSectionStyle}>
        <div style={hashLabelStyle}>Recorded SHA-256 digest</div>
        <code style={hashValueStyle}>{artifact.sha256}</code>
        {verification.status === "match" && (
          <div style={{ color: "#166534", fontSize: "13px" }}>
            Payload matches recorded hash ({verification.computedHash}).
          </div>
        )}
        {verification.status === "mismatch" && (
          <div style={{ color: "#b91c1c", fontSize: "13px" }}>
            Computed hash {verification.computedHash} does not match the stored digest.
          </div>
        )}
        {verification.status === "unavailable" && (
          <div style={{ color: "#92400e", fontSize: "13px" }}>
            This browser cannot access SubtleCrypto. Re-run the smoke script to verify offline.
          </div>
        )}
      </div>

      <div style={payloadWrapperStyle}>
        <div style={payloadHeaderStyle}>
          Payload snapshot
          <span style={payloadHintStyle}>
            Hash computed over JSON.stringify(payload ?? null)
          </span>
        </div>
        <pre style={payloadBodyStyle}>
          {JSON.stringify(artifact.payload ?? null, null, 2)}
        </pre>
      </div>

      {artifact.wormUri ? (
        <div style={wormHintStyle}>
          WORM storage reference:{" "}
          <a href={artifact.wormUri} target="_blank" rel="noreferrer">
            {artifact.wormUri}
          </a>
        </div>
      ) : null}
    </div>
  );
}

function renderPanel(title: string, subtitle: string | null) {
  return (
    <div style={panelStyle}>
      <h2 style={panelTitleStyle}>{title}</h2>
      {subtitle ? <p style={panelSubtitleStyle}>{subtitle}</p> : null}
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const pageLayoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "260px 1fr",
  gap: "24px",
};

const sidebarStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "12px",
  padding: "20px",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
  display: "grid",
  gap: "16px",
  height: "fit-content",
};

const sidebarTitleStyle: React.CSSProperties = {
  fontSize: "18px",
  margin: 0,
  fontWeight: 600,
};

const sidebarSubtitleStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#64748b",
  margin: "8px 0 0",
};

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
  maxHeight: "520px",
  overflowY: "auto",
  paddingRight: "4px",
};

const artifactButtonStyle: React.CSSProperties = {
  border: "2px solid transparent",
  borderRadius: "10px",
  padding: "12px",
  textAlign: "left",
  cursor: "pointer",
  display: "grid",
  gap: "6px",
  background: "transparent",
};

const artifactTitleStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "#0f172a",
};

const artifactMetaStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#475569",
};

const artifactHashStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#6366f1",
  wordBreak: "break-all",
};

const detailPaneStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "12px",
  padding: "28px",
  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)",
  minHeight: "520px",
};

const detailContentStyle: React.CSSProperties = {
  display: "grid",
  gap: "20px",
};

const detailHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap",
};

const detailTitleStyle: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 600,
};

const detailMetaStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#64748b",
};

const verifyButtonStyle: React.CSSProperties = {
  background: "#0b5fff",
  color: "#ffffff",
  border: "none",
  borderRadius: "8px",
  padding: "10px 16px",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
};

const hashSectionStyle: React.CSSProperties = {
  display: "grid",
  gap: "8px",
};

const hashLabelStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#475569",
};

const hashValueStyle: React.CSSProperties = {
  fontSize: "13px",
  wordBreak: "break-all",
  background: "#f1f5f9",
  padding: "12px",
  borderRadius: "8px",
};

const payloadWrapperStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  overflow: "hidden",
};

const payloadHeaderStyle: React.CSSProperties = {
  padding: "12px 16px",
  background: "#f8fafc",
  fontSize: "13px",
  color: "#475569",
  display: "flex",
  justifyContent: "space-between",
};

const payloadHintStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#94a3b8",
};

const payloadBodyStyle: React.CSSProperties = {
  margin: 0,
  padding: "16px",
  background: "#0f172a",
  color: "#e2e8f0",
  fontSize: "12px",
  lineHeight: 1.5,
  maxHeight: "320px",
  overflow: "auto",
};

const wormHintStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#475569",
};

const panelStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "12px",
  padding: "32px",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)",
};

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "20px",
  fontWeight: 600,
};

const panelSubtitleStyle: React.CSSProperties = {
  marginTop: "8px",
  fontSize: "14px",
  color: "#475569",
};

const emptyStateStyle: React.CSSProperties = {
  background: "#f1f5f9",
  borderRadius: "10px",
  padding: "16px",
  fontSize: "13px",
  color: "#475569",
  textAlign: "center",
};
