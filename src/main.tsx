import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { api } from "./services/api";
import "./index.css";
import { initBrowserMock } from "./browserMock";

// In browser preview (outside Tauri), initialize browser mock synchronously
if (typeof window !== "undefined" && !(window as any).__TAURI_INTERNALS__) {
  initBrowserMock();
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Reveal window when initial DOM tree has rendered
requestAnimationFrame(() => {
  api.showMainWindow().catch(() => {});
});
