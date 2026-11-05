---
description: "Tareas ejecutables para adaptar JM-STORE a Workers y D1"
---

# Tasks: JM-STORE en Cloudflare Workers y D1

**Input**: Design documents from `/specs/002-cloudflare-workers-d1/`

**Prerequisites**: Constitution 1.1.0, spec.md con Clarify, plan.md, research.md,
data-model.md, contracts/ y quickstart.md.

**Tests**: Incluidas antes del código por FR-021 y solicitud explícita. Implementar tests
contra D1 local/sintético primero y comprobar que fallan antes de cada cambio de historia.

**Organization**: Se conservan las cinco historias y sus marcas históricas verificadas. Las tareas Firebase se vinculan a US1/US3 y deben completarse antes de repetir gates alojados o migrar cuentas reales. T048–T056 verificaron scrypt previo; no son evidencia Firebase.

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

- [X] T019 [P] [US1] Crear tests de contrato para rutas existentes de salud, sesión, auth, perfil/direcciones, catálogo, carrito, checkout e historial en `cloud/tests/contract/customer-api.test.js`; afirmar formas/códigos de feature001 y correr en rojo antes de adaptadores.
- [X] T020 [P] [US1] Añadir integración de API D1 para productos, stock, quote, pago REJECTED/APPROVED, idempotencia, precio cambiado y rollback en `cloud/tests/integration/customer-commerce.test.js`.
- [X] T021 [P] [US1] Añadir Playwright del recorrido cliente, assets y rutas SPA/API404 sobre Worker local en `cloud/tests/e2e/customer-store.spec.js`; verificar cero compras contra SQLite real.

### Implementation for User Story 1

- [X] T022 [US1] Crear reglas puras de dinero, promociones, validación y estados reutilizables en `shared/domain/`; añadir pruebas de paridad contra `server/src/lib/` sin cambiar reglas comerciales.
- [X] T023 [US1] Implementar consultas de categorías, productos, búsqueda, filtros y precio vigente con sentencias preparadas async en `cloud/src/repositories/catalog.js`, conservando búsqueda, orden/paginación, 100 productos y montos en céntimos.
- [X] T024 [US1] Adaptar alta/login/logout/sesiones a D1 en `cloud/src/modules/auth/` y `cloud/src/security/sessions.js`; conservar scrypt exacto `N=131072,r=8,p=1,keylen=64,salt=16`, solo hash de sesión en D1, expiración 8h/30min y registro solo CUSTOMER.
- [X] T025 [US1] Adaptar perfil y direcciones propias a D1 en `cloud/src/repositories/customers.js`; validar los límites literales recipient 2..100, teléfono 7..20, region/province/district 2..100, street 5..200 y reference<=200, con 404 para datos ajenos.
- [X] T026 [US1] Adaptar carrito persistente e invitado en `cloud/src/repositories/cart.js`; máximo100 líneas y cantidad1..99, validar versión/stock y restaurar carrito de cliente sin fusión silenciosa.
- [X] T027 [US1] Implementar quote, confirmación y reintento en `cloud/src/repositories/checkout.js` usando `DB.batch()` y guardas D1 que abortan toda transacción; REJECTED no cambia stock, APPROVED confirma, escribe movimiento y descuenta una vez, carrito solo se limpia si su versión coincide.
- [X] T028 [US1] Implementar order snapshots, historial y consultas de titularidad en `cloud/src/repositories/orders.js`; conservar estados `AWAITING_PAYMENT`, `CONFIRMED`, `PREPARING`, `SHIPPED`, `DELIVERED`, currency PEN y totales con `total_cents=subtotal_cents`.
- [X] T029 [US1] Crear Express Worker factory en `cloud/src/app.js` y `cloud/src/worker.js` usando `cloudflare:node/httpServerHandler`; enrutar `/api` antes de Static Assets, devolver JSON404 API y fallback SPA para páginas cliente.
- [X] T030 [US1] Distribuir `client/dist` como Static Assets y manifiesto local en `cloud/src/assets/`; aplicar CSP/HSTS/cabeceras a assets y `no-store` a respuestas privadas, sin `fs`, `express.static` o `sendFile`.
- [X] T031 [US1] Adaptar rutas existentes al repositorio async en `cloud/src/modules/` y `cloud/src/api.js`; mantener contratos de feature001, CSRF/Origin y errores 401/403/404/409/422/429/503 sin exponer SQL.
- [X] T032 [US1] Crear seed sintético idempotente de 20 productos/5 categorías en `cloud/scripts/seed-staging.js`; no ejecutar seed de demo sobre registros importados o stock gestionado.
- [X] T033 [US1] Crear Worker y D1 NUEVOS de staging solo después del preflight T017; registrar IDs y binding `DB` en `cloud/deploy/staging-resources.md`; nunca seleccionar o editar recurso antiguo.
- [X] T087 [P] [US1] Escribir pruebas de contrato REST para registro/login, errores genéricos, signup duplicado, operación incompleta y no vínculo por email en cloud/tests/contract/firebase-auth.contract.test.js; comprobar fallo antes del adaptador.
- [X] T088 [P] [US1] Escribir pruebas unitarias ID token/JWKS RS256, kid, issuer/audience/tenant/sub, exp/iat/auth_time, emulador, firma inválida y fetch fallido en cloud/tests/unit/firebase-id-token.test.js con claves efímeras.
- [X] T090 [US1] Añadir migración D1 cloud/migrations/0003_firebase_identity_security.sql con claims email únicos con ASCII trim/lowercase y longitud<=254, ACCOUNT/IMPORTED/REGISTRATION/EMAIL_CHANGE; operaciones de registro por UID y credenciales tipo EMAIL/PASSWORD; sin passwords/OOB/tokens; máximo una operación activa por usuario; expiry local created_at+60min y guardas batch para claims y users.email.
- [X] T091 [US1] Configurar projectId, API key Firebase restringida a Identity Toolkit y Token Service API y proveedor por entorno en cloud/src/config.js y cloud/README.md; no guardar service account/tokens en Worker; denegar proveedor desconocido y documentar Spark sin upgrades.
- [X] T092 [US1] Implementar cliente Firebase Auth REST en cloud/src/security/firebase-auth.js: signUp, signInWithPassword, lookup, refresh, sendOobCode, inspección resetPassword(oobCode) y aplicación accounts:update(oobCode); endpoints fijos, timeout y redacción de credenciales/cuerpos.
- [X] T093 [US1] Implementar verificador en cloud/src/security/firebase-id-token.js; certificados solo de URL fija oficial, RS256, aud/iss/sub/exp/iat/auth_time/proyecto/tenant, caché max-age y renovación acotada; no confiar roles/email del JWT.
- [X] T094 [US1] Implementar identidad/registro en cloud/src/repositories/firebase-identities.js y cloud/src/modules/auth/firebase-registration.js; reservar antes de signup, claims atómicos, CUSTOMER solamente y completar únicamente operación propia/UID acreditado; UID externo sin vínculo no obtiene sesión ni se vincula por correo.
- [X] T095 [US1] Adaptar cloud/src/security/sessions.js al UID/proyecto; tokens solo cifrados AES-GCM por sesión, rol/auth_version/corte en D1 primaria y estado Firebase antes de autorizar; sin scrypt en Worker ni fallback.
- [X] T100 [P] [US1] Añadir integración Firebase Auth simulada con D1 aislada en `cloud/tests/integration/firebase-admin-security.test.js` y contratos/unidades en `cloud/tests/contract/firebase-auth.contract.test.js`, `cloud/tests/unit/firebase-id-token.test.js`: identidad/roles, refresh concurrente, revocación, reservas, JWT inválido, OOB ajeno/reusado y reconciliación.
- [ ] T102 [US1] Verificar/completar el proyecto Firebase que el propietario ya creó manualmente: Spark base, Email/Password, EEP, policy 12–128, dominio/plantilla allowlisted, API key restringida y ausencia de Blaze/Identity Platform; evidencia en `cloud/deploy/firebase-staging.md`. Verificación/configuración remota autorizada completada salvo handler personalizado guardado y entrega de enlace; el correo permanece bloqueado. No se considera completa.
- [ ] T034 [US1] Después de T087–T102, desplegar la versión Firebase únicamente al Worker staging nuevo y ejecutar E2E cliente en cloud/tests/e2e/customer-store.spec.js y cloud/tests/e2e/hosted-auth.spec.js; T103 ejecuta gates alojados R-AUTH/R-EMAIL. Cualquier fallo bloquea migración real y release. Confirmar destino allowlist.
- [ ] T103 [US1] Ejecutar R-AUTH/R-EMAIL en Worker staging sintético: CPU<=10ms por invocación, memoria/cuotas, sin1102, lookup/revocación, OOB, email ocupado con EEP, expiry/replay/cancelación, registro concurrente y signup directo sin vínculo; guardar evidencia redactada en specs/002-cloudflare-workers-d1/quickstart.md.

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
- [ ] T104 [US2] Probar importación exacta STANDARD_SCRYPT del módulo SQLite con cuentas sintéticas en Spark staging autorizado; contraseña original/incorrecta, parámetros, UID/rol D1 explícitos, colisión/reintento en cloud/tests/migration/firebase-scrypt-import.test.js; fallo bloquea cuentas reales, sin reset ni tocar SQLite.
- [ ] T105 [US2] Añadir gate a cloud/scripts/verify-import.js para exigir R-IDENTITY aprobado y manifiesto privado UID/email/rol; fallo/colisión aborta antes de cualquier escritura real en D1.

