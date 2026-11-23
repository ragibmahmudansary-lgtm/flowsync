export function boxTriangles(min = [0, 0, 0], max = [2, 4, 6]) {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const v000 = [x0, y0, z0];
  const v001 = [x0, y0, z1];
  const v010 = [x0, y1, z0];
  const v011 = [x0, y1, z1];
  const v100 = [x1, y0, z0];
  const v101 = [x1, y0, z1];
  const v110 = [x1, y1, z0];
  const v111 = [x1, y1, z1];
  return [
    tri(v000, v001, v011),
    tri(v000, v011, v010),
    tri(v100, v110, v111),
    tri(v100, v111, v101),
    tri(v000, v100, v101),
    tri(v000, v101, v001),
    tri(v010, v011, v111),
    tri(v010, v111, v110),
    tri(v000, v010, v110),
    tri(v000, v110, v100),
    tri(v001, v101, v111),
    tri(v001, v111, v011)
  ];
}

export function tetraTriangles() {
  const a = [0, 0, 0];
  const b = [1, 0, 0];
  const c = [0, 1, 0];
  const d = [0, 0, 1];
  return [
    tri(a, c, b),
    tri(a, b, d),
    tri(a, d, c),
    tri(b, c, d)
  ];
}

export function trianglesToPositions(triangles) {
  return Float64Array.from(triangles.flatMap((triangle) => triangle.vertices.flat()));
}

export function trianglesToAsciiSTL(triangles) {
  const lines = ["solid fixture"];
  for (const triangle of triangles) {
    lines.push("facet normal 0 0 0", "outer loop");
    for (const vertex of triangle.vertices) lines.push(`vertex ${vertex[0]} ${vertex[1]} ${vertex[2]}`);
    lines.push("endloop", "endfacet");
  }
  lines.push("endsolid fixture");
  return new TextEncoder().encode(lines.join("\n")).buffer;
}

function tri(a, b, c) {
  return { vertices: [a, b, c] };
}
