# Implementation Plan: JM-STORE en Cloudflare Workers y D1

**Branch**: `002-cloudflare-workers-d1` | **Date**: 2026-11-04 | **Spec**: [spec.md](spec.md)

**Input**: feature 002, Constitution 1.1.0 y decisiones vigentes de Clarify, incluida
Firebase Authentication base Spark para la aplicación online.
El identificador de feature es lógico; la rama Git inspeccionada sigue siendo `main`.

## Summary

Distribuir React/Vite mediante Workers Static Assets y atender `/api/*` con Fetch nativo
y un dispatcher pequeño de rutas/middleware propio del paquete cloud. Retirar el puente
`cloudflare:node/httpServerHandler` del bundle remoto. Añadir un paquete cloud
con entrada y persistencia D1 propias, manteniendo operable el modo Node/Express/SQLite.
Conservar módulos, reglas, imágenes, colores, temas y recorrido de compra existentes.

Se creó un Worker y una D1 nuevos para staging en la misma cuenta; ningún recurso,
binding, ruta o secreto del proyecto antiguo se reutilizó o modificó. La copia real
permanece bloqueada por R-AUTH; cuando se autorice, migrar una copia
única validada; después del corte los datos online y locales son independientes.
Firebase administra registro/login y contraseñas mediante Auth REST desde Worker; D1
conserva perfiles comerciales, roles y sesiones. El runtime cloud deja de ejecutar el KDF
local; SQLite y sus cuentas mantienen su autenticación. Diseño detallado:
[contracts/firebase-auth.md](contracts/firebase-auth.md).

**Estado del diseño**: Phase 0/1 reconciliadas con Clarify. El bloqueo anterior
P-FIREBASE-EMAIL queda resuelto documentalmente: verificar destino antes de cambiar
correo, reservarlo temporalmente en D1, separar cambios y exigir login tras revocar sesiones.
No hay excepción a Constitution ni aclaración funcional pendiente. R-AUTH, R-EMAIL y
R-IDENTITY siguen como gates de ejecución: este Plan no acredita CPU, revocación, entrega
de enlaces ni compatibilidad de hashes. No autoriza operaciones remotas.

**Estado de implementación (2026-11-04)**: T001–T033 y T048–T056 completadas; T034 ejecutada
parcialmente y pendiente por R-AUTH. El Worker y D1 nuevos están activos solo en staging;
D1 tiene 5 categorías y 20 productos sintéticos, sin usuarios ni pedidos reales. La suite
alojada pasó 3/3, pero el scrypt de registro/login observó hasta 602/522 ms de CPU
(promedios 451.75/435 ms), por encima del límite Free de 10 ms por invocación. No hubo
1102; el uso de memoria por invocación no está disponible en esos agregados. La
importación real queda bloqueada. No se migraron datos reales. US3 (Mi cuenta → Seguridad)
se implementó y verificó sobre D1 emulada con cuentas sintéticas; no fue desplegada. La
sesión/roles de US1 ya terminados permiten ese trabajo local independiente, conforme a la
instrucción del propietario de priorizar T048–T056. Suite cloud36/36, E2E cloud6/6,
integración SQLite20/20 y E2E SQLite9/9; el CRUD administrativo cloud restante está pendiente.
Se conservan hashes y parámetros; no se debilitan ni se reinician contraseñas para cumplir
cuotas. La evidencia anterior corresponde al adaptador scrypt, no prueba Firebase.
La decisión Firebase sustituye ese diseño cloud; los nuevos gates no se han ejecutado.
T048–T056 conservan evidencia histórica; adaptar esos módulos a Firebase requerirá futuras
tareas y pruebas. Esta revisión no cambia tasks.md ni acredita funcionalidad nueva.

## Technical Context

**Revisión autorizada 2026-11-05, entrega 2026-11-06 08:00 America/Lima**: los intentos
con Express/HTTP Node consumieron 15/19 ms de CPU en registro. Se adopta Fetch nativo
solo en cloud, conservando handlers, contratos JSON, repositorios D1 y controles de
seguridad. El servidor Express/SQLite local permanece independiente. Los checkpoints
anteriores de este documento son históricos cuando describen el adaptador HTTP.