**Checkpoint**: migración de fixture completa y recuperable; SQLite original nunca cambia.
La copia real queda como tarea de corte en la fase final, después de los demás gates.

---

## Phase 5: User Story 3 - Cambiar credenciales del administrador (Priority: P1)

**Goal**: sección Mi cuenta → Seguridad permite cambiar correo/password con reautenticación
y protección contra carreras.

**Independent Test**: con Firebase Spark sintético, cambio de correo queda pendiente y conserva correo/sesiones actuales hasta confirmar enlace; al confirmar reconcilia D1, revoca todas las sesiones y exige login nuevo. Password se cambia aparte; envío combinado se rechaza antes de efectos.

### Evidencia histórica (adaptador scrypt local; completada)

T048–T056 se mantienen [X] por su implementación y verificación originales con scrypt. No son evidencia Firebase ni se reabren.

- [X] T048 [P] [US3] Añadir contrato de GET/PATCH `/api/admin/me/security`: permisos, currentPassword, email único, password12..128, confirmación, versión, errores 401/403/409/422 en `cloud/tests/contract/admin-security.test.js`.
- [X] T049 [P] [US3] Añadir integración histórica scrypt para cambio correo/password/ambos, correo duplicado, password actual erróneo, rollback de auditoría, sesión actual/otras y login concurrente con hash antiguo en cloud/tests/integration/admin-security.test.js; no cubre Firebase/OOB.
- [X] T050 [P] [US3] Añadir Playwright de navegación, validaciones, red lenta, respuesta perdida y logout forzado tras cambio en `cloud/tests/e2e/admin-security.spec.js`.

### Implementation for User Story 3

- [X] T051 [US3] Implementar GET/PATCH de seguridad en `cloud/src/modules/admin/security.routes.js`; exigir ADMIN activo, currentPassword, CAS sobre user.version/password_hash/sesión y correo único <=254 normalizado.
- [X] T052 [US3] Implementar batch atómico en `cloud/src/repositories/admin-security.js`: verificar la contraseña actual con los mismos parámetros scrypt, cambio inmediato de email sin email externo, password solo si 12..128, incremento `auth_version`, evento sin secretos y revocación de TODAS las sesiones en cambio de password.
- [X] T053 [US3] Proteger carrera login/password-change en `cloud/src/security/sessions.js`; solo insertar sesión si siguen iguales usuario/hash/auth_version verificados; tras cambio de password expirar cookie actual y devolver `requiresLogin:true`.
- [X] T054 [US3] Añadir capacidad aditiva `capabilities.adminSecurity=true` a `/auth/session` cloud y ausencia=false en `client/src/app/providers.jsx`; ocultar enlace en backend SQLite que no expone el endpoint.
- [X] T055 [US3] Implementar página, formularios y navegación **Mi cuenta → Seguridad** en `client/src/pages/admin/AdminSecurityPage.jsx`, `client/src/components/admin/AccountNav.jsx` y `client/src/styles/`; no almacenar password/email nuevo en browser ni logs.
- [X] T056 [US3] Ejecutar contrato, integración, carrera e2e de T048..T050 con fallos forzados; corregir serialización en `cloud/src/modules/admin/security.routes.js` y `client/src/pages/admin/AdminSecurityPage.jsx`, comprobar que API local conserva respuesta actual.

