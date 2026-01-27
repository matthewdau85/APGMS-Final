import React from "react";
import type { RouteObject } from "react-router-dom";
import { FigmaShell } from "./FigmaShell";

// Replace placeholders by importing real extracted pages from: webapp/src/_figma/...
// Example:
// import { DashboardPage } from "../../_figma/pages/DashboardPage";

function Placeholder(props: { name: string }) {
  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontSize: 18, marginBottom: 8 }}>{props.name}</div>
      <div style={{ opacity: 0.8 }}>
        Wire this route to the extracted Figma page/component by importing it from webapp/src/_figma.
      </div>
    </div>
  );
}

export const figmaRoutes: RouteObject[] = [
  {
    path: "/figma",
    element: (
      <FigmaShell title="APGMS (Figma shell)">
        <Placeholder name="Figma Home" />
      </FigmaShell>
    ),
  },
  {
    path: "/figma/dashboard",
    element: (
      <FigmaShell title="Dashboard">
        <Placeholder name="Dashboard" />
      </FigmaShell>
    ),
  },
  {
    path: "/figma/obligations",
    element: (
      <FigmaShell title="Obligations">
        <Placeholder name="Obligations" />
      </FigmaShell>
    ),
  },
  {
    path: "/figma/reconciliation",
    element: (
      <FigmaShell title="Reconciliation">
        <Placeholder name="Reconciliation" />
      </FigmaShell>
    ),
  },
  {
    path: "/figma/evidence-pack",
    element: (
      <FigmaShell title="Evidence Pack">
        <Placeholder name="Evidence Pack" />
      </FigmaShell>
    ),
  },
];
