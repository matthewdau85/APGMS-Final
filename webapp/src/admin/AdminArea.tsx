import React from "react";
import { useAuth } from "../auth/auth";
import { PrototypeApp } from "../prototype/PrototypeApp";

export function AdminArea(props: { onExit: () => void }) {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }}>
        <h2>Not authorized</h2>
        <p>You must be logged in as admin to access this area.</p>
      </div>
    );
  }

  return <PrototypeApp onExit={props.onExit} />;
}
