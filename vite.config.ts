import { defineConfig, type Plugin } from "vite";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Plugin de dev server: expone /api/content/* para read/write a public/content/.
 * Solo activo en `vite dev` — la build de producción no incluye estos handlers.
 */
function contentApiPlugin(): Plugin {
  const ROOT_REL = "public/content";
  return {
    name: "daa-content-api",
    configureServer(server) {
      const contentRoot = path.resolve(server.config.root, ROOT_REL);

      server.middlewares.use("/api/content", async (req, res, next) => {
        try {
          const url = new URL(req.url ?? "/", "http://x");
          const rel = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
          if (!rel) {
            res.statusCode = 400;
            return res.end("missing path");
          }
          const filePath = path.resolve(contentRoot, rel);
          if (!filePath.startsWith(contentRoot)) {
            res.statusCode = 403;
            return res.end("forbidden");
          }

          if (req.method === "GET") {
            try {
              const data = await fs.readFile(filePath);
              const ext = path.extname(filePath).toLowerCase();
              const ct =
                ext === ".json"
                  ? "application/json"
                  : ext === ".png"
                  ? "image/png"
                  : "application/octet-stream";
              res.setHeader("Content-Type", ct);
              res.end(data);
            } catch {
              res.statusCode = 404;
              res.end("not found");
            }
          } else if (req.method === "PUT") {
            const chunks: Buffer[] = [];
            req.on("data", (c: Buffer) => chunks.push(c));
            req.on("end", async () => {
              try {
                await fs.mkdir(path.dirname(filePath), { recursive: true });
                await fs.writeFile(filePath, Buffer.concat(chunks));
                res.statusCode = 200;
                res.end("ok");
              } catch (e) {
                res.statusCode = 500;
                res.end(String(e));
              }
            });
          } else if (req.method === "DELETE") {
            try {
              await fs.unlink(filePath);
              res.statusCode = 200;
              res.end("ok");
            } catch (e) {
              res.statusCode = 500;
              res.end(String(e));
            }
          } else {
            next();
          }
        } catch (e) {
          res.statusCode = 500;
          res.end(String(e));
        }
      });

      // Listado de archivos en una subcarpeta de content (útil para skins/)
      server.middlewares.use("/api/list", async (req, res) => {
        try {
          const url = new URL(req.url ?? "/", "http://x");
          const rel = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
          const dir = path.resolve(contentRoot, rel);
          if (!dir.startsWith(contentRoot)) {
            res.statusCode = 403;
            return res.end("forbidden");
          }
          const entries = await fs.readdir(dir).catch(() => []);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(entries));
        } catch (e) {
          res.statusCode = 500;
          res.end(String(e));
        }
      });
    },
  };
}

export default defineConfig({
  base: "./",
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: "es2020",
    sourcemap: false,
    rollupOptions: {
      // Solo el juego entra a producción; editor.html queda fuera del build.
      input: { main: "index.html" },
    },
  },
  plugins: [contentApiPlugin()],
});
