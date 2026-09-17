import { create } from "zustand";
import { computeComponentProperties, computeCG } from "@/modules/solver/massProperties";
import { useGeometryStore } from "./useGeometryStore";
import { useRecognitionStore } from "./useRecognitionStore";
import { useAeroStore } from "./useAeroStore";
import { useConsoleStore } from "./useConsoleStore";

interface ComponentDensity {
  wing: number;
  htail: number;
  vtail: number;
  fuselage: number;
}

interface MassState {
  densities: ComponentDensity;
  totalMass: number | null;
  cgX: number | null;
  cgZ: number | null;
  fallbackWarning: boolean;
  setDensities: (d: Partial<ComponentDensity>) => void;
  compute: () => void;
}

const DEFAULT_DENSITIES: ComponentDensity = {
  wing: 50,
  htail: 35,
  vtail: 35,
  fuselage: 80,
};

export const useMassStore = create<MassState>((set, get) => ({
  densities: { ...DEFAULT_DENSITIES },
  totalMass: null,
  cgX: null,
  cgZ: null,
  fallbackWarning: false,

  setDensities: (d) => set({ densities: { ...get().densities, ...d } }),

  compute: () => {
    const model = useGeometryStore.getState().model;
    const rec = useRecognitionStore.getState().result;
    if (!model || !rec) {
      useConsoleStore.getState().log("error", "Mass: need model + recognition first.");
      return;
    }

    const props = computeComponentProperties(model.faces, rec.componentByFaceId);
    const densities = get().densities;

    const components = props.map((p) => {
      const rho = p.component in densities ? densities[p.component as keyof ComponentDensity] : 50;
      return {
        ...p,
        density: rho,
        mass: p.volume * rho,
      };
    });

    const { cg, totalMass } = computeCG(components);
    const fallback = props.some((p) => p.fallback);

    set({
      totalMass,
      cgX: cg[0],
      cgZ: cg[2],
      fallbackWarning: fallback,
    });

    // Write CG into aero store for stability analysis
    useAeroStore.getState().set({ cgX: cg[0], cgZ: cg[2] });

    useConsoleStore.getState().log(
      "success",
      `CG computed: mass=${totalMass.toFixed(1)} kg, CG=(${cg[0].toFixed(3)}, ${cg[2].toFixed(3)})${fallback ? " (fallback bbox estimate)" : ""}`
    );
  },
}));
