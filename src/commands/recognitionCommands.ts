import { registerCommand } from "./registry";
import { useRecognitionStore } from "@/state/useRecognitionStore";
import { useGeometryStore } from "@/state/useGeometryStore";

registerCommand({
  id: "recognition.run",
  label: "Run auto-recognition",
  category: "Recognition",
  run: () => useRecognitionStore.getState().runAutoRecognition(),
});

registerCommand({
  id: "recognition.confirm",
  label: "Confirm & lock recognition",
  category: "Recognition",
  run: () => useRecognitionStore.getState().confirmRecognition(),
});

registerCommand({
  id: "recognition.reset",
  label: "Reset recognition",
  category: "Recognition",
  run: () => useRecognitionStore.getState().resetRecognition(),
});

registerCommand({
  id: "selection.component",
  label: "Select whole component of current selection",
  category: "Select",
  run: () => {
    const model = useGeometryStore.getState().model;
    const rec = useRecognitionStore.getState().result;
    const selected = useGeometryStore.getState().selectedFaceIds;
    if (!model || !rec || selected.length === 0) return;
    const comp = rec.componentByFaceId[selected[0]];
    useGeometryStore
      .getState()
      .setSelectedFaces(
        model.faces
          .filter((f) => rec.componentByFaceId[f.id] === comp)
          .map((f) => f.id)
      );
  },
});
