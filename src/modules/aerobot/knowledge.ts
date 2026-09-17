export interface GlossaryEntry {
  term: string;
  keywords: string[];
  def: string;
  where: string;
}

export interface PlaybookEntry {
  id: string;
  title: string;
  keywords: string[];
  steps: string[];
}

export interface TheoryEntry {
  id: string;
  title: string;
  keywords: string[];
  text: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: "CL (lift coefficient)",
    keywords: ["cl", "lift"],
    def: "CL = L / (q·S), q = ½ρV². Normalized lift.",
    where: "Results tab charts; report §5.1.",
  },
  {
    term: "CD (drag coefficient)",
    keywords: ["cd", "drag"],
    def: "CD = D / (q·S). In FlowSync CD = CDi + CD0.",
    where: "Drag breakdown chart.",
  },
  {
    term: "CDi (induced drag)",
    keywords: ["cdi", "induced"],
    def: "Drag from lift-generated wake vortices; computed near-field from wake downwash on bound vortices.",
    where: "Drag breakdown chart.",
  },
  {
    term: "CD0 (viscous drag)",
    keywords: ["cd0", "viscous", "parasitic"],
    def: "Skin-friction + form drag estimate via von Kármán momentum-integral closure per spanwise strip.",
    where: "Drag breakdown chart; toggle in Tab 3.",
  },
  {
    term: "Cm (pitching moment coefficient)",
    keywords: ["cm", "moment"],
    def: "Cm = −M_y/(q·S·MAC) about the quarter-MAC, nose-up positive (X-forward axes).",
    where: "Cm charts; report §5.3.",
  },
  {
    term: "Cm_α (pitch stiffness)",
    keywords: ["cm alpha", "cm_α"],
    def: "dCm/dα about the CG. Negative = pitch-restoring = statically stable.",
    where: "Stability Box.",
  },
  {
    term: "CL_α (lift-curve slope)",
    keywords: ["cl alpha", "lift slope"],
    def: "dCL/dα from the sweep linear fit; compare to lifting-line ideal 2πAR/(AR+2) per radian.",
    where: "Stability Box; report interpretation.",
  },
  {
    term: "MAC (Mean Aerodynamic Chord)",
    keywords: ["mac"],
    def: "MAC = (2/S)∫c²dy; the chord that normalizes Cm and static margin.",
    where: "Recognition table; Stability Box.",
  },
  {
    term: "Aspect ratio (AR)",
    keywords: ["aspect", "ar"],
    def: "AR = b²/S. Higher AR → higher CL_α, lower CDi.",
    where: "Recognition table.",
  },
  {
    term: "Sweep (¼-chord convention)",
    keywords: ["sweep"],
    def: "Angle of the quarter-chord line from root to tip; convention documented per FS-04-013.",
    where: "Recognition table.",
  },
  {
    term: "Dihedral",
    keywords: ["dihedral"],
    def: "Spanwise upward tilt of the wing from area-weighted skin height vs y.",
    where: "Recognition table.",
  },
  {
    term: "Static margin",
    keywords: ["static margin", "sm"],
    def: "SM = (x_np − x_cg)/MAC (positive = stable). Classically measured aft-positive.",
    where: "Stability Box verdict reasons.",
  },
  {
    term: "Neutral point",
    keywords: ["neutral point", "np"],
    def: "CG location where dCm/dCL = 0; x_np = x_ref + (dCm/dCL)|ref · MAC.",
    where: "Stability Box; red NP marker in 3D.",
  },
  {
    term: "Center of gravity (CG)",
    keywords: ["cg", "center of gravity", "mass"],
    def: "Mass-weighted centroid from divergence-theorem component volumes × effective densities.",
    where: "Tab 3 Mass & CG box; green CG marker.",
  },
  {
    term: "Trim α",
    keywords: ["trim"],
    def: "AoA where Cm about CG = 0; must lie inside the tested sweep for a usable trim.",
    where: "Stability Box.",
  },
  {
    term: "Reynolds number",
    keywords: ["reynolds", "re"],
    def: "Re = ρVc/μ; per-strip local chord drives the CD0 closure.",
    where: "Tab 3; status bar.",
  },
  {
    term: "Span efficiency e",
    keywords: ["span efficiency", "e"],
    def: "e = CL²/(π·AR·CDi); 1.0 = elliptic loading.",
    where: "Results summary; report.",
  },
  {
    term: "VLM (Vortex Lattice Method)",
    keywords: ["vlm", "vortex lattice"],
    def: "Horseshoe vortices on a panel lattice; no-penetration BC; linear solve for circulation; inviscid, incompressible, steady.",
    where: "The solver (Tab 3 → Run).",
  },
  {
    term: "Horseshoe vortex",
    keywords: ["horseshoe", "bound vortex"],
    def: "Bound leg at panel ¼-chord + two semi-infinite trailing legs aligned with the local wake direction.",
    where: "Solver internals; lattice overlay.",
  },
  {
    term: "Control point",
    keywords: ["control point"],
    def: "Collocation point at panel ¾-chord where no-penetration is enforced.",
    where: "Solver internals.",
  },
  {
    term: "AIC matrix",
    keywords: ["aic", "influence"],
    def: "Aerodynamic influence coefficients: induced velocity per unit circulation at every control point; solved by Gaussian elimination with pivoting.",
    where: "Solver internals.",
  },
  {
    term: "Kutta condition",
    keywords: ["kutta"],
    def: "Flow leaves the trailing edge smoothly; realized by trailing wake vortices shed from the TE.",
    where: "Solver internals.",
  },
  {
    term: "Wake relaxation",
    keywords: ["wake", "relax"],
    def: "Trailing vortices re-aligned with local induced velocity (vorticity-transport equation, inviscid limit); improves CDi for swept/dihedralled wings.",
    where: "Tab 3 toggle; theory card.",
  },
  {
    term: "Circulation Γ",
    keywords: ["circulation", "gamma"],
    def: "Vortex strength per panel; spanwise Γ is the lift distribution.",
    where: "Spanwise charts; color map.",
  },
  {
    term: "Trefftz plane",
    keywords: ["trefftz"],
    def: "Far-downstream plane where wake cross-flow kinetic energy equals induced drag; cross-check concept for the near-field CDi.",
    where: "Theory only in Beta.",
  },
  {
    term: "Boundary layer",
    keywords: ["boundary layer"],
    def: "Thin viscous layer near surfaces; its momentum deficit is what the momentum-integral CD0 closure models.",
    where: "Theory; CD0.",
  },
  {
    term: "von Kármán momentum integral",
    keywords: ["von karman", "momentum integral"],
    def: "dθ/dx + (2θ+δ*)(1/U)dU/dx = Cf/2 — the transport equation reduced across the boundary layer; Beta closure uses Schlichting Cf × form factor × wetted ratio.",
    where: "Theory card; viscousDrag module.",
  },
  {
    term: "General Transport Equation",
    keywords: ["transport equation", "gte"],
    def: "∫∂(ρφ)/∂t dV + ∮ρφv·dA = ∮Γ_φ∇φ·dA + ∫S_φ dV — the FVM/CFD master equation. FlowSync Beta implements its reduced forms: steady (∂/∂t=0), convection = wake relaxation, diffusion = BL closure, sources = BCs.",
    where: "Theory card in Tab 3.",
  },
  {
    term: "CFD / RANS / k-ω SST",
    keywords: ["cfd", "rans", "sst", "turbulence"],
    def: "CFD discretizes the transport equations on a volume mesh; RANS averages turbulence; k-ω SST is a two-equation closure. NOT in Beta (§8.9) — FlowSync complements, not replaces, CFD.",
    where: "Theory only; AeroBot can teach it.",
  },
  {
    term: "Stall / CL_max",
    keywords: ["stall", "cl max"],
    def: "Flow separation limit. VLM cannot predict it; Beta flags linear-range validity instead. CFD or polars needed.",
    where: "Report limitations.",
  },
  {
    term: "B-Rep / TopoDS face",
    keywords: ["brep", "topods", "step"],
    def: "Exact CAD surface representation; STEP/IGES faces keep true face identity in FlowSync.",
    where: "Import pipeline.",
  },
  {
    term: "STL",
    keywords: ["stl"],
    def: "Triangle soup without topology; FlowSync welds vertices and segments it into engineering auto-faces by dihedral BFS.",
    where: "Import pipeline.",
  },
  {
    term: "Segmentation (auto-faces)",
    keywords: ["segmentation", "autoface"],
    def: "Connected triangle regions separated by sharp dihedral angles (>28–45° adaptive); restores face-level selection on STL.",
    where: "Import worker.",
  },
  {
    term: "Orientation normalization",
    keywords: ["orientation", "flip", "rotate"],
    def: "Auto-maps any authored axes to X-fwd/Y-right/Z-up using bbox ranks + tail-fin nose heuristic; manual Flip/Rot override in Tab 1.",
    where: "Import summary; Geometry Inspector.",
  },
  {
    term: "Named Selection",
    keywords: ["named selection", "name"],
    def: "ANSYS-style user-named face groups (e.g., Wing_Upper) for tagging and later workflows.",
    where: "Left panel tree.",
  },
  {
    term: "Flood select",
    keywords: ["flood"],
    def: "Ctrl+Shift+Click: BFS over face adjacency limited to dihedral ≤ 30°.",
    where: "Viewport selection.",
  },
  {
    term: "Box select",
    keywords: ["box", "marquee"],
    def: "Drag a screen rectangle; faces with projected vertices inside are selected (Ctrl add, Alt remove).",
    where: "Selection Toolbar.",
  },
  {
    term: "Component select",
    keywords: ["component", "ancestor"],
    def: "Selects every face belonging to the recognized component of the current selection.",
    where: "Selection Toolbar ⇪.",
  },
  {
    term: "Gust / dynamic derivatives",
    keywords: ["gust", "dynamic", "cm_q", "cl_p"],
    def: "Unsteady effects and rate derivatives (Cm_q, Cl_p, Cn_r). Post-Beta with the unsteady/visualization phase (§8.9).",
    where: "Roadmap.",
  },
];

