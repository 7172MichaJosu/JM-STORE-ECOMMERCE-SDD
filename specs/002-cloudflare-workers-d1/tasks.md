---
description: "Tareas ejecutables para adaptar JM-STORE a Workers y D1"
---

# Tasks: JM-STORE en Cloudflare Workers y D1

**Input**: Design documents from `/specs/002-cloudflare-workers-d1/`

**Prerequisites**: Constitution 1.1.0, spec.md con Clarify, plan.md, research.md,
data-model.md, contracts/ y quickstart.md.

**Tests**: Incluidas antes del código por FR-021 y solicitud explícita. Implementar tests
contra D1 local/sintético primero y comprobar que fallan antes de cada cambio de historia.

**Organization**: Tareas agrupadas por las cinco historias priorizadas en spec.md.

## Formato

`- [ ] T### [P?] [US#?] Descripción concreta y ruta de archivo`

`[P]` solo marca tareas con archivos diferentes y sin dependencias pendientes. Toda tarea
de historia incluye su etiqueta [US#]. Las rutas son las propuestas en plan.md.

## Phase 1: Setup (estructura aislada)

**Purpose**: crear estructura de trabajo cloud y evitar que artefactos o secretos cloud
se mezclen con SQLite o entren a Git.

- [X] T001 Crear workspace `cloud/` ESM con scripts `cloud:build`, `cloud:test` y `cloud:dev` en `package.json` y `cloud/package.json`, sin cambiar `start` de Node/SQLite.
- [X] T002 Instalar y fijar Wrangler, Vitest y la integración Workers compatible con las versiones del plan; regenerar `package-lock.json` mediante `npm install --package-lock-only` después de T001.
- [X] T003 [P] Excluir `.dev.vars*`, `cloud/.wrangler/`, snapshots, exports D1, `.sqlite*`, fixtures con PII y reportes privados en `.gitignore`; conservar `.env.example` y datos/imágenes demo públicas.
- [X] T004 Crear configs separadas y sin secretos `cloud/wrangler.jsonc` y `cloud/wrangler.staging.jsonc`, con nombres nuevos, rutas propias, binding `DB` distinto y valores de cuenta/UUID vacíos que impidan despliegue hasta verificación.
- [X] T005 Crear estructura y documentación de ambiente en `cloud/README.md` y `cloud/src/config.js`: staging/prod explícitos, secretos por entorno, origen permitido y ausencia de target remoto por defecto.
- [X] T006 [P] Crear fixtures sintéticos sin PII para producto, cliente, carrito y pedido en `cloud/tests/fixtures/commerce.js`, independientes del seed SQLite real.

---

## Phase 2: Foundational (bloquea todas las historias)

**Purpose**: implementar contratos comunes y esquema D1 de forma verificable antes de las
rutas de tienda, importación o credenciales.

### Tests fundacionales primero

- [X] T007 [P] Escribir pruebas D1 locales de constraints y FK para roles, usuarios, catálogo, inventario, carritos, pedidos, pagos e idempotencia en `cloud/tests/unit/schema-contract.test.js`; comprobar inicialmente que fallan por falta de esquema.
- [X] T008 [P] Escribir tests de identidad de target que rechacen cuenta, Worker, UUID D1, origen o ambiente distinto de la allowlist y recursos nombrados como proyecto anterior en `cloud/tests/unit/target-guard.test.js`.
- [X] T009 [P] Crear pruebas de repositorio D1 async, errores por target cerrado y batch con rollback completo ante SQL inválido en `cloud/tests/integration/d1-foundation.test.js`.

### Implementación fundacional

- [X] T010 Crear migración baseline `cloud/migrations/0001_commerce.sql` y ledger `cloud/migrations/0002_migration_control.sql`, preservando `schema_migrations`, roles `CUSTOMER|ADMIN`, claves FK, CHECK, índices parciales `one_approval`/`one_sale`, triggers `cart_limit` y `payment_amount`; probar T007 antes de marcar completado.
- [X] T011 En `cloud/migrations/0001_commerce.sql`, reproducir literalmente los constraints de `data-model.md`: IDs `INTEGER` positivos; dinero `INTEGER` céntimos y `currency='PEN'`; fechas UTC ISO8601; email `UNIQUE`, ASCII `lower(trim(email))`, <=254; nombre cliente2..100, teléfono opcional7..20, password12..128 sin trim y hash requerido; SKU1..64 `UNIQUE`, slug `UNIQUE`, producto2..120, descripción1..4000, categoría2..80; imágenes alt no vacío y posición0..3 `UNIQUE(product_id,position)`; stock0..1000000; carrito máximo100 líneas y cantidad1..99; dirección recipient2..100, teléfono7..20, region/province/district2..100, street5..200, reference<=200; checks de promoción, estados, totales y FK explícitas del modelo.
- [X] T012 Añadir tablas cloud `security_events`, `rate_limit_buckets`, `mutation_contexts`, `migration_runs`, `migration_chunks` y `deployment_state` con claves, enums y restricciones de `data-model.md` en `cloud/migrations/0002_migration_control.sql`; no guardar passwords, hashes temporales, cookies ni token de administración en tablas de auditoría.
- [X] T013 Crear registro y selección de migraciones ordenadas, con identidad DB, versión esperada y prohibición de ejecutar cambios automáticamente al importar el Worker en `cloud/src/db/migrations.js`.
- [X] T014 Definir interfaces async de catálogo, identidad, carrito, checkout, pedidos y admin en `cloud/src/repositories/index.js`; documentar compatibilidad de serializadores actuales en `cloud/src/repositories/README.md` sin alterar resultados SQLite.
- [X] T015 Añadir inicialización D1 por request y prepared statements vinculados en `cloud/src/db/connection.js`; jamás abrir filesystem, `node:sqlite` o `.env.local` desde el bundle cloud.
- [X] T016 Implementar errores uniformes, requestId, redacción de parámetros SQL y configuración de seguridad por ambiente en `cloud/src/middleware/errors.js`, `cloud/src/middleware/request-context.js` y `cloud/src/config.js`.
- [X] T017 Crear scripts de verificación de ambiente y allowlist con target obligatorio, modo dry-run y fallo cerrado en `cloud/scripts/targets.js`; antes de crear cualquier recurso debe usar `cf` mientras no exista config Wrangler y comprobar recursos antiguos como prohibidos.
- [X] T018 Ejecutar suites existentes definidas en `package.json` (`npm test`, `npm run test:integration`, `npm run test:e2e`) y nuevas pruebas en `cloud/tests/`; corregir regresiones en `server/tests/` antes de iniciar historias.

**Checkpoint**: baseline D1 pasa constraints/FK, los datos SQLite y configuración local no
se abren desde cloud, y cada mutación exige destino explícito.

---

## Phase 3: User Story 1 - Acceder a JM-STORE online (Priority: P1)

**Goal**: cliente usa catálogo, cuenta, carrito y compra simulada con los mismos resultados
del MVP; despliegue staging opera sin Node local y muestra JM-STORE.

**Independent Test**: en D1 sintética, cliente busca producto, agrega/cambia carrito, crea
dirección, registra pago rechazado, reintenta aprobado y revisa pedido/stock tras nueva
sesión; UI abre en computadora y teléfono.

### Tests for User Story 1 (primero)

- [ ] T019 [P] [US1] Crear tests de contrato para rutas existentes de salud, sesión, auth, perfil/direcciones, catálogo, carrito, checkout e historial en `cloud/tests/contract/customer-api.test.js`; afirmar formas/códigos de feature001 y correr en rojo antes de adaptadores.
- [ ] T020 [P] [US1] Añadir integración de API D1 para productos, stock, quote, pago REJECTED/APPROVED, idempotencia, precio cambiado y rollback en `cloud/tests/integration/customer-commerce.test.js`.
- [ ] T021 [P] [US1] Añadir Playwright del recorrido cliente, assets y rutas SPA/API404 sobre Worker local en `cloud/tests/e2e/customer-store.spec.js`; verificar cero compras contra SQLite real.

### Implementation for User Story 1

- [ ] T022 [US1] Crear reglas puras de dinero, promociones, validación y estados reutilizables en `shared/domain/`; añadir pruebas de paridad contra `server/src/lib/` sin cambiar reglas comerciales.
- [ ] T023 [US1] Implementar consultas de categorías, productos, búsqueda, filtros y precio vigente con sentencias preparadas async en `cloud/src/repositories/catalog.js`, conservando búsqueda, orden/paginación, 100 productos y montos en céntimos.
- [ ] T024 [US1] Adaptar alta/login/logout/sesiones a D1 en `cloud/src/modules/auth/` y `cloud/src/security/sessions.js`; conservar scrypt exacto `N=131072,r=8,p=1,keylen=64,salt=16`, solo hash de sesión en D1, expiración 8h/30min y registro solo CUSTOMER.
- [ ] T025 [US1] Adaptar perfil y direcciones propias a D1 en `cloud/src/repositories/customers.js`; validar los límites literales recipient 2..100, teléfono 7..20, region/province/district 2..100, street 5..200 y reference<=200, con 404 para datos ajenos.
- [ ] T026 [US1] Adaptar carrito persistente e invitado en `cloud/src/repositories/cart.js`; máximo100 líneas y cantidad1..99, validar versión/stock y restaurar carrito de cliente sin fusión silenciosa.
- [ ] T027 [US1] Implementar quote, confirmación y reintento en `cloud/src/repositories/checkout.js` usando `DB.batch()` y guardas D1 que abortan toda transacción; REJECTED no cambia stock, APPROVED confirma, escribe movimiento y descuenta una vez, carrito solo se limpia si su versión coincide.
- [ ] T028 [US1] Implementar order snapshots, historial y consultas de titularidad en `cloud/src/repositories/orders.js`; conservar estados `AWAITING_PAYMENT`, `CONFIRMED`, `PREPARING`, `SHIPPED`, `DELIVERED`, currency PEN y totales con `total_cents=subtotal_cents`.
- [ ] T029 [US1] Crear Express Worker factory en `cloud/src/app.js` y `cloud/src/worker.js` usando `cloudflare:node/httpServerHandler`; enrutar `/api` antes de Static Assets, devolver JSON404 API y fallback SPA para páginas cliente.
- [ ] T030 [US1] Distribuir `client/dist` como Static Assets y manifiesto local en `cloud/src/assets/`; aplicar CSP/HSTS/cabeceras a assets y `no-store` a respuestas privadas, sin `fs`, `express.static` o `sendFile`.
- [ ] T031 [US1] Adaptar rutas existentes al repositorio async en `cloud/src/modules/` y `cloud/src/api.js`; mantener contratos de feature001, CSRF/Origin y errores 401/403/404/409/422/429/503 sin exponer SQL.
- [ ] T032 [US1] Crear seed sintético idempotente de 20 productos/5 categorías en `cloud/scripts/seed-staging.js`; no ejecutar seed de demo sobre registros importados o stock gestionado.
- [ ] T033 [US1] Crear Worker y D1 NUEVOS de staging solo después del preflight T017; registrar IDs y binding `DB` en `cloud/deploy/staging-resources.md`; nunca seleccionar o editar recurso antiguo.
- [ ] T034 [US1] Desplegar únicamente a staging nuevo, ejecutar `cloud/tests/e2e/customer-store.spec.js` alojado y gate R-AUTH sintético de scrypt CPU/memoria/error1102 en `cloud/tests/e2e/hosted-auth.spec.js`; si falla, detener importación de datos reales y dejar release bloqueado.

**Checkpoint**: journey cliente completa contra staging sintético y modo local SQLite
conserva su build y suites. R-AUTH debe pasar antes de cualquier migración real.

---

## Phase 4: User Story 2 - Preservar datos existentes online (Priority: P1)

**Goal**: copiar una vez el estado SQLite a D1 y demostrar integridad, preservando el
archivo local como sistema independiente.

**Independent Test**: migrar fixture completo a D1 aislada, comparar recuentos, relaciones,
hashes y valores; autenticar cliente sintético, leer pedido y mantener origen intacto.

### Tests for User Story 2 (primero)

- [ ] T035 [P] [US2] Crear fixtures SQLite con todas las tablas 001..005, relaciones, imágenes, promos, hashes, sesiones y snapshots históricos en `cloud/tests/migration/fixtures/full-source.test.js`.
- [ ] T036 [P] [US2] Escribir pruebas de snapshot consistente con API detenida, integridad, SHA-256, WAL/SHM, fuente solo lectura y manifiesto sin credenciales en `cloud/tests/migration/snapshot.test.js`.
- [ ] T037 [P] [US2] Escribir pruebas de importación por chunks, FK, sesión inerte, reintento igual, contenido distinto, interrupción y checkpoint atómico en `cloud/tests/migration/import.test.js`.
- [ ] T038 [P] [US2] Añadir pruebas de backup, restore aislado y target equivocado sobre D1 sintética en `cloud/tests/migration/recovery.test.js`; ningún caso debe abrir producción ni usar PII real.

### Implementation for User Story 2

- [ ] T039 [US2] Implementar snapshot SQLite con proceso local detenido, integrity_check, copia conjunta DB/WAL/SHM, SHA-256 y cutoff en `cloud/scripts/snapshot.js`; lectura de la copia, nunca actualizar esquema/registro en el origen.
- [ ] T040 [US2] Generar manifiesto con versión fuente, tablas, conteos, rangos IDs, digests y columnas transformadas en `cloud/scripts/manifest.js`; no imprimir emails, direcciones, hashes o payloads privados.
- [ ] T041 [US2] Implementar export consistente de SQLite por PK y orden FK en `cloud/scripts/export-sqlite.js`, incluyendo exactamente productos, categorías, precios, promociones, stock/movimientos, clientes, direcciones, carritos, pedidos, pagos, historial e idempotencia.
- [ ] T042 [US2] Implementar importador D1 preparado por chunks y `migration_chunks` en `cloud/scripts/import-d1.js`; batch cada chunk y su checkpoint juntos, destinos Closed, filas sin duplicar y reanudación solo para mismo snapshot/DB.
- [ ] T043 [US2] Transformar sesiones importadas a namespace inerte en `cloud/scripts/transform-sessions.js`; preservar referencias que permiten contar/retener carritos, pero impedir autenticación mediante cookies locales; invalidar quotes antiguos.
- [ ] T044 [US2] Implementar reconciliación en `cloud/scripts/verify-import.js`: counts/digests por tabla, FK, total/stock, snapshots, imágenes y hashes sin exponerlos; cualquier diferencia mantiene `deployment_state=CLOSED`.
- [ ] T045 [US2] Implementar export D1 privado, bookmark de recuperación y restauración de ensayo en `cloud/scripts/backup-d1.js` y `cloud/scripts/restore-verify.js`; guardar fuera de Git, metadata privada y retención 30 días.
- [ ] T046 [US2] Ejecutar snapshot/import/verify/restore sobre SQLite fixture y staging sintética; probar parada/reanudación, integridad de fuente, carritos cliente y acceso con hash existente en `cloud/tests/migration/`.
- [ ] T047 [US2] Verificar capacidad de cuenta y destino nuevo, registrar identity allowlist y coste de staging/prod desde `cloud/scripts/targets.js`; no borrar bases ni degradar el proyecto antiguo si el plan Free no tiene capacidad.

**Checkpoint**: migración de fixture completa y recuperable; SQLite original nunca cambia.
La copia real queda como tarea de corte en la fase final, después de los demás gates.

---

## Phase 5: User Story 3 - Cambiar credenciales del administrador (Priority: P1)

**Goal**: sección Mi cuenta → Seguridad permite cambiar correo/password con reautenticación
y protección contra carreras.

**Independent Test**: en staging sintética, correo cambia inmediatamente sin email; password
nuevo inicia sesión, antiguo falla y todas las sesiones quedan revocadas.

### Tests for User Story 3 (primero)

- [ ] T048 [P] [US3] Añadir contrato de GET/PATCH `/api/admin/me/security`: permisos, currentPassword, email único, password12..128, confirmación, versión, errores 401/403/409/422 en `cloud/tests/contract/admin-security.test.js`.
- [ ] T049 [P] [US3] Añadir integración para cambio correo/password/ambos, correo dup, password actual erróneo, rollback de auditoría, sesión actual/otras y login concurrente con hash antiguo en `cloud/tests/integration/admin-security.test.js`.
- [ ] T050 [P] [US3] Añadir Playwright de navegación, validaciones, red lenta, respuesta perdida y logout forzado tras cambio en `cloud/tests/e2e/admin-security.spec.js`.

### Implementation for User Story 3

- [ ] T051 [US3] Implementar GET/PATCH de seguridad en `cloud/src/modules/admin/security.routes.js`; exigir ADMIN activo, currentPassword, CAS sobre user.version/password_hash/sesión y correo único <=254 normalizado.
- [ ] T052 [US3] Implementar batch atómico en `cloud/src/repositories/admin-security.js`: verificar la contraseña actual con los mismos parámetros scrypt, cambio inmediato de email sin email externo, password solo si 12..128, incremento `auth_version`, evento sin secretos y revocación de TODAS las sesiones en cambio de password.
- [ ] T053 [US3] Proteger carrera login/password-change en `cloud/src/security/sessions.js`; solo insertar sesión si siguen iguales usuario/hash/auth_version verificados; tras cambio de password expirar cookie actual y devolver `requiresLogin:true`.
- [ ] T054 [US3] Añadir capacidad aditiva `capabilities.adminSecurity=true` a `/auth/session` cloud y ausencia=false en `client/src/app/providers.jsx`; ocultar enlace en backend SQLite que no expone el endpoint.
- [ ] T055 [US3] Implementar página, formularios y navegación **Mi cuenta → Seguridad** en `client/src/pages/admin/AdminSecurityPage.jsx`, `client/src/components/admin/AccountNav.jsx` y `client/src/styles/`; no almacenar password/email nuevo en browser ni logs.
- [ ] T056 [US3] Ejecutar contrato, integración, carrera e2e de T048..T050 con fallos forzados; corregir serialización en `cloud/src/modules/admin/security.routes.js` y `client/src/pages/admin/AdminSecurityPage.jsx`, comprobar que API local conserva respuesta actual.

**Checkpoint**: la UI confirma correo inmediato; el cambio de password borra todas las
sesiones y obliga nuevo login, sin datos parciales aunque falle auditoría.

---

## Phase 6: User Story 4 - Administrar tienda y pedidos en cloud (Priority: P2)

**Goal**: todas las funciones administrativas existentes siguen funcionando mediante D1,
incluidos productos, categorías, imágenes, precios, promociones, stock, clientes y pedidos.

**Independent Test**: admin cambia producto/stock, cliente completa compra y ve estado; un
segundo login observa el cambio, y cliente/visitante no accede a operaciones admin.

### Tests for User Story 4 (primero)

- [ ] T057 [P] [US4] Portar contratos de summary, productos, imágenes, categorías, promociones, inventario, clientes y pedidos al Worker en `cloud/tests/contract/admin-api.test.js` antes de adaptar repositorios.
- [ ] T058 [P] [US4] Añadir integración de concurrencia de edits, version conflict, movimiento stock, límites de imagen, propiedad y desactivación de cliente en `cloud/tests/integration/admin-data.test.js`.
- [ ] T059 [P] [US4] Añadir Playwright del flujo producto/categoría/imagen/promo/stock/cliente/estado de pedido en `cloud/tests/e2e/admin-commerce.spec.js`.

### Implementation for User Story 4

- [ ] T060 [US4] Adaptar creación/edición/desactivación de productos con versión optimistic-lock en `cloud/src/repositories/admin-products.js`; respetar name2..120, descripción1..4000, SKU1..64 y precio1..100000000 céntimos.
- [ ] T061 [US4] Adaptar categorías y promociones en `cloud/src/repositories/admin-catalog.js`; nombre categoría2..80, exacto un product/category target, `PERCENT_BPS`1..9999, `FINAL_PRICE` positivo menor al base, fechas inicio<fin y no intervalos solapados.
- [ ] T062 [US4] Adaptar catálogo de imágenes en `cloud/src/repositories/admin-images.js` y `cloud/src/assets/manifest.json`; limitar rutas a manifiesto permitido, alt no vacío y posición0..3 sin upload abierto.
- [ ] T063 [US4] Adaptar inventario en `cloud/src/repositories/admin-inventory.js`; cantidad0..1000000, version esperada, cada cambio crea movimiento `ADJUSTMENT` con actor/delta/razón y conflicto no modifica stock.
- [ ] T064 [US4] Adaptar privacidad/desactivación de clientes en `cloud/src/repositories/admin-customers.js`; nunca devolver `password_hash`, prohibir promociones a ADMIN y revocar sesiones del usuario desactivado.
- [ ] T065 [US4] Adaptar estado e historial de pedidos en `cloud/src/repositories/admin-orders.js`; permitir solo CONFIRMED→PREPARING→SHIPPED→DELIVERED, registrar actor y prohibir cambios a pagos simulados.
- [ ] T066 [US4] Mantener panel y tablas actuales en `client/src/pages/admin/` usando capability cloud solo para seguridad; errores 403/409/429/503 visibles, sin cambiar comportamiento funcional local.
- [ ] T067 [US4] Ejecutar suites de T057..T059 y suites locales, verificar cada acción CRUD persiste y cliente recibe solo recursos propios; corregir en `cloud/src/repositories/admin-*.js` y `client/src/pages/admin/`.

**Checkpoint**: todos los módulos administrativos actuales operan sobre D1 y pasan permiso,
validación y concurrencia en staging.

---

## Phase 7: User Story 5 - Usar la tienda en computadoras y celulares (Priority: P2)

**Goal**: recorridos de cliente y admin conservan diseño JM-STORE, tema claro/oscuro,
accesibilidad, teclado y distribución a 360 px y escritorio.

**Independent Test**: ejecutar rutas cliente/admin a 360/1280, ambos temas, teclado y axe;
ninguna tarea crítica tiene overflow de página y el modo reducido desactiva animación.

### Tests for User Story 5 (primero)

- [ ] T068 [P] [US5] Expandir E2E de responsive/axe para catálogo, compra, seguridad y admin en `cloud/tests/e2e/responsive-accessibility.spec.js` con Viewports360/1280 y temas claro/oscuro.
- [ ] T069 [P] [US5] Añadir pruebas de teclado, foco, labels, prefers-reduced-motion y menús/tablas móviles en `cloud/tests/e2e/keyboard-accessibility.spec.js` antes de cambios de estilos.

### Implementation for User Story 5

- [ ] T070 [US5] Mantener tokens amarillo/azul/blanco, tema oscuro y foco AA en `client/src/styles/tokens.css`, `themes.css` y `accessibility.css`; reducir o apagar animaciones para `prefers-reduced-motion`.
- [ ] T071 [US5] Ajustar header, navegación, cards, mini-cart, checkout, tablas admin y formulario de seguridad en `client/src/styles/layout.css` y `components.css`; evitar overflow a 360..1280 px.
- [ ] T072 [US5] Corregir labels, orden de tab, foco visible, mensajes aria-live y contraste detectado por axe en `client/src/components/` y `client/src/styles/accessibility.css` sin eliminar acciones o datos.
- [ ] T073 [US5] Ejecutar todos los tests T068/T069 a 360/1280 y claro/oscuro en `cloud/tests/e2e/`; verificar teclado, reduced-motion, contraste y no overflow antes de marcar US5 completa.

**Checkpoint**: el recorrido de compra y administración sigue siendo reconocible como
JM-STORE en ambas dimensiones y temas; la accesibilidad se limita a pantallas verificadas.

---

## Phase 8: Polish, datos reales y corte controlado

**Purpose**: demostrar restauración y cuotas, conectar Workers Builds y abrir solo después
de completar stories y gates. El target remoto siempre es explícito.

- [ ] T074 [P] Ejecutar `npm run build`, `npm test`, `npm run test:integration`, `npm run test:e2e`, `npm run cloud:test` y `npm run cloud:test:e2e`; guardar resultados y corregir fallos en `specs/002-cloudflare-workers-d1/quickstart.md`.
- [ ] T075 [P] Medir scrypt exacto, error1102, CPU/memoria, D1 filas/consulta y p95 búsqueda con 100 productos/20 sesiones en `cloud/tests/performance/`; aprobar R-AUTH solo si runtime hosted Free cumple con margen, si no detener el release y registrar decisión en `specs/002-cloudflare-workers-d1/quickstart.md`.
- [ ] T076 [P] Escanear secretos, `.dev.vars`, snapshots, SQLite, exports, PII y permisos de archivos en el tree/GitHub workflow mediante `cloud/tests/security/repository-secrets.test.js`; corregir `.gitignore`/config antes de usar credenciales.
- [ ] T077 Ensayar export diario, Time Travel, restore staging, namespaces, expiración sesiones, firma quote y conciliación de escrituras posteriores en `cloud/tests/migration/recovery.test.js`; documentar tiempos y RPO/RTO en `cloud/README.md`.
- [ ] T078 Conectar Workers Builds únicamente a `7172MichaJosu/JM-STORE-ECOMMERCE-SDD` y al Worker nuevo usando el mecanismo autorizado de Cloudflare; fijar main/staging, `npm ci`, build/tests obligatorios, sin auto deploy inicial ni secrets en `.github/workflows/` o forks; documentar ID de conexión/configuración revisada en `cloud/deploy/builds.md`.
- [ ] T079 Verificar identidad de destino, nombre nuevo y cuota compartida con `cf`/script explícito antes de crear D1/Worker nuevos de producción; almacenar allowlist en `cloud/deploy/targets.json`, rechazar recurso antiguo y no borrar cuota del proyecto previo.
- [ ] T080 Crear backup privado verificable de SQLite `server/data/jm-store.sqlite` y archivos WAL/SHM usando `cloud/scripts/snapshot.js`; API local detenida limpiamente, integrity_check PASS, digest y manifiesto privado antes de leer/importar.
- [ ] T081 Aplicar migraciones y copia única del snapshot a D1 nueva en estado CLOSED con `cloud/scripts/migrate.js` y `cloud/scripts/import.js`; incluir todas tablas/relaciones, preservar hashes, stock, pedidos/pagos, no sembrar ni alterar la fuente SQLite.
- [ ] T082 Ejecutar reconciliación del snapshot con `cloud/scripts/verify-import.js`; comparar 100% recuentos, digests/fk, stock, importes y pedidos, login admin autorizado y restauración; diferencia mantiene producción CLOSED.
- [ ] T083 Desplegar build revisado desde GitHub al Worker de producción nuevo usando `cloud/scripts/release.js --target production`; rutas/origen/binding solo nuevos; no asociar custom domain del proyecto antiguo y mantener `deployment_state=CLOSED` hasta validaciones finales.
- [ ] T084 Ejecutar aceptación completa contra staging sintética en `cloud/tests/e2e/release-acceptance.spec.js`: journey<4min, admin security, roles, CRUD, checkout, 100 concurrencias, backup/restore, mobile/desktop/temas y carga Free; en Worker production Closed limitar smoke a health/catálogo público de solo lectura, sin crear cuentas, clientes, carritos u órdenes reales.
- [ ] T085 Obtener aprobación explícita del corte y abrir únicamente D1/Worker de producción mediante `cloud/scripts/release.js --target production --open`; guardar confirmación/IDs en `cloud/deploy/release-record.json`, sin cambiar ni cerrar el Worker antiguo.
- [ ] T086 Actualizar README y guías para instalación local, despliegue cloud, admin security, límites Free, monitor de cuotas, backup/restore/corte en `README.md`, `cloud/README.md` y `specs/002-cloudflare-workers-d1/quickstart.md`; conservar estado de todo criterio no medido como pendiente.

## Dependencias y orden de ejecución

### Grafo de fases

```text
Setup T001-T006
  └── Foundation T007-T018
       └── US1 T019-T034 (staging sintético; R-AUTH debe pasar para datos reales)
            ├── US2 T035-T047 (migración y recovery probados sintéticamente)
            ├── US3 T048-T056 (seguridad admin sobre auth cloud)
            ├── US4 T057-T067 (admin D1)
            └── US5 T068-T073 (responsive de customer/admin)
                 └── Polish T074-T086 (producción, copia y apertura controladas)
```

Todas las historias dependen de US1 y Foundation. US2, US3 y US4 pueden avanzar en
paralelo después de T034 si respetan sus propios archivos/repositorios y no modifican
simultáneamente el mismo router. US5 espera pantallas de todas las historias. T079..T085
son secuenciales: no crear producción antes de preflight, no importar antes de backup,
no abrir antes de reconciliar, probar y aprobar corte. R-AUTH fallido detiene T080..T085;
no hay fallback aprobado.

### Dependencias por historia

- **US1 (P1)**: Setup + Foundation; su staging nuevo prueba interfaz cliente y D1.
- **US2 (P1)**: US1 + baseline D1; primero fixture sintética, producción solo en Polish.
- **US3 (P1)**: US1 para sesión/roles cloud; puede desarrollarse junto a US2/US4 en staging.
- **US4 (P2)**: US1 para API/repo base; datos sintéticos separados de migración.
- **US5 (P2)**: US1..US4 porque verifica los flujos completos de cliente y administración.
- **Polish/cutover**: las cinco historias completas y todos los gates R-* de plan.md.

### Oportunidades paralelas

- T003/T006 y T007/T008/T009 editan rutas diferentes; ejecutar en paralelo con T001 solo si el workspace no cambia los mismos archivos.
- Tests por historia T019..T021, T035..T038, T048..T050, T057..T059 y T068..T069 pueden escribirse en paralelo antes de sus implementaciones.
- Después de T034, los adaptadores/importador de US2, endpoint de US3 y módulos admin US4 usan archivos separados; coordinar integración en sus checkpoints.
- T074/T075/T076 corren sobre artefactos distintos; T077 recovery depende de los scripts de US2 y puede ejecutarse entonces.

## Paralelo de ejemplo: User Story 1

```text
Primero, lanzar en paralelo T019 (contrato API), T020 (compra D1) y T021 (e2e customer).
Confirmar que fallan por la adaptación cloud aún ausente.
Después pueden implementarse en paralelo T023 (repositorio catálogo) y T024 (auth D1),
que editan módulos diferentes. T027 checkout espera T026 carrito; T031 rutas esperan
repositorios; T034 staging espera T029/T030/T031/T032 y el preflight T017.
```

## Otros ejemplos de trabajo paralelo por historia

- **US2**: después de crear fixtures sintéticos, T035 snapshot y T038 recovery prueban utilidades independientes; T039 snapshot y T040 manifiesto usan módulos/archivos distintos. T042 importer espera sus interfaces.
- **US3**: correr T048 contrato, T049 integración y T050 navegador en paralelo primero; luego T051 endpoint y T055 página/form en archivos diferentes. T056 integra al final.
- **US4**: correr T057 contratos, T058 integración y T059 E2E juntos; tras interfaces aprobadas, T061 categorías/promos, T062 imágenes y T063 inventario editan repositorios distintos. T067 valida el panel integrado.
- **US5**: T068 visual/axe y T069 teclado/reduced-motion se desarrollan en paralelo en specs diferentes. T070 tokens y T071 layout pueden correr juntos si mantienen archivos separados; T073 integra ambos.

## Estrategia de implementación

### Primer MVP demostrable

El primer incremento de staging es US1 con datos sintéticos: catálogo, cuenta, compra
simulada y persistencia. Para declarar la versión online lista para datos reales hay que
completar además US2 (copia verificada), US3 (credenciales/admin seguro), US4 (gestión
completa) y US5 (responsive/accesibilidad), más R-AUTH y resto de gates. No abrir producción
basándose solo en US1.

### Entrega incremental

Setup + Foundation → US1 en Workers staging → US2 dry-run/import sintético y recovery →
US3 → US4 → US5 → suites/gates/quotas → backup real y copia única → reconciliación →
release nuevo Worker cerrado → aprobación de corte → apertura. Cada etapa mantiene
verificable el modo local SQLite y el proyecto Cloudflare antiguo.

## Notes

- `[P]` solo indica archivos distintos sin dependencia incompleta; todas las tareas usan T### secuencial.
- `[US#]` enlaza historia de spec.md; cada historia empieza por tests que deben fallar.
- Datos reales solo se leen tras snapshot privado; no usar en tests, screenshots, CI o fixtures.
- El estimado de 32 tests de feature001 es histórico; solo resultados ejecutados durante implementación pueden marcar tareas `[X]`.
- No se crean recursos, editan fuentes ni se despliega al generar esta lista.
