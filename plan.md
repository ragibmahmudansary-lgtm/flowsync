Based on your request, I will now provide an elaborated methodology for each module as described in the FlowSync planning document, with the explicit understanding that **Aircraft Recognition will be performed manually by the user** rather than automatically. I will extract and synthesize the methodology directly from the planning file, cross-referencing where appropriate.

---

# FlowSync v1.0Beta: Elaborated Module Methodologies

---

## Module 1: Project Management (FS-01)

### Purpose
Provide project creation, saving, loading, and configuration persistence. This is the entry point for all user workflows.

### Methodology

**1. Project Lifecycle Management**
- **New Project (FS-01-001):** Create a new `.flowsync` project directory with a standardized folder structure:
  ```
  ProjectName.flowsync/
  ├── models/          # Imported CAD files
  ├── geometry/        # Processed geometry data
  ├── analyses/        # VLM analysis results
  ├── reports/        # Generated PDF reports
  ├── settings.json    # Project configuration
  └── project.lock     # Prevents concurrent access
  ```
- **Open Project (FS-01-002):** Deserialize `settings.json`, validate directory integrity, and restore the last session state.
- **Save Project (FS-01-003 / FS-01-004):** Serialize all module states into the project directory. Save As creates a copy with a new UUID.
- **Project Settings (FS-01-005):** Store user preferences including:
  - Unit system (SI vs. Imperial)
  - Default panel resolution settings
  - Visualization theme
  - Solver convergence tolerances
- **Recent Projects (FS-01-006):** Maintain a MRU (Most Recently Used) list in the application registry.
- **Auto Save (FS-01-007):** Periodic background serialization of unsaved changes.

**2. Data Persistence Model**
- All project data is stored in a **structured JSON format** for human readability and version control compatibility.
- Binary data (meshes, large matrices) is stored in separate files with JSON metadata pointers.
- **Crash Recovery (FS-08-012):** Auto-save snapshots every 5 minutes. On restart, detect unclean shutdown and offer recovery.

**3. Session State Management**
- Track the current workflow stage (imported → processed → recognized → analyzed → reported).
- Prevent invalid state transitions (e.g., running analysis before geometry is loaded).

---

## Module 2: CAD Import System (FS-02)

### Purpose
Import aircraft geometry from supported file formats while preserving model integrity and providing validation feedback.

### Methodology

**1. Supported Format Handling**

| Format | Library | Methodology |
|--------|---------|-------------|
| **STEP** (AP203/AP214) | OpenCascade STEPCAFControl | Parse B-rep topology graph; extract faces, edges, shells; preserve color/layer metadata |
| **IGES** (5.3) | OpenCascade IGESCAFControl | Parse entity types 100-199 (curves), 500-599 (surfaces); map to OpenCascade topological shapes |
| **STL** (ASCII/Binary) | OpenCascade RWStl | Parse triangular mesh; convert to faceted B-rep (Poly_Triangulation); **no parametric surface data** |

**2. Import Validation Pipeline (FS-02-004)**
```
STEP/IGES/STL File
    ↓
Format Detection (magic bytes / file extension)
    ↓
Parser Invocation (OpenCascade reader)
    ↓
Topology Validation:
  - Check for null shapes
  - Check for empty compounds
  - Check for self-intersecting faces (BOPAlgo_Checker)
    ↓
Geometry Validation:
  - Bounding box non-zero
  - Face area > ε
  - Edge length > ε
    ↓
Unit Detection & Normalization:
  - Parse UNITS section (STEP) / Global Section (IGES)
  - Convert all lengths to meters (SI base unit)
    ↓
Import Summary Generation (FS-02-006)
```

**3. Error Reporting (FS-02-005)**
- **Graceful degradation:** If a file contains unsupported entities, import valid portions and log warnings.
- **Error categories:**
  - `CORRUPTED_FILE`: Cannot parse file structure
  - `UNSUPPORTED_ENTITIES`: Contains entities not handled by v1.0Beta
  - `EMPTY_GEOMETRY`: No valid topological shapes found
  - `SCALE_AMBIGUOUS`: Units cannot be determined (prompt user)
  - `NON_MANIFOLD`: Detected non-manifold edges (warning, not fatal)

**4. Import Summary**
- Display to user:
  - Number of faces, edges, vertices
  - Bounding box dimensions
  - Detected units
  - Warnings (e.g., "47 small faces detected, may be fasteners or rivets")

---

## Module 3: Geometry Engine (FS-03)

