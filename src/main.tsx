import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { api } from "./services/api";
import "./index.css";

// In browser preview (outside Tauri), initialize browser mock
if (typeof window !== "undefined" && !(window as any).__TAURI_INTERNALS__) {
  import("./browserMock").then(({ initBrowserMock }) => initBrowserMock());
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
