import { parseSTL } from "./stlParser.js";
import {
  AXIS_OPTIONS,
  DEFAULT_AXIS_MAPPING,
  internalToScene,
  mapPositions,
  positionsToSceneFloat32,
  validateAxisMapping
} from "./axisMapping.js";
import { computeMeshProperties } from "./geometry.js";
import { aggregateMassProperties, createDefaultManifest, createPointMass, normalizeManifest, updateMeshComponentPositions } from "./massModel.js";
import { defaultReferenceFromBounds, simulatePitchResponse } from "./stability.js";
import { drawPlots } from "./graphs.js";
import {
  COMPONENT_NAMES,
  COMPONENT_TYPES,
  assignTriangles,
  buildRecognitionReport,
  buildTriangleAdjacency,
  createRecognitionModel,
  growSelection
} from "./recognition.js?v=0.2.1";
import { runVlmAnalysis, TIER0_MODEL_DESCRIPTION, UNCERTAINTY_LABEL } from "./vlmSolver.js?v=0.3.1";
import {
  createProjectSnapshot,
  loadAutosave,
  restoreAssignments,
  saveAutosave,
  validateProjectSnapshot
} from "./projectState.js";

const DEMO_STL = "./assets/airbus-a320-cfd-1.snapshot.7/samolot.stl";
const THREE_LOCAL = "../vendor/three/three.module.js";
const CONTROL_IDS = [
  "densityInput", "velocityInput", "alphaMinInput", "alphaMaxInput", "alphaStepInput", "flowYawInput",
  "refAreaInput", "refSpanInput", "refMacInput", "rootChordInput", "tipChordInput", "sweepInput",
  "dihedralInput", "incidenceInput", "rootLeadingXInput", "chordwiseRowsInput", "spanPanelsInput",
  "cd0Input", "cm0Input", "pitchDampingInput", "growAngleInput", "maxRegionFacesInput", "regionGrowInput"
];

const elements = Object.fromEntries([
  "viewer", "statusLine", "meshQualityBadge", "geometrySourceBadge", "referenceSourceBadge", "solverBadge",
  "resolutionBadge", "loadDemoButton", "stlFileInput", "exportProjectButton", "projectFileInput", "exportResultsButton",
  "addMassButton", "massTable", "meshWarnings", "massMetrics", "stabilityMetrics", "solverDiagnostics",
  "polarCanvas", "pitchCanvas", "unitScaleSelect", "axisLongitudinal", "axisLateral", "axisVertical",
  "selectedCount", "selectionModeButton", "regionGrowInput", "growAngleInput", "maxRegionFacesInput", "clearSelectionButton",
  "clearAssignmentsButton", "recognitionSummary", "densityInput", "velocityInput", "alphaMinInput",
  "alphaMaxInput", "alphaStepInput", "flowYawInput", "refAreaInput", "refSpanInput", "refMacInput",
  "rootChordInput", "tipChordInput", "sweepInput", "dihedralInput", "incidenceInput", "rootLeadingXInput",
  "aeroCenterInput", "neutralPointInput", "chordwiseRowsInput", "spanPanelsInput", "cd0Input", "cm0Input", "pitchDampingInput",
  "runVlmButton"
].map((id) => [id, document.querySelector(`#${id}`)]));
elements.massTableBody = document.querySelector("#massTable tbody");

const state = {
  THREE: null,
  rawStl: null,
  mappedPositions: null,
  meshProperties: null,
  manifest: null,
  recognition: null,
  recognitionReport: null,
  adjacency: null,
  sourceName: "",
  axisMapping: { ...DEFAULT_AXIS_MAPPING },
  unitScale: 1,
  referenceSource: "bounds",
  scene: null,
  camera: null,
  renderer: null,
  meshGroup: null,
  markerGroup: null,
  vlmGroup: null,
  mesh: null,
  orbit: null,
  selectionMode: false,
  lastMassProperties: null,
  lastVlm: null,
  lastPitchSamples: null,
  pendingProject: null,
  autosaveTimer: null
};

initAxisControls();
bindEvents();
bootstrap();

async function bootstrap() {
  try {
    state.THREE = await import(THREE_LOCAL);
    initViewer();
    const autosave = loadAutosave();
    await loadDemo(autosave?.source?.name === "samolot.stl" ? autosave : null);
  } catch (error) {
    setStatus(`Startup failed: ${error.message}`);
    console.error(error);
  }
}

function initAxisControls() {
  for (const select of [elements.axisLongitudinal, elements.axisLateral, elements.axisVertical]) {
    for (const option of AXIS_OPTIONS) {
      const node = document.createElement("option");
      node.value = option.value;
      node.textContent = option.label;
      select.append(node);
    }
  }
  setAxisControls(DEFAULT_AXIS_MAPPING, 1);
}

function bindEvents() {
  elements.loadDemoButton.addEventListener("click", () => loadDemo());
  elements.stlFileInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await loadStlBuffer(await file.arrayBuffer(), file.name, state.pendingProject);
      state.pendingProject = null;
    } catch (error) {
      setStatus(`Import failed: ${error.message}`);
    }
    event.target.value = "";
  });
  elements.projectFileInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await openProject(validateProjectSnapshot(JSON.parse(await file.text())));
    } catch (error) {
      setStatus(`Project open failed: ${error.message}`);
    }
    event.target.value = "";
  });
  elements.exportProjectButton.addEventListener("click", exportProject);
  elements.exportResultsButton.addEventListener("click", exportResults);
  elements.addMassButton.addEventListener("click", () => {
    if (!state.manifest) return;
    state.manifest.components.push(createPointMass(state.meshProperties, state.manifest.components.length));
    renderMassTable();
    invalidateVlm("Mass model changed");
    updateMassAnalysis();
  });

  for (const select of [elements.unitScaleSelect, elements.axisLongitudinal, elements.axisLateral, elements.axisVertical]) {
    select.addEventListener("change", () => remapCurrentGeometry(true));
  }

  elements.selectionModeButton.addEventListener("click", () => setSelectionMode(!state.selectionMode));
  elements.clearSelectionButton.addEventListener("click", () => {
    state.recognition?.selected.clear();
    updateMeshColors();
    renderRecognition();
    setStatus("Selection cleared");
  });
  elements.clearAssignmentsButton.addEventListener("click", () => {
    if (!state.recognition) return;
    state.recognition.assignments.fill(COMPONENT_TYPES.unassigned);
    state.recognition.selected.clear();
    refreshRecognitionReport(false);
  });
  for (const button of document.querySelectorAll("[data-assign]")) {
    button.addEventListener("click", () => assignSelected(button.dataset.assign));
  }
  elements.runVlmButton.addEventListener("click", runVlm);

  const solverInputs = CONTROL_IDS
    .map((id) => elements[id])
    .filter((input) => input && ![elements.pitchDampingInput, elements.growAngleInput, elements.regionGrowInput].includes(input));
  for (const input of solverInputs) {
    input.addEventListener("input", () => {
      invalidateVlm("Inputs changed");
      updateMassAnalysis();
      scheduleAutosave();
    });
  }
  elements.pitchDampingInput.addEventListener("input", () => {
    updateMassAnalysis();
    scheduleAutosave();
  });
  window.addEventListener("resize", () => {
    resizeViewer();
    updateGraphs();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setSelectionMode(false);
    if (event.key === "F5") {
      event.preventDefault();
      runVlm();
    }
    if (event.ctrlKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      exportProject();
    }
  });
}

