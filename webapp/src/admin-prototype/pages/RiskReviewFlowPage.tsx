import React, { useEffect, useMemo, useState } from "react";
import { fetchAlerts } from "../../api";
import { getToken } from "../../auth";

type AlertRecord = Awaited<ReturnType<typeof fetchAlerts>>["alerts"][number];

type ReviewBucket = {
  title: string;
  description: string;
  filter: (alert: AlertRecord) => boolean;
};

const reviewBuckets: ReviewBucket[] = [
  {
    title: "Payroll variance",
    description:
      "Flags when the secured PAYGW is short versus the withholding amount that payroll reported.",
    filter: (alert) => alert.type === "PAYGW_SHORTFALL",
  },
  {
    title: "GST cash exception",
    description:
      "Triggers whenever GST capture is skipped for 48 hours while the merchant account is still settling funds.",
    filter: (alert) => alert.type === "GST_ESCROW_MISSED",
  },
  {
    title: "Manual override",
    description:
      "Exposes any operator overrides so we can justify them during regulator walkthroughs.",
    filter: (alert) => alert.type === "MANUAL_OVERRIDE",
  },
];

export default function RiskReviewFlowPage() {
  const token = getToken();
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError("No session token");
      return;
    }

    (async () => {
      try {
        const response = await fetchAlerts(token);
        setAlerts(response.alerts);
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Unable to load alerts feed");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const bucketSummaries = useMemo(() => {
    return reviewBuckets.map((bucket) => ({
      bucket,
      alerts: alerts.filter(bucket.filter),
    }));
  }, [alerts]);

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <header style={headerStyle}>
        <h2 style={pageTitleStyle}>ATO risk review script</h2>
        <p style={pageSubtitleStyle}>
          Each bucket below maps a production alert to a regulator narrative. Use this to
          show that our monitoring surface is the same one the compliance team works from
          every day.
        </p>
      </header>

      {loading && <div style={infoStyle}>Loading alerts from the API…</div>}
      {error && <div style={errorStyle}>{error}</div>}

      {!loading && !error && (
        <section style={bucketsGridStyle}>
          {bucketSummaries.map(({ bucket, alerts: bucketAlerts }) => (
            <article key={bucket.title} style={bucketCardStyle}>
              <h3 style={bucketTitleStyle}>{bucket.title}</h3>
              <p style={bucketDescriptionStyle}>{bucket.description}</p>
              <div style={bucketListStyle}>
                {bucketAlerts.length === 0 && (
                  <span style={emptyStateStyle}>No matching alerts in the current feed.</span>
                )}
                {bucketAlerts.map((alert) => (
                  <div key={alert.id} style={alertRowStyle}>
                    <span style={alertBadgeStyle}>{alert.severity}</span>
                    <div style={{ display: "grid", gap: "4px" }}>
                      <span style={alertMessageStyle}>{alert.message}</span>
                      <span style={alertMetaStyle}>
                        Raised {new Date(alert.createdAt).toLocaleString()} •{' '}
                        {alert.resolved ? `Resolved ${new Date(alert.resolvedAt ?? "").toLocaleString()}` : "Open"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "28px 32px",
  borderRadius: "16px",
  boxShadow: "0 28px 52px rgba(15, 23, 42, 0.07)",
  display: "grid",
  gap: "12px",
};

const pageTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "22px",
};

const pageSubtitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "15px",
  color: "#475569",
  lineHeight: 1.5,
};

const infoStyle: React.CSSProperties = {
  backgroundColor: "#e0f2fe",
  color: "#075985",
  padding: "12px 16px",
  borderRadius: "8px",
  fontSize: "14px",
};

const errorStyle: React.CSSProperties = {
  backgroundColor: "#fee2e2",
  color: "#b91c1c",
  padding: "12px 16px",
  borderRadius: "8px",
  fontSize: "14px",
};

const bucketsGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "20px",
};

const bucketCardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "24px",
  borderRadius: "16px",
  boxShadow: "0 24px 48px rgba(15, 23, 42, 0.05)",
  display: "grid",
  gap: "12px",
};

const bucketTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "18px",
};

const bucketDescriptionStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "14px",
  color: "#475569",
};

const bucketListStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
};

const emptyStateStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#64748b",
  backgroundColor: "#f8fafc",
  padding: "10px 12px",
  borderRadius: "8px",
};

const alertRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gap: "12px",
  padding: "14px 16px",
  borderRadius: "12px",
  backgroundColor: "#f1f5f9",
};

const alertBadgeStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  padding: "6px 10px",
  borderRadius: "999px",
  backgroundColor: "#0b5fff",
  color: "white",
  fontSize: "12px",
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const alertMessageStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "#1f2937",
};

const alertMetaStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#475569",
};
