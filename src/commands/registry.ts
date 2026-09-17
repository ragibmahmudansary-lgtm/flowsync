import { useUIStore } from "@/state/useUIStore";
import { useConsoleStore } from "@/state/useConsoleStore";
import { useProjectStore } from "@/state/useProjectStore";
import type { DisplayMode } from "@/core/types";

export interface CommandDef {
  id: string;
  label: string;
  category: string;
  run: () => void | Promise<void>;
}

const commands = new Map<string, CommandDef>();

export function registerCommand(def: CommandDef) {
  commands.set(def.id, def);
}

export function listCommands(): CommandDef[] {
  return Array.from(commands.values());
}

export function runCommand(id: string) {
  const cmd = commands.get(id);
  if (!cmd) {
    useConsoleStore.getState().log("error", `Unknown command: ${id}`);
    return;
  }
  void cmd.run();
}

// ---- core commands (later phases register their own here) ----
const tabs = ["geometry", "vlm", "analysis", "results"] as const;
tabs.forEach((t) =>
  registerCommand({
    id: `tab.${t}`,
    label: `Go to tab: ${t}`,
    category: "Navigate",
    run: () => useUIStore.getState().setActiveTab(t),
  })
);

(["shaded", "wireframe", "shadedEdges"] as DisplayMode[]).forEach((m) =>
  registerCommand({
    id: `display.${m}`,
    label: `Display mode: ${m}`,
    category: "View",
    run: () => useUIStore.getState().setDisplayMode(m),
  })
);

["Iso", "Top", "Front", "Side", "Reset"].forEach((v) =>
  registerCommand({
    id: `view.${v}`,
    label: `Camera view: ${v}`,
    category: "View",
    run: () => useUIStore.getState().requestView(v),
  })
);

registerCommand({
  id: "console.toggle",
  label: "Toggle analysis console",
  category: "View",
  run: () => useConsoleStore.getState().toggle(),
});

registerCommand({
  id: "project.new",
  label: "New project",
  category: "Project",
  run: () => {
    useProjectStore.getState().newProject();
    useConsoleStore.getState().log("info", "New project created.");
  },
});

registerCommand({
  id: "select.click",
  label: "Selection mode: click",
  category: "Selection",
  run: () => useUIStore.getState().setSelectMode("click"),
});

registerCommand({
  id: "select.box",
  label: "Selection mode: box",
  category: "Selection",
  run: () => useUIStore.getState().setSelectMode("box"),
});
