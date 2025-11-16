// webapp/src/main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import App from "./App";
import { store } from "./store";

const el = document.getElementById("root");
if (!el) {
  throw new Error("no #root element");
}
createRoot(el).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);
