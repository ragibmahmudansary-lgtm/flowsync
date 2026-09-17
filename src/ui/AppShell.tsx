import { useEffect } from "react";
import { useUIStore } from "@/state/useUIStore";
import { useConsoleStore } from "@/state/useConsoleStore";
import { useProjectStore } from "@/state/useProjectStore";
import { runCommand } from "@/commands/registry";
import { MinimalScene } from "@/three/MinimalScene";
import { SplashScreen } from "./SplashScreen";
import { CommandPalette } from "./CommandPalette";

const TABS = [
  { id: "geometry" as const, label: "Geometry & Airfoils" },
  { id: "vlm" as const, label: "VLM Mesh & Setup" },
  { id: "analysis" as const, label: "Analysis & Flight Conditions" },
  { id: "results" as const, label: "Results & Graphs" },
];

export function AppShell() {
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const splashVisible = useUIStore((s) => s.splashVisible);
  const hideSplash = useUIStore((s) => s.hideSplash);
  const consoleOpen = useConsoleStore((s) => s.open);
  const toggleConsole = useConsoleStore((s) => s.toggle);
  const lines = useConsoleStore((s) => s.lines);
  const projectName = useProjectStore((s) => s.projectName);

  useEffect(() => {
    const t = setTimeout(hideSplash, 1600);
    return () => clearTimeout(t);
  }, [hideSplash]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#EEF2F6] text-[#0F172A] overflow-hidden">
      {/* Top bar */}
      <header className="h-10 shrink-0 flex items-center gap-3 border-b border-[#C3CDD8] px-3 bg-white">
        <div className="h-2.5 w-2.5 rounded-full bg-[#FF6600]" />
        <span className="font-semibold tracking-wide">FlowSync</span>
        <span className="text-xs text-[#52606D]">v1.0.0-beta · redesign</span>
        <span className="ml-auto text-xs text-[#52606D]">
          {projectName} | Units: SI | X fwd · Y right · Z up
        </span>
      </header>

      {/* Toolbar */}
      <div className="h-9 shrink-0 flex items-center gap-2 border-b border-[#C3CDD8] bg-white px-2 text-xs">
        <button
          className="px-3 py-1.5 rounded border border-[#C3CDD8] bg-white hover:border-[#FF6600] hover:text-[#C2410C] transition-colors text-sm"
          onClick={() => runCommand("project.new")}
        >
          New
        </button>
        <button
          className="px-3 py-1.5 rounded border border-[#C3CDD8] bg-white text-sm opacity-50 cursor-not-allowed"
          disabled
          title="Phase 1"
        >
          Import CAD
        </button>
        <button
          className="px-3 py-1.5 rounded border border-transparent bg-[#FF6600] text-white text-sm opacity-50 cursor-not-allowed"
          disabled
          title="Phase 3"
        >
          Run Analysis
        </button>
        <button
          className="px-3 py-1.5 rounded border border-[#C3CDD8] bg-white text-sm opacity-50 cursor-not-allowed"
          disabled
          title="Phase 4"
        >
          Report
        </button>
        <div className="w-px h-5 bg-[#C3CDD8] mx-1" />
        {["Iso", "Top", "Front", "Side"].map((v) => (
          <button
            key={v}
            className="px-3 py-1.5 rounded border border-[#C3CDD8] bg-white hover:border-[#FF6600] hover:text-[#C2410C] transition-colors text-sm"
            onClick={() => runCommand(`view.${v}`)}
          >
            {v}
          </button>
        ))}
        <button
          className="px-3 py-1.5 rounded border border-[#C3CDD8] bg-white hover:border-[#FF6600] hover:text-[#C2410C] transition-colors text-sm ml-auto"
          onClick={() => useUIStore.getState().setPaletteOpen(true)}
        >
          ⌘K Commands
        </button>
      </div>

      {/* Tabs */}
      <nav className="h-11 shrink-0 flex items-end gap-1 border-b border-[#C3CDD8] px-2 bg-white">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${
              activeTab === t.id
                ? "text-[#C2410C] border-[#FF6600] font-medium"
                : "border-transparent text-[#52606D] hover:text-[#0F172A]"
            }`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* 3-pane workspace */}
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 shrink-0 border-r border-[#C3CDD8] bg-white flex flex-col">
          <div className="text-xs uppercase tracking-widest text-[#52606D] px-3 py-2 border-b border-[#C3CDD8]">
            Project Tree
          </div>
          <div className="p-3 text-xs text-[#52606D]">
            <div className="mb-3 p-2 rounded bg-[#EEF2F6] border border-[#C3CDD8]">
              <div className="font-medium text-[#0F172A] mb-1">📐 Geometry</div>
              <div className="text-[10px]">No model imported yet</div>
            </div>
            <div className="mb-3 p-2 rounded bg-[#EEF2F6] border border-[#C3CDD8]">
              <div className="font-medium text-[#0F172A] mb-1">🔍 Recognition</div>
              <div className="text-[10px]">Awaiting geometry import</div>
            </div>
            <div className="mb-3 p-2 rounded bg-[#EEF2F6] border border-[#C3CDD8]">
              <div className="font-medium text-[#0F172A] mb-1">📊 VLM Setup</div>
              <div className="text-[10px]">Configure in Phase 2</div>
            </div>
            <div className="p-2 rounded bg-[#EEF2F6] border border-[#C3CDD8]">
              <div className="font-medium text-[#0F172A] mb-1">📈 Results</div>
              <div className="text-[10px]">Available after Phase 3 analysis</div>
            </div>
          </div>
        </aside>

        <main className="flex-1 relative overflow-hidden">
          {activeTab === "results" ? (
            <div className="h-full flex items-center justify-center text-sm text-[#52606D] bg-[#E8EDF2]">
              <div className="text-center">
                <div className="text-3xl mb-3">📊</div>
                <div className="font-medium mb-1">Results workspace</div>
                <div className="text-xs">Arrives in Phase 3 with solver integration</div>
              </div>
            </div>
          ) : (
            <MinimalScene />
          )}
        </main>

        <aside className="w-80 shrink-0 border-l border-[#C3CDD8] bg-white flex flex-col">
          <div className="text-xs uppercase tracking-widest text-[#52606D] px-3 py-2 border-b border-[#C3CDD8]">
            Properties Inspector
          </div>
          <div className="p-3 text-xs text-[#52606D] space-y-3">
            <div className="p-2 rounded bg-[#EEF2F6] border border-[#C3CDD8]">
              <div className="font-medium text-[#0F172A] mb-1">Selection</div>
              <div className="text-[10px]">No faces selected. Import CAD in Phase 1 to enable selection.</div>
            </div>
            <div className="p-2 rounded bg-[#EEF2F6] border border-[#C3CDD8]">
              <div className="font-medium text-[#0F172A] mb-1">Recognition</div>
              <div className="text-[10px]">Component identification arrives in Phase 2.</div>
            </div>
            <div className="p-2 rounded bg-[#EEF2F6] border border-[#C3CDD8]">
              <div className="font-medium text-[#0F172A] mb-1">Flight Conditions</div>
              <div className="text-[10px]">Set velocity, altitude, AoA in Phase 3.</div>
            </div>
          </div>
        </aside>
      </div>

      {/* Console */}
      {consoleOpen && (
        <div className="h-36 shrink-0 border-t border-[#C3CDD8] bg-white flex flex-col">
          <div className="text-xs uppercase tracking-widest text-[#52606D] px-3 py-2 border-b border-[#C3CDD8] flex justify-between">
            <span>Analysis Console</span>
            <button
              className="text-xs underline text-[#52606D] hover:text-[#FF6600]"
              onClick={() => useConsoleStore.getState().clear()}
            >
              Clear
            </button>
          </div>
          <div className="flex-1 overflow-auto px-3 py-1 font-mono text-[11px] space-y-0.5">
            {lines.length === 0 && (
              <div className="text-[#52606D] italic py-2">
                Console empty. Events will appear here.
              </div>
            )}
            {lines.map((l, i) => (
              <div
                key={i}
                className={
                  l.level === "error"
                    ? "text-red-600"
                    : l.level === "warn"
                    ? "text-amber-700"
                    : l.level === "success"
                    ? "text-green-700"
                    : "text-slate-600"
                }
              >
                [{l.time}] {l.level.toUpperCase()} — {l.msg}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status bar */}
      <footer className="h-7 shrink-0 border-t border-[#C3CDD8] bg-white px-3 flex items-center justify-between text-xs text-[#52606D]">
        <button className="underline hover:text-[#FF6600]" onClick={toggleConsole}>
          Console ({lines.length})
        </button>
        <div className="flex gap-4">
          <span>Tab: {activeTab}</span>
          <span>Solver: idle</span>
          <span>Units: SI</span>
        </div>
      </footer>

      <CommandPalette />
      {splashVisible && <SplashScreen />}
    </div>
  );
}
