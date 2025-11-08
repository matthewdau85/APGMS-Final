import React, { useEffect, useMemo, useState } from "react";
import {
  fetchRegulatorEvidenceDetail,
  fetchRegulatorEvidenceList,
} from "./api";
import { getRegulatorSession, getRegulatorToken } from "./regulatorAuth";
import DiscrepancyJournal, {
  type JournalEntry,
  type JournalExport,
} from "./portal/DiscrepancyJournal";
import {
  generatePlanRemissionPack,
  downloadPlanRemissionPack,
  type PlanRemissionPackManifest,
  type PlanRemissionPackResult,
} from "./portal/PlanRemissionPack";

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

type EvidenceArtifact = EvidenceDetail["artifact"];

type PackUiState = {
  status: "idle" | "working" | "ready" | "error";
  error: string | null;
  downloadUrl: string | null;
  bundleName: string | null;
  manifest: PlanRemissionPackManifest | null;
  hashes: PlanRemissionPackResult["hashes"] | null;
};

export default function RegulatorEvidencePage() {
  const token = getRegulatorToken();
  const session = getRegulatorSession();
  const [listState, setListState] = useState(initialListState);
  const [detailState, setDetailState] = useState(initialDetailState);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [lastJournalExport, setLastJournalExport] = useState<JournalExport | null>(null);
  const [packState, setPackState] = useState<PackUiState>(() => ({
    status: "idle",
    error: null,
    downloadUrl: null,
    bundleName: null,
    manifest: null,
    hashes: null,
  }));

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

  useEffect(() => {
    return () => {
      if (packState.downloadUrl) {
        URL.revokeObjectURL(packState.downloadUrl);
      }
    };
  }, [packState.downloadUrl]);

  useEffect(() => {
    setPackState((prev) => {
      if (prev.downloadUrl) {
        URL.revokeObjectURL(prev.downloadUrl);
      }
      return {
        status: "idle",
        error: null,
        downloadUrl: null,
        bundleName: null,
        manifest: null,
        hashes: null,
      };
    });
    const seeded = deriveJournalSeed(detailState.artifact);
    setJournalEntries(seeded);
    setLastJournalExport(null);
  }, [detailState.artifact]);

  const orgId = session?.orgId ?? detailState.artifact?.payload?.orgId ?? "unknown-org";

  const planSummaryPreview = useMemo(() => {
    return detailState.artifact
      ? derivePlanSummary(detailState.artifact)
      : "Select an artifact to load plan context.";
  }, [detailState.artifact]);

  const remissionNotesPreview = useMemo(() => {
    return detailState.artifact
      ? deriveRemissionNotes(detailState.artifact)
      : "Select an artifact to load remission context.";
  }, [detailState.artifact]);

  const sortedArtifacts = useMemo(() => {
    return [...listState.artifacts].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [listState.artifacts]);

  function handleJournalChange(entries: JournalEntry[]) {
    setJournalEntries(entries);
    if (entries.length > 0) {
      setPackState((prev) =>
        prev.status === "error" && prev.error?.startsWith("Log at least one discrepancy")
          ? {
              status: "idle",
              error: null,
              downloadUrl: prev.downloadUrl,
              bundleName: prev.bundleName,
              manifest: prev.manifest,
              hashes: prev.hashes,
            }
          : prev,
      );
    }
  }

  function handleJournalExport(payload: JournalExport) {
    setLastJournalExport(payload);
  }

  async function handleGeneratePack() {
    if (!detailState.artifact) {
      setPackState({
        status: "error",
        error: "Select an artifact to anchor the pack before generating it.",
        downloadUrl: null,
        bundleName: null,
        manifest: null,
        hashes: null,
      });
      return;
    }
    if (journalEntries.length === 0) {
      setPackState({
        status: "error",
        error: "Log at least one discrepancy entry before generating the pack.",
        downloadUrl: null,
        bundleName: null,
        manifest: null,
        hashes: null,
      });
      return;
    }
    setPackState((prev) => {
      if (prev.downloadUrl) {
        URL.revokeObjectURL(prev.downloadUrl);
      }
      return {
        status: "working",
        error: null,
        downloadUrl: null,
        bundleName: null,
        manifest: null,
        hashes: null,
      };
    });
    try {
      const result = await generatePlanRemissionPack({
        orgId,
        requestedBy: session?.orgId
          ? `Regulator reviewer for ${session.orgId}`
          : "Regulator reviewer",
        planSummary: planSummaryPreview,
        remissionNotes: remissionNotesPreview,
        journalEntries,
      });
      downloadPlanRemissionPack(result);
      const downloadUrl = URL.createObjectURL(result.bundle);
      setPackState({
        status: "ready",
        error: null,
        downloadUrl,
        bundleName: result.bundleName,
        manifest: result.manifest,
        hashes: result.hashes,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to generate pack";
      setPackState({
        status: "error",
        error: message,
        downloadUrl: null,
        bundleName: null,
        manifest: null,
        hashes: null,
      });
    }
  }

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
          >
            <PlanRemissionToolkit
              orgId={orgId}
              planSummary={planSummaryPreview}
              remissionNotes={remissionNotesPreview}
              journalEntries={journalEntries}
              onJournalChange={handleJournalChange}
              onJournalExport={handleJournalExport}
              onGeneratePack={handleGeneratePack}
              packState={packState}
              lastExport={lastJournalExport}
            />
          </ArtifactDetailView>
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
  children,
}: {
  artifact: EvidenceDetail["artifact"];
  verification: DetailState["verification"];
  onVerify: () => void;
  children?: React.ReactNode;
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

      {children}
    </div>
  );
}

type PlanRemissionToolkitProps = {
  orgId: string;
  planSummary: string;
  remissionNotes: string;
  journalEntries: JournalEntry[];
  onJournalChange: (entries: JournalEntry[]) => void;
  onJournalExport: (payload: JournalExport) => void;
  onGeneratePack: () => void;
  packState: PackUiState;
  lastExport: JournalExport | null;
};

function PlanRemissionToolkit({
  orgId,
  planSummary,
  remissionNotes,
  journalEntries,
  onJournalChange,
  onJournalExport,
  onGeneratePack,
  packState,
  lastExport,
}: PlanRemissionToolkitProps) {
  const toolkitHeadingId = React.useId();

  const lastExportLabel = lastExport
    ? formatDate(lastExport.generatedAt)
    : "Not exported yet";

  return (
    <section aria-labelledby={`${toolkitHeadingId}-title`} style={toolkitSectionStyle}>
      <header style={toolkitHeaderStyle}>
        <div>
          <h2 id={`${toolkitHeadingId}-title`} style={toolkitTitleStyle}>
            Discrepancy journal & remission pack
          </h2>
          <p style={toolkitSubtitleStyle}>
            Create an audit-ready bundle for ATO conversations. Entries feed into a PDF + JSON pack
            with SHA-256 digests so the evidence library can attest to integrity.
          </p>
        </div>
        <dl style={toolkitMetaStyle}>
          <div>
            <dt style={toolkitMetaLabelStyle}>Entries logged</dt>
            <dd style={toolkitMetaValueStyle}>{journalEntries.length}</dd>
          </div>
          <div>
            <dt style={toolkitMetaLabelStyle}>Last export</dt>
            <dd style={toolkitMetaValueStyle}>{lastExportLabel}</dd>
          </div>
        </dl>
      </header>

      <DiscrepancyJournal
        orgId={orgId}
        initialEntries={journalEntries}
        onChange={onJournalChange}
        onExport={onJournalExport}
      />

      <div style={packCardStyle}>
        <div style={packCardHeaderStyle}>
          <h3 style={packCardTitleStyle}>Plan / remission pack generator</h3>
          <p style={packCardSubtitleStyle}>
            Review the extracted plan and remission context before minting the bundle. We include a
            lightweight PDF summary plus a manifest with hashes for each file in the pack.
          </p>
        </div>

        <div style={packContextGridStyle}>
          <div>
            <h4 style={contextHeadingStyle}>Plan summary (source payload)</h4>
            <p style={contextBodyStyle}>{planSummary}</p>
          </div>
          <div>
            <h4 style={contextHeadingStyle}>Remission notes</h4>
            <p style={contextBodyStyle}>{remissionNotes}</p>
          </div>
        </div>

        <div style={packActionRowStyle}>
          <button
            type="button"
            onClick={onGeneratePack}
            style={packPrimaryButtonStyle}
            disabled={packState.status === "working" || journalEntries.length === 0}
          >
            {packState.status === "working" ? "Generating pack..." : "Generate pack"}
          </button>
          {packState.downloadUrl && packState.bundleName ? (
            <a
              href={packState.downloadUrl}
              download={packState.bundleName}
              style={packDownloadLinkStyle}
            >
              Download bundle again
            </a>
          ) : null}
        </div>

        {packState.status === "error" && packState.error ? (
          <div role="alert" style={packErrorStyle}>
            {packState.error}
          </div>
        ) : null}

        {packState.status === "ready" && packState.manifest ? (
          <div style={packResultStyle} aria-live="polite">
            <p style={packResultSummaryStyle}>
              Pack generated {formatDate(packState.manifest.generatedAt)}. Attach the manifest and
              PDF to the evidence library entry referenced above.
            </p>
            <ul style={digestListStyle}>
              <li>
                PDF SHA-256: <code>{packState.hashes?.pdf ?? "Unavailable"}</code>
              </li>
              <li>
                Manifest file SHA-256: <code>{packState.hashes?.manifest ?? "Unavailable"}</code>
              </li>
              <li>
                Canonical manifest digest: <code>{packState.hashes?.manifestCanonical ?? "Unavailable"}</code>
              </li>
            </ul>
            <details style={manifestDetailsStyle}>
              <summary>View manifest preview</summary>
              <pre style={manifestPreviewStyle}>
                {JSON.stringify(packState.manifest, null, 2)}
              </pre>
            </details>
          </div>
        ) : null}
      </div>
    </section>
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

function derivePlanSummary(artifact: EvidenceArtifact): string {
  const payload = artifact.payload;
  if (!payload) {
    return "No plan metadata was included in this artifact.";
  }
  if (isRecord(payload)) {
    if (typeof payload.planSummary === "string" && payload.planSummary.trim()) {
      return payload.planSummary.trim();
    }
    if (typeof payload.summary === "string" && payload.summary.trim()) {
      return payload.summary.trim();
    }
    if (isRecord(payload.plan)) {
      const plan = payload.plan;
      const fragments: string[] = [];
      if (typeof plan.status === "string") {
        fragments.push(`Status: ${plan.status}`);
      }
      if (plan.weeklyAmount !== undefined) {
        fragments.push(`Weekly amount: ${String(plan.weeklyAmount)}`);
      }
      if (plan.startDate || plan.starting) {
        fragments.push(`Start date: ${String(plan.startDate ?? plan.starting)}`);
      }
      if (plan.cycleId) {
        fragments.push(`Cycle: ${String(plan.cycleId)}`);
      }
      if (fragments.length > 0) {
        return fragments.join("\n");
      }
    }
    const keys = Object.keys(payload);
    if (keys.length > 0) {
      return `Payload keys: ${keys.join(", " )}. Refer to the JSON payload for full detail.`;
    }
  }
  return "Unable to derive a summary from the payload.";
}

function deriveRemissionNotes(artifact: EvidenceArtifact): string {
  const payload = artifact.payload;
  if (!payload) {
    return "No remission context recorded in this artifact.";
  }
  if (isRecord(payload)) {
    if (typeof payload.remissionNotes === "string" && payload.remissionNotes.trim()) {
      return payload.remissionNotes.trim();
    }
    if (typeof payload.remission === "string" && payload.remission.trim()) {
      return payload.remission.trim();
    }
    if (isRecord(payload.remission)) {
      const remission = payload.remission;
      const fragments: string[] = [];
      if (typeof remission.status === "string") {
        fragments.push(`Status: ${remission.status}`);
      }
      if (typeof remission.reason === "string") {
        fragments.push(`Reason: ${remission.reason}`);
      }
      if (remission.requestedAt) {
        fragments.push(`Requested: ${String(remission.requestedAt)}`);
      }
      if (fragments.length > 0) {
        return fragments.join("\n");
      }
    }
  }
  return "No remission notes embedded in the selected artifact.";
}

function deriveJournalSeed(artifact: EvidenceArtifact | null): JournalEntry[] {
  if (!artifact?.payload || !isRecord(artifact.payload)) {
    return [];
  }
  const possible = (artifact.payload as { discrepancies?: unknown }).discrepancies;
  if (!Array.isArray(possible)) {
    return [];
  }
  return possible
    .map((entry, index) => normaliseJournalEntry(entry, index))
    .filter((entry): entry is JournalEntry => entry !== null);
}

function normaliseJournalEntry(raw: unknown, index: number): JournalEntry | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = typeof raw.id === "string" && raw.id ? raw.id : `seed-${index}`;
  const observedAt = typeof raw.observedAt === "string" ? raw.observedAt : new Date().toISOString();
  const control = typeof raw.control === "string" && raw.control
    ? raw.control
    : typeof raw.system === "string" && raw.system
    ? raw.system
    : "Unspecified control";
  const description = typeof raw.description === "string" && raw.description
    ? raw.description
    : typeof raw.summary === "string" && raw.summary
    ? raw.summary
    : "No description provided.";
  const owner = typeof raw.owner === "string" && raw.owner
    ? raw.owner
    : typeof raw.assignee === "string" && raw.assignee
    ? raw.assignee
    : "Unassigned";
  const followUp = typeof raw.followUp === "string" && raw.followUp
    ? raw.followUp
    : typeof raw.action === "string" && raw.action
    ? raw.action
    : "Pending clarification";
  return {
    id,
    observedAt,
    control,
    description,
    severity: normaliseSeverity(raw.severity),
    status: normaliseStatus(raw.status),
    owner,
    followUp,
  };
}

function normaliseSeverity(value: unknown): JournalEntry["severity"] {
  if (typeof value === "string") {
    const normalised = value.toLowerCase();
    if (normalised === "low" || normalised === "medium" || normalised === "high") {
      return normalised;
    }
  }
  return "medium";
}

function normaliseStatus(value: unknown): JournalEntry["status"] {
  if (typeof value === "string") {
    const normalised = value.toLowerCase();
    if (normalised === "open" || normalised === "monitoring" || normalised === "resolved") {
      return normalised;
    }
  }
  return "monitoring";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

const toolkitSectionStyle: React.CSSProperties = {
  display: "grid",
  gap: "24px",
  marginTop: "16px",
};

const toolkitHeaderStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "16px",
  justifyContent: "space-between",
  alignItems: "flex-start",
};

const toolkitTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "22px",
  fontWeight: 700,
  color: "#0f172a",
};

const toolkitSubtitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#475569",
  maxWidth: "60ch",
  lineHeight: 1.6,
};

const toolkitMetaStyle: React.CSSProperties = {
  display: "flex",
  gap: "16px",
  margin: 0,
};

const toolkitMetaLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#64748b",
};

