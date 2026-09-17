import { registerCommand } from "./registry";
import { useGeometryStore } from "@/state/useGeometryStore";
import { useUIStore } from "@/state/useUIStore";
import { useConsoleStore } from "@/state/useConsoleStore";
import { useProjectStore } from "@/state/useProjectStore";

const EXT_FORMAT: Record<string, string> = {
  step: "step",
  stp: "step",
  iges: "iges",
  igs: "iges",
  brep: "brep",
  stl: "stl",
};

export async function startImport(file: File) {
  const geo = useGeometryStore.getState();
  const log = useConsoleStore.getState().log;
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const format = EXT_FORMAT[ext];

  if (!format) {
    geo.setImportStatus(
      "error",
      `Unsupported file type ".${ext}". Supported: STEP, IGES, BREP, STL.`
    );
    geo.openSummary();
    return;
  }

  geo.setImportStatus("loading");
  log("info", `Importing ${file.name} in background worker…`);

  const buffer = await file.arrayBuffer();
  const worker = new Worker(
    new URL("../workers/import.worker.ts", import.meta.url),
    { type: "module" }
  );

  worker.onmessage = (e) => {
    const msg = e.data;
    if (msg.type === "progress")
      log("info", `[import ${msg.pct}%] ${msg.stage}`);
    else if (msg.type === "result") {
      useGeometryStore.getState().setModel(msg.model);
      useGeometryStore.getState().setImportStatus("ready");
      useGeometryStore.getState().openSummary();
      useProjectStore.getState().pushRecent(file.name);
      log(
        "success",
        `Imported ${msg.model.faces.length} faces, ${msg.model.triangleCount} triangles.`
      );
      if (msg.model.orientationNote)
        log("info", `Orientation: ${msg.model.orientationNote}`);
      worker.terminate();
    } else if (msg.type === "error") {
      useGeometryStore.getState().setImportStatus("error", msg.message);
      useGeometryStore.getState().openSummary();
      log("error", msg.message);
      worker.terminate();
    }
  };
  worker.onerror = (e) => {
    useGeometryStore.getState().setImportStatus("error", e.message);
    log("error", `Import worker crashed: ${e.message}`);
    worker.terminate();
  };

  worker.postMessage({
    type: "import",
    fileName: file.name,
    format,
    buffer,
  });
}

// Register CAD commands
registerCommand({
  id: "cad.import",
  label: "Import CAD file…",
  category: "CAD",
  run: () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".step,.stp,.iges,.igs,.brep,.stl";
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) void startImport(f);
    };
    input.click();
  },
});

registerCommand({
  id: "selection.clear",
  label: "Clear selection",
  category: "Select",
  run: () => useGeometryStore.getState().clearSelection(),
});

registerCommand({
  id: "selection.mode.click",
  label: "Selection mode: click",
  category: "Select",
  run: () => useUIStore.getState().setSelectMode("click"),
});

registerCommand({
  id: "selection.mode.box",
  label: "Selection mode: box marquee",
  category: "Select",
  run: () => useUIStore.getState().setSelectMode("box"),
});

// Override project.new to also reset geometry
registerCommand({
  id: "project.new",
  label: "New project",
  category: "Project",
  run: () => {
    useProjectStore.getState().newProject();
    useGeometryStore.getState().setModel(null);
    useGeometryStore.getState().setImportStatus("idle");
    useConsoleStore.getState().log("info", "New project created; geometry cleared.");
  },
});
