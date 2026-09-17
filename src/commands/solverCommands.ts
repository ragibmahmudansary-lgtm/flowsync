import { registerCommand } from "./registry";
import { useSolverStore } from "@/state/useSolverStore";

registerCommand({ id: "solver.run", label: "Run VLM analysis", category: "Analysis", run: () => useSolverStore.getState().run() });
registerCommand({ id: "solver.validate", label: "Run validation case (AR=6)", category: "Analysis", run: () => useSolverStore.getState().runValidation() });
