import { create } from "zustand";
import type { TabId, SelectMode, DisplayMode } from "@/core/types";

interface UIState {
  activeTab: TabId;
  setActiveTab: (t: TabId) => void;
  selectMode: SelectMode;
  setSelectMode: (m: SelectMode) => void;
  displayMode: DisplayMode;
  setDisplayMode: (m: DisplayMode) => void;
  viewRequest: { view: string; nonce: number } | null;
  requestView: (view: string) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  splashVisible: boolean;
  hideSplash: () => void;
  showColorMap: boolean;
  showPathlines: boolean;
  setViz: (p: { showColorMap?: boolean; showPathlines?: boolean }) => void;
  aeroBotOpen: boolean;
  setAeroBotOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: "geometry",
  setActiveTab: (activeTab) => set({ activeTab }),
  selectMode: "click",
  setSelectMode: (selectMode) => set({ selectMode }),
  displayMode: "shaded",
  setDisplayMode: (displayMode) => set({ displayMode }),
  viewRequest: null,
  requestView: (view) =>
    set((s) => ({
      viewRequest: { view, nonce: (s.viewRequest?.nonce ?? 0) + 1 },
    })),
  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  splashVisible: true,
  hideSplash: () => set({ splashVisible: false }),
  showColorMap: false,
  showPathlines: false,
  setViz: (p) => set(p),
  aeroBotOpen: false,
  setAeroBotOpen: (aeroBotOpen) => set({ aeroBotOpen }),
}));
