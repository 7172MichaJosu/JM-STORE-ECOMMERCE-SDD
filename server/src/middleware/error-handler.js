export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  let status = err.status || 500,
    code = err.code || "INTERNAL",
    message = err.message;
  if (err.code === "SQLITE_BUSY" || /database is locked/.test(message)) {
    status = 503;
    code = "STORAGE_BUSY";
    message = "La tienda está ocupada. Reintenta la misma operación.";
  } else if (/UNIQUE constraint failed/.test(message)) {
    status = 409;
    code = "CONFLICT";
    message = "Los datos ya existen o la operación ya fue registrada.";
  } else if (err.type === "entity.parse.failed") {
    status = 400;
    code = "INVALID_JSON";
    message = "El contenido no es JSON válido.";
  } else if (status === 500) {
    message = "No pudimos completar la operación. Intenta de nuevo.";
    console.error(
      JSON.stringify({
        requestId: req.requestId,
        code: "INTERNAL",
        type: err.name,
      }),
    );
  }
  res
    .status(status)
    .json({
      error: { code, message, fields: err.fields, requestId: req.requestId },
    });
}
