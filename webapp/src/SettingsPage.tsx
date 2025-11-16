import React, { useEffect, useState } from "react";
import { fetchTier, updateTier, type SubscriptionTier } from "./api";
import { getToken } from "./auth";

const tiers: Array<{ tier: SubscriptionTier; title: string; description: string; features: string[] }> = [
  {
    tier: "Monitor",
    title: "Monitor",
    description: "Baseline insights, manual reconciliation, and alerts delivered by email.",
    features: ["Virtual balance widgets", "Manual payroll & POS ingest", "BAS shortfall alerts"],
  },
  {
    tier: "Reserve",
    title: "Reserve",
    description: "Adds rolling predictions and low-balance warnings for proactive remediation.",
    features: ["Prediction engine access", "Virtual balance automation", "Reminder API webhooks"],
  },
  {
    tier: "Automate",
    title: "Automate",
    description: "Unlocks autonomous transfers, BAS pre-check enforcement, and ATO-ready evidence.",
    features: ["Auto-transfer execution", "Advanced alerts", "ATO-ready BAS evidence"],
  },
];

export default function SettingsPage() {
  const token = getToken();
  const [currentTier, setCurrentTier] = useState<SubscriptionTier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingTier, setUpdatingTier] = useState<SubscriptionTier | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const response = await fetchTier(token);
        setCurrentTier(response.tier);
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Unable to load subscription tier");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function handleUpgrade(nextTier: SubscriptionTier) {
    if (!token || nextTier === currentTier) {
      return;
    }
    try {
      setUpdatingTier(nextTier);
      const response = await updateTier(token, nextTier);
      setCurrentTier(response.tier);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Unable to update tier");
    } finally {
      setUpdatingTier(null);
    }
  }

  if (!token) {
    return null;
  }

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <header>
        <h1 style={pageTitleStyle}>Subscription & Access</h1>
        <p style={pageSubtitleStyle}>Control which automation features are enabled for your organisation.</p>
      </header>

      {loading && <div style={infoTextStyle}>Loading tier data…</div>}
      {error && <div style={errorTextStyle}>{error}</div>}

      {!loading && currentTier && (
        <section style={tierGridStyle}>
          {tiers.map((tierOption) => (
            <article key={tierOption.tier} style={tierCardStyle}>
              <header style={{ display: "grid", gap: "4px" }}>
                <p style={infoLabelStyle}>{tierOption.title}</p>
                <h2 style={{ margin: 0 }}>{tierOption.description}</h2>
              </header>
              <ul style={featureListStyle}>
                {tierOption.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <button
                type="button"
                style={{
                  ...tierButtonStyle,
                  backgroundColor: tierOption.tier === currentTier ? "#e2e8f0" : "#0b5fff",
                  color: tierOption.tier === currentTier ? "#1e293b" : "#fff",
                  cursor: tierOption.tier === currentTier ? "default" : "pointer",
                }}
                disabled={tierOption.tier === currentTier || updatingTier !== null}
                onClick={() => handleUpgrade(tierOption.tier)}
              >
                {tierOption.tier === currentTier
                  ? "Current tier"
                  : updatingTier === tierOption.tier
                    ? "Updating…"
                    : `Switch to ${tierOption.title}`}
              </button>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

const pageTitleStyle: React.CSSProperties = {
  fontSize: "32px",
  fontWeight: 700,
  margin: 0,
  color: "#0f172a",
};

const pageSubtitleStyle: React.CSSProperties = {
  fontSize: "16px",
  color: "#475569",
  marginTop: "8px",
};

const infoTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#475569",
};

const errorTextStyle: React.CSSProperties = {
  ...infoTextStyle,
  color: "#b91c1c",
};

const infoLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#94a3b8",
};

const tierGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "20px",
};

const tierCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "16px",
  padding: "20px",
  backgroundColor: "#fff",
  display: "grid",
  gap: "12px",
};

const featureListStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: "18px",
  color: "#475569",
  display: "grid",
  gap: "4px",
  fontSize: "14px",
};

const tierButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: "8px",
  padding: "10px 16px",
  fontWeight: 600,
};
