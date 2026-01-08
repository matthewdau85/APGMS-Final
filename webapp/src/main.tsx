import React from "react";
import ReactDOM from "react-dom/client";

import App from "./app/App";

// Figma-exported CSS entry (Tailwind + theme tokens)
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