const toolkitMetaValueStyle: React.CSSProperties = {
  marginTop: "4px",
  fontSize: "16px",
  fontWeight: 600,
  color: "#0f172a",
};

const packCardStyle: React.CSSProperties = {
  padding: "24px",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  backgroundColor: "#f8fafc",
  display: "grid",
  gap: "20px",
};

const packCardHeaderStyle: React.CSSProperties = {
  display: "grid",
  gap: "8px",
};

const packCardTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "18px",
  fontWeight: 600,
};

const packCardSubtitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "14px",
  color: "#475569",
  lineHeight: 1.6,
};

const packContextGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "16px",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
};

const contextHeadingStyle: React.CSSProperties = {
  margin: "0 0 6px",
  fontSize: "14px",
  fontWeight: 600,
  color: "#0f172a",
};

const contextBodyStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "14px",
  color: "#1e293b",
  whiteSpace: "pre-wrap",
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  padding: "12px 14px",
  border: "1px solid #e2e8f0",
};

const packActionRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "12px",
  alignItems: "center",
};

const packPrimaryButtonStyle: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: "8px",
  border: "none",
  backgroundColor: "#0b5fff",
  color: "#ffffff",
  fontWeight: 600,
  cursor: "pointer",
};

const packDownloadLinkStyle: React.CSSProperties = {
  color: "#0b5fff",
  textDecoration: "none",
  fontWeight: 600,
};

const packErrorStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: "8px",
  backgroundColor: "#fee2e2",
  color: "#991b1b",
  fontSize: "14px",
};

const packResultStyle: React.CSSProperties = {
  border: "1px solid #cbd5f5",
  backgroundColor: "#e0ecff",
  borderRadius: "10px",
  padding: "16px",
  display: "grid",
  gap: "12px",
};

const packResultSummaryStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "14px",
  color: "#1e293b",
};

const digestListStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: "20px",
  display: "grid",
  gap: "4px",
  fontSize: "13px",
  color: "#1e293b",
};

const manifestDetailsStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#0f172a",
};

const manifestPreviewStyle: React.CSSProperties = {
  marginTop: "8px",
  backgroundColor: "#0f172a",
  color: "#e2e8f0",
  padding: "12px",
  borderRadius: "8px",
  maxHeight: "260px",
  overflowY: "auto",
  fontFamily:
    "ui-monospace, SFMono-Regular, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  fontSize: "12px",
};
