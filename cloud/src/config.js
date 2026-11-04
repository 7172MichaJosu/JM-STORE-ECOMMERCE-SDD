export function validateTarget(target, allowlist) {
  const fields = ["environment", "accountId", "worker", "databaseId", "origin"];
  if (!target || !["staging", "production"].includes(target.environment))
    throw Error("Target explícito requerido.");
  const expected = allowlist?.[target.environment];
  if (!expected || fields.some((k) => !target[k] || target[k] !== expected[k]))
    throw Error("El target no coincide con la allowlist.");
  if (
    !/^[0-9a-f]{32}$/i.test(target.accountId) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      target.databaseId,
    )
  )
    throw Error("Identidad remota inválida.");
  if (
    !target.origin.startsWith("https://") ||
    new URL(target.origin).origin !== target.origin
  )
    throw Error("Origen HTTPS requerido.");
  if (
    (allowlist.forbiddenWorkers || []).some(
      (x) => x.toLowerCase() === target.worker.toLowerCase(),
    ) ||
    (allowlist.forbiddenDatabases || []).includes(target.databaseId)
  )
    throw Error("Recurso antiguo prohibido.");
  const other =
    allowlist[target.environment === "staging" ? "production" : "staging"];
  if (
    other &&
    (other.worker === target.worker ||
      other.databaseId === target.databaseId ||
      other.accountId !== target.accountId)
  )
    throw Error(
      "Staging y producción deben usar recursos separados en la misma cuenta.",
    );
  return target;
}
export function configuration(env) {
  if (
    !env?.DB?.prepare ||
    !["local", "staging", "production"].includes(env.ENVIRONMENT)
  )
    throw Error("Ambiente/binding no configurado.");
  const origin = new URL(env.APP_ORIGIN).origin;
  if (
    origin !== env.APP_ORIGIN ||
    (!origin.startsWith("https://") &&
      !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
  )
    throw Error("Origen no válido.");
  for (const key of ["QUOTE_SECRET", "RATE_LIMIT_SECRET"])
    if (
      typeof env[key] !== "string" ||
      new TextEncoder().encode(env[key]).length < 32
    )
      throw Error("Secretos privados requeridos.");
  if (
    env.QUOTE_SECRET === env.RATE_LIMIT_SECRET ||
    !env.SESSION_NAMESPACE ||
    env.SESSION_NAMESPACE === "imported-source" ||
    !env.DATABASE_IDENTITY
  )
    throw Error("Identidad o separación de secretos inválida.");
  return {
    origin,
    namespace: env.SESSION_NAMESPACE,
    identity: env.DATABASE_IDENTITY,
    environment: env.ENVIRONMENT,
    quoteSecret: env.QUOTE_SECRET,
    rateSecret: env.RATE_LIMIT_SECRET,
  };
}
