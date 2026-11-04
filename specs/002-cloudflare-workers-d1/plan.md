# Implementation Plan: JM-STORE en Cloudflare Workers y D1

**Branch**: `002-cloudflare-workers-d1` | **Date**: 2026-11-04 | **Spec**: [spec.md](spec.md)

**Input**: feature 002, Constitution 1.1.0 y cuatro decisiones aprobadas en Clarify.
El identificador de feature es lógico; la rama Git inspeccionada sigue siendo `main`.

## Summary

Distribuir React/Vite mediante Workers Static Assets y atender `/api/*` con Express 5
usando el adaptador oficial `cloudflare:node/httpServerHandler`. Añadir un paquete cloud
con entrada y persistencia D1 propias, manteniendo operable el modo Node/Express/SQLite.
Conservar módulos, reglas, imágenes, colores, temas y recorrido de compra existentes.

Crear posteriormente un Worker y una D1 nuevos en la misma cuenta; ningún recurso,
binding, ruta o secreto del proyecto antiguo se reutiliza o modifica. Migrar una copia
única validada; después del corte los datos online y locales son independientes.
La nueva sección Mi cuenta → Seguridad verifica contraseña actual, cambia correo sin
enlace de email y revoca todas las sesiones al cambiar contraseña.

**Estado**: diseño de Phase 0 y Phase 1; no código ni recursos creados. La investigación
no acredita que el scrypt actual quepa en Workers Free. Se conservan hashes y parámetros;
el gate R-AUTH exige comprobarlo en runtime alojado antes de publicar. Si falla se detiene
el release y se requiere nueva decisión SDD sobre presupuesto o arquitectura. No se
debilitan hashes ni se reinician contraseñas para cumplir cuotas.

## Technical Context

**Language/Version**: JavaScript ESM; Node 24.15+ de rama 24 y npm 11 en herramientas;
workerd en Cloudflare, compatibility date propuesta `2026-11-04`.

**Primary Dependencies**: React 19, Vite 7, React Router 7, Express 5 y Helmet existentes;
adaptador oficial HTTP; Wrangler 4 fijado por lockfile futuro; Vitest y la integración
oficial Workers para pruebas D1. Sin ORM ni nuevo framework HTTP.

**Storage**: SQLite local actual; D1 nueva por binding `DB`; imágenes y manifiesto público
en Static Assets (`client/dist`). Sin imágenes en D1 ni nuevo servicio R2.

**Testing**: suites actuales node:test, Playwright y axe; contratos cloud y pruebas D1
aisladas; medición alojada solo sobre staging nuevo con datos sintéticos.

**Target Platform**: Worker HTTPS con frontend y API del mismo origen; hostname inicial
Workers `workers.dev`, sin configurar dominios del proyecto antiguo.

**Project Type**: aplicación web de comercio electrónico con modo local y modo cloud.

**Performance Goals**: 100 productos de referencia, búsqueda p95<=2 s, compra<4 min,
360/1280 px y cero sobreventa en 100 intentos concurrentes/repetidos. Latencia de usuario
y CPU de Worker se miden por separado.

**Constraints**: Free priorizado, no garantizado. Consulta oficial del 2026-11-04:
Workers 100 000 solicitudes dinámicas/día, CPU10ms y memoria128MB/isolate; D1 5 millones
de filas leídas/día, 100 000 escritas/día, 500MB/base y 5GB/10 bases por cuenta. El consumo
del proyecto antiguo cuenta para las cuotas compartidas. Fuentes en [research.md](research.md).

**Scale/Scope**: preservar carrito de 100 líneas con cantidades1..99, datos migrados sin
limitar a los 20 productos demo; no pagos reales, correo externo, sincronización continua
o carga arbitraria de imágenes. No activar pagos ni cambiar plan automáticamente.

## Constitution Check

*GATE: revisión previa a Phase 0 y posterior al diseño Phase 1.*

| Principio / restricción | Antes de investigación | Después del diseño |
|---|---|---|
| I. SDD | PASS: spec y Clarify presentes | PASS: únicamente artefactos Plan |
| II. Datos consistentes | PASS: SQLite se conserva y D1 se diseña | PASS: copia única, batch con guardas y reconciliación |
| III. Seguridad | PASS: sin secretos públicos | PASS de diseño: hashes intactos, reautenticación y revocación |
| IV. Recorrido completo | PASS: se conservan módulos | PASS: contratos de catálogo, clientes, carrito, inventario y pedidos |
| V. Calidad y recuperación | PASS: validación aislada | PASS: matriz de pruebas, backup y restore |
| Diseño y accesibilidad | PASS: referencia conservada | PASS: mismo cliente, teclado, axe y ambos temas |
| Aislamiento Cloudflare | PASS: nuevos recursos | PASS: allowlist, IDs y rutas propios |
| Migración sin pérdida | PASS: origen intacto | PASS: snapshot cerrado, importación validada y recuperación |

Los PASS son de consistencia documental. No acreditan ejecución ni compatibilidad de
scrypt en Free. No hay excepción constitucional aprobada: un fallo futuro de R-AUTH
produce ERROR y bloquea el corte; no autoriza publicar sin autenticación.

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
    ├── ui.md
    └── operations.md
