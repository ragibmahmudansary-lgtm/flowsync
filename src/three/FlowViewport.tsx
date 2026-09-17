import { useEffect, useRef, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useUIStore } from "@/state/useUIStore";
import { useGeometryStore } from "@/state/useGeometryStore";
import { useRecognitionStore } from "@/state/useRecognitionStore";
import { runCommand } from "@/commands/registry";
import { VlmLatticeOverlay } from "./VlmLatticeOverlay";
import { CgMarker } from "./CgMarker";
import { PanelColorMap } from "./PanelColorMap";
import { FlowPathlines } from "./FlowPathlines";
import { AxisTriad } from "./AxisTriad";
import { AirflowIndicator } from "./AirflowIndicator";
import { setViewportRenderer } from "./viewportCapture";
import * as THREE from "three";
import type { CadFace, ComponentType } from "@/core/types";

const COMPONENT_COLORS: Record<ComponentType, string> = {
  wing: "#4F86C6",
  htail: "#5FA777",
  vtail: "#8E7CC3",
  fuselage: "#9AAAB9",
  unassigned: "#B7C1CC",
};

function CameraController() {
  const { camera } = useThree();
  const viewRequest = useUIStore((s) => s.viewRequest);
  const model = useGeometryStore((s) => s.model);
  const lastNonce = useRef(0);

  useEffect(() => {
    if (!viewRequest || viewRequest.nonce === lastNonce.current) return;
    lastNonce.current = viewRequest.nonce;

    const dist = model
      ? Math.max(
          model.bbox.max[0] - model.bbox.min[0],
          model.bbox.max[1] - model.bbox.min[1],
          model.bbox.max[2] - model.bbox.min[2]
        ) * 1.8
      : 12;

    switch (viewRequest.view) {
      case "Top":
        camera.position.set(0, 0, dist);
        break;
      case "Front":
        camera.position.set(0, -dist, dist * 0.3);
        break;
      case "Side":
        camera.position.set(dist, 0, dist * 0.3);
        break;
      case "Reset":
      case "Iso":
        camera.position.set(dist * 0.6, -dist * 0.7, dist * 0.4);
        break;
    }
    camera.up.set(0, 0, 1);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [viewRequest, camera, model]);

  return null;
}

function FaceMesh({
  face,
  isSelected,
  displayMode,
  component,
  onClick,
}: {
  face: CadFace;
  isSelected: boolean;
  displayMode: string;
  component: ComponentType;
  onClick: (e: any) => void;
}) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(face.position.slice(), 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(face.normal.slice(), 3));
    geo.setIndex(new THREE.BufferAttribute(face.index.slice(), 1));
    geo.computeBoundingSphere();
    return geo;
  }, [face]);

  const edgesGeo = useMemo(() => {
    if (displayMode !== "shadedEdges") return null;
    const edges = new THREE.EdgesGeometry(geometry, 15);
    return edges;
  }, [geometry, displayMode]);

  const color = isSelected ? "#FF6600" : COMPONENT_COLORS[component];

  return (
    <group>
      <mesh
        geometry={geometry}
        onClick={onClick}
        renderOrder={isSelected ? 1 : 0}
      >
        <meshStandardMaterial
          color={color}
          wireframe={displayMode === "wireframe"}
          side={THREE.DoubleSide}
          transparent={isSelected}
          opacity={isSelected ? 0.9 : 1}
        />
      </mesh>
      {edgesGeo && (
        <lineSegments geometry={edgesGeo}>
          <lineBasicMaterial color="#333" linewidth={1} />
        </lineSegments>
      )}
    </group>
  );
}

function ImportedModelMesh() {
  const model = useGeometryStore((s) => s.model);
  const selectedFaceIds = useGeometryStore((s) => s.selectedFaceIds);
  const selectOnly = useGeometryStore((s) => s.selectOnly);
  const toggleFace = useGeometryStore((s) => s.toggleFace);
  const floodSelect = useGeometryStore((s) => s.floodSelect);
  const displayMode = useUIStore((s) => s.displayMode);
  const recResult = useRecognitionStore((s) => s.result);

  if (!model) return null;

  const selectedSet = new Set(selectedFaceIds);

  return (
    <group>
      {model.faces.map((face) => {
        const component = recResult?.componentByFaceId[face.id] ?? "unassigned";
        return (
          <FaceMesh
            key={face.id}
            face={face}
            isSelected={selectedSet.has(face.id)}
            displayMode={displayMode}
            component={component}
            onClick={(e: any) => {
              e.stopPropagation();
              if (e.shiftKey && e.ctrlKey) {
                floodSelect(face.id);
              } else if (e.ctrlKey) {
                toggleFace(face.id);
              } else {
                selectOnly(face.id);
              }
            }}
          />
        );
      })}
    </group>
  );
}

