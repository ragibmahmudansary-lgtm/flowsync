import type { WebGLRenderer } from "three";

let renderer: WebGLRenderer | null = null;

export function setViewportRenderer(gl: WebGLRenderer) {
  renderer = gl;
}

export function captureViewportPNG(): string | null {
  if (!renderer) return null;
  try {
    return renderer.domElement.toDataURL("image/png");
  } catch {
    return null;
  }
}
