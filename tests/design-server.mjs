import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("public");
http
  .createServer(async (req, res) => {
    let path = resolve(
      root,
      "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
    );
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      if ((await stat(path)).isDirectory()) path = resolve(path, "index.html");
      const data = await readFile(path);
      res.setHeader(
        "Content-Type",
        {
          ".html": "text/html; charset=utf-8",
          ".css": "text/css",
          ".js": "text/javascript",
          ".json": "application/json",
          ".png": "image/png",
        }[extname(path)] || "application/octet-stream",
      );
      res.end(data);
    } catch {
      res.writeHead(404).end();
    }
  })
  .listen(4173, "127.0.0.1", () =>
    console.log("http://127.0.0.1:4173/previews/designs/"),
  );
