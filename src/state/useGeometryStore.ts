import { create } from "zustand";
import type { ImportedModel, NamedSelection } from "@/core/types";
import { buildFace, combineBounds } from "@/modules/cad/faceProperties";
import { buildFaceAdjacency } from "@/modules/cad/faceAdjacency";
import { useConsoleStore } from "./useConsoleStore";

export type ImportStatus = "idle" | "loading" | "ready" | "error";

interface GeometryState {
  model: ImportedModel | null;
  importStatus: ImportStatus;
  importError: string | null;
  summaryOpen: boolean;
  selectedFaceIds: string[];
  namedSelections: NamedSelection[];

  setModel: (m: ImportedModel | null) => void;
  setImportStatus: (s: ImportStatus, err?: string | null) => void;
  openSummary: () => void;
  closeSummary: () => void;

  selectOnly: (id: string) => void;
  toggleFace: (id: string) => void;
  addFaces: (ids: string[]) => void;
  removeFaces: (ids: string[]) => void;
  setSelectedFaces: (ids: string[]) => void;
  floodSelect: (id: string) => void;
  clearSelection: () => void;

  createNamedSelection: (name: string) => void;
  assignSelectedFaces: (nsId: string) => void;
  deleteNamedSelection: (nsId: string) => void;

  applyRotation: (kind: "rotZ90" | "flipX" | "flipZ") => void;
}

export const useGeometryStore = create<GeometryState>((set, get) => ({
  model: null,
  importStatus: "idle",
  importError: null,
  summaryOpen: false,
  selectedFaceIds: [],
  namedSelections: [],

  setModel: (model) => set({ model, selectedFaceIds: [] }),
  setImportStatus: (importStatus, importError = null) =>
    set({ importStatus, importError }),
  openSummary: () => set({ summaryOpen: true }),
  closeSummary: () => set({ summaryOpen: false }),

  selectOnly: (faceId) => set({ selectedFaceIds: [faceId] }),
  toggleFace: (faceId) =>
    set((s) => ({
      selectedFaceIds: s.selectedFaceIds.includes(faceId)
        ? s.selectedFaceIds.filter((id) => id !== faceId)
        : [...s.selectedFaceIds, faceId],
    })),
  addFaces: (ids) =>
    set((s) => ({
      selectedFaceIds: Array.from(new Set([...s.selectedFaceIds, ...ids])),
    })),
  removeFaces: (ids) =>
    set((s) => ({
      selectedFaceIds: s.selectedFaceIds.filter((id) => !ids.includes(id)),
    })),
  setSelectedFaces: (faceIds) => set({ selectedFaceIds: faceIds }),
  clearSelection: () => set({ selectedFaceIds: [] }),

  floodSelect: (faceId) => {
    const model = get().model;
    if (!model) return;
    const visited = new Set<string>([faceId]);
    const queue = [faceId];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const nb of model.adjacency[cur] ?? [])
        if (!visited.has(nb)) {
          visited.add(nb);
          queue.push(nb);
        }
    }
    set((s) => ({
      selectedFaceIds: Array.from(new Set([...s.selectedFaceIds, ...visited])),
    }));
  },

  createNamedSelection: (name) =>
    set((s) => ({
      namedSelections: [
        ...s.namedSelections,
        {
          id: crypto.randomUUID(),
          name,
          faceIds: [],
          color: "#FF6600",
        },
      ],
    })),
  assignSelectedFaces: (nsId) =>
    set((s) => ({
      namedSelections: s.namedSelections.map((ns) =>
        ns.id === nsId
          ? {
              ...ns,
              faceIds: Array.from(
                new Set([...ns.faceIds, ...s.selectedFaceIds])
              ),
            }
          : ns
      ),
    })),
  deleteNamedSelection: (nsId) =>
    set((s) => ({
      namedSelections: s.namedSelections.filter((ns) => ns.id !== nsId),
    })),

  applyRotation: (kind) => {
    const model = get().model;
    if (!model) return;
    const t = (p: [number, number, number]): [number, number, number] =>
      kind === "rotZ90"
        ? [-p[1], p[0], p[2]]
        : kind === "flipX"
        ? [-p[0], p[1], p[2]]
        : [p[0], p[1], -p[2]];

    const faces = model.faces.map((f) => {
      const position = new Float32Array(f.position.length);
      for (let i = 0; i < f.position.length; i += 3) {
        const q = t([f.position[i], f.position[i + 1], f.position[i + 2]]);
        position[i] = q[0];
        position[i + 1] = q[1];
        position[i + 2] = q[2];
      }
      const normal = new Float32Array(f.normal.length);
      for (let i = 0; i < f.normal.length; i += 3) {
        const q = t([f.normal[i], f.normal[i + 1], f.normal[i + 2]]);
        normal[i] = q[0];
        normal[i + 1] = q[1];
        normal[i + 2] = q[2];
      }
      return buildFace(f.id, f.name, f.format, position, normal, f.index, f.baseColor);
    });

    set({
      model: {
        ...model,
        faces,
        bbox: combineBounds(faces),
        adjacency: buildFaceAdjacency(faces),
        orientationNote:
          (model.orientationNote ?? "") + ` [manual: ${kind}]`,
      },
      selectedFaceIds: [],
    });
    useConsoleStore.getState().log("info", `Manual orientation applied: ${kind}`);
  },
}));