async function loadDemo(project = null) {
  setStatus("Loading demo STL...");
  const response = await fetch(DEMO_STL);
  if (!response.ok) throw new Error(`Demo STL failed to load: ${response.status}`);
  await loadStlBuffer(await response.arrayBuffer(), "samolot.stl", project);
}

async function loadStlBuffer(buffer, sourceName, project = null) {
  const parsed = parseSTL(buffer);
  state.rawStl = parsed;
  state.sourceName = sourceName;
  if (project?.source) setAxisControls(project.source.axisMapping, project.source.unitScale);
  remapCurrentGeometry(false, false);
  if (project) restoreProjectState(project);
  else runVlm();
}

function remapCurrentGeometry(keepManifest, autoRun = true) {
  if (!state.rawStl) return;
  try {
    const nextMapping = readAxisMapping();
    const nextScale = numericValue(elements.unitScaleSelect, 1);
    validateAxisMapping(nextMapping);
    setStatus("Computing mesh properties...");
    if (keepManifest && state.manifest) {
      transformManifestPositions(state.manifest, state.axisMapping, state.unitScale, nextMapping, nextScale);
    }
    state.axisMapping = nextMapping;
    state.unitScale = nextScale;
    state.mappedPositions = mapPositions(state.rawStl.positions, nextMapping, nextScale);
    state.meshProperties = computeMeshProperties(state.mappedPositions, 1);
    state.manifest = keepManifest && state.manifest ? state.manifest : createDefaultManifest(state.meshProperties);
    updateMeshComponentPositions(state.manifest, state.meshProperties);
    if (!state.recognition || state.recognition.assignments.length !== state.rawStl.triangleCount) {
      state.recognition = createRecognitionModel(state.rawStl.triangleCount);
    }
    state.adjacency = null;
    state.recognitionReport = buildRecognitionReport(state.mappedPositions, state.recognition.assignments);
    if (state.recognitionReport.wing.valid) applyRecognizedReference(state.recognitionReport.wing);
    else setReferenceDefaults();
    renderMesh();
    renderMassTable();
    renderRecognition();
    invalidateVlm("Geometry changed");
    updateMassAnalysis();
    renderWarnings(state.lastMassProperties?.warnings || state.meshProperties.warnings);
    elements.geometrySourceBadge.textContent = `${formatInt(state.meshProperties.triangleCount)} triangles`;
    elements.geometrySourceBadge.className = "badge good";
    setStatus(`${state.sourceName}: ${formatInt(state.meshProperties.triangleCount)} triangles loaded`);
    if (autoRun) runVlm();
  } catch (error) {
    setStatus(`Geometry mapping failed: ${error.message}`);
  }
}

function setReferenceDefaults() {
  const bounds = state.meshProperties.bounds;
  const ref = defaultReferenceFromBounds(bounds);
  const taper = 0.35;
  const rootChord = 2 * ref.refAreaM2 / (ref.spanM * (1 + taper));
  state.referenceSource = "bounds";
  setReferenceInputs({
    areaM2: ref.refAreaM2,
    spanM: ref.spanM,
    macM: ref.macM,
    rootChordM: rootChord,
    tipChordM: rootChord * taper,
    sweepDeg: 25,
    dihedralDeg: 4,
    xLeadingRootM: bounds.min[0] + bounds.size[0] * 0.3,
    aeroCenterXM: ref.aeroCenterXM
  });
  elements.referenceSourceBadge.textContent = "Bounds seed - verify";
  elements.referenceSourceBadge.className = "badge warn";
}

function applyRecognizedReference(reference) {
  state.referenceSource = "recognized";
  setReferenceInputs(reference);
  elements.referenceSourceBadge.textContent = "Recognized wing";
  elements.referenceSourceBadge.className = "badge good";
}

function setReferenceInputs(reference) {
  elements.refAreaInput.value = formatInput(reference.areaM2 ?? reference.refAreaM2, 3);
  elements.refSpanInput.value = formatInput(reference.spanM, 3);
  elements.refMacInput.value = formatInput(reference.macM, 3);
  elements.rootChordInput.value = formatInput(reference.rootChordM, 3);
  elements.tipChordInput.value = formatInput(reference.tipChordM, 3);
  elements.sweepInput.value = formatInput(reference.sweepDeg, 2);
  elements.dihedralInput.value = formatInput(reference.dihedralDeg, 2);
  elements.rootLeadingXInput.value = formatInput(reference.xLeadingRootM, 3);
  elements.aeroCenterInput.value = formatInput(reference.aeroCenterXM, 3);
}

function updateMassAnalysis() {
  if (!state.meshProperties || !state.manifest) return;
  state.lastMassProperties = aggregateMassProperties(state.manifest, state.meshProperties);
  renderWarnings(state.lastMassProperties.warnings);
  renderMassMetrics(state.lastMassProperties);
  if (state.lastVlm) {
    const params = readAnalysisParams();
    const zero = nearestAlpha(state.lastVlm.series, 0);
    // SOL-03 (REM-1): no pitch simulation from a quarantined solution. M0-5 /
    // SOL-09: and none from an undetermined C_m slope — the ODE must never
    // treat a missing derivative as zero (the pitch graph's own model
    // quarantine is SOL-07 / M0a work, unchanged here).
    if (state.lastVlm.validity?.status !== "invalid" && Number.isFinite(state.lastVlm.cmAlphaPerRad)) {
      const stabilityForPitch = {
        ...state.lastVlm,
        dynamicPressure: 0.5 * params.densityKgM3 * params.velocityMS ** 2
      };
      state.lastPitchSamples = simulatePitchResponse({ ...params, cm0: zero.cm }, state.lastMassProperties, stabilityForPitch);
    } else {
      state.lastPitchSamples = null;
    }
    renderStabilityMetrics(state.lastVlm);
    updateGraphs(state.lastPitchSamples);
  }
  updateSceneAnnotations(readAnalysisParams(), state.lastMassProperties, state.lastVlm);
  scheduleAutosave();
}