**Checkpoint histórico**: T048–T056 verificaron UI/API con scrypt previo. No satisface el flujo Firebase. El checkpoint US3 requiere además T087–T103.

- [X] T089 [P] [US3] E2E local Firebase en `cloud/tests/e2e/firebase-admin-security.spec.js`, junto con formularios separados de `admin-security.spec.js`: registro/login, roles D1, solicitud pendiente, cancelación inmediata, enlace explícito desde otro navegador, OOB vencido, errores y login tras revocación. Worker real y D1 efímera con proveedor REST/JWKS sintético sin red; R-EMAIL alojado permanece pendiente.
- [X] T096 [P] [US3] Actualizar pruebas de contrato/integración en `cloud/tests/contract/admin-security.test.js` y `cloud/tests/integration/firebase-admin-security.test.js`: combinado 422 antes de todo efecto, operación activa bloquea otra, correo viejo mientras pending, reserva genérica y carreras con registro/cancelación/expiry/replay.
- [X] T097 [US3] Implementar solicitud/estado/cancelación de email en `cloud/src/modules/admin/security.routes.js` y `cloud/src/repositories/firebase-admin-security.js`; reautenticar contraseña/mismo UID, CAS de claim, email/sesiones vigentes durante pending, expiry 60min no renovable, sin OOB duplicado automático; cancelación reautenticada libera solo reserva propia conocida. La transición APPLYING de confirmación usa apply_token CAS en migración 0004 para que cancelación/confirmación concurrentes tengan un único ganador.
- [X] T098 [US3] Implementar confirmación en cloud/src/modules/auth/email-action.routes.js y client/src/pages/auth/ConfirmEmailChangePage.jsx; GET inerte, POST explícito, inspección OOB/tipo/old/new/op/expiry; CAS APPLYING y revocación/bloqueo antes de aplicar; confirmar localId/newEmail y cerrar D1; incierto queda RECONCILIATION_REQUIRED, sin log/persistencia de código/token.
- [X] T099 [US3] Adaptar cambio de contraseña Firebase en `cloud/src/modules/admin/security.routes.js` y `cloud/src/repositories/firebase-admin-security.js`; reautenticar mismo UID, operación separada, bloqueo/auth_version/corte/revocación antes de proveedor y reconciliar después; no guardar password; incierto cierra acceso.
- [X] T101 [US3] Añadir pruebas accesibles/estado para Seguridad y confirmación en `cloud/tests/e2e/admin-security.spec.js`; comprobar password/OOB no persistidos y fallo incierto sin éxito falso.

---

## Phase 6: User Story 4 - Administrar tienda y pedidos en cloud (Priority: P2)

**Goal**: todas las funciones administrativas existentes siguen funcionando mediante D1,
incluidos productos, categorías, imágenes, precios, promociones, stock, clientes y pedidos.

**Independent Test**: admin cambia producto/stock, cliente completa compra y ve estado; un
segundo login observa el cambio, y cliente/visitante no accede a operaciones admin.

### Tests for User Story 4 (primero)

- [X] T057 [P] [US4] Portar contratos de summary, productos, imágenes, categorías, promociones, inventario, clientes y pedidos al Worker en `cloud/tests/contract/admin-api.test.js` antes de adaptar repositorios.
- [X] T058 [P] [US4] Integración D1 en `cloud/tests/integration/admin-commerce.test.js`: rollback de producto/stock/movimientos al fallar imágenes, carreras de edición y stock, desactivación de cliente y transiciones de pedido atómicas.
- [X] T059 [P] [US4] E2E local Firebase/Worker/D1 en `cloud/tests/e2e/admin-commerce.spec.js`: categoría, producto, foto, precio, promoción, inventario, cliente, compra simulada y seguimiento.

### Implementation for User Story 4

- [X] T060 [US4] Adaptar creación/edición/desactivación de productos con versión optimistic-lock en `cloud/src/repositories/admin-products.js`; respetar name2..120, descripción1..4000, SKU1..64 y precio1..100000000 céntimos.
- [X] T061 [US4] Adaptar categorías y promociones en `cloud/src/repositories/admin-catalog.js`; nombre categoría2..80, exacto un product/category target, `PERCENT_BPS`1..9999, `FINAL_PRICE` positivo menor al base, fechas inicio<fin y no intervalos solapados.
- [X] T062 [US4] Biblioteca de imágenes importada de `cloud/src/assets/library.json`, generada en build desde imágenes públicas y validada en `cloud/src/repositories/admin-products.js`; hasta cuatro, posiciones únicas, alt validado, sin uploads arbitrarios; conservar manifiesto de licencias.
- [X] T063 [US4] Adaptar inventario en `cloud/src/repositories/admin-operations.js`; cantidad0..1000000, version esperada, cada cambio crea movimiento `ADJUSTMENT` con actor/delta/razón y conflicto no modifica stock.
- [X] T064 [US4] Adaptar privacidad/desactivación de clientes en `cloud/src/repositories/admin-operations.js`; nunca devolver `password_hash`, prohibir promociones a ADMIN y revocar sesiones del usuario desactivado.
- [X] T065 [US4] Adaptar estado e historial de pedidos en `cloud/src/repositories/admin-operations.js`; permitir solo CONFIRMED→PREPARING→SHIPPED→DELIVERED, registrar actor y prohibir cambios a pagos simulados.
- [X] T066 [US4] Mantener panel y tablas actuales en `client/src/pages/admin/` usando capability cloud solo para seguridad; errores 403/409/429/503 visibles, sin cambiar comportamiento funcional local.
- [X] T067 [US4] Ejecutar suites de T057..T059 y suites locales, verificar cada acción CRUD persiste y cliente recibe solo recursos propios; corregir en `cloud/src/repositories/admin-*.js` y `client/src/pages/admin/`.

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

### Incremento urgente autorizado: Fetch nativo y demostración (2026-11-05)

Este incremento sigue la revisión de Plan del 2026-11-05. No modifica las marcas
históricas ni considera aprobados los requisitos pendientes. Las tareas T106–T112 se
ejecutan antes de continuar la aceptación alojada; el bloqueo de correo puede permanecer
para la entrega del 6 de noviembre a las 08:00 America/Lima. No se reconfigura ADMIN.