### Purpose
Convert imported CAD models into a structured, engineering-ready geometric representation. This is the bridge between CAD and aerodynamic analysis.

### Methodology

**1. Internal Workflow**
```
CAD Model (TopoDS_Shape from OpenCascade)
    ↓
Read Topology (TopExp_Explorer)
    ↓
Validate Geometry (BRepCheck_Analyzer)
    ↓
Extract Faces (iterate faces, assign Face_ID)
    ↓
Extract Edges (iterate edges, assign Edge_ID)
    ↓
Compute Surface Properties (per face):
  - Surface area (GProp_GProps)
  - Centroid (GProp_GProps)
  - Bounding box (BRepBndLib)
  - Surface normal at centroid (BRepLProp_SLProps)
  - Surface type classification (GeomAbs_Plane, Cylinder, Bspline, etc.)
    ↓
Compute Bounding Boxes (per component and global)
    ↓
Organize Geometry Tree (hierarchical data structure)
    ↓
Generate Engineering Model (structured output for downstream modules)
```

**2. Geometry Data Structure**
The internal representation is a **hierarchical tree**:

```
Aircraft
├── Wing
│   ├── Upper Surface (Face_001, Face_002, ...)
│   ├── Lower Surface (Face_010, Face_011, ...)
│   ├── Leading Edge (Face_020, ...)
│   └── Trailing Edge (Face_030, ...)
├── Horizontal Tail
│   ├── Upper Surface
│   ├── Lower Surface
│   └── ...
├── Vertical Tail
│   └── ...
├── Fuselage
│   ├── Nose
│   ├── Main Body
│   └── Tail Cone
└── Reference Data
    ├── Bounding Box
    ├── Global Origin
    └── Coordinate System
```

**3. Feature Specifications**

| Feature ID | Methodology |
|------------|-------------|
| **FS-03-001** Geometry Validation | BRepCheck_Analyzer for topology; BOPAlgo_Checker for self-intersection; flag open edges |
| **FS-03-002** Topology Extraction | TopExp_Explorer iteration: vertices → edges → wires → faces → shells → solids |
| **FS-03-003/004** Face/Edge ID | UUID assignment per entity; stored in map for O(1) lookup |
| **FS-03-005** Bounding Box | BRepBndLib::Add(shape, box); extract Xmin/Xmax, Ymin/Ymax, Zmin/Zmax |
| **FS-03-006** Surface Area | GProp_GProps + BRepGProp::SurfaceProperties(face, props) |
| **FS-03-007** Center of Surface | props.CentreOfMass() from GProp_GProps |
| **FS-03-008** Surface Normal | BRepLProp_SLProps at parametric midpoint (u,v) = (0.5, 0.5) |
| **FS-03-009** Reference Axis | Principal axes from bounding box; X = longitudinal (max dimension), Z = vertical, Y = spanwise |
| **FS-03-010** Geometry Tree | Custom tree data structure with parent-child relationships; displayed in Project Explorer |
| **FS-03-011** Duplicate Detection | Hash face centroids + areas; flag pairs with distance < ε and area ratio ≈ 1.0 |
| **FS-03-012** Small Face Detection | Flag faces with area < threshold (e.g., 0.001 × total model area) |
| **FS-03-013** Surface Coloring | Temporary OpenGL color assignment per component type (Wing=Blue, Tail=Green, Fuselage=Gray) |
| **FS-03-014** Geometry Statistics | Aggregate counts and properties; display in Properties Panel |
| **FS-03-015** Basic Repair | Remove duplicate faces (hash-based); heal small gaps (BRepBuilderAPI_Sewing with tolerance); fix tolerances (ShapeFix_Shape) |

**4. Outputs**
- **Structured Engineering Model** containing:
  - Face database (ID, geometry pointer, properties, normal, area, centroid)
  - Edge database (ID, geometry pointer, length, adjacent faces)
  - Surface properties (area, normal, bounding box per face)
  - Reference geometry (global bounding box, principal axes)
  - Geometry tree (hierarchical component structure)

---

## Module 4: Aircraft Recognition Engine (FS-04) — **MANUAL MODE**

### Purpose
**Revised for Manual Operation:** Allow the user to manually assign imported geometric faces to aircraft components (wing, horizontal tail, vertical tail, fuselage) and compute reference aerodynamic parameters.

### Methodology