function runVlm() {
  if (!state.meshProperties || !state.lastMassProperties) return;
  try {
    elements.solverBadge.textContent = "Running";
    elements.solverBadge.className = "badge warn";
    setStatus("Generating panels and solving influence matrices...");
    const params = readAnalysisParams(true);
    const surfaces = [readMainSurface(true)];
    const tail = state.recognitionReport?.htail;
    if (tail?.valid) surfaces.push({ ...tail, name: "Horizontal tail", incidenceDeg: 0 });
    const sweepInputs = {
      surfaces,
      spanwisePanels: params.spanwisePanels,
      chordwiseRows: params.chordwiseRows,
      alphaMinDeg: params.alphaMinDeg,
      alphaMaxDeg: params.alphaMaxDeg,
      alphaStepDeg: params.alphaStepDeg,
      betaDeg: params.flowYawDeg,
      velocityMS: params.velocityMS,
      densityKgM3: params.densityKgM3,
      refAreaM2: params.refAreaM2,
      refChordM: params.macM,
      referencePoint: state.lastMassProperties.cg,
      cd0: params.cd0,
      cm0: params.cm0,
      // VLM-V8 (M0-5, DR-36): bounds-seed reference values are a placeholder
      // and must carry a validity warning with a message.
      seedReferencePlaceholder: state.referenceSource === "bounds",
      // DATA_CONTRACTS 2.5 verdict rules (STAB-V2/STAB-V3): the verdict is
      // shown only with the full contract evidence. There is no mass
      // provenance concept in M0 — every manifest is the default
      // uniform-density lump — so condition 2 can NOT be satisfied yet and
      // the verdict is withheld with the unmet conditions named, as the
      // review demands ("withhold invalid stability verdicts").
      verdictInputs: {
        horizontalStabilizerPresent: Boolean(state.recognitionReport?.htail?.valid),
        massSource: "assumedUniform",
        modelDescription: TIER0_MODEL_DESCRIPTION
      }
    };
    // Budget the plotted sweep and its exact-flow VLM-V3 check as one Run.
    const sweep = runVlmAnalysis(sweepInputs);
    sweep.provenance = { inputs: sweepInputs, referenceSource: state.referenceSource, sourceName: state.sourceName || null, massSource: "assumedUniform" };
    const { resolutionCheck } = sweep;
    state.lastVlm = sweep;
    elements.neutralPointInput.value = formatInput(state.lastVlm.neutralPointXM, 3);
    elements.solverBadge.textContent = `VLM ${state.lastVlm.resolution.label} current`;
    elements.solverBadge.className = "badge good";
    elements.resolutionBadge.textContent = resolutionBadgeText(resolutionCheck, params);
    elements.resolutionBadge.className = `badge ${resolutionCheck.badge === "green" ? "good" : "warn"}`;
    renderVlmLattice(state.lastVlm);
    updateMassAnalysis();
    setStatus(`VLM solved ${state.lastVlm.series.length} cases with ${state.lastVlm.diagnostics.panelCount} panels (${state.lastVlm.resolution.label})`);
  } catch (error) {
    clearVlmResult("Solver error");
    updateSceneAnnotations(readAnalysisParams(), state.lastMassProperties, null);
    setStatus(`VLM failed: ${error.message}`);
    console.error(error);
  }
}

// SOL-02 (REM-1): the badge text names the flow and lattice actually checked.
// A check of a different yaw or of the prescribed R1/R2 grids is never shown as
// the convergence of the plotted custom lattice.
function resolutionBadgeText(check, params) {
  const flow = `b=${formatNumber(params.flowYawDeg, 1)}, a=0..4`;
  if (check.claim === "withheld") {
    return "Resolution convergence claim withheld (see diagnostics)";
  }
  const prescribed = check.claim === "prescribed R1 vs R2";
  const source = prescribed ? check : check.currentGrid;
  const lattice = prescribed ? "R1 vs R2" : "Custom vs 2x refined";
  return `${lattice} @ ${flow}: dCLa ${(source.deltaClAlpha * 100).toFixed(2)}%, dCDi ${(source.deltaCdi * 100).toFixed(2)}%`;
}

function readMainSurface(strict = false) {
  const number = strict ? requiredInput : numericValue;
  const positiveNumber = strict ? requiredPositiveInput : positiveInput;
  return {
    name: "Main wing",
    spanM: positiveNumber(elements.refSpanInput, 1),
    rootChordM: positiveNumber(elements.rootChordInput, 1),
    tipChordM: positiveNumber(elements.tipChordInput, 1),
    sweepDeg: number(elements.sweepInput, 0),
    dihedralDeg: number(elements.dihedralInput, 0),
    incidenceDeg: number(elements.incidenceInput, 0),
    xLeadingRootM: number(elements.rootLeadingXInput, 0),
    zRootM: state.recognitionReport?.wing?.valid ? state.recognitionReport.wing.zRootM : state.meshProperties.bounds.center[2]
  };
}

