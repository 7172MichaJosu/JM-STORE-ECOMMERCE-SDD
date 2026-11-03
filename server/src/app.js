import express from "express";
import helmet from "helmet";
import path from "node:path";
import { existsSync } from "node:fs";
import { openDatabase } from "./db/connection.js";
import { migrate } from "./db/migrate.js";
import { configuration, root } from "./config.js";
import { requestContext } from "./middleware/request-context.js";
import { errorHandler } from "./middleware/error-handler.js";
import { installApi } from "./api.js";
export function createApp(options = {}) {
  const config = configuration(options);
  const db = openDatabase(config.databasePath);
  migrate(db);
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "img-src": ["'self'", "data:"],
          "script-src": ["'self'"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "upgrade-insecure-requests": null,
        },
      },
      hsts: config.origin.startsWith("https:"),
    }),
  );
  app.use(requestContext, express.json({ limit: "100kb" }));
  app.get("/api/health", (req, res) => {
    db.prepare("SELECT 1").get();
    res.json({ data: { status: "ok" } });
  });
  return {
    app,
    db,
    config,
    finish() {
      installApi({ app, db, config });
      app.use("/api", (req, res) =>
        res
          .status(404)
          .json({
            error: { code: "NOT_FOUND", message: "Ruta no encontrada." },
          }),
      );
      const dist = path.join(root, "client/dist");
      if (existsSync(dist)) {
        app.use(express.static(dist));
        app.get("/{*path}", (req, res) =>
          res.sendFile(path.join(dist, "index.html")),
        );
      }
      app.use(errorHandler);
    },
    close() {
      db.close();
    },
  };
}
