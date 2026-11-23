import test from "node:test";
import assert from "node:assert/strict";
import { parseSTL, serializeBinarySTL } from "../src/stlParser.js";
import { boxTriangles, trianglesToAsciiSTL } from "./fixtures.mjs";

test("parses generated binary STL", () => {
  const triangles = boxTriangles();
  const buffer = serializeBinarySTL(triangles, "box");
  const parsed = parseSTL(buffer);
  assert.equal(parsed.format, "binary");
  assert.equal(parsed.triangleCount, 12);
  assert.equal(parsed.positions.length, 108);
  assert.deepEqual(Array.from(parsed.positions.slice(0, 3)), [0, 0, 0]);
});

test("parses generated ASCII STL", () => {
  const buffer = trianglesToAsciiSTL(boxTriangles());
  const parsed = parseSTL(buffer);
  assert.equal(parsed.format, "ascii");
  assert.equal(parsed.triangleCount, 12);
  assert.equal(parsed.positions.length, 108);
});
