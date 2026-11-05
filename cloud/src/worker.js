import { createApp } from "./app.js";
const app = createApp();
export function secured(response, url) {
  const headers = new Headers(response.headers);
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  );
  headers.set("X-Content-Type-Options", "nosniff");
  const emailAction = url.pathname === "/admin/mi-cuenta/seguridad/confirmar-correo";
  headers.set("Referrer-Policy", emailAction ? "no-referrer" : "same-origin");
  headers.set("X-Frame-Options", "DENY");
  if (url.protocol === "https:")
    headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  if (url.pathname.startsWith("/assets/"))
    headers.set("Cache-Control", "public,max-age=31536000,immutable");
  if (emailAction) headers.set("Cache-Control", "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
export default {
  async fetch(request, bindings, ctx) {
    const url = new URL(request.url),
      local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (!local && bindings.REMOTE_ENABLED !== "true")
      return secured(
        Response.json(
          {
            error: {
              code: "REMOTE_DISABLED",
              message: "Despliegue no habilitado.",
            },
          },
          { status: 503 },
        ),
        url,
      );
    const response =
      url.pathname === "/api" || url.pathname.startsWith("/api/")
        ? await app.fetch(request, bindings, ctx)
        : await bindings.ASSETS.fetch(request);
    return secured(response, url);
  },
};
