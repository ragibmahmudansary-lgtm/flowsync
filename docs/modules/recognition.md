# FS-04 — Aircraft Recognition Engine

## Purpose

Automatically classify imported CAD faces into aircraft components (Wing, Horizontal Tail, Vertical Tail, Fuselage) using rule-based geometry heuristics. Compute reference geometry (span, chords, MAC, AR, sweep, dihedral) for lifting surfaces.

## Rule Table

| Condition | Classification |
|-----------|---------------|
| Horizontal + Outboard + Forward | **Wing** |
| Horizontal + Outboard + Aft | **Horizontal Tail** |
| Vertical + Aft + Elevated | **Vertical Tail** |
| Small area (< 1.5% total) | **Fuselage** (struts, gear, fairings) |
| Otherwise | **Fuselage** |

### Thresholds

- **Aft threshold**: `bbox.min[0] + 0.3 * xLen`
- **Elevated threshold**: `bbox.min[2] + 0.45 * zLen`
- **Outboard threshold (D-008)**: `max(0.06 * yLen, 1.25 * fuselageHalfWidth)`

### D-008: Fuselage-Width-Aware Outboard Threshold

**Problem (v1):** Fixed `0.18 * yLen` threshold could swallow small horizontal tails into the fuselage class on wide-span models.

**Solution (v2):** Compute fuselage half-width from centerline deck faces (horizontal normals near Y=0), then use `max(0.06 * yLen, 1.25 * fw)`. This ensures small tails at moderate span are not misclassified.

## Two-Path Classification

### Path A: Multi-Lump (Disconnected Solids)

1. Union-Find groups faces into connected lumps by welded vertices
2. Per-lump classification:
   - Compute horizontal/vertical area ratios
   - If `hArea > 50%` and spans outboard → Wing or Htail (by X centroid)
   - If `vArea > 50%` and `hArea < 25%` and aft+elevated → Vtail
   - Else → Fuselage
3. Multiple wing lumps: largest kept as Wing, others downgraded to Htail

### Path B: Single Fused Solid

Per-face heuristic classification (lower confidence). Warning issued.

## Spanwise Analyzer

Computes lifting surface properties from 48 spanwise bins:

- **Span**: Y extent
- **Area**: Sum of triangle areas (upper skin only to avoid double-counting)
- **Root/Tip Chord**: X extent at root/tip bins
- **MAC**: Mean aerodynamic chord via `∫c²dy / ∫c·dy`
- **MAC location**: Area-weighted centroid of chord distribution
- **Aspect Ratio**: `span² / area`
- **Sweep (¼-chord)**: `atan2(xq_root - xq_tip, dy)`
- **Dihedral**: `atan2(z_tip - z_root, dy)`
- **Symmetry**: `|areaLeft - areaRight| / totalArea < 5%` and `|yMin + yMax| < 5% * span`

## Outputs

```typescript
interface RecognitionResult {
  status: "proposed" | "confirmed";
  componentByFaceId: Record<string, ComponentType>;
  wing: LiftingSurfaceProps | null;
  htail: LiftingSurfaceProps | null;
  vtailArea: number;
  vtailHeight: number;
  fuselageLength: number;
  fuselageMaxWidth: number;
  warnings: string[];
  generatedAt: string;
}
```

## Manual Override Workflow

1. Select faces in viewport (click/box/flood)
2. In Recognition Inspector → "Assign Sel." to component
3. Or use Project Tree → click component name to select all faces of that component
4. Re-run recognition or confirm to lock

## Limitations

- **Conventional config only**: T-tail, canard, flying wing, biplane not supported
- **Single-wing assumption**: Multiple lifting bodies → largest = wing, others = htail
- **Symmetry required**: Asymmetric models may produce warnings
- **Fused solids**: Single-lump models use per-face heuristic (lower confidence)

## Validation

- Synthetic test: rectangular wing (span 6m, chord 1m) → AR=6, sweep=0°, dihedral=0°, symmetric=true
- Cessna 152 expectations: wing span ~10m, AR ~7, sweep ~0°, dihedral ~2°

## Usage

```typescript
import { runCommand } from "@/commands/registry";
runCommand("recognition.run"); // Auto-classify
runCommand("recognition.confirm"); // Lock result
runCommand("selection.component"); // Select all faces in same component
```
