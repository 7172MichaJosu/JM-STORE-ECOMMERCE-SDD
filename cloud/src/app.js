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
import { Router, responseContext } from "./http/router.js";

async function jsonBody(request) {
  if (!request.body) return {};
  const maximum = 100 * 1024;
  const tooLarge = () => Object.assign(Error("Solicitud demasiado grande."), { type: "entity.too.large" });
  if (Number(request.headers.get("content-length")) > maximum) throw tooLarge();
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || ""))
    throw Object.assign(Error("Usa un cuerpo JSON."), { status: 415, code: "UNSUPPORTED_MEDIA_TYPE" });
  if (request.headers.get("content-encoding") && request.headers.get("content-encoding") !== "identity")
    throw Object.assign(Error("Codificación no permitida."), { status: 415, code: "UNSUPPORTED_MEDIA_TYPE" });
  const reader = request.body.getReader(), chunks = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > maximum) { await reader.cancel(); throw tooLarge(); }
    chunks.push(value);
  }
  if (!size) return {};
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (value === null || typeof value !== "object") throw Error("JSON object required.");
    return value;
  } catch { throw Object.assign(Error("JSON inválido."), { type: "entity.parse.failed" }); }
}

export function createApp() {
  const routes = Router();
  routes.use(sessionMiddleware, limit("api", 300, 60), queryValidation, (req, res, next) => csrf(req.config.origin)(req, res, next), apiRoutes());
  return {
    async fetch(request, bindings) {
      const url = new URL(request.url), res = responseContext();
      const query = Object.create(null);
      for (const [name, value] of url.searchParams) {
        if (Object.hasOwn(query, name)) query[name] = Array.isArray(query[name]) ? [...query[name], value] : [query[name], value];
        else query[name] = value;
      }
      const req = { method: request.method, path: url.pathname.slice(4) || "/", params: {}, query,
        headers: Object.fromEntries(request.headers), get: name => request.headers.get(name), socket: { remoteAddress: "local" } };
      requestContext(req, res, () => {});
      try {
        req.body = await jsonBody(request);
        try { req.config = configuration(bindings); req.db = connect(bindings.DB); }
        catch { res.status(503).json({ error: { code: "CONFIGURATION_REQUIRED", message: "Servicio aún no configurado.", requestId: req.requestId } }); return res.finish(req.method); }
        const state = await deploymentState(req.db, req.config.identity);
        if (["GET", "HEAD"].includes(req.method) && /^\/health\/?$/i.test(req.path)) res.json({ data: { status: "ok" } });
        else if (state.mode !== "OPEN") res.status(503).json({ error: { code: "STORE_NOT_READY", message: "Tienda temporalmente no disponible.", requestId: req.requestId } });
        else await routes(req, res);
        if (!res.finished) res.status(404).json({ error: { code: "NOT_FOUND", message: "Ruta no encontrada.", requestId: req.requestId } });
      } catch (error) { errorHandler(error, req, res); }
      return res.finish(req.method);
    },
  };
}