function readAnalysisParams(strict = false) {
  const number = strict ? requiredInput : numericValue;
  const positiveNumber = strict ? requiredPositiveInput : positiveInput;
  const spanInput = elements.spanPanelsInput;
  const spanwiseValue = strict && spanInput.value === "" && !spanInput.validity.badInput ? NaN : number(spanInput, NaN);
  if (strict && Number.isFinite(spanwiseValue) && (!Number.isInteger(spanwiseValue) || spanwiseValue < 4 || spanwiseValue > 240)) throw new Error("Spanwise panels must be an integer from 4 to 240, or blank for automatic sizing.");
  const rows = number(elements.chordwiseRowsInput, 4);
  if (strict && (!Number.isInteger(rows) || rows < 1 || rows > 16)) throw new Error("Chordwise rows must be an integer from 1 to 16.");
  const cd0 = number(elements.cd0Input, 0.025);
  const pitchDamping = number(elements.pitchDampingInput, 0.65);
  if (strict && (cd0 < 0 || pitchDamping < 0)) throw new Error("Profile drag and pitch damping must be nonnegative.");
  return {
    densityKgM3: positiveNumber(elements.densityInput, 1.225),
    velocityMS: positiveNumber(elements.velocityInput, 72),
    alphaMinDeg: number(elements.alphaMinInput, -6),
    alphaMaxDeg: number(elements.alphaMaxInput, 10),
    alphaStepDeg: positiveNumber(elements.alphaStepInput, 1),
    flowYawDeg: number(elements.flowYawInput, 0),
    refAreaM2: positiveNumber(elements.refAreaInput, 1),
    spanM: positiveNumber(elements.refSpanInput, 1),
    macM: positiveNumber(elements.refMacInput, 1),
    chordwiseRows: clamp(Math.round(rows), 1, 16),
    // Blank spanwise panels selects the prescribed per-surface count
    // (panel width/length ~ 1 at the mean chord, DATA_CONTRACTS §2.7).
    spanwisePanels: Number.isFinite(spanwiseValue) ? Math.max(4, Math.min(240, Math.round(spanwiseValue))) : "auto",
    cd0: Math.max(0, cd0),
    cm0: number(elements.cm0Input, 0),
    pitchDamping: Math.max(0, pitchDamping)
  };
}

function initViewer() {
  const THREE = state.THREE;
  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(0x0b1119);
  state.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100000);
  state.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  elements.viewer.append(state.renderer.domElement);
  const ambient = new THREE.HemisphereLight(0xffffff, 0x5d6b78, 1.4);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(20, 30, 40);
  state.scene.add(ambient, key);
  const grid = new THREE.GridHelper(80, 40, 0x9caab6, 0xc7d0d8);
  grid.position.y = -0.02;
  state.scene.add(grid, new THREE.AxesHelper(8));
  state.meshGroup = new THREE.Group();
  state.markerGroup = new THREE.Group();
  state.vlmGroup = new THREE.Group();
  state.scene.add(state.meshGroup, state.vlmGroup, state.markerGroup);
  state.orbit = createOrbitController();
  new ResizeObserver(() => resizeViewer()).observe(elements.viewer);
  new ResizeObserver(() => requestAnimationFrame(() => updateGraphs())).observe(elements.stabilityMetrics.closest(".results-panel"));
  resizeViewer();
  animate();
}

function createOrbitController() {
  const orbit = { target: new state.THREE.Vector3(), radius: 80, theta: -0.75, phi: 1.05, dragging: false, moved: false, lastX: 0, lastY: 0 };
  const canvas = state.renderer.domElement;
  canvas.addEventListener("pointerdown", (event) => {
    orbit.lastX = event.clientX;
    orbit.lastY = event.clientY;
    orbit.moved = false;
    if (state.selectionMode) return;
    orbit.dragging = true;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!orbit.dragging) return;
    const dx = event.clientX - orbit.lastX;
    const dy = event.clientY - orbit.lastY;
    if (Math.abs(dx) + Math.abs(dy) > 2) orbit.moved = true;
    orbit.theta -= dx * 0.006;
    orbit.phi = clamp(orbit.phi + dy * 0.006, 0.15, Math.PI - 0.15);
    orbit.lastX = event.clientX;
    orbit.lastY = event.clientY;
    updateCameraFromOrbit();
  });
  canvas.addEventListener("pointerup", (event) => {
    if (state.selectionMode) {
      pickTriangle(event);
      return;
    }
    orbit.dragging = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  });
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    orbit.radius = clamp(orbit.radius * (event.deltaY > 0 ? 1.09 : 0.92), 0.5, 200000);
    updateCameraFromOrbit();
  }, { passive: false });
  updateCameraFromOrbit();
  return orbit;
}

function renderMesh() {
  if (state.mesh) {
    state.mesh.geometry.dispose();
    state.mesh.material.dispose();
    state.meshGroup.remove(state.mesh);
  }
  const THREE = state.THREE;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positionsToSceneFloat32(state.mappedPositions), 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(state.mappedPositions.length), 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.06, side: THREE.DoubleSide });
  state.mesh = new THREE.Mesh(geometry, material);
  state.meshGroup.add(state.mesh);
  updateMeshColors();
  fitCameraToBounds(state.meshProperties.bounds);
}

function updateMeshColors() {
  if (!state.mesh || !state.recognition) return;
  const color = state.mesh.geometry.getAttribute("color");
  const palette = [
    [0.49, 0.58, 0.66], [0.12, 0.39, 0.77], [0.14, 0.53, 0.34], [0.86, 0.48, 0.08], [0.42, 0.46, 0.50]
  ];
  const selected = [1, 0.78, 0.08];
  for (let triangle = 0; triangle < state.recognition.assignments.length; triangle += 1) {
    const rgb = state.recognition.selected.has(triangle) ? selected : palette[state.recognition.assignments[triangle]];
    for (let vertex = 0; vertex < 3; vertex += 1) {
      const offset = triangle * 9 + vertex * 3;
      color.array[offset] = rgb[0];
      color.array[offset + 1] = rgb[1];
      color.array[offset + 2] = rgb[2];
    }
  }
  color.needsUpdate = true;
}

function pickTriangle(event) {
  if (!state.mesh || !state.recognition) return;
  const rect = state.renderer.domElement.getBoundingClientRect();
  const pointer = new state.THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  const raycaster = new state.THREE.Raycaster();
  raycaster.setFromCamera(pointer, state.camera);
  const hit = raycaster.intersectObject(state.mesh, false)[0];
  if (!hit || !Number.isInteger(hit.faceIndex)) return;
  let picked = new Set([hit.faceIndex]);
  if (elements.regionGrowInput.checked) {
    if (!state.adjacency) {
      setStatus("Building triangle adjacency for region selection...");
      state.adjacency = buildTriangleAdjacency(state.mappedPositions);
    }
    picked = growSelection(
      hit.faceIndex,
      state.mappedPositions,
      state.adjacency,
      numericValue(elements.growAngleInput, 18),
      numericValue(elements.maxRegionFacesInput, 15000)
    );
  }
  if (!event.ctrlKey && !event.metaKey) state.recognition.selected.clear();
  for (const triangle of picked) {
    if ((event.ctrlKey || event.metaKey) && state.recognition.selected.has(triangle)) state.recognition.selected.delete(triangle);
    else state.recognition.selected.add(triangle);
  }
  updateMeshColors();
  renderRecognition();
  const cap = numericValue(elements.maxRegionFacesInput, 15000);
  setStatus(`Selected ${formatInt(state.recognition.selected.size)} triangles${picked.size >= cap ? " (region cap reached)" : ""}`);
}

