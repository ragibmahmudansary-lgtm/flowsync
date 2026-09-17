# FS-02 / FS-03 — CAD Pipeline

## Purpose

Import aircraft CAD geometry (STEP, IGES, BREP, STL), segment it into engineering faces, normalize orientation, build a face database with adjacency, and enable interactive selection.

## Pipeline

```
File → [Import Worker] → Parse → Segment → Orient → Face DB → Adjacency → UI
```

### Stages

1. **Parse**: Binary/ASCII STL parser (dependency-free) or OCCT WASM kernel (STEP/IGES/BREP)
2. **Segment**: Position-welded dihedral-angle BFS with adaptive thresholds [28°, 35°, 45°]. Hard cap 2000 regions.
3. **Orient**: BBox-rank axes → span/length/vertical assignment. Tail-fin nose heuristic. Manual override available.
4. **Face DB**: Per-face area, centroid, area-weighted normal, bounding box.
5. **Adjacency**: Welded-vertex graph filtered by ≤30° dihedral angle.

## Worker Contract

```typescript
// Input
{ type: "import", fileName: string, format: string, buffer: ArrayBuffer }

// Output (progressive)
{ type: "progress", stage: string, pct: number }
{ type: "result", model: ImportedModel }
{ type: "error", message: string }
```

## Inputs

| Format | Parser | Notes |
|--------|--------|-------|
| STL (binary) | `stlImporter.ts` | Unitless → assumed meters |
| STL (ASCII) | `stlImporter.ts` | Unitless → assumed meters |
| STEP | `occtImporter.ts` | OCCT WASM, Y-up → Z-up rotation |
| IGES | `occtImporter.ts` | OCCT WASM, Y-up → Z-up rotation |
| BREP | `occtImporter.ts` | OCCT native format |

## Outputs

- `ImportedModel` with faces, adjacency, bbox, metadata
- Face selection state (click / toggle / flood / box marquee)
- Named selections (user-defined face groups)

## Selection Modes

| Mode | Action | Modifier |
|------|--------|----------|
| Click | Select single face | — |
| Click | Toggle face | Ctrl |
| Click | Flood (connected) | Ctrl+Shift |
| Box | Marquee select | — |

## Limitations

- STL is unitless (assumed meters)
- Segmentation uses angle heuristic (may over/under-segment complex fillets)
- Orientation nose heuristic may fail on symmetric or unusual geometries
- OCCT WASM is ~5MB download (lazy-loaded only for STEP/IGES/BREP)

## Usage

```typescript
import { runCommand } from "@/commands/registry";
runCommand("cad.import"); // Opens file picker
```

## Manual Orientation Override

Available in the Geometry Inspector panel:
- **Rot Z 90°**: Rotate around Z axis
- **Flip X**: Mirror along X axis
- **Flip Z**: Mirror along Z axis
