import React, { createContext, useContext } from "react";

const BasePathContext = createContext<string>("");

export function BasePathProvider(props: { basePath: string; children: React.ReactNode }) {
  const basePath = normalizeBasePath(props.basePath);
  return <BasePathContext.Provider value={basePath}>{props.children}</BasePathContext.Provider>;
}

export function useBasePath() {
  return useContext(BasePathContext);
}

export function withBasePath(basePath: string, to: string) {
  if (!to) return to;
  if (to.startsWith("http://") || to.startsWith("https://") || to.startsWith("mailto:") || to.startsWith("#")) {
    return to;
  }
  if (!to.startsWith("/")) return to; // relative paths are left alone
  if (!basePath || basePath === "/") return to;

  const b = normalizeBasePath(basePath);
  if (to === b || to.startsWith(b + "/")) return to;

  return b + to;
}

function normalizeBasePath(p: string) {
  if (!p) return "";
  if (p === "/") return "/";
  let out = p.startsWith("/") ? p : `/${p}`;
  if (out.endsWith("/")) out = out.slice(0, -1);
  return out;
}