- [X] T106 [US1] Escribir y ejecutar en rojo contratos de dispatcher Fetch, prefijos/params, errores async, cookies, HEAD y parser limitado en `cloud/tests/unit/native-http.test.js` y `cloud/tests/contract/native-api.test.js`.
- [X] T107 [US1] Implementar dispatcher/contexto Request–Response en `cloud/src/http/`, adaptar factories de rutas cloud y sustituir la entrada Express/Node por Fetch en `cloud/src/app.js` y `cloud/src/worker.js`; conservar seguridad, contratos y repositorios.
- [X] T108 [US1] Aprobar suites cloud y E2E Firebase/local, build/dry-run y regresión SQLite usando bases temporales; verificar ausencia de puente Node/Express en bundle y hashes SQLite originales.
- [X] T109 [US1] Respaldar y restaurar/verificar staging; publicar Fetch solo al Worker nuevo preservando secretos, namespace, ADMIN y datos; medir primera invocación de registro tras publicación y recorridos calientes reales con cuentas sintéticas; documentar límites de la muestra sin equipararla a estrés integral.
- [X] T110 [US1] Completar pruebas alojadas cliente y administración: búsqueda/carrito/direcciones, pago rechazado y aprobado, stock/idempotencia, CRUD/seguimiento y cambio separado de password con revocación sobre ADMIN sintético; respetar Free/Spark y no usar la cuenta personal.
- [X] T111 Documentar evidencia actual, aptitud de demostración y pendientes explícitos (correo, migración real, producción, pruebas manuales no realizadas) en `cloud/deploy/`, README y quickstart; actualizar solo tareas verificadas.
- [X] T112 Revisar todo el contenido Git publicable y el historial por secretos/datos privados; commit/push autorizado a `JM-STORE-ECOMMERCE-SDD` cuando pasen las pruebas críticas; verificar remoto y árbol limpio, sin deploy de producción.

**Purpose**: demostrar restauración y cuotas, conectar Workers Builds y abrir solo después
de completar stories y gates. El target remoto siempre es explícito.

- [X] T074 [P] Ejecutar build y todas las suites locales; resultados actuales 2026-11-05: 3 unitarias, 20 integración, 9 E2E SQLite, 87 cloud, 8 E2E cloud y 7 E2E Firebase aprobadas (134 total); build/dry-run aprobados. El incremento autorizado permite concluir regresión independiente de correo; esta marca no aprueba aceptación integral, R-EMAIL, migración ni producción.
- [ ] T075 [P] Medir Firebase sin KDF de password en Worker, error1102, CPU/memoria, llamadas proveedor, D1 filas/subrequests y p95 búsqueda con 100 productos/20 sesiones en cloud/tests/performance/; aprobar R-AUTH solo si Worker Free cumple con margen; registrar límites reales en specs/002-cloudflare-workers-d1/quickstart.md.
- [ ] T076 [P] Escanear secretos, `.dev.vars`, snapshots, SQLite, exports, PII y permisos de archivos en el tree/GitHub workflow mediante `cloud/tests/security/repository-secrets.test.js`; corregir `.gitignore`/config antes de usar credenciales.
- [ ] T077 Ensayar export diario, Time Travel, restore staging, namespaces, expiración sesiones, firma quote y conciliación de escrituras posteriores en `cloud/tests/migration/recovery.test.js`; documentar tiempos y RPO/RTO en `cloud/README.md`.
- [ ] T078 Conectar Workers Builds únicamente a `7172MichaJosu/JM-STORE-ECOMMERCE-SDD` y al Worker nuevo usando el mecanismo autorizado de Cloudflare; fijar main/staging, `npm ci`, build/tests obligatorios, sin auto deploy inicial ni secrets en `.github/workflows/` o forks; documentar ID de conexión/configuración revisada en `cloud/deploy/builds.md`.
- [ ] T079 Verificar identidad de destino, nombre nuevo y cuota compartida con `cf`/script explícito antes de crear D1/Worker nuevos de producción; almacenar allowlist en `cloud/deploy/targets.json`, rechazar recurso antiguo y no borrar cuota del proyecto previo.
- [ ] T080 Crear backup privado verificable de SQLite `server/data/jm-store.sqlite` y archivos WAL/SHM usando `cloud/scripts/snapshot.js`; API local detenida limpiamente, integrity_check PASS, digest y manifiesto privado antes de leer/importar.
- [ ] T081 Aplicar migraciones y copia única del snapshot a D1 nueva en estado CLOSED con cloud/scripts/migrate.js y cloud/scripts/import.js; incluir tablas/relaciones, preservar hashes originales, stock y pedidos/pagos, sin seed ni cambios al origen. Cuentas reales bloqueadas hasta T104/T105.
- [ ] T082 Ejecutar reconciliación con cloud/scripts/verify-import.js; comparar 100% recuentos, digests/FK, stock, importes/pedidos, UID/roles y login admin sintético; diferencia o T104/T105 fallidas mantienen producción CLOSED y cuentas reales sin migrar.
- [ ] T083 Desplegar build revisado desde GitHub al Worker de producción nuevo usando `cloud/scripts/release.js --target production`; rutas/origen/binding solo nuevos; no asociar custom domain del proyecto antiguo y mantener `deployment_state=CLOSED` hasta validaciones finales.
- [ ] T084 Ejecutar aceptación contra staging sintética en cloud/tests/e2e/release-acceptance.spec.js: journey<4min, registro/login Firebase, email con enlace/reserva/cancelación, password separado, sesiones revocadas, roles, CRUD, checkout, 100 concurrencias, backup/restore, responsive y carga Free; en producción Closed solo health/catálogo público de lectura.
- [ ] T085 Obtener aprobación explícita del corte y abrir únicamente D1/Worker de producción mediante `cloud/scripts/release.js --target production --open`; guardar confirmación/IDs en `cloud/deploy/release-record.json`, sin cambiar ni cerrar el Worker antiguo.
- [ ] T086 Actualizar README y guías para instalación local, despliegue cloud, admin security, límites Free, monitor de cuotas, backup/restore/corte en `README.md`, `cloud/README.md` y `specs/002-cloudflare-workers-d1/quickstart.md`; conservar estado de todo criterio no medido como pendiente.

## Dependencias y orden de ejecución

### Grafo de fases

