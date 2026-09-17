import { create } from "zustand";
import type { ComponentType, RecognitionResult } from "@/core/types";
import {
  runRecognition,
  applyComponentMap,
} from "@/modules/recognition/recognitionEngine";
import { useGeometryStore } from "./useGeometryStore";
import { useConsoleStore } from "./useConsoleStore";

interface RecognitionState {
  result: RecognitionResult | null;
  runAutoRecognition: () => void;
  assignSelectedFaces: (component: ComponentType) => void;
  clearComponent: (component: ComponentType) => void;
  confirmRecognition: () => void;
  resetRecognition: () => void;
}

export const useRecognitionStore = create<RecognitionState>((set, get) => ({
  result: null,

  runAutoRecognition: () => {
    const model = useGeometryStore.getState().model;
    if (!model) {
      useConsoleStore.getState().log("error", "Recognition: import a model first.");
      return;
    }
    const result = runRecognition(model);
    set({ result });
    useConsoleStore.getState().log(
      "success",
      `Recognition: wing=${
        result.wing
          ? `span ${result.wing.span.toFixed(2)} m, AR ${result.wing.aspectRatio.toFixed(1)}`
          : "none"
      }, htail=${result.htail ? "yes" : "no"}, vtail=${
        result.vtailArea > 0 ? "yes" : "no"
      }.`
    );
  },

  assignSelectedFaces: (component) => {
    const model = useGeometryStore.getState().model;
    const selected = useGeometryStore.getState().selectedFaceIds;
    const result = get().result;
    if (!model || !result || selected.length === 0) return;
    const map = { ...result.componentByFaceId };
    for (const id of selected) map[id] = component;
    set({
      result: applyComponentMap(model, { ...result, status: "proposed" }, map),
    });
    useConsoleStore
      .getState()
      .log("info", `Manual override: ${selected.length} faces → ${component}.`);
  },

  clearComponent: (component) => {
    const model = useGeometryStore.getState().model;
    const result = get().result;
    if (!model || !result) return;
    const map: Record<string, ComponentType> = {};
    for (const [id, comp] of Object.entries(result.componentByFaceId))
      map[id] = comp === component ? "unassigned" : comp;
    set({ result: applyComponentMap(model, result, map) });
  },

  confirmRecognition: () => {
    const result = get().result;
    if (!result) return;
    set({ result: { ...result, status: "confirmed" } });
    useConsoleStore.getState().log("success", "Recognition confirmed & locked.");
  },

  resetRecognition: () => set({ result: null }),
}));