function assignSelected(componentName) {
  if (!state.recognition?.selected.size) return;
  assignTriangles(state.recognition, state.recognition.selected, COMPONENT_TYPES[componentName]);
  state.recognition.selected.clear();
  refreshRecognitionReport(true);
}

function refreshRecognitionReport(autoRun) {
  state.recognitionReport = buildRecognitionReport(state.mappedPositions, state.recognition.assignments);
  if (state.recognitionReport.wing.valid) applyRecognizedReference(state.recognitionReport.wing);
  else if (state.referenceSource === "recognized") setReferenceDefaults();
  updateMeshColors();
  renderRecognition();
  invalidateVlm("Surface assignments changed");
  updateMassAnalysis();
  if (autoRun && state.recognitionReport.wing.valid) runVlm();
}

function renderRecognition() {
  if (!state.recognition) return;
  elements.selectedCount.textContent = `${formatInt(state.recognition.selected.size)} selected`;
  const counts = new Uint32Array(COMPONENT_NAMES.length);
  for (const value of state.recognition.assignments) counts[value] += 1;
  const wing = state.recognitionReport?.wing;
  elements.recognitionSummary.innerHTML = [
    summaryRow("Wing", counts[COMPONENT_TYPES.wing], wing?.valid ? `${formatNumber(wing.spanM, 2)} m span, ${formatNumber(wing.areaM2, 2)} m2` : "not assigned"),
    summaryRow("H-tail", counts[COMPONENT_TYPES.htail], state.recognitionReport?.htail?.valid ? "included in VLM" : "not assigned"),
    summaryRow("V-tail", counts[COMPONENT_TYPES.vtail], "visual assignment only"),
    summaryRow("Fuselage", counts[COMPONENT_TYPES.fuselage], "mass/visual only")
  ].join("");
}

function setSelectionMode(enabled) {
  state.selectionMode = enabled;
  elements.selectionModeButton.setAttribute("aria-pressed", String(enabled));
  elements.selectionModeButton.textContent = enabled ? "Face selection on" : "Select faces";
  if (state.renderer) state.renderer.domElement.style.cursor = enabled ? "crosshair" : "grab";
}

function renderVlmLattice(result) {
  clearGroup(state.vlmGroup);
  const THREE = state.THREE;
  const alpha = (nearestAlpha(result.series, 0)?.alphaDeg || 0) * Math.PI / 180;
  const wake = [Math.cos(alpha), 0, Math.sin(alpha)];
  const wakeLength = Math.max(readAnalysisParams().macM * 2, 1);
  const values = [];
  for (const panel of result.panels) {
    addSceneSegment(values, panel.boundA, panel.boundB);
    addSceneSegment(values, panel.boundA, addVector(panel.boundA, scaleVector(wake, wakeLength)));
    addSceneSegment(values, panel.boundB, addVector(panel.boundB, scaleVector(wake, wakeLength)));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(values, 3));
  state.vlmGroup.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x087f8c, transparent: true, opacity: 0.7 })));
}

function updateSceneAnnotations(params, massProperties, vlm) {
  if (!state.markerGroup || !state.meshProperties) return;
  clearGroup(state.markerGroup);
  const THREE = state.THREE;
  const maxSize = Math.max(...state.meshProperties.bounds.size, 1);
  const cgScene = internalToScene(massProperties.cg);
  const cg = new THREE.Vector3(...cgScene);
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(maxSize * 0.018, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0xb23a48, emissive: 0x3b0710, emissiveIntensity: 0.2 })
  );
  marker.position.copy(cg);
  state.markerGroup.add(marker);
  const yaw = params.flowYawDeg * Math.PI / 180;
  const flowScene = internalToScene([Math.cos(yaw), Math.sin(yaw), 0]);
  const flowDirection = new THREE.Vector3(...flowScene).normalize();
  const center = new THREE.Vector3(...internalToScene(state.meshProperties.bounds.center));
  const flowOrigin = center.clone().addScaledVector(flowDirection, -maxSize * 0.62);
  state.markerGroup.add(new THREE.ArrowHelper(flowDirection, flowOrigin, maxSize * 0.45, 0x2764c4, maxSize * 0.08, maxSize * 0.04));
  if (!vlm?.series?.length) return;
  const zero = nearestAlpha(vlm.series, 0);
  state.markerGroup.add(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), cg, maxSize * 0.22 * Math.sign(zero.liftN || 1), 0x23704a, maxSize * 0.05, maxSize * 0.025));
  state.markerGroup.add(new THREE.ArrowHelper(flowDirection, cg, maxSize * 0.16, 0xad6a00, maxSize * 0.045, maxSize * 0.022));
}

function fitCameraToBounds(bounds) {
  const center = internalToScene(bounds.center);
  state.orbit.target = new state.THREE.Vector3(...center);
  state.orbit.radius = Math.max(...bounds.size, 1) * 1.45;
  state.orbit.theta = -0.75;
  state.orbit.phi = 1.05;
  updateCameraFromOrbit();
}

function updateCameraFromOrbit() {
  if (!state.camera || !state.orbit) return;
  const orbit = state.orbit;
  const sinPhi = Math.sin(orbit.phi);
  state.camera.position.set(
    orbit.target.x + orbit.radius * sinPhi * Math.cos(orbit.theta),
    orbit.target.y + orbit.radius * Math.cos(orbit.phi),
    orbit.target.z + orbit.radius * sinPhi * Math.sin(orbit.theta)
  );
  state.camera.lookAt(orbit.target);
  state.camera.near = Math.max(0.01, orbit.radius / 10000);
  state.camera.far = Math.max(1000, orbit.radius * 100);
  state.camera.updateProjectionMatrix();
}

function resizeViewer() {
  if (!state.renderer || !state.camera) return;
  const rect = elements.viewer.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  state.renderer.setSize(width, height, false);
  state.camera.aspect = width / height;
  state.camera.updateProjectionMatrix();
}

function animate() {
  if (!state.renderer) return;
  requestAnimationFrame(animate);
  state.renderer.render(state.scene, state.camera);
}