**1. Manual Component Assignment Workflow**
```
Geometry Engine Output (Face Database + Geometry Tree)
    ↓
User Selection via 3D Viewport:
  - Click/Box-select faces
  - Right-click → "Assign to Component" → [Wing / Horizontal Tail / Vertical Tail / Fuselage]
    ↓
Component Grouping:
  - Store face-to-component mapping
  - Validate: faces in same component should be connected (adjacency check)
    ↓
Symmetry Detection (FS-04-006):
  - For Wing and Horizontal Tail: check for mirror symmetry about XZ plane
  - Pair faces by centroid reflection: distance(centroid, reflected_centroid) < ε
    ↓
Reference Geometry Calculation (FS-04-007 to FS-04-014)
    ↓
Generate Aircraft Model (structured input for VLM Solver)
```

**2. Manual Override Interface (FS-04-016)**
- **3D Selection Tools:** Click, box-select, lasso-select faces; Ctrl+click for multi-select
- **Context Menu:** Right-click selected faces → "Assign to Wing" / "Assign to Horizontal Tail" / etc.
- **Validation Feedback:** 
  - Green check: component has valid geometry (connected faces, non-zero area)
  - Yellow warning: component may have issues (disconnected faces, unusual aspect ratio)
  - Red error: component cannot be used for analysis (zero area, invalid topology)
- **Clear Assignment:** User can unassign faces or reassign to different components

**3. Reference Geometry Calculation (Post-Manual Assignment)**

Once faces are assigned to components, the following are computed automatically:

| Parameter | Methodology | Formula |
|-----------|-------------|---------|
| **Wing Span (FS-04-007)** | Max Y-extent of wing face centroids | b = max(Y) - min(Y) |
| **Semi-span** | b/2 | — |
| **Root Chord (FS-04-008)** | Chord length at Y = 0 (or min |Y| for asymmetric) | Intersection of wing surface with XZ plane at root |
| **Tip Chord (FS-04-009)** | Chord length at Y = b/2 | Intersection of wing surface with XZ plane at tip |
| **MAC (FS-04-010)** | Numerical integration of local chord² over span | c̄ = (2/S) ∫₀^(b/2) c(y)² dy |
| **MAC Position** | Y-coordinate where local chord = MAC | Iterative search along span |
| **Wing Area (FS-04-011)** | Sum of projected areas onto XZ plane | S = Σ(projected_face_area) |
| **Aspect Ratio (FS-04-012)** | b² / S | AR = b²/S |
| **Sweep Angle (FS-04-013)** | Angle of quarter-chord line | Λ_c/4 = arctan(ΔX / ΔY) at 25% chord |
| **Dihedral Angle (FS-04-014)** | Angle of wing surface relative to XY plane | Γ = arctan(ΔZ / ΔY) at quarter-chord |

**4. Component Naming (FS-04-015)**
- Auto-suggest names based on position: "Wing_Main", "HTail", "VTail", "Fuselage"
- User can rename

**5. Recognition Report (FS-04-017)**
- Components assigned and their status
- Reference dimensions table
- Geometry warnings (e.g., "Wing aspect ratio > 20 — verify this is correct")

**6. Known Limitations (v1.0Beta)**
- **No automatic detection** — all component assignment is manual
- Supports only conventional fixed-wing configurations
- Flying wings, BWB, canards, tandem wings, VTOL — out of scope

**7. Engineering Outputs**
Structured Aircraft Model:
```
Aircraft
├── Wing
│   ├── Surfaces: [Face_ID list]
│   ├── Span: b
│   ├── Area: S
│   ├── Root Chord: c_root
│   ├── Tip Chord: c_tip
│   ├── Sweep: Λ
│   ├── Dihedral: Γ
│   └── MAC: c̄
├── Horizontal Tail (same structure)
├── Vertical Tail (same structure)
├── Fuselage
│   ├── Surfaces: [Face_ID list]
│   └── Length, Max Diameter
└── Reference Data
    ├── S_ref (wing area)
    ├── b_ref (span)
    ├── c̄_ref (MAC)
    └── Coordinate System Origin
```

---

## Module 5: Vortex Lattice Method (VLM) Solver (FS-05)

### Purpose
The computational core. Transform the manually-defined aircraft geometry into a mathematical aerodynamic model and solve for steady, inviscid aerodynamic characteristics.

### Methodology

