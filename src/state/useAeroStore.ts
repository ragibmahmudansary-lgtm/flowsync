import { create } from "zustand";
import type { SymmetryMode } from "@/core/types";

interface AeroState {
  velocity: number;
  density: number;
  viscosity: number;
  aoaStartDeg: number;
  aoaEndDeg: number;
  aoaStepDeg: number;
  spanwisePanels: number;
  chordwisePanels: number;
  symmetry: SymmetryMode;
  wakeRelaxation: boolean;
  viscousCorrection: boolean;
  displayAlphaDeg: number;
  cgX: number | null;
  cgZ: number | null;
  set: (p: Partial<AeroState>) => void;
}

export const useAeroStore = create<AeroState>((set) => ({
  velocity: 30,
  density: 1.225,
  viscosity: 1.81e-5,
  aoaStartDeg: -4,
  aoaEndDeg: 12,
  aoaStepDeg: 1,
  spanwisePanels: 24,
  chordwisePanels: 8,
  symmetry: "full",
  wakeRelaxation: true,
  viscousCorrection: true,
  displayAlphaDeg: 0,
  cgX: null,
  cgZ: null,
  set: (p) => set(p),
}));
