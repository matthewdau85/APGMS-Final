import { create } from "zustand";

export type Theme = "light" | "dark";

type ThemeState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  initialize: () => void;
};

const storageKey = "apgms-theme";
const themeOrder: Theme[] = ["light", "dark"];

function getPreferredTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = window.localStorage.getItem(storageKey);
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  if (typeof window === "undefined") {
    return;
  }

  const root = window.document.documentElement;
  root.dataset.theme = theme;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  window.localStorage.setItem(storageKey, theme);
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "light",
  setTheme: (theme) => {
    set({ theme });
    applyTheme(theme);
  },
  toggleTheme: () => {
    const { theme, setTheme } = get();
    const index = themeOrder.indexOf(theme);
    const nextTheme = themeOrder[(index + 1) % themeOrder.length];
    setTheme(nextTheme);
  },
  initialize: () => {
    const initial = getPreferredTheme();
    get().setTheme(initial);
  }
}));
