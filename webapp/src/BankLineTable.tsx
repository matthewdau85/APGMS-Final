// services/webapp/src/BankLineTable.tsx
import { BankLine } from "./api";

export function BankLineTable({ lines }: { lines: BankLine[] }) {
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontFamily: "sans-serif",
      }}
    >
      <thead>
        <tr>
          <th
            style={{
              textAlign: "left",
              borderBottom: "1px solid #ccc",
              padding: "0.5rem",
            }}
          >
            Posted At
          </th>
          <th
            style={{
              textAlign: "right",
              borderBottom: "1px solid #ccc",
              padding: "0.5rem",
            }}
          >
            Amount
          </th>
          <th
            style={{
              textAlign: "left",
              borderBottom: "1px solid #ccc",
              padding: "0.5rem",
            }}
          >
            Description (masked)
          </th>
          <th
            style={{
              textAlign: "left",
              borderBottom: "1px solid #ccc",
              padding: "0.5rem",
            }}
          >
            Created
          </th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.id}>
            <td
              style={{
                borderBottom: "1px solid #eee",
                padding: "0.5rem",
                whiteSpace: "nowrap",
              }}
            >
              {l.postedAt}
            </td>
            <td
              style={{
                borderBottom: "1px solid #eee",
                padding: "0.5rem",
                textAlign: "right",
              }}
            >
              {l.amount}
            </td>
            <td
              style={{
                borderBottom: "1px solid #eee",
                padding: "0.5rem",
              }}
            >
              {l.description}
            </td>
            <td
              style={{
                borderBottom: "1px solid #eee",
                padding: "0.5rem",
              }}
            >
              {l.createdAt}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
