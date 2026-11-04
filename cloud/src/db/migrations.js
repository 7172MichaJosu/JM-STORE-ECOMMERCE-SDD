export const expectedSchemaVersion = 2;
export const migrationFiles = Object.freeze([
  "0001_commerce.sql",
  "0002_migration_control.sql",
]);
export async function deploymentState(db, identity) {
  const state = await db.first("SELECT * FROM deployment_state WHERE id=1");
  if (
    !state ||
    state.database_identity !== identity ||
    state.schema_version !== expectedSchemaVersion
  )
    throw Object.assign(Error("El almacenamiento no está listo."), {
      status: 503,
      code: "STORE_NOT_READY",
    });
  return state;
}
export function selectMigrations(applied) {
  if (applied.some((x) => !migrationFiles.includes(x)))
    throw Error("Versión de esquema inesperada.");
  if (applied.some((x, i) => x !== migrationFiles[i]))
    throw Error("Ledger no ordenado.");
  return migrationFiles.slice(applied.length);
}