function renderMassTable() {
  elements.massTableBody.textContent = "";
  if (!state.manifest) return;
  state.manifest = normalizeManifest(state.manifest, state.meshProperties);
  updateMeshComponentPositions(state.manifest, state.meshProperties);
  state.manifest.components.forEach((component, index) => {
    const row = document.createElement("tr");
    row.append(
      inputCell(component.name, "text", (value) => { component.name = value; scheduleAutosave(); }),
      selectCell(component.type, ["mesh-volume", "point-mass", "component"], (value) => {
        component.type = value;
        renderMassTable();
        invalidateVlm("Mass model changed");
        updateMassAnalysis();
      }),
      inputCell(component.massKg, "number", (value) => { component.massKg = Number.parseFloat(value) || 0; invalidateVlm("Mass model changed"); updateMassAnalysis(); }, { step: "0.1" }),
      positionCell(component, 0), positionCell(component, 1), positionCell(component, 2), deleteCell(index)
    );
    elements.massTableBody.append(row);
  });
}

function inputCell(value, type, onInput, attrs = {}) {
  const cell = document.createElement("td");
  const input = document.createElement("input");
  input.type = type;
  input.value = value;
  for (const [key, attrValue] of Object.entries(attrs)) input.setAttribute(key, attrValue);
  input.addEventListener("input", () => onInput(input.value));
  cell.append(input);
  return cell;
}

function selectCell(value, options, onChange) {
  const cell = document.createElement("td");
  const select = document.createElement("select");
  for (const option of options) select.append(new Option(option, option));
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  cell.append(select);
  return cell;
}

function positionCell(component, axis) {
  const cell = document.createElement("td");
  const input = document.createElement("input");
  input.type = "number";
  input.step = "0.01";
  input.value = formatInput(component.positionM[axis], 3);
  input.disabled = component.type === "mesh-volume";
  input.addEventListener("input", () => {
    component.positionM[axis] = Number.parseFloat(input.value) || 0;
    invalidateVlm("CG changed");
    updateMassAnalysis();
  });
  cell.append(input);
  return cell;
}

function deleteCell(index) {
  const cell = document.createElement("td");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "delete-row";
  button.textContent = "X";
  button.setAttribute("aria-label", "Delete mass row");
  button.addEventListener("click", () => {
    state.manifest.components.splice(index, 1);
    renderMassTable();
    invalidateVlm("Mass model changed");
    updateMassAnalysis();
  });
  cell.append(button);
  return cell;
}

function renderWarnings(warnings) {
  elements.meshWarnings.textContent = "";
  const effectiveWarnings = [...warnings];
  if (state.sourceName === "samolot.stl" && state.manifest?.components?.some((component) => Number(component.massKg) === 42600)) {
    effectiveWarnings.unshift("The 42,600 kg demo airframe mass is an editable assumption, not data contained in the STL.");
  }
  for (const warning of [...new Set(effectiveWarnings)].slice(0, 6)) {
    const node = document.createElement("div");
    node.className = "warning";
    node.textContent = warning;
    elements.meshWarnings.append(node);
  }
  const topology = state.meshProperties?.topology;
  if (!topology) return;
  const warn = topology.boundaryEdges > 0 || topology.nonManifoldEdges > 0 || topology.componentCount > 1;
  elements.meshQualityBadge.textContent = warn ? "Mesh warnings" : "Watertight mesh";
  elements.meshQualityBadge.className = `badge ${warn ? "warn" : "good"}`;
}

function renderMassMetrics(mass) {
  const mesh = state.meshProperties;
  elements.massMetrics.innerHTML = [
    metric("Total mass", `${formatNumber(mass.totalMassKg, 1)} kg`),
    metric("Mesh volume", `${formatNumber(mesh.volumeM3, 3)} m3`),
    metric("CG x y z", vectorText(mass.cg), "full"),
    metric("Ixx Iyy Izz", `${formatNumber(mass.inertiaCg.xx, 0)}, ${formatNumber(mass.inertiaCg.yy, 0)}, ${formatNumber(mass.inertiaCg.zz, 0)}`, "full"),
    metric("Surface area", `${formatNumber(mesh.surfaceAreaM2, 2)} m2`),
    metric("Mass entries", `${mass.components.length}`)
  ].join("");
}

function renderStabilityMetrics(vlm) {
  const zero = nearestAlpha(vlm.series, 0);
  const quality = vlm.diagnostics.worstPivotRatio > 1e-7 && vlm.diagnostics.worstResidual < 1e-7;
  const resolution = vlm.resolution ? ` ${vlm.resolution.label} (${vlm.resolution.chordwiseRows} chordwise rows).` : "";
  const validityMessages = vlm.validity?.messages?.length ? `<br>${vlm.validity.messages.join("<br>")}` : "";
  // SOL-02 (REM-1): state which flow/lattice the resolution claim covers.
  const check = vlm.resolutionCheck;
  const checkLine = check
    ? `<br>Resolution claim: ${check.claim}; checked at beta = ${formatNumber(check.inputIdentity.betaDeg, 1)} deg, alpha = 0/4 deg` +
      (check.claim === "withheld" ? ` — ${check.withholdingReason || "withheld"}` : "") + "."
    : "";
  const labelLine = vlm.uncertaintyLabel === UNCERTAINTY_LABEL
    ? `<em>${vlm.uncertaintyLabel}</em> (${vlm.uncertaintyScope || ""})`
    : `<em>${vlm.uncertaintyLabel}</em> — ${vlm.uncertaintyScope || ""}`;
  elements.solverDiagnostics.innerHTML = `<strong>${vlm.method}</strong>${resolution}<br>${vlm.diagnostics.panelCount} panels; residual ${formatScientific(vlm.diagnostics.worstResidual)}; pivot ratio ${formatScientific(vlm.diagnostics.worstPivotRatio)}; ${quality ? "numerically resolved" : "conditioning warning"}.${checkLine}${validityMessages}<br>${labelLine}`;
  if (vlm.validity?.status === "invalid") {
    // G0 display rule (SOL-03/SOL-07, REM-1): a quarantined number is shown as
    // UNAVAILABLE, never as a value.
    elements.stabilityMetrics.innerHTML = [
      metric("Result validity", "UNAVAILABLE — quarantined solution", "full"),
      metric("Quarantine", vlm.validity.messages.join(" ") || "see solver diagnostics", "full")
    ].join("");
    return;
  }
  elements.stabilityMetrics.innerHTML = [
    metric("Static margin", Number.isFinite(vlm.staticMargin) ? `${formatNumber(vlm.staticMargin * 100, 1)} %` : "not determined"),
    // DATA_CONTRACTS 2.5 verdict rules (M0-5 / SOL-09, STAB-V2/STAB-V3): a
    // verdict is rendered only when the solver record holds ALL contract
    // conditions; the model description is printed WITH it (rule 4). Anything
    // else is "not determined" with the unmet conditions named — never NaN and
    // never "Unstable" (VLM-V7). `stabilityVerdict` is the only verdict
    // source; the bare slope sign (cmSlopeNegative) is never rendered as one.
    metric("Pitch stability", vlm.stabilityVerdict?.status === "determined"
      ? `${vlm.stabilityVerdict.verdict === "statically stable" ? "Stable" : "Unstable"} — <em>${vlm.stabilityVerdict.modelDescription}</em>`
      : `not determined — ${vlm.stabilityVerdict?.unmetConditions?.join("; ") || "verdict conditions not met (DATA_CONTRACTS 2.5)"}`),
    metric("Neutral point x", Number.isFinite(vlm.neutralPointXM) ? `${formatNumber(vlm.neutralPointXM, 3)} m` : "not determined"),
    metric("Trim alpha", Number.isFinite(vlm.trimAlphaDeg) ? `${formatNumber(vlm.trimAlphaDeg, 2)} deg` : "not determined"),
    metric("CL alpha", Number.isFinite(vlm.clAlphaPerRad) ? `${formatNumber(vlm.clAlphaPerRad, 3)} /rad` : "not determined"),
    metric("Cm alpha", Number.isFinite(vlm.cmAlphaPerRad) ? `${formatNumber(vlm.cmAlphaPerRad, 3)} /rad` : "not determined"),
    metric("CL at 0 deg", formatNumber(zero.cl, 3)),
    metric("CDi at 0 deg", formatNumber(zero.cdi, 4))
  ].join("");
}