```

No se genera `tasks.md` en Plan.

### Source Code (repository root)

Propuesta para implementación posterior; estos archivos no se crean ahora:

```text
client/                        # actual; agrega AdminSecurityPage y navegación
server/                        # modo Node/SQLite y scripts actuales
shared/domain/                 # reglas puras compartidas: dinero, validación, estados
cloud/
  package.json
  wrangler.jsonc               # producción nueva, sin secretos
  wrangler.staging.jsonc       # Worker/D1 de prueba propios
  src/
    worker.js                  # routing Assets/API y adaptador HTTP
    app.js                     # fábrica Express sin fs ni node:sqlite
    config.js                  # bindings y configuración por request
    repositories/              # D1 asíncrono y batch commands
    modules/                   # catálogo/auth/cliente/carrito/checkout/pedidos/admin
    security/                  # sesiones, CSRF, credenciales y rate limit
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

### Frontend y adaptación Express

Usar el build Vite actual como Static Assets con fallback SPA. Enviar `/api` y `/api/*`
al Worker antes del fallback; API desconocida siempre JSON404. Express usa
`httpServerHandler`; su puerto interno es una clave del adaptador, no un servidor local
necesario en producción. Configuración y bindings por request, sin estado mutable de
usuario compartido entre invocaciones.

Sustituir acceso SQL síncrono por repositorios async. Conservar middleware de validación,
formatos de errores y rutas. No usar express.static/sendFile, filesystem, migración al
arranque o lectura runtime de imágenes. Importar manifiesto público al compilar. Aplicar
CSP/HSTS y cabeceras de seguridad también a assets, que no atraviesan Helmet; caché por
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

Ruta `/admin/mi-cuenta/seguridad`; API `/api/admin/me/security`. Cambiar correo/password
separados o juntos, con currentPassword obligatorio y CAS sobre usuario/hash verificado.
Correo ASCII trim/lowercase<=254, único; password12..128 sin trim y confirmación exacta.
Correo cambia de inmediato sin email externo. Cambio de password: credencial nueva,
incremento auth_version, eliminación de todas las sesiones y auditoría dentro de un batch;
borrar cookie y solicitar nuevo login. Correo solo conserva sesión y refresca perfil.

Token aleatorio32bytes, hash en D1; cookie online distinta `__Host-jm-sdd.sid`, Secure,
HttpOnly, SameSite=Lax, Path=/ y sin Domain. Sesión8h absoluta/30min inactiva; sesión
visitante24h con cookie no persistente. Comprobar rol/estado/auth_version en cada request
privado. Crear sesión tras login solo si siguen vigentes usuario y hash verificados:
la carrera login/password-change no puede recrear una sesión revocada.

CSRF y Origin exacto en todas las escrituras incluyendo auth. Secretos de cotización y
HMAC de rate limit independientes. Rate limit persistente D1, no MemoryStore distribuido:
login10/15min, registro5/15min, seguridad5/15min por admin+IP, checkout20/min y API300/min.
Identidad IP procede del contexto confiable de Cloudflare, no X-Forwarded-For del cliente.
Logs solo requestId, operación, IDs y resultado; no cuerpos, direcciones ni credenciales.

### Migración, respaldos y recuperación

Capturar snapshot final con API local detenida limpiamente; copiar/verificar conjunto
SQLite y WAL/SHM existente, registrar corte y hash y leer la copia. No resetear ni escribir
el origen. Comparar SC-003 antes de reanudar actividad local, para distinguir cambios
de usuario posteriores. La copia determina el estado de corte; no sincronizar después.

Ensayar importación en D1 local y staging sintético. El snapshot real va solo al destino
cerrado aprobado. Preservar IDs, hashes, precios, stock, relaciones, snapshots y carritos.
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
No están creados ni comprobados; colisión implica escoger otro nombre, nunca adoptar el
recurso antiguo. Mantener allowlist de account_id, Worker, UUID D1 y origen confirmados
por operador. No wildcard routes sobre zonas del proyecto anterior.

La futura configuración Wrangler fija compatibility date, Assets, DB, origen y targets.
Conforme AGENTS.md, interacción Cloudflare usa `cf` antes de existir config Wrangler;
una vez creada se permite Wrangler con `--config` explícito. Ahora solo se consultó
documentación pública. No se almacena ningún secreto en los documentos.

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
| R-AUTH | scrypt exacto en staging alojado Free: registro/login/cambio y concurrencia sin incompatibilidad, CPU/memoria excesivos o error1102 |
| R-DATA | backup legible, restore probado, reconciliación completa y origen intacto |
| R-COMMERCE | rechazo/reintento, 100 intentos última unidad, idempotencia y rollback inyectado |
| R-SECURITY | roles, titularidad, CSRF, revocación total, carreras de credenciales y logs seguros |
| R-UX | 360/1280, temas, teclado, axe, rutas principales y p95 búsqueda<=2s |
| R-LOCAL | build y suites actuales conservan modo Node/SQLite |

Todos están pendientes de ejecución en implementación. Fallo implica bloquear release;
R-AUTH no tiene fallback aprobado. Los pendientes humanos SC-001/SC-002 de feature001
no se consideran completados por este Plan. Validación: [quickstart.md](quickstart.md).

## Complexity Tracking

Sin violaciones de Constitution que justificar. El paquete cloud responde al aislamiento
solicitado. Guardas y SQL por conjuntos son necesarios para atomicidad D1 y carritos de
100 líneas. Se conservan Express y Vite y se evita añadir ORM u otro framework HTTP.
