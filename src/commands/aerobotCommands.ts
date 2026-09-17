import { registerCommand } from "./registry";
import { useUIStore } from "@/state/useUIStore";

registerCommand({
  id: "aerobot.open",
  label: "Open AeroBot assistant",
  category: "Assistant",
  run: () => useUIStore.getState().setAeroBotOpen(true),
});

registerCommand({
  id: "aerobot.tour",
  label: "Start beginner guided tour",
  category: "Assistant",
  run: () => {
    useUIStore.getState().setAeroBotOpen(true);
    window.dispatchEvent(new CustomEvent("flowsync:aerobot-tour"));
  },
});
