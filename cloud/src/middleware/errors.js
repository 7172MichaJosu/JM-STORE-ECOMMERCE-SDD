export function errorHandler(error, req, res, next) {
  let status = error.status || 500,
    code = error.code || "INTERNAL",
    message = error.status
      ? error.message
      : "No se pudo completar la operación.";
  if (
    !error.status &&
    /MUTATION_CONFLICT|UNIQUE constraint/.test(error.message)
  ) {
    status = 409;
    code = "VERSION_CONFLICT";
    message = "Los datos cambiaron. Recarga y revisa.";
  } else if (!error.status && /D1_|SQLITE_BUSY/.test(error.message)) {
    status = 503;
    code = "STORAGE_UNAVAILABLE";
    message = "Servicio temporalmente no disponible.";
  }
  if (error.type === "entity.parse.failed") {
    status = 400;
    code = "INVALID_JSON";
    message = "JSON inválido.";
  }
  if (error.type === "entity.too.large") {
    status = 413;
    code = "BODY_TOO_LARGE";
    message = "Solicitud demasiado grande.";
  }
  res
    .status(status)
    .json({
      error: {
        code,
        message,
        ...(error.fields ? { fields: error.fields } : {}),
        requestId: req.requestId,
      },
    });
}
