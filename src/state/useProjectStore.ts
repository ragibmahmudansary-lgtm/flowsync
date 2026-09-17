import { create } from "zustand";

interface ProjectState {
  projectName: string;
  dirty: boolean;
  recents: string[];
  setProjectName: (n: string) => void;
  markDirty: () => void;
  newProject: () => void;
  pushRecent: (name: string) => void;
}

const loadRecents = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem("flowsync_recents") ?? "[]");
  } catch {
    return [];
  }
};

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectName: "Untitled FlowSync Project",
  dirty: false,
  recents: loadRecents(),
  setProjectName: (projectName) => set({ projectName, dirty: true }),
  markDirty: () => set({ dirty: true }),
  newProject: () =>
    set({ projectName: "Untitled FlowSync Project", dirty: false }),
  pushRecent: (name) => {
    const recents = [name, ...get().recents.filter((r) => r !== name)].slice(
      0,
      8
    );
    localStorage.setItem("flowsync_recents", JSON.stringify(recents));
    set({ recents });
  },
}));