export const PLAYBOOK: PlaybookEntry[] = [
  {
    id: "first-analysis",
    title: "Run your first full analysis",
    keywords: ["start", "first", "guide", "tutorial", "how to use"],
    steps: [
      "1 Import CAD (Toolbar → Import CAD or Ctrl+K).",
      "2 Check orientation in the Import Summary (nose +X, span ±Y); fix with Flip/Rot in Tab 1 if needed.",
      "3 Tab 2 → Run Auto-Recognition; correct with box-select + Assign; Confirm & Lock.",
      "4 Tab 2 → set spanwise/chordwise panels (start 24×8).",
      "5 Tab 3 → set velocity/density/AoA sweep; Run VLM Analysis.",
      "6 Tab 3 → Compute CG (Mass & CG box) so stability can be evaluated.",
      "7 Tab 4 → read curves + Stability Box; toggle color map/pathlines; Generate Report.",
    ],
  },
  {
    id: "name-faces",
    title: "Name a group of faces (Named Selection)",
    keywords: ["name", "named selection", "tag"],
    steps: [
      "1 Switch Selection Toolbar to ⬚ Box.",
      "2 Drag around the faces (Ctrl+drag adds, Alt+drag removes).",
      "3 Left panel → type a name (e.g., Wing_Upper) → Create Named Selection → Assign Selected Faces.",
    ],
  },
  {
    id: "fix-recognition",
    title: "Fix a wrong recognition",
    keywords: ["fix recognition", "wrong component"],
    steps: [
      "1 Select the misclassified faces (box or flood).",
      "2 Tab 2 → on the correct component card press Assign Sel.",
      "3 Press Clear on the wrong component if needed.",
      "4 Re-check the Wing Reference Geometry table, then Confirm & Lock.",
    ],
  },
  {
    id: "interpret-stability",
    title: "Interpret the stability verdict",
    keywords: ["stable", "unstable", "stability"],
    steps: [
      "1 Read the verdict badge in Tab 4 Stability Box.",
      "2 STABLE: Cm_α(CG) negative, NP aft of CG, trim inside sweep.",
      "3 UNSTABLE: move CG forward (lower %MAC) below the NP %MAC and re-read.",
      "4 Marginal (±2% MAC): expect sensitivity to loading/CG shifts.",
    ],
  },
  {
    id: "validate",
    title: "Validate the solver",
    keywords: ["validate", "validation", "trust"],
    steps: [
      "1 Ctrl+K → 'Run validation case (AR=6)'.",
      "2 Expect four PASS lines (CL_α vs lifting-line, e, CL(0), Cm).",
      "3 Any FAIL = stop and report; do not trust sweeps until green.",
    ],
  },
  {
    id: "panels",
    title: "Choose panel resolution",
    keywords: ["panels", "resolution", "convergence"],
    steps: [
      "1 Start 24 spanwise × 8 chordwise.",
      "2 Double spanwise; if CL changes < 1% you are converged.",
      "3 Use cosine spanwise clustering (built-in) for tip-sensitive wings.",
    ],
  },
  {
    id: "vlm-vs-cfd",
    title: "Know when VLM is enough",
    keywords: ["cfd", "when", "trust", "limits"],
    steps: [
      "1 VLM is valid: attached flow, subsonic, preliminary CL/CDi/Cm/stability.",
      "2 VLM is NOT valid: stall, compressibility, viscous drag detail, unsteady/gust.",
      "3 For those, export the report and run CFD (OpenFOAM/ANSYS) — FlowSync complements CFD.",
    ],
  },
  {
    id: "troubleshoot",
    title: "Troubleshoot import or blank UI",
    keywords: ["blank", "crash", "troubleshoot", "error"],
    steps: [
      "1 Read the on-screen boot diagnostic or ErrorBoundary panel.",
      "2 Open the Analysis Console (status bar).",
      "3 Check Pipeline Health rows in Tab 2.",
      "4 Re-import; verify orientation note; run validation.",
    ],
  },
];

