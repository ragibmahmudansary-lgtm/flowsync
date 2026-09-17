import { create } from "zustand";

export interface ConsoleLine {
  time: string;
  level: "info" | "success" | "warn" | "error";
  msg: string;
}

interface ConsoleState {
  lines: ConsoleLine[];
  open: boolean;
  log: (level: ConsoleLine["level"], msg: string) => void;
  toggle: () => void;
  clear: () => void;
}

export const useConsoleStore = create<ConsoleState>((set) => ({
  lines: [],
  open: false,
  log: (level, msg) =>
    set((s) => ({
      lines: [
        ...s.lines.slice(-400),
        { time: new Date().toLocaleTimeString(), level, msg },
      ],
    })),
  toggle: () => set((s) => ({ open: !s.open })),
  clear: () => set({ lines: [] }),
}));
