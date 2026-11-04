# Research: Workers, D1 y conservación de JM-STORE

Fecha: 2026-11-04. Evidencia: inspección del repositorio y documentación primaria.
Las decisiones de Clarify se mantienen; no se consultó ni modificó una cuenta Cloudflare.
La skill Plan requirió un agente de investigación para contrastar estas tecnologías.

## R1. Runtime y adaptación de Express

**Decision**: mantener Express5 y adaptarlo con `httpServerHandler` de `cloudflare:node`;
entrada cloud separada, factory y repositorios async con D1. Compatibility date propuesta
2026-11-04; Node compatibility está habilitada por defecto para fechas>=2026-08-04.

**Rationale**: la guía oficial soporta Express y acceso a bindings. El `app.js` local abre
SQLite y usa fs/sendFile, por lo que no es una entrada portable. Adaptar solo el listener
no resuelve esas dependencias ni las transacciones síncronas.

**Alternatives considered**: reescribir con otro router agrega cambios sin beneficio
requerido; alojar el servidor Node local como dependencia contradice independencia.

Fuentes: [Express en Workers](https://developers.cloudflare.com/workers/tutorials/deploy-an-express-app/),
[HTTP Node](https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/),
[compatibilidad crypto](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/).

## R2. React/Vite y recursos estáticos

**Decision**: build Vite actual distribuido como Workers Static Assets, mismo origen para
API y UI; worker-first solo `/api` y `/api/*`, SPA para navegación cliente. Manifest de
imágenes importado al compilar, sin filesystem runtime.

**Rationale**: conserva componentes, imágenes y rutas. API404 debe quedar fuera de la
regla SPA. Cabeceras estáticas se configuran separadamente de Helmet.

**Alternatives considered**: Pages separado requiere dos despliegues sin necesidad;
SSR o migración de framework no aporta al alcance aprobado.

Fuentes: [routing SPA](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/),
[worker-first](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/).

## R3. D1 asíncrono y checkout atómico

**Decision**: prepared statements por binding `DB`, batch transaccional con guardas SQL
de versión/stock, operaciones por conjuntos y respuesta idempotente en el mismo commit.
No transacción interactiva Node entre awaits; no lock de memoria como garantía.

**Rationale**: D1 batch revierte ante fallo SQL. Cero filas afectadas no es fallo SQL;
se necesita assertion/trigger que aborte. Carrito existente admite100 líneas: serializar
cada línea en varias consultas excedería el presupuesto Free; JSON por conjuntos evita
ese crecimiento de sentencias. Es una decisión del diseño que deberá probarse.

**Alternatives considered**: comprobar conflictos después de batch permite commits
parciales; Durable Object como coordinador no sustituye la integridad en D1 y agrega
un servicio; dividir una venta en varios commits rompe atomicidad.

Fuentes: [D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/),
[D1 SQL](https://developers.cloudflare.com/d1/sql-api/sql-statements/),
[D1 límites](https://developers.cloudflare.com/d1/platform/limits/).

## R4. Hashes y límite de recursos: gate R-AUTH

**Decision**: preservar exactamente el formato actual
`scrypt$131072$8$1$<salt-hex>$<derived-key-hex>` y comprobar con native node:crypto.
No convertir hashes a PBKDF2 ni reducir N. Un cambio de KDF no puede conservar el login
existente solo transformando un hash, sin conocer la contraseña original.

**Rationale**: crypto scrypt está soportado oficialmente; Argon2 no lo está. Sin embargo,
el código actual permite maxmem192MiB y el área de trabajo aproximada `128*N*r` es128MiB.
Workers anuncia128MB/isolate y Free10ms CPU/request. La cifra de trabajo es una estimación
técnica, no una medición de consumo ni una prueba de imposibilidad del runtime alojado.
El límite actual workerd de coste N*r*p es2^20, exactamente el coste de estos parámetros.
Su scrypt con callback invoca la derivación nativa antes de resolver la promesa; async
no demuestra que quede fuera del presupuesto CPU.

**Resolution of unknown**: existe API compatible y se elige conservar la credencial;
la viabilidad alojada gratuita sigue como criterio de aceptación R-AUTH, no como hecho
aprobado. Durante Implement se mide primero con cuentas sintéticas, una y varias
invocaciones concurrentes, antes de importar datos reales. No se creó un Worker para
medir en Plan. Si falla, detener release y solicitar decisión SDD de arquitectura o
coste; pagar más CPU no aumenta por sí solo el límite de memoria anunciado. No hay
proveedor externo ni activación/reset de cuentas autorizado por este diseño.

**Alternatives considered**: KDF más barato degrada seguridad y no verifica hashes
migrados; hash calculado solo en navegador no sustituye verificación segura de servidor;
verificador dependiente del equipo local viola independencia. Servicio de identidad o
credenciales nuevas cambia alcance y requiere decisión explícita.

Fuentes: [crypto Workers](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/),
[límites Workers](https://developers.cloudflare.com/workers/platform/limits/),
[scrypt Node](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback),
[workerd límite](https://github.com/cloudflare/workerd/blob/main/src/workerd/io/limit-enforcer.h),
[workerd scrypt](https://github.com/cloudflare/workerd/blob/main/src/node/internal/crypto_scrypt.ts).

## R5. Sesiones y cambio de credenciales

**Decision**: D1 es autoridad de sesiones y rate limits; cookie con nombre propio y
namespace online, versiones de autenticación y control de concurrencia. Password change
es batch indivisible con revocación total/auditoría; correo solo no fuerza logout.

**Rationale**: no conservar MemoryStore ni sesiones en isolates efímeros. La verificación
de password antes del batch exige CAS contra el hash/version todavía vigente. Migrar
sesiones usables podría transportar acceso entre entornos; se conserva su dependencia
de carritos, pero se marca namespace importado no autenticable.

**Alternatives considered**: JWT sin revocación inmediata no satisface Clarify; guardar
la sesión solo en navegador no permite revocación. Correo externo descartado por Clarify.

Fuente para secretos: [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/).
Las reglas concretas de sesión y credenciales provienen de Constitution/spec actuales.

## R6. Migración y recuperación

**Decision**: snapshot consistente de SQLite, baseline D1 separado y copia única con
manifiesto/checkpoints. No importar un dump SQLite sin filtrar pragmas/transacciones y
sin validar constraints. Exports privados y bookmark antes de migración; ensayo de restore
en destino nuevo. No sincronizar después del corte.

**Rationale**: D1 tiene herramientas de import/export y migraciones ordenadas. FK se
mantienen activas; las dependencias se ordenan o difieren con el mecanismo soportado,
sin confiar en desactivar foreign_keys. Time Travel está activo, Free conserva7días y
no clona una base a otra; el restore en base separada usa export/import. Datos y secretos
no son artifacts del repositorio público.

**Alternatives considered**: seed sobre datos operativos puede sobrescribir stock;
Time Travel como única copia no cubre30días ni recuperación aislada; importar sobre D1
con nuevas ventas causaría pérdida o mezcla de estados.

Fuentes: [import/export](https://developers.cloudflare.com/d1/best-practices/import-export-data/),
[migraciones](https://developers.cloudflare.com/d1/reference/migrations/),
[FK](https://developers.cloudflare.com/d1/sql-api/foreign-keys/),
[Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/).

## R7. Free, recursos independientes y GitHub

**Decision**: Worker/D1 y staging nuevos en misma cuenta; no registrar rutas sobre el
proyecto viejo. Workers Builds conectado al repositorio JM-STORE-ECOMMERCE-SDD con rama
de producción main solo después de validar. Migración nunca se liga automáticamente al
push. Config Wrangler explícita se creará en Implement, no en este documento.

**Rationale**: Builds admite integración GitHub y Free incluye3000min/mes con una
compilación concurrente. Los budgets D1 compartidos exigen reservar capacidad sin tocar
el proyecto previo. Inventario remoto futuro se hará con CLI conforme AGENTS.md; no se
asumen cuenta autenticada, disponibilidad de nombres o cuota libre.

| Límite verificado | Free, al 2026-11-04 | Consecuencia del diseño |
|---|---|---|
| Workers dinámico | 100000 requests/día,10msCPU,128MB/isolate | medir auth; reducir trabajo y servir assets fuera de API |
| D1 por invocación | 50 consultas;100 parámetros/sentencia | batch por conjuntos, presupuesto checkout<=30 |
| D1 diario | 5M filas leídas,100k escritas | índices/paginación; contar sesiones y rate limit |
| D1 almacenamiento | 500MB/base,5GB y10 bases/cuenta | dos targets nuevos solo si hay cuota disponible |
| Recuperación | Time Travel7días | export privado adicional30días |

Estos límites no son una garantía de capacidad libre ni de rendimiento. Los límites
diarios agotados producen errores y deben bloquear operaciones de forma segura. Revalidar
antes de implementar, sin activar upgrades ni borrar recursos antiguos.

**Alternatives considered**: GitHub Actions para desplegar requiere token adicional;
Builds nativo evita esa copia de credenciales. Se conservan verificaciones de PR, sin
acceso a producción. No seleccionar un Worker existente por coincidencia de nombre.

Fuentes: [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/),
[GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/),
[Builds pricing](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/),
[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/),
[D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

## Cierre de investigación

No quedan decisiones técnicas sin estrategia documentada ni marcadores NEEDS CLARIFICATION.
R-AUTH es el principal riesgo conocido y una validación de release aún no ejecutada.
No se afirma viabilidad gratuita, éxito de migración, pruebas aprobadas ni despliegue.
Si el gate falla durante implementación, no se acepta una excepción implícita.
