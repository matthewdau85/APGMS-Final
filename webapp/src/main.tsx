// webapp/src/main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import App from "./App";

const el = document.getElementById("root");
if (!el) {
  throw new Error("no #root element");
}

const theme = createTheme({
  palette: {
    primary: {
      main: "#0f6b8a",
    },
    secondary: {
      main: "#3949ab",
    },
    background: {
      default: "#f6f8fb",
    },
  },
});

createRoot(el).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
