# Research: Workers, D1 y conservación de JM-STORE

## Decisión vigente 2026-11-05: Fetch nativo para la entrega

Los intentos con el puente HTTP Node/Express excedieron 10 ms (15/19 ms en registro).
La autorización del propietario permite cambiar primero Plan/Tasks y sustituir solo
la entrada cloud. Se adopta Request/Response nativo con dispatcher mínimo, reutilizando
handlers/repositorios y controles; no se añade framework ni dependencia de runtime.
Express y SQLite permanecen en el servidor local. Las decisiones siguientes que
describen el puente Node son históricas y quedan sustituidas para cloud por esta revisión.
La adopción no acredita CPU por sí sola: se requieren pruebas y mediciones alojadas.
Fuentes: [Fetch](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/),
[CPU Free](https://developers.cloudflare.com/workers/platform/limits/).

Fecha: 2026-11-04. Evidencia: inspección del repositorio y documentación primaria.
Revisión Firebase de Plan: decisiones de Clarify conservadas y contrastadas con fuentes
oficiales. Esta revisión no consulta cuentas privadas ni modifica recursos.
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

## R4. Firebase Authentication y presupuesto Free

**Decision**: Firebase Authentication base Spark, correo y contraseña por Auth REST desde
Worker. Mantener rutas/formularios; no Firebase SDK cliente ni Admin SDK Worker. Tokens
solo en sesiones D1 cifradas. Contrato: [firebase-auth.md](contracts/firebase-auth.md).

**Rationale**: scrypt local N131072/r8/p1/key64/salt16 mantiene su protección. La evidencia
anterior alojada midió hasta602/522ms CPU en registro/login, excediendo Free10ms. Delegar
el KDF elimina ese trabajo del Worker sin cambiar hashes locales. Fetch, AES-GCM y RS256
siguen consumiendo recursos: medir cold/warm, refresh, lookup y concurrencia antes de
aprobar R-AUTH. Espera de red no equivale a CPU; afecta latencia, disponibilidad y cuotas.

**Alternatives considered**: Web SDK con persistencia LOCAL por defecto cambia el modelo
HttpOnly; se elige backend REST. PBKDF2 barato, hashes en cliente y bajar scrypt están
descartados. Scrypt en Worker ya falla el presupuesto medido. No Blaze ni Workers Paid.

Fuentes: [Auth REST](https://firebase.google.com/docs/reference/rest/auth),
[Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/),
[límites Workers](https://developers.cloudflare.com/workers/platform/limits/),
[persistencia cliente](https://firebase.google.com/docs/auth/web/auth-state-persistence).

## R5. Tokens, sesiones y compatibilidad del cambio de correo

**Decision**: validar RS256/issuer/audience/sub/tiempos con certificados oficiales de
Firebase cacheados según max-age. Roles/estado D1 por proyecto/UID, nunca email o claims
cliente. Firma válida no acredita sesión vigente. accounts:lookup comprueba el proveedor,
y D1 mantiene corte/auth_version, sesiones opacas y tokens cifrados. Probar lookup de
usuario Spark sintético: si no detecta revocación con fiabilidad, no aprobar R-AUTH.

**Rationale**: los ID tokens duran hasta una hora. Cambios de credenciales invalidan
refresh tokens; verificar solo firma no bloquea JWT ya emitidos. Cada request privado
comprueba D1/proveedor. Bloqueo de seguridad y guardas D1 impiden commits antiguos. Un
corte estricto y prueba del mismo segundo evitan reconstruir sesión con tokens previos.
Password solo requiere reautenticar en Firebase y comprobar mismo UID; preparar
operación/bloqueo/revocación D1 antes del cambio remoto y completar auditoría/reconciliación.
No hay transacción ACID entre Firebase y D1 ni rollback automático del proveedor.

**Decision — correo aprobada en Clarify**: verificar destino antes de actualizar, reservar
correo pendiente en D1, separar correo/password y revocar todas las sesiones al confirmar.
Se resuelve el bloqueo documental P-FIREBASE-EMAIL; R-EMAIL será prueba de ejecución.

**Rationale**: accounts:sendOobCode con VERIFY_AND_CHANGE_EMAIL, idToken de reautenticación
y newEmail no requiere IAM de runtime. accounts:resetPassword con solo oobCode inspecciona
tipo/email/newEmail; accounts:update con oobCode aplica. Un manejador propio comprueba
reserva/estado antes de aplicar, sin SDK cliente ni cambio en GET. EEP puede responder
éxito sin enviar si el destino está ocupado: 200 no acredita entrega ni disponibilidad.

**Alternatives considered**: cambio inmediato contradice Clarify; broker IAM o desactivar
EEP añade privilegios/riesgo. Envío combinado se rechaza antes de mutar. Reserva D1 con
registro único compartido por altas/imports cierra carreras entre rutas JM-STORE; vence
a los 60 minutos como límite local, no como promesa de caducidad Firebase.

**Límite comprobado**: D1 no bloquea signup directo Firebase; cancelar/expirar en D1 no
invalida necesariamente OOB remoto. No se adoptan blocking functions ni upgrade. Un UID
externo no enlazado no tiene acceso; colisiones bloquean el cambio, deriva UID/email
revoca sesiones y exige reconciliación antes de autorizar. No hay transacción Firebase/D1.
Ensayar código tardío/directo, replay, cancelación concurrente y destino ocupado sin
promover roles por email ni debilitar credenciales.

**Gate**: diseño coherente con FR-011; CPU, semántica de revocación y enlaces reales aún
pendientes en Spark sintético. Fallo no permite activar pagos ni debilitar seguridad.

Fuentes: [ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens),
[sesiones](https://firebase.google.com/docs/auth/admin/manage-sessions),
[accounts.lookup](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/lookup),
[UserInfo](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/UserInfo),
[sendOobCode](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/sendOobCode),
[comprobar OOB](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/resetPassword),
[aplicar OOB](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/update),
[manejador de correo](https://firebase.google.com/docs/auth/custom-email-handler),
[enumeración protegida](https://docs.cloud.google.com/identity-platform/docs/admin/email-enumeration-protection),
[API administrativa](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/projects.accounts/update).
Consultar referencias Identity Toolkit no requiere activar el upgrade Identity Platform.

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
push. Configs Wrangler ya existen; esta revisión no las modifica ni ejecuta CLI.

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

## R8. Spark, configuración y cuotas

**Decision**: Firebase Authentication base Spark, Email/Password y protección de enumeración.
No upgrade Identity Platform, Blaze, facturación vinculada ni servicios auxiliares de pago.
API key restringida a servicios usados; no es una credencial de autorización. No activar
Firestore/Storage/Functions/Analytics por defecto. Auth REST usa APIs Identity Toolkit
incluidas en Firebase; el nombre de la API no equivale a contratar Identity Platform.

**Rationale**: la documentación distingue Auth base del upgrade opcional Identity Platform.
La cuota de3000DAU corresponde al upgrade Spark, no se atribuye como límite de Auth base.
Revalidar cuotas del proyecto antes de configurarlo y detenerse ante requisito de pago.

| Cuota publicada al 2026-11-04 | Condición |
|---|---|
| Cuentas registradas | Sin máximo publicado de cuentas registradas; no implica throughput ilimitado |
| Nuevas cuentas | 100/hora por IP; el proxy Worker obliga a medir la IP efectiva para no asumir capacidad por usuario |
| Correos de verificación/cambio | 1000/día cada tipo en Spark, si el flujo aprobado los usa |
| Reset password | 150 correos/día; no se autoriza un reset masivo ni migración por esta vía |
| Intercambio de tokens | 18000/min/proyecto; sumar renovaciones y llamadas por sesión |
| Spark con upgrade Identity Platform | 3000DAU Tier1; upgrade explícitamente prohibido en este alcance |

El rate limit de Worker no protege accesos directos a la API key pública de Firebase:
configurar también cuotas/políticas del proveedor. El proxy consulta lookup por request
privado para seguridad; estimar tráfico, latencia, D1 y subrequests antes de publicar.
No caché de revocación ni degradación de seguridad para aparentar capacidad Free.

**Alternatives considered**: Blaze agrega riesgo de coste y no está autorizado; Identity
Platform no es necesario para Email/Password base. Proveedores adicionales no solicitados.

Fuentes: [Auth base y upgrade](https://firebase.google.com/docs/auth/),
[límites Auth](https://firebase.google.com/docs/auth/limits),
[API keys](https://firebase.google.com/docs/projects/api-keys),
[política password](https://firebase.google.com/docs/auth/web/password-auth).

## R9. Importación scrypt y recuperación de identidades

**Decision**: probar STANDARD_SCRYPT, distinto de SCRYPT modificado de Firebase. Candidato
memoryCost=131072, blockSize=8, parallelization=1, derivedKeyLength=64; salt16 y key64
se decodifican de hex a bytes. Parsear formato local exacto y rechazar parámetros distintos,
no normalizar ni transformar passwords. No presentar compatibilidad como demostrada.

**Rationale**: Firebase documenta importación de hashes standard scrypt y rehash propio al
primer login correcto. No se ejecuta la derivación local en Worker. Herramienta Node
privada importa como máximo1000 usuarios por llamada con manifiesto y resultados por
cuenta; un éxito parcial no abre la tienda. Preflight UID/email porque importUsers no
comprueba duplicados. Enlazar IDs de negocio/roles mediante manifiesto, nunca por email.
La prueba con cuenta sintética del mismo módulo local debe pasar remotamente en Spark,
además de password incorrecto, roles, reinicio, colisiones y reintento sin duplicación.

Conservar snapshot SQLite restaurable/hash/salt sin cambios y export/manifiesto privados.
Un auth:export Firebase puede omitir hash/salt de cuentas externas aún no rehasheadas;
no sustituye ese snapshot. Restaurar D1 nunca restaura credenciales Firebase antiguas:
reconciliar UID/estado vigente, cambiar namespace y revocar sesiones antes de abrir.

**Alternatives considered**: reset masivo, password temporal, plaintext o bajar N no están
aprobados. Incompatibilidad exacta mantiene R-IDENTITY bloqueado hasta nueva decisión de
recuperación verificada; no se añade tal alternativa por inferencia en Plan.

Fuentes: [importar usuarios](https://firebase.google.com/docs/auth/admin/import-users),
[CLI import/export](https://firebase.google.com/docs/cli/auth).

## Cierre de investigación

Phase 0 resuelve decisiones de diseño conforme a Constitution/Specify/Clarify. Phase 1
define registro/login, tokens/sesiones, correo pendiente/reservado, operaciones separadas,
reconciliación e importación sintética. No quedan decisiones de diseño por aclarar.
R-AUTH/R-EMAIL/R-IDENTITY son validaciones experimentales pendientes, no pruebas superadas.
Esta revisión no modifica spec/tasks/sistema ni crea recursos.
