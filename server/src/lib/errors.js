export class AppError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}
export function fail(status, code, message, fields) {
  throw new AppError(status, code, message, fields);
}
export const notFound = () =>
  fail(404, "NOT_FOUND", "No encontramos este recurso.");
