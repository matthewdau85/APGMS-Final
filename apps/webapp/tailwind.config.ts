import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../shared/src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1200px" } },
    extend: {
      colors: {
        brand: {
          50: "#f5fbff",
          100: "#eaf5ff",
          200: "#cfe9ff",
          300: "#aadaff",
          400: "#6ec0ff",
          500: "#2aa7ff", // primary accents (links, buttons)
          600: "#198ee6",
          700: "#1673b8",
          800: "#145e95",
          900: "#124e7a"
        },
        success: { DEFAULT: "#22c55e" },
        warning: { DEFAULT: "#f59e0b" },
        danger: { DEFAULT: "#ef4444" },
        ink: {
          50: "#f7f7f8",
          100: "#f1f3f5",
          200: "#eceef1",
          300: "#e6e8ec",
          400: "#ced4da",
          500: "#adb5bd",
          600: "#667085",
          700: "#475467",
          800: "#344054",
          900: "#1d2939"
        },
        panel: { DEFAULT: "#ffffff", subtle: "#fafafa" }
      },
      borderRadius: { lg: "1rem", xl: "1.25rem", "2xl": "1.5rem" },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.04), 0 4px 12px rgba(16,24,40,0.06)"
      }
    }
  },
  plugins: []
};

export default config;
