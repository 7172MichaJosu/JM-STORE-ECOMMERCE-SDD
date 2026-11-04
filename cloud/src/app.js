import express from "express";
import helmet from "helmet";
import { configuration } from "./config.js";
import { connect } from "./db/connection.js";
import { deploymentState } from "./db/migrations.js";
import { requestContext } from "./middleware/request-context.js";
import { errorHandler } from "./middleware/errors.js";
import { sessionMiddleware } from "./security/sessions.js";
import { limit } from "./security/rate-limit.js";
import { csrf } from "../../server/src/middleware/csrf.js";
import { queryValidation } from "../../server/src/middleware/query-validation.js";
import { apiRoutes } from "./api.js";
export function createApp(getEnv) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({ contentSecurityPolicy: false, hsts: false }),
    requestContext,
    express.json({ limit: "100kb" }),
  );
  app.use((req, res, next) => {
    try {
      const env = getEnv();
      req.config = configuration(env);
      req.db = connect(env.DB);
      next();
    } catch {
      res
        .status(503)
        .json({
          error: {
            code: "CONFIGURATION_REQUIRED",
            message: "Servicio aún no configurado.",
            requestId: req.requestId,
          },
        });
    }
  });
  app.get("/api/health", async (req, res) => {
    await deploymentState(req.db, req.config.identity);
    res.json({ data: { status: "ok" } });
  });
  app.use(
    "/api",
    async (req, res, next) => {
      const state = await deploymentState(req.db, req.config.identity);
      if (state.mode !== "OPEN")
        return res
          .status(503)
          .json({
            error: {
              code: "STORE_NOT_READY",
              message: "Tienda temporalmente no disponible.",
              requestId: req.requestId,
            },
          });
      next();
    },
    sessionMiddleware,
    limit("api", 300, 60),
    queryValidation,
    (req, res, next) => csrf(req.config.origin)(req, res, next),
    apiRoutes(),
  );
  app.use((req, res) =>
    res
      .status(404)
      .json({
        error: {
          code: "NOT_FOUND",
          message: "Ruta no encontrada.",
          requestId: req.requestId,
        },
      }),
  );
  app.use(errorHandler);
  return app;
}