function SelectionBox({
  onBoxComplete,
}: {
  onBoxComplete: (rect: { x1: number; y1: number; x2: number; y2: number }) => void;
}) {
  const selectMode = useUIStore((s) => s.selectMode);
  const containerRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectMode !== "box") return;
    const el = containerRef.current;
    if (!el) return;

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return;
      const rect = el.getBoundingClientRect();
      startRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onMove = (e: MouseEvent) => {
      if (!startRef.current || !boxRef.current) return;
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const x1 = Math.min(startRef.current.x, cx);
      const y1 = Math.min(startRef.current.y, cy);
      const x2 = Math.max(startRef.current.x, cx);
      const y2 = Math.max(startRef.current.y, cy);
      boxRef.current.style.left = `${x1}px`;
      boxRef.current.style.top = `${y1}px`;
      boxRef.current.style.width = `${x2 - x1}px`;
      boxRef.current.style.height = `${y2 - y1}px`;
      boxRef.current.style.display = "block";
    };

    const onUp = (e: MouseEvent) => {
      if (!startRef.current) return;
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const x1 = Math.min(startRef.current.x, cx);
      const y1 = Math.min(startRef.current.y, cy);
      const x2 = Math.max(startRef.current.x, cx);
      const y2 = Math.max(startRef.current.y, cy);
      startRef.current = null;
      if (boxRef.current) boxRef.current.style.display = "none";

      if (x2 - x1 > 5 && y2 - y1 > 5) {
        onBoxComplete({ x1, y1, x2, y2 });
      }
    };

    el.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      el.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [selectMode, onBoxComplete]);

  return (
    <div ref={containerRef} className="absolute inset-0 z-10">
      <div
        ref={boxRef}
        className="absolute border-2 border-[#FF6600] bg-[#FF6600]/10 pointer-events-none"
        style={{ display: "none" }}
      />
    </div>
  );
}

function projectToScreen(
  point: THREE.Vector3,
  camera: THREE.Camera,
  width: number,
  height: number
): { x: number; y: number } {
  const v = point.clone().project(camera);
  return {
    x: ((v.x + 1) / 2) * width,
    y: ((-v.y + 1) / 2) * height,
  };
}

function BoxSelectionHandler() {
  const selectMode = useUIStore((s) => s.selectMode);
  const model = useGeometryStore((s) => s.model);
  const addFaces = useGeometryStore((s) => s.addFaces);
  const setSelectedFaces = useGeometryStore((s) => s.setSelectedFaces);

  const handleBox = (rect: { x1: number; y1: number; x2: number; y2: number }) => {
    if (!model) return;
    // Get canvas dimensions from the container
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    // Get camera from the R3F context
    const camera = (window as any).__flowsync_camera as THREE.Camera;
    if (!camera) return;

    const selected: string[] = [];
    for (const face of model.faces) {
      // Sample centroid
      const centroid = new THREE.Vector3(
        face.centroid[0],
        face.centroid[1],
        face.centroid[2]
      );
      const screen = projectToScreen(centroid, camera, width, height);
      if (
        screen.x >= rect.x1 &&
        screen.x <= rect.x2 &&
        screen.y >= rect.y1 &&
        screen.y <= rect.y2
      ) {
        selected.push(face.id);
      }
    }

    if (selected.length > 0) {
      addFaces(selected);
    }
  };

  if (selectMode !== "box" || !model) return null;
  return <SelectionBox onBoxComplete={handleBox} />;
}

function CameraExporter() {
  const { camera } = useThree();
  useEffect(() => {
    (window as any).__flowsync_camera = camera;
  }, [camera]);
  return null;
}

