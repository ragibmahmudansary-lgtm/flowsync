# Aircraft CFD Design and Simulation Platform — Consolidated Requirements

**Source:** Messages from Ragib Ansary, July 31, 2026  
**Purpose:** Organize the original Bengali–English messages into a clear English-language project specification. This document preserves the proposed features and the sender's stated implementation priorities.

## 1. Project Objective

Develop an interactive, aircraft-focused computational fluid dynamics (CFD) platform that supports:

- Parametric construction and assembly of aircraft geometry (wings, fuselage, and tail configurations).
- Accurate identification and manual selection of aircraft surfaces and individual mesh faces, with selection behavior inspired by ANSYS.
- Definition and visualization of the surrounding fluid domain and its boundary conditions.
- CFD mesh generation, solver integration, and aerodynamic analysis.
- Clear, separate visualizations of aerodynamic coefficients, stability-related quantities, flow fields, and simulation results.

**Primary priority:** Validate geometry identification, face selection, boundary definition, and the underlying aerodynamic/CFD workflow **before** investing substantial effort in UI polish.

## 2. Reference Material and Initial Investigation

**CFD simulation reference:** https://youtu.be/BaERGrs9m1s?si=HKJc7PRd9cGq5TCk

Study the referenced demonstration, focusing on:

1. How ANSYS-style face and surface selection works.
2. The sequence of operations in the CFD setup and simulation workflow.
3. How geometry, mesh faces, fluid-domain boundaries, and boundary conditions are identified and assigned.
4. Which inputs and equations are necessary for calculating the lift coefficient (C_L), drag coefficient (C_D), pitching moment coefficient (C_M), maximum lift coefficient (C_L,max), and static stability measures.

## 3. Geometry Identification and Face Selection — Highest Priority

Before building the full user interface or solver results pages, verify that the system can reliably identify and locate **all relevant geometry components and surfaces**, including:

- Wings and their faces.
- Fuselage and its faces.
- Tail surfaces and tail assemblies.
- Individual selectable mesh faces and groups of connected faces.

Allow users to **manually select and label** the corresponding aircraft components and face sets, rather than depending entirely on automatic classification.

### 3.1 High-Performance Selection Engine

- Use `three-mesh-bvh` for accelerated mesh raycasting and spatial queries.
- Attach a bounding-volume hierarchy to generated geometry using `computeBoundsTree()`.
- Support **Ctrl + Click** to select an individual triangle/mesh face using the raycaster's `faceIndex`.
- Support **Ctrl + Shift + Click** to select neighboring faces through a breadth-first-search (BFS) flood fill.
- For flood-fill selection, include adjacent faces whose dihedral angle is **30° or less**.
- Highlight selected faces in **ANSYS-style orange (`#FF6600`)** by directly updating the vertex-color `BufferAttribute`, without rebuilding the entire mesh.

### 3.2 Selection and Assignment Workflow

Users should be able to:

1. Locate a wing, tail, fuselage region, or individual mesh face in the 3D view.
2. Select faces individually or as connected groups.
3. Assign or edit the identity of selected surfaces/components manually.
4. Assign applicable boundary tags to selected face sets.
5. Inspect the selections and their properties before exporting or running a simulation.

## 4. Parametric Aircraft Geometry

### 4.1 Wing Generator

- Implement the **NACA 4-digit airfoil** equations for 2D airfoil geometry.
- Loft airfoil sections along the wing span.
- Support parametric adjustments to:
  - Geometric twist.
  - Dihedral angle.
  - Sweep.
  - Taper ratio.
- Apply the appropriate geometric transformations when generating the wing mesh.

### 4.2 Fuselage Generator

- Create the fuselage by sweeping superellipse cross-sections longitudinally.
- Use the cross-section equation:

  \[
  \left|\frac{x}{a}\right|^n + \left|\frac{y}{b}\right|^n = 1
  \]

- Support shape variation through the exponent `n`, including `n = 2` for elliptical/circular sections and `n < 2` for alternative chined or stealth-oriented profiles, as proposed in the original specification.

### 4.3 Empennage (Tail) Assembly

Implement a modular assembly system using wing-like components attached to the fuselage. Support:

- Conventional tail.
- T-tail.
- V-tail.
- H-tail.
- Inverted-U tail.

Each configuration should remain identifiable and selectable within the 3D model.

## 5. Fluid Domain and Boundary Conditions

### 5.1 Fluid-Domain Creation

- Compute an aircraft reference length, `L_ref`.
- Automatically generate an enclosure surrounding the aircraft.
- Use the proposed initial extents:
  - **Upstream:** `3 × L_ref`.
  - **Downstream:** `6 × L_ref`.
- Ensure that the domain's surrounding surfaces can be located, inspected, and labeled individually.

### 5.2 Boundary Definition and Visualization

The user should be able to identify the role of **every relevant fluid-domain face**, understand where the inlet and outlet are, and see how pressure and wall conditions are assigned throughout the domain.

Allow manual selection and assignment of the following boundary-condition types:

| Boundary tag | Intended role |
|---|---|
| `VELOCITY_INLET` | Inlet boundary with prescribed flow velocity. |
| `PRESSURE_OUTLET` | Outlet boundary with a defined pressure condition. |
| `WALL_NOSLIP` | No-slip solid-wall boundary, such as aircraft surfaces. |
| `SYMMETRY` | Symmetry boundary where appropriate. |

