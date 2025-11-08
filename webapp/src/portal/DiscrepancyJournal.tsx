import React, { useEffect, useId, useMemo, useState } from "react";

type Severity = "low" | "medium" | "high";
type Status = "open" | "monitoring" | "resolved";

export type JournalEntry = {
  id: string;
  observedAt: string;
  control: string;
  description: string;
  severity: Severity;
  status: Status;
  owner: string;
  followUp: string;
};

export type JournalExport = {
  orgId: string;
  generatedAt: string;
  entries: JournalEntry[];
};

type Props = {
  orgId: string;
  initialEntries?: JournalEntry[];
  onChange?: (entries: JournalEntry[]) => void;
  onExport?: (payload: JournalExport) => void;
};

const defaultDraft: Omit<JournalEntry, "id"> = {
  observedAt: new Date().toISOString(),
  control: "PAYGW holdback",
  description: "",
  severity: "medium",
  status: "monitoring",
  owner: "",
  followUp: "",
};

export default function DiscrepancyJournal({
  orgId,
  initialEntries,
  onChange,
  onExport,
}: Props) {
  const [entries, setEntries] = useState<JournalEntry[]>(initialEntries ?? []);
  const [draft, setDraft] = useState(defaultDraft);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const draftFormId = useId();

  useEffect(() => {
    if (initialEntries) {
      setEntries(initialEntries);
    }
  }, [initialEntries]);

  const severityCounts = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        acc[entry.severity] += 1;
        return acc;
      },
      { low: 0, medium: 0, high: 0 } as Record<Severity, number>,
    );
  }, [entries]);

  const openItems = useMemo(
    () => entries.filter((entry) => entry.status !== "resolved").length,
    [entries],
  );

  function notifyChange(next: JournalEntry[]) {
    setEntries(next);
    onChange?.(next);
  }

  function resetDraft() {
    setDraft({ ...defaultDraft, observedAt: new Date().toISOString() });
  }

  function createIdentifier() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `journal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function handleAddEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.description.trim()) {
      setFlashMessage("Describe the discrepancy before adding it to the journal.");
      return;
    }
    const entry: JournalEntry = {
      id: createIdentifier(),
      ...draft,
      observedAt: draft.observedAt || new Date().toISOString(),
      owner: draft.owner.trim() || "Unassigned",
      followUp: draft.followUp.trim() || "Pending clarification",
    };
    const next = [entry, ...entries].sort((a, b) => (a.observedAt < b.observedAt ? 1 : -1));
    notifyChange(next);
    resetDraft();
    setFlashMessage(`Logged discrepancy for ${entry.control}.`);
  }

  function handleStatusChange(id: string, status: Status) {
    const next = entries.map((entry) =>
      entry.id === id
        ? {
            ...entry,
            status,
          }
        : entry,
    );
    notifyChange(next);
  }

  function handleExport() {
    const payload: JournalExport = {
      orgId,
      generatedAt: new Date().toISOString(),
      entries,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const fileName = `apgms-discrepancy-journal-${orgId}-${Date.now()}.json`;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    anchor.click();
    URL.revokeObjectURL(url);
    setFlashMessage("Discrepancy journal exported. Attach it to the evidence pack upload.");
    onExport?.(payload);
  }

  return (
    <section aria-labelledby={`${draftFormId}-journal-heading`} style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <h2 id={`${draftFormId}-journal-heading`} style={titleStyle}>
            Discrepancy journal
          </h2>
          <p style={subtitleStyle}>
            Capture what was escalated to the regulator, who owns the fix, and how the risk is
            being remediated.
          </p>
        </div>
        <div style={badgeRowStyle} aria-live="polite">
          <Badge tone="neutral" label="Total" value={entries.length} />
          <Badge tone="warn" label="Open" value={openItems} />
          <Badge tone="ok" label="Low" value={severityCounts.low} />
          <Badge tone="highlight" label="Medium" value={severityCounts.medium} />
          <Badge tone="critical" label="High" value={severityCounts.high} />
        </div>
      </div>

      <form onSubmit={handleAddEntry} style={formStyle} aria-describedby={`${draftFormId}-helper`}>
        <div style={fieldGridStyle}>
          <label style={labelStyle}>
            <span>Date observed</span>
            <input
              type="datetime-local"
              value={toLocalInputValue(draft.observedAt)}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  observedAt: fromLocalInputValue(event.target.value) ?? prev.observedAt,
                }))
              }
              required
            />
          </label>
          <label style={labelStyle}>
            <span>Control / system</span>
            <input
              value={draft.control}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  control: event.target.value,
                }))
              }
              placeholder="PAYGW ledger"
              required
            />
          </label>
          <label style={labelStyle}>
            <span>Owner</span>
            <input
              value={draft.owner}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  owner: event.target.value,
                }))
              }
              placeholder="ATO liaison"
            />
          </label>
          <label style={labelStyle}>
            <span>Severity</span>
            <select
              value={draft.severity}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  severity: event.target.value as Severity,
                }))
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label style={labelStyle}>
            <span>Status</span>
            <select
              value={draft.status}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  status: event.target.value as Status,
                }))
              }
            >
              <option value="open">Open</option>
              <option value="monitoring">Monitoring</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
        </div>
        <label style={labelStyle}>
          <span>Summary</span>
          <textarea
            value={draft.description}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                description: event.target.value,
              }))
            }
            rows={3}
            placeholder="Describe the discrepancy and the expected impact."
            required
          />
        </label>
        <label style={labelStyle}>
          <span>Follow-up actions</span>
          <textarea
            value={draft.followUp}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                followUp: event.target.value,
              }))
            }
            rows={2}
            placeholder="Document remediation steps or requests sent to the business."
          />
        </label>
        <div style={formActionRowStyle}>
          <button type="submit" style={primaryButtonStyle}>
            Add discrepancy
          </button>
          <button
            type="button"
            onClick={handleExport}
            style={secondaryButtonStyle}
            disabled={entries.length === 0}
          >
            Export journal (.json)
          </button>
        </div>
        <p id={`${draftFormId}-helper`} style={helperTextStyle}>
          Journal exports are versioned JSON files you can attach to communications or upload into the
          evidence vault.
        </p>
        {flashMessage ? (
          <div role="status" aria-live="polite" style={flashStyle}>
            {flashMessage}
          </div>
        ) : null}
      </form>

      <div>
        <table style={tableStyle}>
          <caption style={tableCaptionStyle}>
            Logged discrepancies ({entries.length})
          </caption>
          <thead>
            <tr>
              <th scope="col">Observed</th>
              <th scope="col">Control</th>
              <th scope="col">Owner</th>
              <th scope="col">Severity</th>
              <th scope="col">Status</th>
              <th scope="col">Summary</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} style={emptyCellStyle}>
                  Nothing logged yet. Use the form above to capture the first discrepancy.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.observedAt).toLocaleString()}</td>
                  <td>{entry.control}</td>
                  <td>{entry.owner}</td>
                  <td>{entry.severity}</td>
                  <td>
                    <label style={inlineLabelStyle}>
                      <span style={visuallyHiddenStyle}>Update status for {entry.control}</span>
                      <select
                        value={entry.status}
                        onChange={(event) => handleStatusChange(entry.id, event.target.value as Status)}
                      >
                        <option value="open">Open</option>
                        <option value="monitoring">Monitoring</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </label>
                  </td>
                  <td>
                    <div style={summaryCellStyle}>{entry.description}</div>
                    <div style={followUpCellStyle}>Follow-up: {entry.followUp}</div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function toLocalInputValue(value: string) {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    const pad = (input: number) => input.toString().padStart(2, "0");
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return "";
  }
}

function fromLocalInputValue(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

const containerStyle: React.CSSProperties = {
  display: "grid",
  gap: "24px",
  padding: "24px",
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "16px",
  justifyContent: "space-between",
  alignItems: "flex-start",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "20px",
  fontWeight: 700,
  color: "#0f172a",
};

const subtitleStyle: React.CSSProperties = {
  margin: "8px 0 0 0",
  color: "#475569",
  maxWidth: "54ch",
  lineHeight: 1.5,
};

const badgeRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: "16px",
};

const fieldGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: "8px",
  fontSize: "14px",
  color: "#1e293b",
};

const helperTextStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#64748b",
  margin: 0,
};

const formActionRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "12px",
  alignItems: "center",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "10px 16px",
  backgroundColor: "#0b5fff",
  color: "#ffffff",
  border: "none",
  borderRadius: "8px",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "10px 16px",
  backgroundColor: "transparent",
  color: "#0b5fff",
  border: "1px solid #0b5fff",
  borderRadius: "8px",
  fontWeight: 600,
  cursor: "pointer",
};

const flashStyle: React.CSSProperties = {
  margin: 0,
  padding: "12px 14px",
  borderRadius: "8px",
  backgroundColor: "#ecfdf5",
  color: "#047857",
  fontSize: "14px",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  overflow: "hidden",
  fontSize: "14px",
};

const tableCaptionStyle: React.CSSProperties = {
  textAlign: "left",
  fontWeight: 600,
  padding: "12px 16px",
  backgroundColor: "#f8fafc",
  color: "#0f172a",
};

const emptyCellStyle: React.CSSProperties = {
  padding: "28px 16px",
  textAlign: "center",
  color: "#64748b",
  fontStyle: "italic",
};

const inlineLabelStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
};

const visuallyHiddenStyle: React.CSSProperties = {
  border: 0,
  clip: "rect(0 0 0 0)",
  height: "1px",
  width: "1px",
  margin: "-1px",
  padding: 0,
  overflow: "hidden",
  position: "absolute",
};

const summaryCellStyle: React.CSSProperties = {
  fontWeight: 500,
  marginBottom: "6px",
};

const followUpCellStyle: React.CSSProperties = {
  color: "#475569",
  fontSize: "13px",
};

type BadgeTone = "neutral" | "warn" | "ok" | "highlight" | "critical";

function Badge({ label, value, tone }: { label: string; value: number; tone: BadgeTone }) {
  const palette: Record<BadgeTone, { background: string; color: string }> = {
    neutral: { background: "#e2e8f0", color: "#0f172a" },
    warn: { background: "#fef3c7", color: "#b45309" },
    ok: { background: "#dcfce7", color: "#166534" },
    highlight: { background: "#dbeafe", color: "#1d4ed8" },
    critical: { background: "#fee2e2", color: "#b91c1c" },
  };
  const styles: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "13px",
    fontWeight: 600,
    backgroundColor: palette[tone].background,
    color: palette[tone].color,
  };
  return (
    <span style={styles}>
      {label}
      <span aria-hidden>·</span>
      {value}
    </span>
  );
}