El dispatcher cloud compila las rutas una vez; admite únicamente el subconjunto usado
por los módulos existentes: métodos HTTP, parámetros y montaje de middleware por
segmentos completos. Los objetos de contexto y respuesta conectan esos handlers con
Request/Response, sin sockets ni emulación de servidor Node. Debe esperar todos los
middleware async y propagar fallos al error handler uniforme. Cookies HttpOnly/Secure,
SameSite=Lax, CSRF/Origin, autorización D1, lookup/revocación Firebase y límites de
intentos se mantienen. El parser JSON impone 100 KiB por streaming, rechaza JSON
malformado con 400, tipo de cuerpo no soportado con 415 y tamaño excesivo con 413;
queries repetidas permanecen arrays para no eludir validaciones. HEAD conserva headers
y omite body. Cabeceras de seguridad equivalentes a las actuales.

No se añaden dependencias de runtime. Web Crypto y las utilidades Node crypto existentes
siguen disponibles con nodejs_compat; no se debilitan firmas, claves ni revocación.
No cambia esquema D1, namespace ni identidad/rol del administrador personal.

Pruebas previas: contratos de dispatcher/parser y regresión Worker completa; luego E2E
Firebase y local. Tras respaldo nuevo verificado, publicar solo staging con secretos
actuales; medir CPU de registro/login, compras simuladas y administración con identidades
sintéticas, incluyendo password y revocación sobre ADMIN sintético. Conservar evidencia
de cola real y Analytics, diferenciando CPU de wall time y ausencia de métricas.
El nuevo permiso autoriza repetir la medición pese al gate histórico fallido, sin
eliminarlo hasta contar con evidencia. No reaprovisionar al administrador personal.
El cambio de correo queda deshabilitado y pendiente según autorización de entrega;
esto no acredita FR-011/R-EMAIL. Migración real y producción continúan bloqueadas.
Las regresiones locales T074/T108 son independientes de R-EMAIL y pueden concluir para
esta entrega; su aprobación no equivale a aprobar el corte ni toda Phase 8.

