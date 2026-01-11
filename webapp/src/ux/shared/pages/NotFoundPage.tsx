import React from "react";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>404 - Not Found</h1>
      <p style={{ marginBottom: 16 }}>
        The page you requested does not exist.
      </p>
      <Link to="/">Go to Dashboard</Link>
    </div>
  );
}
