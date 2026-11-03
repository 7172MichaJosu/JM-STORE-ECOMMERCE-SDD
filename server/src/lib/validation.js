import { fail } from "./errors.js";
export function fields(body, allowed) {
  for (const key of Object.keys(body || {}))
    if (!allowed.includes(key))
      fail(422, "VALIDATION", "Revisa los campos enviados.", {
        [key]: "Campo no permitido.",
      });
}
export function text(value, key, min = 1, max = 200) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    fail(422, "VALIDATION", "Revisa los campos.", {
      [key]: `Usa entre ${min} y ${max} caracteres.`,
    });
  return value.trim();
}
export function integer(value, key, min = 0, max = 1000000) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    fail(422, "VALIDATION", "Revisa los campos.", {
      [key]: `Usa un entero entre ${min} y ${max}.`,
    });
  return value;
}
export function flag(value, key) {
  if (typeof value !== "boolean")
    fail(422, "VALIDATION", "Valor no válido.", {
      [key]: "Usa verdadero o falso.",
    });
  return Number(value);
}
export function pagination(q) {
  const page = Number(q.page ?? 1),
    pageSize = Number(q.pageSize ?? 20);
  integer(page, "page", 1, 1000000);
  integer(pageSize, "pageSize", 1, 100);
  return { page, pageSize };
}
export function version(expected, actual) {
  if (expected !== actual)
    fail(
      409,
      "VERSION_CONFLICT",
      "Los datos cambiaron. Recarga y revisa antes de guardar.",
    );
}