```text
Setup T001-T006 → Foundation T007-T018 → base cloud T019-T033
  → Firebase tests T087-T089 → schema/REST/JWT/identity/sessions T090-T095
       ├→ US3 tests T096 → security implementation T097-T099 → local verification T100-T101
       └→ Firebase staging T102 (explicit authorization)
             → T034 deploy/customer E2E → T103 hosted R-AUTH/R-EMAIL gates
                   → T104 synthetic hash test → T105 migration identity gate
                         → US2 real-account copy T081/T082 only if gate passes
US4 T057-T067 and US5 T068-T073 may prepare independent synthetic work.
Polish T074-T086 requires complete stories, gates, backup, reconciliation, authorization.
```

T048–T056 remain complete only for the previous scrypt provider; they do not unlock
Firebase work. T087–T089 tests precede implementation. T096 precedes T097–T099. T034
requires T087–T102 and must precede T103. T104/T105 precede any real account import;
if compatibility fails, stop before importing accounts and seek a new approved SDD
decision. US5 verifies all completed screens. T079–T085 retain their sequential
preflight, backup, reconciliation, verification and cutover authorization.

### Dependencias por historia

- **US1 (P1)**: Setup + Foundation; Firebase requires T087–T095 before T034/T103; scrypt evidence does not satisfy R-AUTH.
- **US2 (P1)**: US1 + baseline D1; fixtures permitidas, migración real de usuarios bloqueada hasta T104/T105 y autorización del corte.
- **US3 (P1)**: T048–T056 son históricas scrypt; adaptación Firebase T087–T103 depende del proveedor/sesión Firebase de US1.
- **US4 (P2)**: US1 para API/repo base; datos sintéticos separados de migración.
- **US5 (P2)**: US1..US4 porque verifica los flujos completos de cliente y administración.
- **Polish/cutover**: las cinco historias completas y todos los gates R-* de plan.md.

### Oportunidades paralelas

- T003/T006 y T007/T008/T009 editan rutas diferentes; ejecutar en paralelo con T001 solo si el workspace no cambia los mismos archivos.
- Tests T019..T021, T035..T038, T057..T059, T068..T069 y T087..T089 pueden escribirse en paralelo antes del código; T096 agrega cobertura de seguridad Firebase.
- US2/US4 sintéticas pueden avanzar aparte. Firebase tests T087–T089 preceden T090–T095; T096 precede T097–T099; T034/T103 esperan T102 y pruebas listas; cuentas reales esperan T104/T105.
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
- **US3 histórico**: T048–T056 permanecen completas para scrypt. **Firebase**: T089/T096 definen pruebas; T097–T099 implementan; T098 integra handler/enlace; T100/T101 prueban.
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

## Implementation checkpoint — 2026-11-04

T001–T032 están completadas. Evidencia local de esta continuación: `npm test` 3/3;
`npm run test:integration` 20/20; `npm run test:e2e` 9/9; `npm run cloud:test` 24/24;
`npm run cloud:test:e2e` 2/2 (incluye build Vite y Wrangler dry-run). En total, 58
pruebas aprobadas entre la regresión local y el runtime D1/Worker emulado.

T033 completada con autorización explícita el 2026-11-04. Se creó el Worker
`jm-store-ecommerce-sdd-staging` y la D1 `jm-store-ecommerce-d1-staging`; se registraron
la identidad y el binding en `cloud/deploy/staging-resources.md`. T034 se ejecutó
parcialmente: se aplicaron migraciones remotas solo a la D1 nueva, se cargaron 20
productos y 5 categorías sintéticos, y el Worker quedó activo solo en workers.dev. La
suite alojada pasó 3/3. R-AUTH no pasa: las invocaciones de registro/login llegaron a
602/522 ms de CPU (promedios 451.75/435 ms) frente al presupuesto Workers Free de 10 ms;
no hubo respuesta 1102. Las métricas no exponen memoria por invocación, así que tampoco
se puede verificar ese presupuesto. Se desactivó la recolección de observabilidad al
terminar la medición agregada. T034 queda [ ] y bloquea importación real/corte; no se
probaron cambio de password ni concurrencia en staging. No se abrió SQLite local ni se
importaron datos reales. Este checkpoint antecede a la continuación US3 documentada abajo.

### Continuación US3 — 2026-11-04

T048–T056 implementadas y verificadas localmente con D1 emulada y cuentas sintéticas.
La instrucción del propietario de continuar tareas independientes permite desarrollar
US3 sobre T001–T033 y la sesión/roles cloud ya terminados. La parte pendiente de T034
(R-AUTH Free alojado) sigue bloqueando migración real/corte y no se considera aprobada por
estas pruebas. Ninguna acción remota se ejecutó en esta continuación.

Evidencia final: `npm run cloud:test` 36/36 (12 casos de seguridad administrativa);
`npm run cloud:test:e2e`/runner local 6/6 (4 de seguridad y 2 de tienda), build Vite y
Wrangler dry-run aprobados; `npm run test:integration` 20/20 y `npm run test:e2e` 9/9
contra SQLite temporal. Axe no encontró violaciones en el formulario a360/1280px en ambos
temas. El test de contrato confirmó que la API SQLite mantiene su respuesta sin capacidad
adminSecurity. Se verificaron carrera de dos passwords (exactamente un commit), login
con hash antiguo rechazado, revocación de todas las sesiones y rollback de auditoría.
Los fallos iniciales del test de navegación se corrigieron antes de marcar estas tareas.

Conteo histórico al 2026-11-04: 42/86 tareas originales completas y 44 pendientes.
T087–T105 se agregan como pendientes, no verificadas. Clarify resolvió proveedor y correo;
T048–T056 son evidencia scrypt, no compatibilidad Firebase.

### Continuación Firebase local — 2026-11-05

T087, T088, T090, T092–T101 están verificadas localmente; T089, T091 y T102–T105 siguen pendientes. No se marca T091/T102 porque faltan validar configuración efectiva del proyecto Firebase (Project ID, Web API Key restringida, dominio/plantilla de acción); T034/T103 dependen de ese preflight y no se desplegó.

Evidencia de esta continuación: `npm run cloud:test` 69/69; `npm run cloud:test:e2e` 8/8 con Worker/D1 locales emulados, build y Wrangler dry-run; `npm test` 3/3; `npm run test:integration` 20/20; `npm run test:e2e` 9/9. Las pruebas Firebase usan tokens y cuentas sintéticos. Se corrigieron el rollback de registro con FK, la renovación de tokens próximos a expirar, el montaje del handler Firebase de confirmación de correo y la carrera confirmación/cancelación mediante CAS; T096 cubre registro concurrente, cancelación, expiración y replay. GET del enlace no aplica cambios, el POST explícito falla sin mostrar éxito ante error, y los códigos OOB no se guardan en D1.

