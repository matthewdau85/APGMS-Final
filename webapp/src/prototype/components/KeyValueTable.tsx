import React from "react";

export function KeyValueTable(props: { rows: { k: string; v: React.ReactNode }[] }) {
  return (
    <table className="apgms-proto__table">
      <tbody>
        {props.rows.map((r) => (
          <tr key={r.k}>
            <th style={{ width: 260, opacity: 0.8, fontWeight: 700 }}>{r.k}</th>
            <td style={{ opacity: 0.9 }}>{r.v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