Fuentes técnicas revisadas: [Fetch](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/)
y [límites Free](https://developers.cloudflare.com/workers/platform/limits/).

**Language/Version**: JavaScript ESM; Node 24.15+ de rama 24 y npm 11 en herramientas;
workerd en Cloudflare, compatibility date propuesta `2026-11-04`.

**Primary Dependencies**: React 19, Vite 7, React Router 7; Fetch/Web Crypto nativos en cloud;
Wrangler 4.157.0 fijado por lockfile; Vitest y la integración oficial Workers para pruebas D1.
Express y Helmet permanecen en el servidor local, sin entrar al bundle cloud.
Auth REST usa fetch y el verificador nativo Web Crypto. Sin ORM ni nuevo framework HTTP.
Admin SDK se limita a herramientas Node privadas de importación,
no al Worker. No añadir SDK Firebase al cliente en el diseño de backend REST/cookie.

**Storage**: SQLite local actual; D1 nueva por binding `DB`; imágenes y manifiesto público
en Static Assets (`client/dist`). Firebase conserva credenciales; D1 enlaza UID/perfil/rol
y guarda tokens por sesión cifrados AES-GCM con clave fuera de la base. Sin Firestore,
Firebase Storage, imágenes en D1 ni nuevo servicio R2.

**Testing**: suites actuales node:test, Playwright y axe; contratos cloud y pruebas D1
aisladas; JWT firmados sintéticos y mocks locales, pruebas posteriores de Spark para
importación scrypt, revocación y cuotas. Medición alojada solo en staging nuevo sintético.
El emulador Firebase no demuestra importación de hashes ni revocación reales.

**Target Platform**: Worker HTTPS con frontend y API del mismo origen; hostname inicial
Workers `workers.dev`, sin configurar dominios del proyecto antiguo.

**Project Type**: aplicación web de comercio electrónico con modo local y modo cloud.

**Performance Goals**: 100 productos de referencia, búsqueda p95<=2 s, compra<4 min,
360/1280 px y cero sobreventa en 100 intentos concurrentes/repetidos. Latencia de usuario
y CPU de Worker se miden por separado.

**Constraints**: únicamente servicios gratuitos; capacidad y disponibilidad no garantizadas. Consulta oficial del 2026-11-04:
Workers 100 000 solicitudes dinámicas/día, CPU10ms y memoria128MB/isolate; D1 5 millones
de filas leídas/día, 100 000 escritas/día, 500MB/base y 5GB/10 bases por cuenta. El consumo
del proyecto antiguo cuenta para las cuotas compartidas. Fuentes en [research.md](research.md).

**Scale/Scope**: preservar carrito de 100 líneas con cantidades1..99, datos migrados sin
limitar a los 20 productos demo; no pagos reales, sincronización continua o carga arbitraria de imágenes. Firebase base
Spark es la única integración de identidad aprobada. No Identity Platform, Blaze ni otros
servicios de pago. No cambiar planes automáticamente; se utiliza el proyecto Firebase
Spark creado por el propietario, sin crear otro ni modificar la cuenta personal.

## Constitution Check

*GATE: revisión previa a Phase 0 y posterior al diseño Phase 1.*

| Principio / restricción | Antes de investigación | Después del diseño |
|---|---|---|
| I. SDD | PASS: spec y Clarify presentes | PASS: únicamente artefactos Plan |
| II. Datos consistentes | PASS: SQLite se conserva y D1 se diseña | PASS: copia única, batch con guardas y reconciliación |
| III. Seguridad | PASS: destino verificado y sin secretos públicos | PASS documental: enlace previo, reserva D1, cambios separados, reautenticación, revocación total y reconciliación |
| IV. Recorrido completo | PASS: se conservan módulos | PASS: contratos de catálogo, clientes, carrito, inventario y pedidos |
| V. Calidad y recuperación | PASS: validación aislada | PASS: matriz de pruebas, backup y restore |
| Diseño y accesibilidad | PASS: referencia conservada | PASS: mismo cliente, teclado, axe y ambos temas |
| Aislamiento Cloudflare | PASS: nuevos recursos | PASS: allowlist, IDs y rutas propios |
| Migración sin pérdida | PASS: origen intacto | PASS: snapshot cerrado, importación validada y recuperación |

Los PASS son documentales, no pruebas ejecutadas. La revisión posterior Phase 1 satisface
Constitution 1.1.0 y FR-006/010–018 sin excepciones: Firebase mantiene hashing especializado,
y SQLite conserva scrypt y datos. Correo pendiente no cambia identidad; al verificar se
reconcilia con D1 y se cierran sesiones. R-AUTH/R-EMAIL/R-IDENTITY quedan pendientes y
bloquean publicación/migración, no la conclusión documental de Plan. Una prueba fallida
vuelve al artefacto SDD correspondiente.

## Project Structure

### Documentation (this feature)

```text
specs/002-cloudflare-workers-d1/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── contracts/
    ├── api.md
    ├── firebase-auth.md
    ├── ui.md
    └── operations.md
```

No se genera ni modifica `tasks.md` en esta actualización Plan.

### Source Code (repository root)

Estructura existente y ampliaciones propuestas; se continúa sobre lo implementado, sin
reiniciar el paquete cloud. Los nuevos adaptadores Firebase no se crean en esta fase:

```text
client/                        # actual; agrega AdminSecurityPage y navegación
server/                        # modo Node/SQLite y scripts actuales
shared/domain/                 # reglas puras compartidas: dinero, validación, estados
cloud/
  package.json
  wrangler.jsonc               # producción nueva, sin secretos
  wrangler.staging.jsonc       # Worker/D1 de prueba propios
  wrangler.local.jsonc         # emulación local sin IDs remotos
  src/
    worker.js                  # routing Assets/API y adaptador HTTP
    app.js                     # fábrica Fetch sin sockets, fs ni node:sqlite
    http/router.js             # dispatcher nativo y respuesta/cookies
    config.js                  # bindings y configuración por request
    repositories/              # D1 asíncrono y batch commands
    modules/                   # catálogo/auth/cliente/carrito/checkout/pedidos/admin
    security/                  # sesiones, CSRF, Firebase REST/JWT/cifrado y rate limit
    assets/                    # manifiesto JSON público importado en build
  migrations/                  # historial D1 independiente de SQLite
  scripts/                     # snapshot/import/verify/backup/release con target explícito
  tests/                       # workerd y D1 temporal
```

**Structure Decision**: separar adaptadores de runtime/persistencia y compartir funciones
puras sin efectos al importar. La extracción futura conserva contratos y pruebas locales.
Composición de rutas se hace inyectable/asíncrona; el Worker nunca importa la fábrica
actual que abre SQLite, lee `.env.local`, migra y sirve archivos con Node. No simular
la API síncrona de SQLite mediante promesas D1.

## Architecture and Delivery Design

### Frontend y entrada Fetch nativa

Usar el build Vite actual como Static Assets con fallback SPA. Enviar `/api` y `/api/*`
al Worker antes del fallback; API desconocida siempre JSON404. El Worker atiende
Request/Response directamente, sin puerto interno ni adaptador HTTP Node.
Configuración y bindings por request, sin estado mutable de
usuario compartido entre invocaciones.

Sustituir acceso SQL síncrono por repositorios async. Conservar middleware de validación,
formatos de errores y rutas. No usar express.static/sendFile, filesystem, migración al
arranque o lectura runtime de imágenes. Importar manifiesto público al compilar. Aplicar
CSP/HSTS y cabeceras de seguridad equivalentes también a assets; caché por
hash para estáticos y `no-store` para API privada/sesión/seguridad.

La respuesta cloud de `/auth/session` añade `capabilities.adminSecurity=true`. El cliente
trata ausencia como false: muestra la navegación de seguridad solo cuando el backend la
soporta. Así el mismo cliente conserva su navegación actual contra el servidor SQLite,
sin enlazar una API inexistente. La capacidad no sustituye autorización ADMIN en servidor.

### D1 y atomicidad

No usar transacciones interactivas `BEGIN IMMEDIATE` entre awaits. Operaciones de varias
tablas se agrupan con `DB.batch()`; guardas SQL/trigger generan un error que revierte el
lote completo. Un UPDATE que cambia cero filas no es un error: comprobarlo después del
commit en JavaScript permitiría persistencia parcial.

Checkout prepara un contexto de operación UUID con snapshot firmado y versiones. Una
guarda en el primer INSERT comprueba dentro del batch propietario, cuenta/sesión activas,
expiración, dirección, carrito/pedido, productos/promociones y stock para todas las líneas.
Escribir pedido, snapshots, intento, movimientos, historial, carrito e idempotencia en
operaciones por conjuntos usando JSON validado. No construir tres sentencias por cada
una de las 100 líneas. Presupuesto inicial <=30 consultas totales por invocación de
checkout, incluyendo lecturas previas; cada sentencia <=100 parámetros, respetando el
límite Free50. El diseño detallado y los abortos están en [data-model.md](data-model.md).

La respuesta idempotente se recupera después de autorizar y antes de exigir cotización
vigente. Una carrera por la misma clave reconsulta el resultado ganador; misma clave y
otro cuerpo produce409. No repetir una intención con clave nueva tras timeout. Lecturas
de autorización y mutaciones sobre primaria; read replication no se habilita en este MVP.

### Seguridad administrativa y autenticación

Mantener formularios React, /auth/register, /auth/login y /api/admin/me/security.
El Worker delega credenciales a Firebase Auth REST por HTTPS, sin derivar hashes. Verifica
ID tokens con RS256 nativo, kid de certificados oficiales, issuer/audience del proyecto,
sub, exp, iat y auth_time. Cachear solo claves públicas hasta max-age; rechazar alg/issuer
inesperados, tokens de otro proyecto/tenant, custom tokens y claves caducadas/desconocidas.
El rol ADMIN sigue en D1, nunca en el cuerpo o claims elegidos por cliente.

Correo ASCII trim/lowercase<=254 único; password12..128 sin trim y confirmación exacta.
Configurar Firebase policy Require12..128. CurrentPassword se verifica mediante nuevo
signInWithPassword en Firebase y UID exactamente igual al ADMIN de la sesión D1.

Password solo: batch D1 con CAS crea operación, bloquea cuenta, incrementa auth_version,
fija corte temporal y revoca todas sus sesiones; después llama accounts:update para
cambiar password. Firebase y D1 no comparten transacción. Fallo/timeout deja estado
RECONCILIATION_REQUIRED y acceso bloqueado hasta autenticar y conciliar identidad vigente.
No anunciar rollback remoto ni guardar/reintentar passwords. Solo tras resultado confirmado
y auditoría completada desbloquear sin restaurar sesiones, borrar cookie y pedir login.
El protocolo y recuperación están en [contrato Firebase](contracts/firebase-auth.md).

Correo solo: reautenticar mismo UID, adquirir reserva única D1 y crear operación
PENDING_VERIFICATION sin cambiar users.email ni revocar sesiones aún. Enviar
VERIFY_AND_CHANGE_EMAIL por Auth REST. El 202 significa solicitud aceptada, no entrega
garantizada. Usar manejador propio del enlace sin mutaciones en GET; comprobar código,
tipo y par de correos antes de consumirlo. CAS excluye confirmación/cancelación/expiración
concurrentes. Antes de aplicar, bloquear cuenta y revocar todas las sesiones; confirmar
UID/correo del proveedor y finalizar email/auditoría/reserva en un batch D1. Si es incierto,
RECONCILIATION_REQUIRED y acceso cerrado; login nuevo concilia el mismo UID.
Reserva compartida con emails actuales/importados y registros en curso: límite local
60 minutos sin extender por reintento. Confirmar, cancelar o expirar libera la reserva
solo con resultado conocido; estados inciertos la retienen hasta reconciliar.
Protocolo y carreras: [Firebase](contracts/firebase-auth.md) y [modelo](data-model.md).

Enviar correo y contraseña juntos devuelve 422 antes de reautenticar o mutar. Mientras
haya verificación pendiente no admitir otra operación de credenciales; completar o
cancelar la primera. Cambios completados requieren login nuevo antes del siguiente.
D1 protege rutas de JM-STORE; no reserva direcciones dentro de Firebase ni invalida un
código OOB remoto al cancelar localmente. Llamadas directas pueden causar colisiones o
deriva: nunca vincular por correo; revocar/bloquear y reconciliar por UID antes de dar
acceso. No añadir blocking functions, que requieren upgrade.

Cookie opaca aleatoria32bytes, hash D1, __Host-jm-sdd.sid, Secure/HttpOnly/SameSite=Lax,
Path=/ sin Domain. Mantener 8h absoluta/30min inactiva; visitante24h no persistente.
UID/proyecto se enlazan al usuario explícitamente, no por email. Tokens ID/refresh solo
cifrados por sesión en D1 con AES-GCM, AAD y secreto versionado fuera de DB; sin tokens
en navegador ni claves administrativas Firebase en Worker. No importar cookies locales.

Cada request privado verifica sesión/rol/estado/auth_version en primaria y consulta
accounts:lookup con el ID token para detectar desactivación/revocación del proveedor.
Renovar mediante Secure Token API cuando expire y guardar mediante CAS. Comprobar firma
no detecta por sí sola revocación. Comparar auth_time con corte D1 y estado Firebase;
misma fracción de segundo ambigua requiere login posterior. Probar en Spark sintético
que lookup de usuario expone validSince/passwordUpdatedAt con semántica suficiente; si
falla, ERROR R-AUTH. Proveedor caído falla cerrado, sin fallback scrypt. Guardas de batch
revalidan versión y sesión para impedir commit con identidad revocada.

CSRF y Origin exacto en escrituras incluyendo auth. Secrets independientes de cotización,
rate limit y cifrado de tokens. Rate limit D1: login10/15min, registro5/15min,
seguridad5/15min por admin+IP, checkout20/min y API300/min. La implementación histórica
US3 usó20/15min en seguridad; esa diferencia queda para futuras tareas Firebase, no se
considera ya corregida. IP del contexto confiable, no X-Forwarded-For del cliente.
Logs solo requestId/operación/IDs/resultado; nunca cuerpos, tokens, direcciones o passwords.

### Migración, respaldos y recuperación

Capturar snapshot final con API local detenida limpiamente; copiar/verificar conjunto
SQLite y WAL/SHM existente, registrar corte y hash y leer la copia. No resetear ni escribir
el origen. Comparar SC-003 antes de reanudar actividad local, para distinguir cambios
de usuario posteriores. La copia determina el estado de corte; no sincronizar después.

Ensayar importación en D1 local y staging sintético. El snapshot real va solo al destino
cerrado aprobado. Preservar IDs, hashes, precios, stock, relaciones, snapshots y carritos.
Antes de cuentas reales, R-IDENTITY importa hashes del código SQLite sin modificar origen
con STANDARD_SCRYPT, candidato N131072/r8/p1/key64/salt16. Probar login con password
original, rechazo de incorrecta y vínculo UID/roles sobre cuentas sintéticas en Spark
real; el emulador no basta. Si falla, bloquear migración sin resets ni KDF más barato.
Admin SDK Node privado con permisos de operador; ninguna clave administrativa en Worker.

Firebase y D1 requieren manifiesto conjunto user_id/project_id/UID. Preflight exhaustivo
de UID/email, reservas históricas y colisiones: importUsers no comprueba duplicados.
Reintentar solo después de conciliar estado, nunca sobrescribir ni vincular por email.
Ambos destinos permanecen cerrados hasta verificar; no existe transacción conjunta.
auth:export puede omitir hashes externos antes del primer login: conservar snapshot
original y manifiesto protegido, no depender de ese export como único backup.

Las sesiones copiadas quedan bajo namespace inerte y requieren login nuevo; el carrito
de cliente se restaura al entrar. No prometer continuidad de cookies invitadas entre
dominios. No sembrar datos sobre un import ni sobrescribir ventas online posteriores.

Lotes de importación con checkpoint atómico; reconciliar recuentos/digests por tabla,
FK, importes, stock, assets y acceso antes de abrir escrituras. Export protegido y restore
ensayado antes de cualquier cambio remoto, además de bookmark Time Travel. Free ofrece
7días de Time Travel; exports diarios y por release retenidos30días fuera de Git con
acceso restringido. No añadir R2 ni guardar datos reales en artifacts de CI.

Rollback de código solo con esquema compatible expand/contract. Restore de datos:
cerrar writes, exportar estado actual, identificar/reconciliar pedidos posteriores al
backup y restaurar únicamente el target nuevo. Una restauración no puede borrar ventas
sin contabilizarlas. Volver a SQLite no copia pedidos online automáticamente.

### Configuración desde GitHub y costes

Fuente `7172MichaJosu/JM-STORE-ECOMMERCE-SDD`. Nombres propuestos nuevos
`jm-store-ecommerce-sdd` / `jm-store-ecommerce-sdd-db`; staging usa sufijo `-staging`.
Producción no está creada. Staging existente usa Worker jm-store-ecommerce-sdd-staging
y D1 jm-store-ecommerce-d1-staging. Colisión implica otro nombre, nunca adoptar el recurso
antiguo. Mantener allowlist de account_id, Worker, UUID D1 y origen confirmados
por operador. No wildcard routes sobre zonas del proyecto anterior.

La futura configuración Wrangler fija compatibility date, Assets, DB, origen y targets.
Conforme AGENTS.md, interacción Cloudflare usa `cf` antes de existir config Wrangler;
una vez creada se permite Wrangler con `--config` explícito. Esta actualización Plan solo consulta
documentación y archivos; no opera recursos remotos. Firebase se creará en futura tarea
Implement autorizada, tras revisar este Plan y actualizar/aprobar Tasks, con autorización específica de creación. Spark base sin
cuenta de facturación, Identity Platform ni otros productos innecesarios. No se almacena
ningún secreto en estos documentos.

Workers Builds se conecta solo al nuevo Worker/repositorio. Primero rama de staging,
sin D1 producción; `main` para producción después de gates y aprobación de corte. Build
reproducible, tests y compilación antes del deploy; importación/migraciones separadas de
push automático. Un target cerrado solo abre tras verificar deployment_state. Pull
requests no reciben secretos ni datos productivos. Secrets de runtime y build se gestionan
en sus almacenes correspondientes, nunca VITE_* o archivos públicos.

Free Builds:3000min/mes y una compilación simultánea según investigación. Reservar cuota
para ambos proyectos; no borrar recursos antiguos ni cambiar planes si falta capacidad.
Medir filas leídas/escritas por ruta, sesiones, rate limit y limpieza. Límites agotados:
503 seguro sin falso éxito ni mutación parcial; no upgrade automático ni degradación
de seguridad. Revalidar límites al implementar.

### Gates de validación futura

| Gate | Evidencia necesaria antes de publicar |
|---|---|
| R-ISOLATION | Cuenta/Worker/D1/origen coinciden con allowlist y son ajenos al proyecto antiguo |
| R-AUTH | Auth REST/JWT/cifrado/lookup/refresh en Free: cold/warm y concurrencia con CPU<=10ms, memoria<=128MB, cuotas y sin1102; sin KDF de password en Worker |
| R-EMAIL | Spark sintético: enlace previo, reserva/colisiones, expiración/cancelación/replay, confirmación sin sesión original, reconciliación UID/email y revocación total; cambios separados |
| R-IDENTITY | STANDARD_SCRYPT exacto probado remotamente en Spark sintético; password original/UID/roles, colisiones y recuperación verificados |
| R-DATA | backup legible, restore probado, reconciliación completa y origen intacto |
| R-COMMERCE | rechazo/reintento, 100 intentos última unidad, idempotencia y rollback inyectado |
| R-SECURITY | roles, titularidad, CSRF, revocación total, carreras de credenciales y logs seguros |
| R-UX | 360/1280, temas, teclado, axe, rutas principales y p95 búsqueda<=2s |
| R-LOCAL | build y suites actuales conservan modo Node/SQLite |

La evidencia histórica se conserva; ningún gate Firebase se ejecutó en Plan. R-EMAIL
tiene diseño definido y validación pendiente. Fallo de gate bloquea release; R-AUTH no tiene fallback local, pago ni
downgrade aprobado. Los pendientes humanos SC-001/SC-002 de feature001
no se consideran completados por este Plan. Validación: [quickstart.md](quickstart.md).

## Trazabilidad de las decisiones aprobadas

| Specify / Clarify | Diseño Phase 1 | Validación futura |
|---|---|---|
| FR-006/018: Spark base, correo/password, sin upgrades | Firebase REST; cookies opacas; sin KDF cloud | R-AUTH y preflight Spark/cuotas |
| FR-006/012/013: UID y roles seguros | RS256, lookup, external_identities, rol/estado/auth_version D1 | JWT adversarios, revocación y roles falsos |
| FR-010/011: correo verificado antes de aplicar | OOB inspeccionado, CAS APPLYING y reconciliación por UID | R-EMAIL con destino ocupado y respuesta perdida |
| Clarify: reservar destino hasta fin/cancelación/expiry | registro único de claims + operación EMAIL, límite local 60min | carreras registro/cambio/cancelación/expiry y deriva externa |
| Clarify: separar correo/password y revocar todas las sesiones | rechazo combinado previo a efectos; nuevo login después de cada cambio | R-SECURITY, sesión actual y otros navegadores |
| FR-015..017: conservar cuentas/datos y bloquear importación real | STANDARD_SCRYPT sintético remoto, snapshot/manifiesto protegidos | R-IDENTITY/R-DATA antes de cualquier cuenta real |
| FR-001/003/019/020: aislamiento y continuidad | mismo cliente/diseño; adaptador cloud y D1 separados de SQLite | R-ISOLATION/R-LOCAL/R-UX |

Revisión documental completada; no equivale a aprobación de ejecución ni evidencia de
Firebase. El siguiente artefacto que requerirá actualización es Tasks, cuando se solicite.
No se reescriben tareas históricas ni se marcan nuevas tareas como completadas en Plan.

## Complexity Tracking

Sin violaciones de Constitution que justificar. El paquete cloud responde al aislamiento
solicitado. Guardas y SQL por conjuntos son necesarios para atomicidad D1 y carritos de
100 líneas. Se conserva Vite y Express local; cloud usa Fetch sin ORM u otro framework HTTP.