No se modificó SQLite con datos existentes, no se migraron usuarios reales, no se escribió en Worker/D1 remotos, no se desplegó y no se hizo commit/push. El proyecto Firebase requiere configuración para pasar a pruebas alojadas.

### Configuración y pruebas locales aisladas — 2026-11-05

T089 completada con `npm run cloud:test:firebase:e2e`: 6/6 (cuatro de seguridad Firebase y dos de tienda). `npm run cloud:test` pasó 71/71; `node cloud/scripts/local-e2e.js` pasó 8/8; build Vite/Worker y Wrangler dry-run aprobados. Total actual: 56/105 tareas completas, 49 pendientes. No se repitieron ni se atribuyen resultados nuevos a las suites SQLite históricas.

El preflight `npm run cloud:config:check` validó las cinco variables requeridas, archivo ignorado/no trackeado, ausencia de duplicados y round-trip AES-GCM sin imprimir valores ni hacer peticiones. El proyecto Spark y el dominio son configuración manual declarada por el propietario; T091/T102 siguen pendientes de verificar restricciones, EEP, policy y plantilla en el servicio real.

Vitest deja de cargar `.dev.vars`: configura bindings sintéticos directamente y bloquea peticiones externas no simuladas. Dos pruebas verifican ausencia de credenciales Firebase del operador y la barrera de red. Los E2E Firebase usan el Worker compilado con D1 efímera y proveedor REST/JWKS simulado en memoria, sin fallback a Internet; códigos de acción sintéticos temporales y sin capturas/trazas. Se encontró y corrigió la pérdida de operationId en React que ocultaba la cancelación inmediata de correo.

T076 parcial: `cloud/scripts/prepare-secret-rotation.js` escanea valores actuales solo en memoria en archivos publicables e historial Git; no detectó coincidencias. Por exposición informada, QUOTE_SECRET/RATE_LIMIT_SECRET se consideran comprometidos igualmente. Se prepararon reemplazos independientes en `cloud/private/staging-secret-rotation.json`, ignorado y con ACL privada. Se verificó rechazo de cotizaciones antiguas con la clave candidata y cambio de namespace de rate limit. Los secretos activos no se reemplazaron; la rotación remota no está aprobada ni aplicada. Procedimiento en `cloud/deploy/secret-rotation.md`. T076 no se marca completa: falta su revisión integral/publicación y la aplicación remota autorizada.

T034/T103 y T091/T102 requieren autorización para validación/configuración remota, migraciones de staging, rotación y publicación solo en el Worker nuevo. T104/T105 e importación real continúan bloqueadas. No hubo escrituras remotas, migración de cuentas reales, modificación de SQLite existente o proyecto antiguo, ni commit/push. Se solicita autorización después de estas pruebas locales conforme a la instrucción del propietario.

### Staging Firebase autorizado y bloqueo de recursos — 2026-11-05

Se ejecutaron únicamente operaciones autorizadas sobre Worker `jm-store-ecommerce-sdd-staging` y D1 `jm-store-ecommerce-d1-staging` (UUID ce073401-aae5-4889-8d32-047010650987). Respaldo privado previo: export 52,486 bytes, restauración local de 25 tablas, integrity_check=ok, FK=0 y recuentos iguales al origen; código/configuración y versión activa anterior conservados privadamente. Se verificó de nuevo el digest antes de aplicar 0003/0004; D1 quedó CLOSED durante la preparación, ambas migraciones están verificadas y FK=0.

Firebase real: proyecto y API key coinciden; Cloud Billing deshabilitado (Spark), Identity Platform deshabilitado, Email/Password y dominio autorizados, EEP activo, política 12–128 configurada conservando requisitos anteriores y API key restringida a Identity Toolkit/Token Service. Se respaldó configuración anterior sin publicarla. T091 queda completa. El callback personalizado sigue predeterminado: el API respondió EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED y el propietario indicó continuar sin guardarlo. T102 sigue pendiente; no se alteró el protocolo SDD de correo. Se añadió FIREBASE_EMAIL_ACTION_READY=false con bloqueo backend antes de cualquier efecto y campo deshabilitado en UI; password permanece disponible. La publicación es un incremento de staging para verificar R-AUTH, no aceptación de T102/R-EMAIL ni release.

Versión publicada: 08151cb7-7c41-40ad-8447-e679b02150de. Namespace nuevo para invalidar sesiones antiguas, cinco valores de configuración protegidos como secrets, QUOTE_SECRET y RATE_LIMIT_SECRET reemplazados en la versión publicada sin mostrar valores. Ninguna credencial se añadió al repositorio. Dos identidades Firebase sintéticas nuevas; ADMIN se provisionó por UID verificado exacto, sin vincular por correo ni promover cuentas existentes.

US4 T057–T067 implementada y verificada localmente. Última suite cloud completa 79/79; E2E Firebase/Worker/D1 7/7, incluida administración y password con correo deshabilitado; E2E cloud local 8/8; regresión SQLite 3/3 unitarias, 20/20 integración y 9/9 E2E, con DB temporal. Tres archivos SQLite reales comparados por hash permanecen intactos. Estas pruebas no equivalen a CRUD alojado completo.

Pruebas alojadas iniciales 11/11: sesión Firebase, registro CUSTOMER, acceso privado, logout, sesión invitada, contraseña incorrecta, login cliente, login ADMIN, lectura de Seguridad y resumen. Firebase nativo adicional verificó firma/audiencia/UID, lookup/validSince y rechazo de password incorrecto. No se imprimieron identificadores/credenciales sintéticos ni tokens.

R-AUTH NO APROBADO: GraphQL Analytics devolvió 11 invocaciones exitosas, cero errores y una muestra de CPU de 11,294 microsegundos = 11.294 ms (bucket de una solicitud; P50=P99). Supera el presupuesto aprobado de 10 ms de Free. Wrangler tail observó otras dos solicitudes de 4 ms y 8 ms, outcome ok; no apareció 1102. La tolerancia ocasional de la plataforma no aprueba el requisito. Observability REST devolvió 403; se obtuvo la medición mediante Analytics con límite reducido y se corroboraron las unidades por introspección oficial. No se expuso memoria por invocación. No se afirma compatibilidad Free completa.