**1. Solver Workflow**
```
Aircraft Model (from Recognition)
    ↓
Reference Geometry (S_ref, b_ref, c̄_ref)
    ↓
Geometry Conversion (FS-05-001)
    ↓
Panel Generation (FS-05-002)
    ↓
Control Point Generation (FS-05-003)
    ↓
Bound Vortex Generation (FS-05-004)
    ↓
Trailing Wake Generation (FS-05-005)
    ↓
Influence Matrix Construction (FS-05-006)
    ↓
Boundary Condition Application (FS-05-007)
    ↓
Linear System Solution (FS-05-008)
    ↓
Circulation Distribution (FS-05-009)
    ↓
Force & Moment Calculation (FS-05-010 to FS-05-012)
    ↓
Results Processing
```

**2. Detailed Methodology by Feature**

**FS-05-001: Geometry Conversion**
- Convert recognized aircraft surfaces into **aerodynamic lifting surfaces**
- For each wing/tail component:
  - Extract camber line from upper and lower surface geometry
  - Define mean camber surface (midpoint between upper and lower)
  - Discretize mean camber surface into panels

**FS-05-002: Panel Generation**
- **Horseshoe vortex lattice** discretization:
  - **Spanwise direction:** Divide semi-span into N_s panels (user-adjustable, default ~20)
  - **Chordwise direction:** Divide chord into N_c panels (user-adjustable, default ~10)
  - Total panels per wing = N_s × N_c
  - Panel corners defined on the mean camber surface
- **Cosine clustering** (optional): Concentrate panels near leading edge and wing tip for better resolution of high-gradient regions

**FS-05-003: Control Point Generation**
- **3/4-chord rule:** Control point (collocation point) located at:
  - Chordwise: 3/4 of panel chord from leading edge
  - Spanwise: Panel mid-span
  - Normal direction: On the mean camber surface

**FS-05-004: Bound Vortex Generation**
- **Horseshoe vortex per panel:**
  - Bound segment: Along the panel quarter-chord line (from 1/4c_left to 1/4c_right)
  - Trailing legs: Extend to infinity downstream (or to a far-field boundary)
  - Vortex strength: Γ_i (unknown, to be solved)

**FS-05-005: Trailing Wake Generation**
- **Fixed, straight wake aligned with freestream** (v1.0Beta simplification)
- Wake vortex lines extend from trailing edge of each panel chordwise line
- Direction: Parallel to freestream velocity vector V∞
- Length: Effectively infinite (or truncated at 20× MAC for numerical purposes)

