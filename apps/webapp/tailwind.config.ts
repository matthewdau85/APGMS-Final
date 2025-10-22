import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "var(--color-border)",
        input: "var(--color-border)",
        ring: "var(--color-focus)",
        background: "var(--color-background)",
        foreground: "var(--color-text)",
        primary: {
          DEFAULT: "var(--color-primary)",
          foreground: "var(--color-primary-contrast)"
        },
        "primary-soft": "var(--color-primary-soft)",
        muted: {
          DEFAULT: "var(--color-text-muted)",
          foreground: "var(--color-text)"
        },
        surface: {
          DEFAULT: "var(--color-surface)",
          muted: "var(--color-surface-muted)"
        },
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)"
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
        xl: "var(--radius-pill)"
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)"
      },
      fontFamily: {
        sans: ["var(--font-family-sans)", ...fontFamily.sans]
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};

export default config;
