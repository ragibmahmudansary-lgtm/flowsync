import React from "react";
import ReactDOM from "react-dom/client";
import { AppShell } from "@/ui/AppShell";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { useConsoleStore } from "@/state/useConsoleStore";
import "@/commands/cadCommands";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  </React.StrictMode>
);

(window as any).__FLOWSYNC_BOOT__.mounted = true;
document.getElementById("boot-diag")?.remove();
useConsoleStore.getState().log("success", "FlowSync v2 Phase 1 booted — CAD pipeline ready.");