function updateGraphs(pitchSamples = null) {
  if (!state.lastVlm) {
    const unavailable = [{ title: "Run VLM to update", series: [] }];
    drawPlots(elements.polarCanvas, unavailable);
    drawPlots(elements.pitchCanvas, unavailable);
    return;
  }
  // SOL-03/SOL-07 (REM-1): never draw curves from a quarantined solution. The
  // canvases state unavailability instead of showing unverified numbers.
  if (state.lastVlm.validity?.status === "invalid") {
    const unavailable = [{ title: "Results unavailable — quarantined solution (see solver diagnostics)", series: [] }];
    drawPlots(elements.polarCanvas, unavailable);
    drawPlots(elements.pitchCanvas, unavailable);
    return;
  }
  const series = state.lastVlm.series;
  const pitch = pitchSamples || state.lastPitchSamples || [];
  drawPlots(elements.polarCanvas, [
    {
      title: "VLM coefficients",
      xLabel: "alpha deg",
      series: [
        { name: "CL", color: "#2764c4", points: series.map((p) => ({ x: p.alphaDeg, y: p.cl })) },
        { name: "CD total", color: "#087f8c", points: series.map((p) => ({ x: p.alphaDeg, y: p.cd })) },
        { name: "Cm", color: "#b23a48", points: series.map((p) => ({ x: p.alphaDeg, y: p.cm })) }
      ]
    },
    {
      title: "Integrated loads",
      xLabel: "alpha deg",
      series: [
        { name: "Lift kN", color: "#23704a", points: series.map((p) => ({ x: p.alphaDeg, y: p.liftN / 1000 })) },
        { name: "Drag kN", color: "#ad6a00", points: series.map((p) => ({ x: p.alphaDeg, y: p.dragN / 1000 })) },
        { name: "Moment kN m", color: "#b23a48", points: series.map((p) => ({ x: p.alphaDeg, y: p.momentNm / 1000 })) }
      ]
    }
  ]);
  if (pitch.length) {
    drawPlots(elements.pitchCanvas, [{
      title: "Linearized pitch response from VLM Cm slope",
      xLabel: "time s",
      series: [
        { name: "theta deg", color: "#2764c4", points: pitch.map((p) => ({ x: p.timeS, y: p.thetaDeg })) },
        { name: "alpha deg", color: "#b23a48", points: pitch.map((p) => ({ x: p.timeS, y: p.alphaDeg })) },
        { name: "q deg/s", color: "#087f8c", points: pitch.map((p) => ({ x: p.timeS, y: p.qPitchDegS })) }
      ]
    }]);
  } else {
    drawPlots(elements.pitchCanvas, [{ title: "Pitch response unavailable", series: [] }]);
  }
}

async function openProject(project) {
  if (project.source.name === "samolot.stl") {
    await loadDemo(project);
    return;
  }
  if (state.rawStl?.triangleCount === project.source.triangleCount) {
    restoreProjectState(project);
    return;
  }
  state.pendingProject = project;
  setStatus(`Project loaded. Import matching STL '${project.source.name}' to restore assignments.`);
}

function restoreProjectState(project) {
  if (project.source.triangleCount !== state.rawStl.triangleCount) throw new Error("Project and STL triangle counts do not match.");
  state.manifest = normalizeManifest(project.massManifest, state.meshProperties);
  state.recognition.assignments = restoreAssignments(project, state.rawStl.triangleCount);
  applyControlValues(project.controls);
  state.recognitionReport = buildRecognitionReport(state.mappedPositions, state.recognition.assignments);
  if (state.recognitionReport.wing.valid) applyRecognizedReference(state.recognitionReport.wing);
  renderMassTable();
  renderRecognition();
  updateMeshColors();
  invalidateVlm("Project restored");
  updateMassAnalysis();
  runVlm();
}

function exportProject() {
  if (!state.rawStl) return;
  downloadBlob("airflow-project.json", JSON.stringify(projectSnapshot(), null, 2), "application/json");
}

