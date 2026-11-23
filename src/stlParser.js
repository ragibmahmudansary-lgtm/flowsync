const textDecoder = new TextDecoder("utf-8");

export function parseSTL(input) {
  const buffer = input instanceof ArrayBuffer ? input : input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
  if (looksBinary(buffer)) return parseBinarySTL(buffer);
  return parseAsciiSTL(textDecoder.decode(buffer));
}

function looksBinary(buffer) {
  if (buffer.byteLength < 84) return false;
  const view = new DataView(buffer);
  const triangleCount = view.getUint32(80, true);
  const expectedLength = 84 + triangleCount * 50;
  if (expectedLength === buffer.byteLength) return true;
  const header = textDecoder.decode(buffer.slice(0, Math.min(80, buffer.byteLength))).trimStart().toLowerCase();
  return !header.startsWith("solid");
}

function parseBinarySTL(buffer) {
  const view = new DataView(buffer);
  const triangleCount = view.getUint32(80, true);
  const positions = new Float64Array(triangleCount * 9);
  const normals = new Float32Array(triangleCount * 9);

  for (let tri = 0, offset = 84; tri < triangleCount; tri += 1, offset += 50) {
    const nx = view.getFloat32(offset, true);
    const ny = view.getFloat32(offset + 4, true);
    const nz = view.getFloat32(offset + 8, true);
    const base = tri * 9;
    for (let vertex = 0; vertex < 3; vertex += 1) {
      const vertexOffset = offset + 12 + vertex * 12;
      const target = base + vertex * 3;
      positions[target] = view.getFloat32(vertexOffset, true);
      positions[target + 1] = view.getFloat32(vertexOffset + 4, true);
      positions[target + 2] = view.getFloat32(vertexOffset + 8, true);
      normals[target] = nx;
      normals[target + 1] = ny;
      normals[target + 2] = nz;
    }
  }

  return { format: "binary", triangleCount, positions, normals };
}

function parseAsciiSTL(text) {
  const vertexPattern = /vertex\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/g;
  const values = [];
  let match;
  while ((match = vertexPattern.exec(text)) !== null) {
    values.push(Number.parseFloat(match[1]), Number.parseFloat(match[2]), Number.parseFloat(match[3]));
  }
  if (values.length % 9 !== 0 || values.length === 0) {
    throw new Error("ASCII STL parser found no complete triangles.");
  }
  const positions = Float64Array.from(values);
  return {
    format: "ascii",
    triangleCount: positions.length / 9,
    positions,
    normals: new Float32Array(positions.length)
  };
}

export function serializeBinarySTL(triangles, name = "generated") {
  const buffer = new ArrayBuffer(84 + triangles.length * 50);
  const view = new DataView(buffer);
  const header = new TextEncoder().encode(name.slice(0, 80));
  new Uint8Array(buffer, 0, header.length).set(header);
  view.setUint32(80, triangles.length, true);
  let offset = 84;
  for (const triangle of triangles) {
    const normal = triangle.normal || faceNormal(triangle.vertices);
    view.setFloat32(offset, normal[0], true);
    view.setFloat32(offset + 4, normal[1], true);
    view.setFloat32(offset + 8, normal[2], true);
    for (let i = 0; i < 3; i += 1) {
      const vertex = triangle.vertices[i];
      view.setFloat32(offset + 12 + i * 12, vertex[0], true);
      view.setFloat32(offset + 16 + i * 12, vertex[1], true);
      view.setFloat32(offset + 20 + i * 12, vertex[2], true);
    }
    offset += 50;
  }
  return buffer;
}

function faceNormal(vertices) {
  const [a, b, c] = vertices;
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cross = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0]
  ];
  const length = Math.hypot(cross[0], cross[1], cross[2]) || 1;
  return [cross[0] / length, cross[1] / length, cross[2] / length];
}
