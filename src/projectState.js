import { decodeAssignments, encodeAssignments } from "./recognition.js";

export const PROJECT_SCHEMA = "airflow.browser-project";
export const PROJECT_VERSION = 1;

export function createProjectSnapshot(state) {
  return {
    schema: PROJECT_SCHEMA,
    version: PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    workflowStage: state.lastVlm ? "analyzed" : state.recognitionReport?.wing?.valid ? "recognized" : state.meshProperties ? "processed" : "empty",
    source: {
      name: state.sourceName || "",
      triangleCount: state.rawStl?.triangleCount || 0,
      unitScale: state.unitScale,
      axisMapping: state.axisMapping
    },
    massManifest: state.manifest,
    recognition: {
      assignmentsRle: encodeAssignments(state.recognition?.assignments || new Uint8Array()),
      report: state.recognitionReport || null
    },
    controls: state.controls || {},
    analysis: state.lastVlm ? stripVlmForPersistence(state.lastVlm) : null
  };
}

export function validateProjectSnapshot(project) {
  if (!project || project.schema !== PROJECT_SCHEMA) throw new Error("Not an AirFLOW browser project file.");
  if (project.version !== PROJECT_VERSION) throw new Error(`Unsupported project version: ${project.version}.`);
  if (!project.source || !Number.isInteger(project.source.triangleCount)) throw new Error("Project source metadata is invalid.");
  return project;
}

export function restoreAssignments(project, triangleCount) {
  validateProjectSnapshot(project);
  if (project.source.triangleCount !== triangleCount) {
    throw new Error(`Project expects ${project.source.triangleCount} triangles; loaded STL has ${triangleCount}.`);
  }
  return decodeAssignments(project.recognition?.assignmentsRle, triangleCount);
}

export function saveAutosave(project) {
  try {
    localStorage.setItem("airflow.browser-project.autosave", JSON.stringify(project));
    return true;
  } catch {
    return false;
  }
}

export function loadAutosave() {
  try {
    const raw = localStorage.getItem("airflow.browser-project.autosave");
    return raw ? validateProjectSnapshot(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function stripVlmForPersistence(result) {
  return {
    method: result.method,
    provenance: result.provenance,
    resolution: result.resolution,
    uncertaintyLabel: result.uncertaintyLabel, uncertaintyScope: result.uncertaintyScope,
    limitations: result.limitations,
    // M0-5 / SOL-09: undetermined derivatives persist as null and must travel
    // with their status record — never as bare nulls without provenance.
    fit: result.fit,
    clAlphaPerRad: result.clAlphaPerRad,
    cmAlphaPerRad: result.cmAlphaPerRad,
    staticMargin: result.staticMargin,
    neutralPointXM: result.neutralPointXM,
    trimAlphaDeg: result.trimAlphaDeg,
    trimStatus: result.trimStatus,
    cmSlopeNegative: result.cmSlopeNegative,
    stabilityVerdict: result.stabilityVerdict,
    validity: result.validity,
    resolutionCheck: result.resolutionCheck,
    diagnostics: result.diagnostics,
    series: result.series.map(({ panelResults, circulation, ...point }) => point)
  };
}
