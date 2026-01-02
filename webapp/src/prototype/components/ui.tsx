import React from "react";

export function Card(props: { title?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="apgms-card">
      {(props.title || props.right) && (
        <div className="apgms-card-h">
          <div className="apgms-card-t">{props.title ?? ""}</div>
          <div className="apgms-card-r">{props.right}</div>
        </div>
      )}
      <div className="apgms-card-b">{props.children}</div>
    </div>
  );
}

export function Tag(props: { tone?: "good" | "warn" | "bad" | "muted"; children: React.ReactNode }) {
  const tone = props.tone ?? "muted";
  return <span className={`apgms-tag apgms-tag-${tone}`}>{props.children}</span>;
}

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  const v = props.variant ?? "primary";
  return <button {...props} className={`apgms-btn apgms-btn-${v} ${props.className ?? ""}`.trim()} />;
}

export function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="apgms-field">
      <div className="apgms-field-label">{props.label}</div>
      <div>{props.children}</div>
    </div>
  );
}