Al detectar el exceso se detuvieron ensayos y mutaciones remotas: no se ejecutaron checkout, CRUD ni cambios de credenciales alojados posteriores. T034, T075 y T103 siguen bloqueadas; T104/T105, cuentas reales y producción continúan bloqueadas. El guard privado de sesión impide repetir automáticamente operaciones/tests de staging sin nueva autorización. Staging queda publicado/OPEN para revisión, correo bloqueado y logs de observabilidad habilitados; no se ejecutó otra publicación tras el hallazgo. Cuotas D1 iniciales: 266,240 bytes, 13,130 filas leídas y 957 escritas en las 24h previas; no se atribuyen esos valores al cierre. Spark no activó facturación; nunca se activó plan pagado Cloudflare, Firebase Hosting, Identity Platform, commit o push. El Worker antiguo no fue modificado.

Conteo actual: 68/105 tareas completas; 37 pendientes. Se requiere consulta al propietario por el exceso de CPU antes de continuar optimización o ensayos remotos, conforme a su instrucción explícita.


### Optimizaci?n CPU autorizada ? 2026-11-05, resultado final

El propietario autoriz? optimizar y repetir pruebas manteniendo Workers Free/Firebase Spark. Se gener? checklists/free-staging.md (16 ?tems de calidad de requisitos sin marcar, propiedad del revisor); la instrucci?n expl?cita autoriza avanzar con optimizaci?n/pruebas mientras queda pendiente esa revisi?n. No hay extensions.yml ni hooks aplicables.

Se reutilizan router/objetos CryptoKey, con reemplazo por rotaci?n/expiraci?n y claves no extra?bles; se usa conversi?n binaria nativa y se agrupan reservas, creaci?n/lectura de usuarios y sesiones en batches D1 con RETURNING. Se conservan controles de UID/auth_version, revocaci?n Firebase/D1, CSRF, rate limit, AES-GCM con IV nuevo y RS256. Pruebas nuevas cubren rotaci?n con mismo kid, IV, aislamiento de clave, registro concurrente y vencimiento durante signup. No se modific? la arquitectura Express aprobada.

Antes de cada publicaci?n se restaur? un export privado: 60,875/66,435 bytes, 27 tablas, integrity_check ok, FK 0 y recuentos iguales. Las versiones de staging fueron 5ef93d10-b881-483f-abcd-bf59c0474942 y c0f43974-41a7-4c15-9ddb-231b76763c81 (activa final). No se reaplicaron migraciones ni reprovision? administrador; los secretos ya rotados y namespace se conservaron.

Pruebas locales finales: 82/82 cloud, 7/7 E2E Firebase, 8/8 E2E cloud, 3/3 unitarias SQLite, 20/20 integraci?n SQLite y 9/9 E2E SQLite: 129 aprobadas. Build y dry-run correctos. Los tres hashes de SQLite original siguen iguales. Escaneo local de 321 archivos publicables y tres revisiones Git: sin coincidencias de valores secretos conocidos; esto no completa la revisi?n integral T076.

Cada intento remoto pas? 11/11 comprobaciones HTTP sint?ticas (22 en dos repeticiones). Wrangler tail midi? 11 invocaciones por intento, todas outcome=ok: registro 15 ms en el primero y 19 ms en el segundo; las dem?s llamadas entre 3 y 8 ms. Analytics del primero devolvi? mayor P99 de bucket 15,350 microsegundos = 15.350 ms, 19 invocaciones y cero errores. Analytics del segundo no estuvo disponible por rate limiter de consultas; se registr? como no disponible sin reutilizar datos anteriores. La evidencia de 19 ms proviene exclusivamente de tail. No hubo 1102; CPU no es wall time y no se afirma mejora estad?stica. Memoria/carga/cuotas al cierre siguen sin acreditarse.

R-AUTH NO APROBADO: registro sigue por encima de 10 ms. Se detuvieron nuevos ensayos/mutaciones remotas tras el segundo intento y se cerr? el guard privado. No se continu? con checkout, CRUD integral ni cambio de password alojados; no se activaron planes pagados. D1 sigue OPEN y staging accesible para revisi?n, pero no listo para aceptaci?n integral/uso estable. Correo contin?a bloqueado hasta guardar/verificar el handler aprobado, sin aplicar cambios con el handler predeterminado.

Alternativa sin costo a evaluar antes de implementar: conservar React, Firebase Spark, D1 y repositorios/reglas, sustituyendo solo la entrada HTTP cloud Express/Node por Fetch nativo. Exige reconciliar Plan/tareas y volver a medir, no garantiza por s? sola CPU. No se realiz? ese cambio ni se alteraron Spec/Plan/Constitution. Detalles y fuentes oficiales en cloud/deploy/cpu-optimization.md.

Conteo conservado: 68/105 tareas completas y 37 pendientes. T074 tiene todas las suites locales ejecutadas, pero mantiene aceptaci?n Phase 8 pendiente por dependencias; T034/T075/T103 bloqueadas por CPU, T102/R-EMAIL por configuraci?n de enlaces, T104/T105 y datos reales bloqueados. Revisiones manuales no realizadas siguen pendientes. Sin producci?n, commit, push, cambio del Worker antiguo ni modificaci?n de SQLite real.

### Administrador personal autorizado — 2026-11-05

Operación acotada solicitada por el propietario para su UID de Firebase; traza FR-014
y Plan (roles en D1, vínculo por UID verificado y provisión privada). No es migración
de SQLite ni habilita registro público de administradores. Checklists sin cambios:
requirements 16/16, free-staging 0/16. Esta autorización no aprueba gates pendientes.

Firebase administrativo confirmó proyecto correcto/activo, Spark sin facturación,
Identity Platform no activado, Email/Password y UID activo con proveedor password.
No había claims ADMIN reconocidos ni cuenta D1 vinculada al UID/correo. No se solicitaron
passwords ni se emitieron custom tokens para simular al propietario.

Antes de escribir: export privado de 56,357 bytes, restauración de 27 tablas,
integrity_check ok, FK 0 y recuentos iguales. Digest verificado antes de la escritura.
Se preservó el procedimiento sintético existente y se adaptó su patrón de provisión
en una operación privada restringida al único UID autorizado.

