import React from "react";

type Props = {
  title?: string;
  children: React.ReactNode;
};

export function FigmaShell(props: Props) {
  const { title = "APGMS", children } = props;

  // Minimal, resilient shell: renders even if extracted components differ.
  // Uses your CSS variables for theme, avoiding white-screen UX.
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
      <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ fontSize: 14, opacity: 0.9 }}>{title}</div>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}
