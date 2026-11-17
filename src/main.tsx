import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { api } from "./services/api";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Reveal window when initial DOM tree has rendered
requestAnimationFrame(() => {
  api.showMainWindow().catch(() => {});
});