Se añadió exactamente una cuenta FIREBASE activa ADMIN con claim ACCOUNT. Las 10
cuentas previas y sus claims se compararon con el respaldo y permanecieron iguales;
total D1 posterior 11, FK 0. Consulta independiente confirmó ADMIN y UID exacto.
Identidad personal, procedimiento detallado y respaldos solo en cloud/private ignorado,
sin passwords ni valores de tokens en documentos públicos.

Primera comprobación: 0 sesiones activas del propietario. Aprovisionamiento verificado;
posteriormente el propietario confirmó que ingresó y vio el panel. Verificación
independiente del 2026-11-05 a las 16:20:31 UTC: ADMIN activo por UID exacto, 1 sesión
vigente con namespace/auth_version de staging correctos y FK 0. Login administrativo
personal verificado sin solicitar ni leer contraseña, cookies o tokens.
[Procedimiento y evidencia](../../cloud/deploy/admin-provisioning.md).

No se desplegó código ni modificaron Worker antiguo/producción, planes o SQLite original
(tres hashes iguales). R-AUTH/R-EMAIL y guard de CPU siguen bloqueados. Revisiones
manuales/aceptación integral pendientes. Conteo conservado: 68/105 completas, 37
pendientes. Sin commit ni push en esta operación.

### Entrega de demostración con Fetch nativo — 2026-11-05

Autorización vigente: actualizar Plan/Tasks antes del cambio de arquitectura, implementar
y medir staging, y publicar avances en GitHub tras pasar pruebas críticas. Entrega el
6 de noviembre a las 08:00 America/Lima. No se repitió la provisión ADMIN. Checklist
free-staging conserva sus 16 marcadores pendientes; la autorización de este incremento
no es una aprobación de esa revisión manual ni de toda la feature.

T106 tuvo rojo inicial por dispatcher inexistente y contrato de parser; verde después
de T107. Cloud ahora usa Fetch directo, sin Express/Helmet/puente Node en bundle, sin
dependencias nuevas. Se conservan todos los handlers/repositorios y controles, incluyendo
CSRF/Origin, rate limit, rol D1, firmas, cookies y revocación Firebase/D1. Plan, Tasks,
contratos y research quedaron coherentes con esta decisión antes de publicar.

T074/T108: 87 cloud, 7 E2E Firebase, 8 E2E cloud, 3 unitarias SQLite, 20 integración
SQLite y 9 E2E SQLite aprobadas (134 total); build/dry-run correctos. Bundle 121.90 KiB
frente a 1,293.52 KiB. No incluye httpServerHandler ni Express. Tres archivos SQLite
originales comparados por hash: intactos.

T109: export/restauración previa 60,250 bytes, 27 tablas, integridad ok, FK 0 y recuentos
iguales. Versión staging `76534b2c-9ab0-402b-8c77-617112fdbf8a`, D1 OPEN, namespace y
secretos conservados. Comparación con respaldo: 10 cuentas originales ajenas al ADMIN
de pruebas permanecieron exactamente iguales, incluida la personal; FK 0. El ADMIN
sintético solo cambió su propia contraseña/versión en la prueba autorizada.

T110: 40/40 comprobaciones API de compra/roles/password, 31/31 de CRUD adicional y 3/3
E2E reales alojados (94.125 s, cero omitidos/reintentos). REJECTED no descuenta stock;
APPROVED descuenta una vez y replay no duplica. Historial/seguimiento, base de precio,
imágenes, promociones, movimientos, clientes y bajas lógicas verificados. Pedido
conserva snapshots después de la baja. Password sintético exige actual, revoca otra
sesión, rechaza anterior y acepta nueva; la cuenta personal no se utilizó.

CPU de plataforma en ejecuciones aprobadas: 40+75+31=146 invocaciones tail, máximo 9 ms
(rangos 2–9, 1–8 y 2–9). Analytics inicial: 41 invocaciones, 0 errores, mayor P99 de
bucket 9,912 microsegundos=9.912 ms. CPU no es wall time ni P99 un máximo individual.
No hubo 1102 ni exceso observado. Consulta final Analytics no disponible por rate
limiter; se conserva el agregado inicial separado sin presentarlo como lectura final.
No se forzó isolate nuevo por solicitud; carga/memoria/margen robusto y cuotas
compartidas siguen pendientes. D1 leído tras primeros recorridos: 323,584 bytes,
28,096 filas leídas/1,997 escritas en 24h de esta base, sin inferir cuota de cuenta.

El primer script CRUD asumió la primera página de inventario y se detuvo después de
15 respuestas correctas; se corrigió filtrando SKU y pasó 31/31 al repetir. Ese intento
inicial, con CPU hasta 7 ms, queda privado y separado del conteo de aprobación.

T111: README, cloud/README, quickstart y cloud/deploy/native-fetch-validation.md indican
aptitud para los recorridos críticos de demostración. Correo permanece deshabilitado
según prioridad autorizada: T102/R-EMAIL/T103, T075 integral, T104/T105/importación real,
recuperación completa, Builds, producción/corte y revisiones manuales siguen pendientes.
T034 conserva su aceptación integral pendiente por sus dependencias, sin ocultar que
la publicación y los E2E de demostración de T109/T110 sí están verificados.

T112 en curso: revisión Git sin secretos conocidos en 326 archivos y cuatro revisiones;
falta completar commit/push y verificar remoto. No se marcan aún como realizados.
Conteo antes de publicar: 75/112 completas, 37 pendientes. Ningún recurso antiguo,
producción o plan pagado fue modificado. No se migraron datos reales.

**Cierre T112**: commit de implementación `6e519d4` publicado en main del repositorio
`7172MichaJosu/JM-STORE-ECOMMERCE-SDD`. Se confirmó el mismo hash mediante ls-remote.
Revisión de 30 archivos preparados (390,260 bytes): sin patrones de credenciales,
bases de datos, archivos privados ni UID personal. El escaneo adicional de valores
secretos conocidos no encontró coincidencias en 326 archivos o el historial revisado.
`.env.local`, `.dev.vars`, SQLite, backups y cloud/private permanecen ignorados y fuera
del commit. Árbol limpio verificado tras ese push; esta anotación registra el resultado
después de realizado, sin marcar publicación anticipadamente.

Conteo final del incremento: **76/112 tareas completas, 36 pendientes**. T106–T112 y
T074 terminadas; la feature integral no se declara completa. [Demostración y evidencia](../../cloud/deploy/native-fetch-validation.md).