- Maintain the selected face sets and boundary tags in application state.
- Export a structured **JSON boundary-condition manifest**.
- Make it possible to review the full fluid-domain setup before solver execution.

### 5.3 Watertight Geometry and Export

- Use constructive solid geometry (CSG) to unite intersecting wings, fuselage, and tail components.
- Use `three-bvh-csg` for the proposed mesh-union workflow.
- Produce a single watertight aircraft shell.
- Export the resulting geometry as **binary STL**.

## 6. Aerodynamic Equations and Analysis Requirements

Investigate and implement the equations, reference quantities, necessary inputs, and calculation procedures for:

| Quantity | Symbol | Required investigation / output |
|---|---|---|
| Lift coefficient | `C_L` | How lift is calculated and nondimensionalized using appropriate reference values. |
| Drag coefficient | `C_D` | How drag is calculated and nondimensionalized. |
| Pitching moment coefficient | `C_M` | How pitching moment is calculated and the required reference point and dimensions. |
| Maximum lift coefficient | `C_L,max` | How maximum lift is determined from appropriate simulation conditions/results. |
| Static stability | — | Which aerodynamic moments, coefficients, trends, and reference quantities are needed to assess stability. |
| Reynolds number | `Re` | Implement the required Reynolds-number calculation and associated simulation inputs. |

Study the relationship between these quantities and the CFD setup, especially the fluid-domain conditions and the forces/moments extracted from the solver.

## 7. Backend, Meshing, and Solver Integration

### 7.1 Backend API

- Build a backend service using **Node.js or Python**.
- Accept the exported aircraft **STL mesh** and **JSON boundary-condition manifest**.

### 7.2 Meshing and Solving

- Integrate meshing tools such as **Gmsh** or the OpenFOAM meshing workflow.
- Support an **OpenFOAM** pipeline using:
  - `snappyHexMesh` for mesh preparation.
  - `simpleFoam` for CFD solution.
  - The **k–ω SST turbulence model**.
- Incorporate Reynolds-number-related parameters into the solver setup.

### 7.3 Flow-Field Post-Processing

- Read solver outputs in **VTK or JSON** form.
- Display them in the Three.js visualization environment.
- Support:
  - Pressure contours, including the pressure coefficient `C_p`.
  - Velocity streamlines around the aircraft.

## 8. Frontend Framework and Application State — Later Priority

Once the geometry-selection and CFD setup workflows are reliable, implement a frontend using **React + Tailwind CSS** (or an equivalent modern framework).

### 8.1 Proposed Three-Pane Workspace

| Pane | Purpose |
|---|---|
| **Left — Model Tree** | Display aircraft parts, generated geometry, face groups, and assigned items. |
| **Center — 3D Viewport** | Display and interact with the Three.js aircraft model and fluid domain. |
| **Right — Properties Inspector** | Edit parameters and inspect settings for the current selection. |

### 8.2 Shared State Management

Use **Zustand or Redux** to manage:

- Geometry parameters.
- Selected mesh-face indices/sets.
- Boundary-condition tags.
- Solver settings.

Updates from user controls, such as sliders, should update the 3D geometry in real time.

### 8.3 Multiple Tabs / Distinct Workspaces

Avoid overcrowding the entire application into a single tab. Prefer separate tabs or workspaces for tasks such as geometry editing, face selection, boundary-condition setup, and simulation results.

## 9. Results and Graphs

Simulation outputs may require substantial screen space. Provide **separate result views or tabs** rather than placing everything within the primary modeling viewport.

Include dedicated presentations for:

- Lift coefficient (`C_L`).
- Drag coefficient (`C_D`).
- Pitching moment coefficient (`C_M`).
- Maximum lift coefficient (`C_L,max`).
- Static stability analysis.
- Aerodynamic coefficient relationships, including **`C_L` vs. `C_D`**.
- Pressure distribution/pressure-coefficient (`C_p`) contours.
- Velocity streamlines and other flow-field visualizations.

## 10. Intended Implementation Order

The final message explicitly puts geometry and CFD correctness before UI development. The requirements can therefore be organized into the following sequence:

| Priority | Workstream | Expected focus |
|---|---|---|
| **1 — First** | Reference study and face identification | Examine ANSYS-style selection and the CFD workflow; correctly locate wings, tails, fuselage, and all relevant faces. |
| **2** | Selection and manual assignment | Implement individual/group face selection, visual highlighting, and manual component/boundary labeling. |
| **3** | Fluid domain and aerodynamic fundamentals | Define enclosure, inlet/outlet/walls/pressure conditions; study `C_L`, `C_D`, `C_M`, `C_L,max`, static stability, and Reynolds number. |
| **4** | Parametric modeling and mesh preparation | Implement aircraft generators, assemblies, watertight union, and STL/JSON export. |
| **5** | Solver pipeline | Integrate backend, meshing, CFD solver, and results extraction. |
| **6 — Later** | Full UI and results organization | Build state-driven multi-pane UI, multiple task-specific tabs, and dedicated aerodynamic graphs. |

---

**Priority reminder:** The immediate concern is whether the application correctly identifies and allows manual assignment of **every aircraft component, selected face, and fluid-domain boundary**. A polished UI and extensive result dashboards should come after that core workflow is established.