export const THEORY: TheoryEntry[] = [
  {
    id: "vlm-math",
    title: "VLM mathematics",
    keywords: ["vlm math", "aic", "equations"],
    text:
      "Each panel carries a horseshoe vortex (bound leg ¼-chord, trailing legs ∥ wake). No-penetration at ¾-chord control points: (V∞ + Σ Γ_j v_j)·n̂ = 0 → A·Γ = b. Forces by Kutta–Joukowski F = ρ Γ (V_local × l); Cm = −M_y/(q S MAC).",
  },
  {
    id: "wake-transport",
    title: "Wake relaxation = vorticity transport",
    keywords: ["wake", "transport", "relax"],
    text:
      "In inviscid flow Dω/Dt = (ω·∇)v: vorticity is advected with the local velocity. FlowSync's relaxation pass re-aligns trailing legs with V∞ + induced velocity — the reduced convection term of the General Transport Equation.",
  },
  {
    id: "stability-theory",
    title: "Longitudinal static stability",
    keywords: ["stability theory", "static margin"],
    text:
      "Cm(cg) = Cm0 + CL·(x_np − x_cg)/MAC (X-forward). Stable ⇔ dCm/dCL|cg < 0 ⇔ NP aft of CG ⇔ SM = (x_np − x_cg)/MAC > 0. Trim exists where Cm(cg)=0. Typical GA margin +5…+15% MAC.",
  },
  {
    id: "gte-mapping",
    title: "General Transport Equation mapping",
    keywords: ["transport equation", "gte", "cfd foundation"],
    text:
      "∫∂(ρφ)/∂t dV + ∮ρφv·dA = ∮Γ_φ∇φ·dA + ∫S_φ dV. CFD (FVM) discretizes it directly. FlowSync Beta: unsteady=0; convection=wake relaxation; diffusion=momentum-integral BL closure (CD0); sources=no-penetration+Kutta. Full FVM = future CFD module.",
  },
  {
    id: "cfd-basics",
    title: "CFD fundamentals (for teaching)",
    keywords: ["cfd", "rans", "mesh", "y+", "sst"],
    text:
      "CFD solves conservation of mass/momentum/energy on a volume mesh. RANS averages turbulence; closures like k-ω SST model Reynolds stresses; y+ guides first cell height; snappyHexMesh/simpleFoam are OpenFOAM tools. Costly but captures stall, separation, compressibility — everything VLM cannot.",
  },
  {
    id: "lifting-line",
    title: "Lifting-line reference",
    keywords: ["lifting line", "ideal"],
    text:
      "Elliptic ideal: CL_α = 2πAR/(AR+2) per radian; CDi = CL²/(π·AR·e). FlowSync validation compares the VLM sweep against these.",
  },
  {
    id: "conventions",
    title: "FlowSync conventions",
    keywords: ["convention", "axes", "sign"],
    text:
      "Body axes X forward (nose +X), Y right, Z up. Relative wind ŵ = (−cos α, 0, sin α). Cm nose-up positive. Sweep at ¼-chord. %MAC measured aft of MAC LE. SI units only.",
  },
];

export function searchCompendium(q: string) {
  const lower = q.toLowerCase();
  const score = (keys: string[], extra: string) =>
    keys.reduce((s, k) => (lower.includes(k) ? s + 2 : 0), 0) +
    (lower.includes(extra.toLowerCase()) ? 1 : 0);
  return {
    glossary: GLOSSARY.filter((g) => score(g.keywords, g.term) > 0).slice(0, 3),
    playbook: PLAYBOOK.filter((p) => score(p.keywords, p.title) > 0).slice(0, 2),
    theory: THEORY.filter((t) => score(t.keywords, t.title) > 0).slice(0, 2),
  };
}
