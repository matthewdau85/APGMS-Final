import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeName = "navy" | "sunset" | "forest";

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "navy",
  setTheme: () => {},
});

const STORAGE_KEY = "apgms-theme";
const THEMES: ThemeName[] = ["navy", "sunset", "forest"];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeName | null;
    return stored && THEMES.includes(stored) ? stored : "navy";
  });

  useEffect(() => {
    const cls = `theme-${theme}`;
    document.body.classList.remove(
      ...THEMES.map((t) => `theme-${t}`),
    );
    document.body.classList.add(cls);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