export function FlowViewport() {
  const model = useGeometryStore((s) => s.model);
  const selectedCount = useGeometryStore((s) => s.selectedFaceIds.length);
  const selectMode = useUIStore((s) => s.selectMode);
  const clearSelection = useGeometryStore((s) => s.clearSelection);
  const setSelectMode = useUIStore((s) => s.setSelectMode);
  const showColorMap = useUIStore((s) => s.showColorMap);
  const showPathlines = useUIStore((s) => s.showPathlines);

  return (
    <div className="h-full w-full relative">
      <Canvas
        camera={{ position: [7.5, -8.5, 4.5], fov: 42 }}
        onCreated={({ camera, gl }) => {
          camera.up.set(0, 0, 1);
          camera.lookAt(0, 0, 0);
          (window as any).__flowsync_camera = camera;
          setViewportRenderer(gl);
        }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <color attach="background" args={["#E8EDF2"]} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[10, -12, 10]} intensity={1.1} />
        <gridHelper
          args={[20, 20, "#8FA0B0", "#C6D0DA"]}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, -1.2]}
        />
        <axesHelper args={[2.5]} />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.12}
          mouseButtons={{
            LEFT: selectMode === "box" ? undefined as any : THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          }}
        />
        <ImportedModelMesh />
        <VlmLatticeOverlay />
        <CgMarker />
        {showColorMap && <PanelColorMap />}
        {showPathlines && <FlowPathlines />}
        <AxisTriad position={[-6, -6, 0]} />
        <AirflowIndicator />
        <CameraController />
        <CameraExporter />
      </Canvas>

      {/* Box selection overlay */}
      <BoxSelectionHandler />

      {/* Selection toolbar */}
      <div className="absolute top-3 left-3 flex gap-1">
        <button
          className={`px-2 py-1 text-xs rounded border ${
            selectMode === "click"
              ? "bg-[#FF6600] text-white border-[#FF6600]"
              : "bg-white border-[#C3CDD8] text-[#52606D] hover:border-[#FF6600]"
          }`}
          onClick={() => setSelectMode("click")}
        >
          ⬐ Click
        </button>
        <button
          className={`px-2 py-1 text-xs rounded border ${
            selectMode === "box"
              ? "bg-[#FF6600] text-white border-[#FF6600]"
              : "bg-white border-[#C3CDD8] text-[#52606D] hover:border-[#FF6600]"
          }`}
          onClick={() => setSelectMode("box")}
        >
          ⬚ Box
        </button>
        {selectedCount > 0 && (
          <>
            <button
              className="px-2 py-1 text-xs rounded border bg-white border-[#C3CDD8] text-[#52606D] hover:border-red-400 hover:text-red-600"
              onClick={clearSelection}
            >
              ✕ Clear
            </button>
            <button
              className="px-2 py-1 text-xs rounded border bg-white border-[#C3CDD8] text-[#52606D] hover:border-[#FF6600] hover:text-[#C2410C]"
              onClick={() => runCommand("selection.component")}
              title="Select all faces in same component"
            >
              ⇪ Component
            </button>
          </>
        )}
      </div>

      {/* Visualization toolbar */}
      <div className="absolute top-3 right-3 flex flex-col gap-1">
        <label className="flex items-center gap-1 px-2 py-1 text-xs bg-white/90 border border-[#C3CDD8] rounded cursor-pointer hover:border-[#FF6600]">
          <input
            type="checkbox"
            checked={showColorMap}
            onChange={(e) => useUIStore.getState().setViz({ showColorMap: e.target.checked })}
            className="accent-[#FF6600]"
          />
          <span className="text-[#52606D]">Panel color map</span>
        </label>
        <label className="flex items-center gap-1 px-2 py-1 text-xs bg-white/90 border border-[#C3CDD8] rounded cursor-pointer hover:border-[#FF6600]">
          <input
            type="checkbox"
            checked={showPathlines}
            onChange={(e) => useUIStore.getState().setViz({ showPathlines: e.target.checked })}
            className="accent-[#FF6600]"
          />
          <span className="text-[#52606D]">Flow pathlines</span>
        </label>
        {showColorMap && (
          <div className="px-2 py-1 text-[10px] bg-white/90 border border-[#C3CDD8] rounded">
            <span className="text-[#52606D]">|Γ|: </span>
            <span className="text-blue-600">low</span>
            <span className="mx-1">▓▓▓▓</span>
            <span className="text-red-600">high</span>
          </div>
        )}
      </div>

      {/* Status chips */}
      <div className="absolute bottom-3 left-3 flex gap-2">
        {!model && (
          <div className="text-xs text-[#52606D] bg-white/80 border border-[#C3CDD8] rounded px-2 py-1 pointer-events-none">
            Phase 1 shell · Import a CAD file to begin · Ctrl+K for commands
          </div>
        )}
        {model && (
          <>
            <div className="text-xs text-[#52606D] bg-white/80 border border-[#C3CDD8] rounded px-2 py-1 pointer-events-none">
              {model.faces.length} faces · {model.triangleCount.toLocaleString()} tris
            </div>
            {selectedCount > 0 && (
              <div className="text-xs text-[#C2410C] bg-[#FF6600]/10 border border-[#FF6600] rounded px-2 py-1 pointer-events-none">
                {selectedCount} selected
              </div>
            )}
          </>
        )}
      </div>

      {/* Selection help */}
      {model && selectMode === "click" && (
        <div className="absolute bottom-3 right-3 text-[10px] text-[#52606D] bg-white/80 border border-[#C3CDD8] rounded px-2 py-1 pointer-events-none">
          Click = select · Ctrl+Click = toggle · Ctrl+Shift+Click = flood
        </div>
      )}
    </div>
  );
}
