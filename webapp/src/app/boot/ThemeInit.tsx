import React, { useEffect } from "react";

export function ThemeInit(): null {
  useEffect(() => {
    // Default to dark to avoid the "all white" UX.
    // You can later wire a real toggle + persisted preference.
    const root = document.documentElement;
    if (!root.classList.contains("dark")) {
      root.classList.add("dark");
    }
  }, []);

  return null;
}
