import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(".");
const preferredPort = Number.parseInt(process.env.PORT || "4173", 10);

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".stl", "model/stl"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".wasm", "application/wasm"]
]);

function safePath(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  const target = resolve(join(root, clean === "/" ? "index.html" : clean));
  if (!target.startsWith(root)) return null;
  return target;
}

function serveFile(req, res) {
  const target = safePath(req.url || "/");
  if (!target) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  let filePath = target;
  try {
    const stats = statSync(filePath);
    if (stats.isDirectory()) filePath = join(filePath, "index.html");
  } catch {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  try {
    const stats = statSync(filePath);
    const type = mimeTypes.get(extname(filePath).toLowerCase()) || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": stats.size,
      "Cache-Control": "no-store"
    });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

function listen(port, attempts = 12) {
  const server = createServer(serveFile);
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && attempts > 0) {
      listen(port + 1, attempts - 1);
      return;
    }
    console.error(error);
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () => {
    const address = server.address();
    console.log(`AirFLOW server running at http://127.0.0.1:${address.port}/`);
  });
}

listen(preferredPort);
