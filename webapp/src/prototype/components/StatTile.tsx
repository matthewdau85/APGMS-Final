import React from "react";

export function StatTile(props: { title: string; value: string; note: string }) {
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 12 }}>
      <div style={{ fontSize: 12, opacity: 0.75 }}>{props.title}</div>
      <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6 }}>{props.value}</div>
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6, lineHeight: 1.35 }}>{props.note}</div>
    </div>
  );
}
