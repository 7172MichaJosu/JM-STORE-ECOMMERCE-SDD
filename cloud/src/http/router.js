// Fetch-native dispatcher for the routes and middleware used by JM-STORE.
export function Router() {
  const layers = [];
  const router = async (req, res, done = () => {}) => {
    async function dispatch(index) {
      if (res.finished) return;
      if (index >= layers.length) return done();
      const layer = layers[index];
      if (layer.method && layer.method !== req.method && !(req.method === "HEAD" && layer.method === "GET")) return dispatch(index + 1);
      const match = layer.pattern.exec(req.path);
      if (!match) return dispatch(index + 1);
      const originalPath = req.path, originalParams = req.params;
      const params = { ...originalParams };
      try { layer.names.forEach((name, i) => { params[name] = decodeURIComponent(match[i + 1]); }); }
      catch { throw Object.assign(Error("Ruta no válida."), { status: 400, code: "INVALID_PATH" }); }
      req.params = params;
      if (!layer.method && layer.mount !== "/") req.path = req.path.slice(match[0].length) || "/";
      const restore = () => { req.path = originalPath; req.params = originalParams; };
      async function run(position) {
        if (res.finished) return;
        if (position === layer.handlers.length) { restore(); return dispatch(index + 1); }
        let continuation, called = false;
        const next = error => {
          if (called) throw Error("Middleware called next twice.");
          called = true;
          continuation = error ? Promise.reject(error) : run(position + 1);
          continuation.catch(() => {});
          return continuation;
        };
        await layer.handlers[position](req, res, next);
        if (called) await continuation;
      }
      try { await run(0); } finally { restore(); }
    }
    await dispatch(0);
  };
  function add(method, path, handlers) {
    for (const mount of Array.isArray(path) ? path : [path]) {
      const names = [];
      const source = mount === "/" ? "" : mount.split("/").map(part => {
        if (part.startsWith(":")) { names.push(part.slice(1)); return "([^/]+)"; }
        return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }).join("/");
      const pattern = new RegExp("^" + source + (method ? "/?$" : mount === "/" ? "" : "(?=/|$)"), "i");
      layers.push({ method, mount, pattern, names, handlers: handlers.flat() });
    }
    return router;
  }
  router.use = (path, ...handlers) => typeof path === "string" || Array.isArray(path)
    ? add(null, path, handlers) : add(null, "/", [path, ...handlers]);
  for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
    router[method.toLowerCase()] = (path, ...handlers) => add(method, path, handlers);
  return router;
}

export function responseContext() {
  const headers = new Headers({
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Resource-Policy": "same-origin",
    "Origin-Agent-Cluster": "?1", "X-DNS-Prefetch-Control": "off", "X-Download-Options": "noopen",
    "X-Permitted-Cross-Domain-Policies": "none", "X-XSS-Protection": "0",
  });
  let status = 200, body = null;
  const res = {
    finished: false,
    setHeader(name, value) { headers.set(name, String(value)); return res; },
    status(value) { status = value; return res; },
    json(value) { headers.set("Content-Type", "application/json; charset=utf-8"); body = JSON.stringify(value); res.finished = true; return res; },
    end(value = null) { body = value; res.finished = true; return res; },
    cookie(name, value, options) {
      let cookie = `${name}=${encodeURIComponent(value)}; Path=${options.path || "/"}`;
      if (options.maxAge !== undefined) cookie += `; Max-Age=${Math.floor(options.maxAge / 1000)}`;
      if (options.expires) cookie += `; Expires=${options.expires.toUTCString()}`;
      if (options.httpOnly) cookie += "; HttpOnly";
      if (options.secure) cookie += "; Secure";
      if (options.sameSite) cookie += "; SameSite=" + (options.sameSite === "lax" ? "Lax" : options.sameSite === "strict" ? "Strict" : "None");
      headers.append("Set-Cookie", cookie); return res;
    },
    clearCookie(name, options) { return res.cookie(name, "", { ...options, maxAge: 0, expires: new Date(0) }); },
    finish(method = "GET") { return new Response(method === "HEAD" || [204, 304].includes(status) ? null : body, { status, headers }); },
  };
  return res;
}
