let csrf = "",
  sessionPromise;
export async function bootstrap(force = false) {
  if (force) sessionPromise = null;
  if (!sessionPromise)
    sessionPromise = fetch("/api/auth/session", { credentials: "same-origin" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok)
          throw new Error(j.error?.message || "No pudimos iniciar la sesión.");
        csrf = j.data.csrfToken;
        return j.data;
      })
      .catch((e) => {
        sessionPromise = null;
        throw e;
      });
  return sessionPromise;
}
export async function request(
  path,
  { method = "GET", body, headers, ...options } = {},
) {
  await bootstrap();
  let response;
  try {
    response = await fetch("/api" + path, {
      method,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrf,
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...options,
    });
  } catch {
    const e = new Error(
      "No hay conexión. Reintenta; conservaremos la misma operación.",
    );
    e.code = "NETWORK";
    throw e;
  }
  if (response.status === 204) return { data: null };
  const j = await response.json();
  if (!response.ok) {
    const e = new Error(
      j.error?.message || "No pudimos completar la operación.",
    );
    Object.assign(e, j.error, { status: response.status });
    throw e;
  }
  if (j.data?.csrfToken) {
    csrf = j.data.csrfToken;
    sessionPromise = Promise.resolve(j.data);
  }
  return j;
}
export const api = async (path, options) => (await request(path, options)).data;
