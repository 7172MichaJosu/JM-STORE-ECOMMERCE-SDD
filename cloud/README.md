# JM-STORE cloud

Workspace independiente; `npm start` conserva Node/Express/SQLite. Configs remotas están
deshabilitadas: account_id y database_id vacíos, workers_dev=false, sin routes y
REMOTE_ENABLED=false. Los scripts de este workspace se limitan a build dry-run, emulador
y pruebas locales. No existe comando de despliegue remoto autorizado en esta etapa.

Desde raíz: `npm run cloud:build`, `npm run cloud:test`, `npm run cloud:test:e2e`.
Para usar la tienda emulada: `npm run cloud:prepare-local` aplica migraciones a D1 local,
crea secretos cloud privados si faltan y carga20 productos/5 categorías sintéticos.
Después `npm run cloud:dev` abre http://localhost:8787. D1 persiste independientemente
en cloud/.wrangler/local/v3; repetir preparación no cambia stock editado ni secretos.
No se carga SQLite real ni `.env.local`. Los tests preparan su D1 temporal separada.

La tienda emulada permite registro/login, perfil/direcciones, catálogo/carrito, pago
simulado rechazado/aprobado y pedidos. Administración cloud y Mi cuenta → Seguridad
siguen pendientes de sus fases posteriores a R-AUTH; la API devuelve503 si un admin
accede a módulos cloud no adaptados. El panel y cuentas locales existentes siguen en3001.

Secrets de desarrollo irán en cloud/.dev.vars (ignorado): QUOTE_SECRET y RATE_LIMIT_SECRET
de al menos32bytes distintos. Nunca usar valores reales en tests, VITE_* o repositorio.
Cada ambiente necesita su origen exacto, namespace e identidad D1 independientes.
La configuración de producción permanece sin destino hasta autorización expresa.

No copiar un token local a Cloudflare. La allowlist de destinos será un archivo privado
cloud/deploy/targets.local.json revisado por operador. `cloud:targets:check` no tiene target
por defecto y falla si faltan identidad o evidencia. No consulta Cloudflare por sí solo.
Cuando corresponda, la CLI será cf hasta existir config Wrangler; con estas configs se
usará Wrangler explícito. El proyecto antiguo no se selecciona ni modifica.
