export type TabId = "geometry" | "vlm" | "analysis" | "results";
export type SelectMode = "click" | "box";
export type DisplayMode = "shaded" | "wireframe" | "shadedEdges";
export type ComponentType = "wing" | "htail" | "vtail" | "fuselage" | "unassigned";
export type Vec3 = [number, number, number];

export interface BoundingBox {
  min: Vec3;
  max: Vec3;
}

export interface CadFace {
  id: string;
  name: string;
  format: string;
  position: Float32Array;
  normal: Float32Array;
  index: Uint32Array;
  area: number;
  centroid: Vec3;
  avgNormal: Vec3;
  bbox: BoundingBox;
  baseColor: string;
}

export interface ImportedModel {
  fileName: string;
  format: string;
  unit: string;
  faces: CadFace[];
  adjacency: Record<string, string[]>;
  bbox: BoundingBox;
  triangleCount: number;
  vertexCount: number;
  orientationNote?: string;
  importedAt: string;
}

export interface ModuleError {
  code: string;
  message: string;
  hint?: string;
}