**FS-05-006: Influence Matrix Construction (AIC Matrix)**
- **Biot-Savart Law:** Compute velocity induced at control point j by horseshoe vortex i
- For each panel pair (i, j):
  - Compute induced velocity vector **v**_ij due to unit circulation (Γ_i = 1) on panel i at control point j
  - Take normal component: a_ij = **v**_ij · **n**_j (dot product with panel j's normal)
- Assemble **AIC matrix A** where A[j][i] = a_ij
- Matrix size: N × N where N = total number of panels across all lifting surfaces

**FS-05-007: Boundary Condition Application**
- **No-penetration condition:** Total normal velocity at each control point = 0
- Total normal velocity = freestream normal + induced normal from all vortices
- For panel j:
  ```
  V∞ · n_j + Σ_i (Γ_i × a_ij) = 0
  ```
- Rearrange to linear system:
  ```
  A · Γ = -V∞ · n
  ```
  where:
  - A = N×N influence coefficient matrix
  - Γ = N×1 circulation vector (unknown)
  - RHS = N×1 freestream normal component vector

**FS-05-008: Linear Solver**
- Solve **A · Γ = RHS** for circulation distribution Γ
- **Numerical methods:**
  - Direct solver: LU decomposition (Eigen::PartialPivLU) for N < 1000
  - Iterative solver: GMRES or BiCGSTAB (Eigen::BiCGSTAB) for larger systems
- **Singularity detection:**
  - Check condition number of A (κ(A) > 1e12 → ill-conditioned)
  - If singular or near-singular: report error, suggest reducing panel count or checking geometry
  - Handle via regularization: A + εI if needed

**FS-05-009: Circulation Distribution**
- Output Γ_i for each panel
- Compute spanwise circulation distribution by summing chordwise panels at each spanwise station
- Normalize: γ(y) = Γ(y) / (V∞ × c(y))

**FS-05-010: Lift Calculation**
- **Kutta-Joukowski theorem:** dL = ρ × V∞ × Γ × dy (per spanwise strip)
- Total lift: L = ρ × V∞ × Σ_i (Γ_i × Δy_i)
- Lift coefficient: CL = L / (0.5 × ρ × V∞² × S_ref)

**FS-05-011: Induced Drag Calculation**
- **Drag due to lift (induced drag only):**
  - Method 1: Trefftz plane analysis (far-field wake survey)
  - Method 2: Integration of local induced velocity × circulation
- Induced drag coefficient: CDi = Di / (0.5 × ρ × V∞² × S_ref)
- **CRITICAL LIMITATION (v1.0Beta):** Only induced drag is computed. Viscous/profile drag is excluded. This must be clearly labeled in all outputs.

**FS-05-012: Moment Calculation**
- Pitching moment about reference point (typically 1/4 MAC):
  - M = Σ_i (r_i × dL_i) where r_i is position vector from reference point to panel
- Pitching moment coefficient: CM = M / (0.5 × ρ × V∞² × S_ref × c̄_ref)

**FS-05-013: Angle of Attack Sweep**
- User defines: start α, end α, increment Δα
- For each α in range:
  - Recompute RHS with new freestream direction
  - Solve linear system
  - Store CL(α), CDi(α), CM(α)
- Typical range: -4° to +12° in 1° increments (linear regime only)

**FS-05-014: Freestream Definition**
- User inputs:
  - Velocity V∞ (m/s)
  - Air density ρ (kg/m³) — default 1.225 (sea level ISA)
  - Angle of attack α (degrees)
- Optional future: sideslip angle β (excluded from v1.0Beta)

**FS-05-015: Solver Progress**
- Display real-time progress:
  - "Generating panels... (45/200)"
  - "Assembling influence matrix..."
  - "Solving linear system..."
  - "Post-processing results..."

**FS-05-016: Error Handling**
- Detect and report:
  - Invalid geometry (zero-area panels, collapsed edges)
  - Singular/near-singular matrix (ill-conditioned geometry)
  - Unsupported configurations (out-of-scope aircraft types)
  - Solver divergence (should not occur for linear VLM, but check for NaN/Inf)
  - Numerical instability (large condition number, oscillatory circulation)

**3. Solver Outputs**
- CL, CDi, CM for each angle of attack
- Lift distribution along span: L'(y)
- Circulation distribution: Γ(y)
- Panel-level data: Γ_i, control point coordinates, normal vectors
- Analysis summary: convergence status, matrix condition number, execution time

**4. Validation Plan**
- Compare against:
  1. **Analytical solutions:** Elliptic loading → CL = π×AR×α (for high AR wings)
  2. **AVL:** Same geometry, same panel density, compare CL-α slope
  3. **OpenVSP VSPAERO:** Benchmark aircraft (e.g., NACA R-1208 wing)
  4. **Published data:** NACA reports, textbook cases (Bertin-Smith wing)
- **Acceptance tolerance:** CL within 5% of reference; CDi trend correct (quadratic with CL²)

**5. Known Limitations (v1.0Beta)**
- No compressibility effects (M < 0.3 assumed)
- No viscous drag (CDi only, not CD_total)
- No unsteady aerodynamics
- No control surface deflections
- Straight, fixed wake (no wake roll-up modeling)
- Ground effect excluded
- Valid only for attached flow, low angles of attack

---

## Module 6: Visualization Engine & User Interface (FS-06)

### Purpose
Provide the graphical interface for user interaction, 3D geometry inspection, analysis setup, and results visualization.

### Methodology

**1. High-Level Interface Layout**
```
+--------------------------------------------------------------+
| Menu Bar (File, Edit, View, Analysis, Help)                  |
+--------------------------------------------------------------+
| Toolbar (New, Open, Save, Import, Run, Report, Reset View) |
+--------------------------------------------------------------+
| Project Tree |     3D Viewport (OpenGL/VTK)     | Properties |
|              |                                  |            |
|              |                                  |            |
|              |                                  |            |
+--------------------------------------------------------------+
| Analysis Console / Status Bar                                |
+--------------------------------------------------------------+
```

**2. Main Interface Components**

| Feature ID | Methodology |
|------------|-------------|
| **FS-06-001** Main Window | Qt QMainWindow with dockable panels (QDockWidget); central widget = 3D viewport |
| **FS-06-002** Project Explorer | QTreeWidget showing hierarchical project structure; drag-drop reordering; context menus |
| **FS-06-003** 3D Viewport | OpenGL widget (QOpenGLWidget) or VTK QVTKOpenGLNativeWidget; camera: perspective projection, configurable FOV |
| **FS-06-004** Selection Tools | Ray-picking for click selection; frustum selection for box-select; highlight selected faces in yellow/orange |
| **FS-06-005** Display Modes | Shaded (Phong lighting), Wireframe (GL_LINES), Shaded+Edges (hybrid) |
| **FS-06-006** Camera Controls | Orbit (left-drag), Pan (middle-drag), Zoom (scroll); preset views (Top, Front, Side, Isometric) via keyboard shortcuts |
| **FS-06-007** Geometry Info Panel | QTableWidget showing selected entity properties (name, area, bounding box, face count, edge count) |
| **FS-06-008** Results Visualization | Color-mapped surface rendering: map scalar values (lift, circulation) to vertex colors via transfer function; display color bar legend |
| **FS-06-009** Analysis Console | QTextEdit with color-coded logging (info=blue, warning=orange, error=red); timestamped messages |
| **FS-06-010** Status Bar | QStatusBar: cursor position (3D world coords), active tool, solver status, file dirty indicator |
| **FS-06-011** Toolbar | QToolBar with QActions for common operations; icons + tooltips |
| **FS-06-012** Context Menus | QMenu on right-click; context-sensitive (face selected → "Assign to Wing", "Show Properties", "Hide") |
| **FS-06-013** Theme | Light/Dark stylesheet (QSS); consistent palette across all widgets |
| **FS-06-014** Keyboard Shortcuts | Ctrl+N (New), Ctrl+O (Open), Ctrl+S (Save), Ctrl+Z (Undo), F5 (Run Analysis) |
| **FS-06-015** Error Dialogs | QMessageBox with detailed text; suggest corrective actions; "Don't show again" checkbox for non-critical warnings |

**3. 3D Rendering Pipeline**
```
Geometry Data (from FS-03)
    ↓
Mesh Triangulation (BRepMesh_IncrementalMesh for B-rep faces)
    ↓
OpenGL Vertex Buffer Objects (VBOs)
    ↓
Shader Program (Vertex + Fragment)
    ↓
Frame Buffer → Screen
```

- **Performance target:** 30+ FPS for models up to 100,000 triangles on target hardware
- **Level-of-Detail (LOD):** Simplified mesh for distant views (future enhancement)

**4. Results Visualization**
- **Lift distribution:** Render wing surface with color mapping (blue = low lift, red = high lift)
- **Circulation distribution:** Same approach, different scalar field
- **VLM panels:** Render panel boundaries as wireframe overlay on geometry
- **Wake visualization:** Render wake lines trailing from wing trailing edge

**5. Manual Recognition UI Flow**
```
User imports CAD → Geometry appears in 3D viewport
    ↓
User clicks "Recognition" tab
    ↓
UI shows component list: [Wing] [HTail] [VTail] [Fuselage]
    ↓
User selects "Wing" → UI prompts "Select wing faces"
    ↓
User clicks/box-selects faces in 3D viewport → faces highlight
    ↓
User clicks "Assign" → faces added to Wing component
    ↓
UI validates: checks connectivity, computes reference geometry
    ↓
Repeat for other components
    ↓
"Finalize Recognition" button → proceed to VLM setup
```

---

## Module 7: Report Generator (FS-07)

### Purpose
Convert aerodynamic analysis results into structured, professional engineering reports in PDF format.

### Methodology

**1. Report Generation Workflow**
```
VLM Results (JSON data)
    ↓
Data Structuring Layer (FS-07-001)
    ↓
Engineering Interpretation Layer (FS-07-006)
    ↓
Report Assembly Engine (FS-07-005)
    ↓
Figure Generation (FS-07-002, FS-07-003)
    ↓
PDF Export System (FS-07-004)
    ↓
Final Engineering Report (PDF)
```

**2. Report Structure (v1.0Beta)**

| Section | Content | Methodology |
|---------|---------|-------------|
| **1. Title Page** | FlowSync logo, project name, aircraft name, date, version | Qt QPainter or PDF library (QPdfWriter / libharu) |
| **2. Executive Summary** | Purpose, key results (CL, CDi, CM), configuration, AoA range, observations | Rule-based text generation from result data |
| **3. Aircraft Geometry Overview** | Span, area, AR, MAC, fuselage description, tail config, labeled diagrams | Embed 3D viewport screenshots; auto-label dimensions |
| **4. Analysis Setup** | V∞, ρ, α range, panel resolution, solver config | Tabular data from project settings |
| **5. Aerodynamic Results** | CL vs α, CDi vs α, CM vs α plots; linear region ID | Matplotlib/QCustomPlot → PNG → embed in PDF |
| **6. Spanwise Distributions** | Lift and circulation distribution plots; color-mapped visualization | Generate plots from panel-level data |
| **7. Engineering Interpretation** | Rule-based text: "Linear lift behavior observed...", "Induced drag increases quadratically..." | Template strings with conditional logic; **NO AI generation** |
| **8. Validation Notes** | Numerical stability, convergence status, benchmark comparison, warnings | Extract from solver logs |
| **9. Conclusion** | Performance summary, key observations, model limitations | Rule-based summary |
| **10. Appendix** | Raw data tables, additional plots, solver logs | Full numerical output |

**3. Feature Specifications**

| Feature ID | Methodology |
|------------|-------------|
| **FS-07-001** Data Collection | Parse VLM solver JSON output; organize into structured report data model |
| **FS-07-002** Plot Generation | Qt QCustomPlot or matplotlib (via Python embedding); generate CL-α, CDi-α, CM-α curves; spanwise distributions |
| **FS-07-003** Figure Export | Render plots to PNG at 300 DPI; consistent dimensions (e.g., 1200×800 px) |
| **FS-07-004** PDF Generation | QPdfWriter with QPainter for vector graphics; or libharu for direct PDF construction; page numbering, headers, embedded images |
| **FS-07-005** Template System | Fixed HTML/XML template with placeholders; fill in data at generation time |
| **FS-07-006** Engineering Summary | Rule-based engine: if CL_slope > 5.0 and R² > 0.99 → "Linear lift behavior"; if CM_α < 0 → "Stable pitching characteristics" |
| **FS-07-007** Data Tables | QTableWidget-style formatting; CSV export as secondary option |
| **FS-07-008** Report Versioning | Embed FlowSync version, analysis config hash (MD5 of input parameters), timestamp |

**4. Engineering Interpretation Rules (Examples)**
```
IF (CL vs α correlation coefficient > 0.99) AND (max α < 10°):
    TEXT = "The aircraft exhibits linear lift behavior within the tested AoA range."
    
IF (CDi vs CL² correlation coefficient > 0.98):
    TEXT = "The induced drag increases quadratically with lift coefficient, consistent with potential flow theory."
    
IF (CM at α=0° < 0) AND (dCM/dα < 0):
    TEXT = "The aircraft shows stable pitching characteristics within the analyzed range."
    
IF (solver_condition_number > 1e12):
    WARNING = "Numerical stability warning: Matrix condition number is high. Results may be sensitive to panel density."
```

**5. Performance Requirements**
- Report generation must complete within 5 seconds of solver completion
- Figures pre-generated during solver post-processing to avoid rendering delays
- Background thread for PDF generation to prevent UI freezing

---

## Module 8: Infrastructure & Build System (FS-08)

### Purpose
Provide the technical foundation for development, compilation, testing, and deployment.

### Methodology

**1. System Stack**
| Layer | Technology | Version |
|-------|-----------|---------|
| Language | C++ (core), Python (tools) | C++17 minimum |
| UI Framework | Qt | 6.x |
| Graphics | OpenGL / VTK | OpenGL 3.3+ / VTK 9.x |
| CAD Kernel | OpenCascade | Stable release |
| Build System | CMake | 3.20+ |
| Version Control | Git + GitHub | — |
| CI/CD | GitHub Actions | — |
| OS Target | Windows 10/11 | — |

**2. Build Architecture**
```
Source Code
    ↓
CMake Configuration (CMakeLists.txt per module)
    ↓
Dependency Resolution (vcpkg / Conan / manual)
    ↓
Compilation (MSVC 2019+ / MinGW-w64)
    ↓
Linking (static + dynamic libs)
    ↓
Executable (FlowSync.exe)
    ↓
Packaging (NSIS / WiX installer)
    ↓
Release Build / Installer (.msi or .exe)
```

**3. Project Structure**
```
FlowSync/
├── src/                    # Source files
│   ├── core/              # Shared utilities
│   ├── modules/           # FS-01 through FS-07
│   │   ├── project/
│   │   ├── cad_import/
│   │   ├── geometry/
│   │   ├── recognition/
│   │   ├── vlm_solver/
│   │   ├── visualization/
│   │   └── report/
│   └── main.cpp
├── include/               # Public headers
├── tests/                 # Unit + integration tests
│   ├── unit/
│   └── integration/
├── docs/                  # Documentation
├── third_party/           # External dependencies
│   ├── opencascade/
│   ├── qt/
│   └── eigen/
├── scripts/               # Build scripts, packaging
└── build/                 # Out-of-source build
```

**4. Git Workflow (GitFlow)**
```
main        → stable releases (tagged: v1.0.0-beta)
  │
  ├── develop → integration branch
  │   │
  │   ├── feature/geometry-engine
  │   ├── feature/vlm-solver
  │   ├── feature/ui-viewer
  │   └── feature/cad-import
  │
  └── hotfix/critical-bug
```

**Rules:**
- No direct commits to `main`
- Pull requests mandatory for `develop` and `main`
- Code review required (minimum 1 reviewer)
- All merges must pass CI

**5. CI/CD Pipeline (GitHub Actions)**
```yaml
on: [push, pull_request]

jobs:
  build:
    runs-on: windows-latest
    steps:
      - checkout
      - setup-msvc
      - install-dependencies (vcpkg)
      - cmake-configure
      - cmake-build
      - run-unit-tests
      - run-integration-tests
      - static-analysis (optional)
      - upload-artifact
```

**6. Feature Specifications**

| Feature ID | Methodology |
|------------|-------------|
| **FS-08-001** CMake Build | Modular CMakeLists.txt per module; separate targets; Debug/Release configs |
| **FS-08-002** Dependency Management | vcpkg or Conan for Qt, OpenCascade, Eigen; version pinning in manifest |
| **FS-08-003** Project Structure | Standardized folder layout; enforced via code review |
| **FS-08-004** Git Workflow | GitFlow branching model; branch protection rules on GitHub |
| **FS-08-005** CI | GitHub Actions: build + test on every PR; status checks required |
| **FS-08-006** Testing | Google Test framework; unit tests per module; integration tests for full pipeline |
| **FS-08-007** Release Build | CMake Release config; strip debug symbols; static linking where possible |
| **FS-08-008** Logging | spdlog or custom logger; per-module log files; severity levels (DEBUG, INFO, WARN, ERROR) |
| **FS-08-009** Configuration | QSettings for UI preferences; JSON files for solver/project settings |
| **FS-08-010** Installer | NSIS or WiX; bundle Qt DLLs, OpenCascade libs, VC++ redistributable |
| **FS-08-011** Versioning | Semantic versioning (MAJOR.MINOR.PATCH); Git tags for releases |
| **FS-08-012** Crash Recovery | Auto-save project state every 5 min; detect crash on restart; offer recovery dialog |

**7. Testing Strategy**

| Test Type | Methodology | Coverage |
|-----------|-------------|----------|
| **Unit Tests** | Google Test; test individual functions/classes | Geometry ops, solver math, data structures |
| **Integration Tests** | Full pipeline: CAD → Geometry → Recognition → Solver → Report | End-to-end with benchmark aircraft |
| **Regression Tests** | Compare results against stored reference outputs | Solver outputs must match within tolerance |
| **Benchmark Tests** | Compare against AVL, OpenVSP for standard cases | CL slope, CDi trend, CM stability |

**8. Constraints (v1.0Beta)**
- Windows-only (no Linux/macOS)
- No cloud dependency
- No distributed computing
- No external runtime downloads during execution
- No runtime AI services

---

## Summary: Revised Data Flow (Manual Recognition)

```
User Input (CAD File: STEP/IGES/STL)
    ↓
FS-02: CAD Import (OpenCascade parsing + validation)
    ↓
FS-03: Geometry Engine (topology extraction, properties, tree)
    ↓
FS-04: MANUAL Aircraft Recognition
    ├── User selects faces in 3D viewport
    ├── Assigns faces to Wing / HTail / VTail / Fuselage
    ├── System validates connectivity
    └── System computes reference geometry (span, area, MAC, AR, sweep, dihedral)
    ↓
FS-05: VLM Solver
    ├── Panel generation (horseshoe vortices)
    ├── AIC matrix assembly (Biot-Savart)
    ├── Linear system solution
    └── Force/moment calculation (CL, CDi, CM)
    ↓
FS-06: Visualization Engine
    ├── 3D model rendering
    ├── Results color-mapping
    └── Analysis console
    ↓
FS-07: Report Generator
    ├── Data structuring
    ├── Plot generation
    ├── PDF assembly
    └── Engineering interpretation (rule-based)
    ↓
FS-08: Infrastructure (supports all stages)
    ├── Build system (CMake)
    ├── CI/CD (GitHub Actions)
    ├── Testing (Google Test)
    └── Logging + Configuration
```

---

This methodology is derived directly from the FlowSync planning document, with the Aircraft Recognition module revised to reflect **manual user assignment** rather than automatic detection. Each module's methodology is specified with sufficient detail for implementation, including algorithms, data structures, libraries, and validation criteria.