function exportResults() {
  if (!state.lastVlm) {
    setStatus("Run VLM before exporting results.");
    return;
  }
  // A sweep-level invalid result is withheld in full, matching the plots. A
  // missing validity record is also unavailable rather than implicitly valid.
  const result = state.lastVlm;
  const sweepUsable = ["ok", "warning"].includes(result.validity?.status);
  const value = (v) => Number.isFinite(v) ? v : null;
  const series = result.series.map((p) => {
    const usable = sweepUsable && ["ok", "warning"].includes(p.validity?.status);
    return {
      alphaDeg: value(p.alphaDeg), validity: p.validity ?? null,
      availability: usable ? "available" : "withheld",
      cl: usable ? value(p.cl) : null, cdi: usable ? value(p.cdi) : null,
      cd: usable ? value(p.cd) : null, cm: usable ? value(p.cm) : null,
      liftN: usable ? value(p.liftN) : null, dragN: usable ? value(p.dragN) : null,
      momentNm: usable ? value(p.momentNm) : null
    };
  });
  const exported = {
    schema: "airflow.vlm-results", version: 1,
    method: result.method ?? null, limitations: result.limitations ?? null,
    validity: result.validity ?? null, provenance: result.provenance ?? null,
    uncertaintyLabel: result.uncertaintyLabel ?? null, uncertaintyScope: result.uncertaintyScope ?? null,
    resolution: result.resolution ?? null, resolutionCheck: result.resolutionCheck ?? null,
    diagnostics: result.diagnostics ?? null,
    coefficientNotes: { cd: "CDi plus assumed constant CD0", cm: "includes user-entered constant CM0; reference point in provenance inputs" },
    series
  };
  downloadBlob("airflow-vlm-results.json", JSON.stringify(exported, null, 2), "application/json");
}

function projectSnapshot() {
  return createProjectSnapshot({
    ...state,
    unitScale: state.unitScale,
    axisMapping: state.axisMapping,
    controls: collectControlValues()
  });
}

function scheduleAutosave() {
  if (!state.rawStl) return;
  clearTimeout(state.autosaveTimer);
  state.autosaveTimer = setTimeout(() => saveAutosave(projectSnapshot()), 800);
}

function collectControlValues() {
  return Object.fromEntries(CONTROL_IDS.map((id) => [id, elements[id].type === "checkbox" ? elements[id].checked : elements[id].value]));
}

function applyControlValues(values = {}) {
  for (const [id, value] of Object.entries(values)) {
    if (!elements[id]) continue;
    if (elements[id].type === "checkbox") elements[id].checked = Boolean(value);
    else elements[id].value = value;
  }
}

function setAxisControls(mapping = DEFAULT_AXIS_MAPPING, scale = 1) {
  elements.axisLongitudinal.value = mapping?.longitudinal || DEFAULT_AXIS_MAPPING.longitudinal;
  elements.axisLateral.value = mapping?.lateral || DEFAULT_AXIS_MAPPING.lateral;
  elements.axisVertical.value = mapping?.vertical || DEFAULT_AXIS_MAPPING.vertical;
  elements.unitScaleSelect.value = String(scale || 1);
}

function transformManifestPositions(manifest, oldMapping, oldScale, newMapping, newScale) {
  if (!oldMapping || !oldScale) return;
  for (const component of manifest.components) {
    if (component.type === "mesh-volume") continue;
    const raw = [0, 0, 0];
    const oldValues = [component.positionM[0], component.positionM[1], component.positionM[2]];
    for (const [index, key] of ["longitudinal", "lateral", "vertical"].entries()) {
      const axis = oldMapping[key];
      const rawIndex = { x: 0, y: 1, z: 2 }[axis.replace("-", "")];
      raw[rawIndex] = oldValues[index] / oldScale * (axis.startsWith("-") ? -1 : 1);
    }
    component.positionM = Array.from(mapPositions(Float64Array.from(raw), newMapping, newScale));
  }
}

function invalidateVlm(reason) {
  if (!state.lastVlm) return;
  clearVlmResult(reason);
}

function clearVlmResult(reason) {
  state.lastVlm = null;
  state.lastPitchSamples = null;
  clearGroup(state.vlmGroup);
  elements.neutralPointInput.value = "";
  elements.solverBadge.textContent = reason;
  elements.solverBadge.className = "badge warn";
  elements.resolutionBadge.textContent = "R1/R2 not run";
  elements.resolutionBadge.className = "badge";
  elements.stabilityMetrics.innerHTML = metric("Solver state", "Run VLM to update", "full");
  elements.solverDiagnostics.textContent = "";
  updateGraphs();
}

function readAxisMapping() {
  return { longitudinal: elements.axisLongitudinal.value, lateral: elements.axisLateral.value, vertical: elements.axisVertical.value };
}

function summaryRow(name, count, detail) {
  return `<div><strong>${name}</strong><span>${formatInt(count)} faces</span><small>${detail}</small></div>`;
}

function metric(label, value, className = "") {
  return `<div class="metric ${className}"><span>${label}</span><strong>${value}</strong></div>`;
}

function addSceneSegment(values, a, b) {
  values.push(...internalToScene(a), ...internalToScene(b));
}

function clearGroup(group) {
  if (!group) return;
  while (group.children.length) {
    const child = group.children[0];
    group.remove(child);
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
    else child.material?.dispose?.();
  }
}

function downloadBlob(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function setStatus(message) { elements.statusLine.textContent = message; }
function requiredInput(input) {
  const parsed = input.valueAsNumber;
  if (input.validity.badInput || !Number.isFinite(parsed)) throw new Error(`${input.id} must be a finite number.`);
  return parsed;
}
function requiredPositiveInput(input) {
  const value = requiredInput(input);
  if (value <= 0) throw new Error(`${input.id} must be positive.`);
  return value;
}
function numericValue(input, fallback) { const value = Number.parseFloat(input.value); return Number.isFinite(value) ? value : fallback; }
function positiveInput(input, fallback) { return Math.max(numericValue(input, fallback), 1e-6); }
function formatInput(value, digits) { return Number.isFinite(value) ? Number(value).toFixed(digits) : ""; }
function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return "n/a";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: Math.min(digits, 1) }).format(value);
}
function formatInt(value) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value); }
function formatScientific(value) { return Number.isFinite(value) ? value.toExponential(2) : "n/a"; }
function vectorText(vector) { return `[${vector.map((value) => formatNumber(value, 3)).join(", ")}] m`; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function nearestAlpha(series, alphaDeg) { return series.reduce((best, point) => Math.abs(point.alphaDeg - alphaDeg) < Math.abs(best.alphaDeg - alphaDeg) ? point : best, series[0]); }
function addVector(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function scaleVector(a, scalar) { return [a[0] * scalar, a[1] * scalar, a[2] * scalar]; }
