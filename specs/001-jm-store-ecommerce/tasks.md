---
description: "Tareas para implementar JM-STORE según Spec Kit"
---

# Tasks: JM-STORE Ecommerce MVP

**Input**: Documentos de diseño en `specs/001-jm-store-ecommerce/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Incluidas porque la Constitution y FR-024 exigen pruebas funcionales del recorrido crítico y verificación de aceptación. Las tareas de prueba se escriben antes de la implementación de cada historia.

**Organization**: Historias ordenadas por prioridad de Specify; la compra (US3) depende de catálogo y cuenta (US1, US2), y administración completa (US4) depende de que existan pedidos.

## Format: `[ID] [P?] [Story] Descripción`

- **[P]**: puede realizarse en paralelo, en archivos distintos y sin dependencia pendiente.
- **[US#]**: historia de usuario de `spec.md`; Setup, Foundation y Polish no usan etiqueta de historia.
- Todas las tareas indican rutas exactas relativas a la raíz.
- IDs consecutivos reflejan el orden de dependencias; una tarea paralela puede avanzar junto a otra marcada `[P]` del mismo bloque.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Crear los workspaces y herramientas mínimas de React/Vite y Express/SQLite.

- [X] T001 Crear `package.json` raíz con npm workspaces `client` y `server`, scripts `dev`, `build`, `start`, `test`, `test:integration`, `test:e2e`, `db:migrate`, `db:seed`, `admin:provision`, `db:backup` y `db:reset-demo`, sin implementar todavía lógica de aplicación.
- [X] T002 [P] Crear `client/package.json` y `client/vite.config.js` con React y Vite estables compatibles con Node 24, React Router 7 y proxy `/api` a `http://127.0.0.1:3001`.
- [X] T003 [P] Crear `server/package.json` ESM con Express 5, Helmet y express-rate-limit; añadir `@playwright/test` como devDependency del workspace raíz porque `tests/e2e/` vive en la raíz; documentar `node:sqlite` sin paquete nativo.
- [X] T004 [P] Crear `.gitignore` para `node_modules/`, `.env*` con excepción `.env.example`, `server/data/*.sqlite*`, `backups/`, `playwright-report/` y `test-results/`; mantener versionado el manifiesto público de atribución de imágenes.
- [X] T005 [P] Crear `.env.example` con nombres inocuos `NODE_ENV`, `HOST`, `PORT`, `APP_ORIGIN`, `DATABASE_PATH` y `QUOTE_SECRET`; no incluir valores secretos ni credenciales administrativas.
- [X] T006 Crear `README.md` con requisitos Node 24 LTS y npm 11, límites de alcance del MVP, enlaces a `specs/001-jm-store-ecommerce/quickstart.md` y aviso de que el pago es solo simulado.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura común de persistencia, validación, errores y seguridad que requieren todas las historias.

**CRITICAL**: Ninguna historia comienza antes de completar esta fase.

- [X] T007 Implementar apertura y cierre de SQLite en `server/src/db/connection.js`, habilitando `PRAGMA foreign_keys=ON`, WAL, `synchronous=FULL` y timeout de espera de 5000 ms para escrituras según `data-model.md`.
- [X] T008 Implementar el ejecutor de migraciones ordenadas en `server/src/db/migrate.js`, que registra `schema_migrations(version, applied_at)`, aplica cada versión una vez y nunca inicializa una base vacía de forma silenciosa ante error.
- [X] T009 [P] Crear `server/src/lib/money.js` con importes como céntimos enteros PEN, redondeo mitad hacia arriba, subtotales y comprobación de total máximo `990000000000` sin aritmética decimal binaria.
- [X] T010 [P] Crear `server/src/lib/errors.js` y `server/src/middleware/error-handler.js` para `{error:{code,message,fields?,requestId}}`, ocultando SQL, stack y secretos, con los estados HTTP fijados en `contracts/api.md`.
- [X] T011 Configurar Express en `server/src/app.js` y `server/src/server.js` con `HOST=127.0.0.1`, `PORT=3001`, Helmet, JSON de máximo 100 KiB, estáticos del build, fallback SPA que excluye `/api`, cierre limpio de DB y `/api/health` sin revelar rutas internas.
- [X] T012 Crear `server/src/config.js` y `server/src/middleware/request-context.js` con carga de `.env.local` desde la raíz, validación de `APP_ORIGIN`, `DATABASE_PATH` y secreto `QUOTE_SECRET` de al menos 32 bytes; asignar `requestId` y no registrar cookies ni cuerpos privados.
- [X] T013 [P] Crear `server/tests/unit/money.test.js` y `server/tests/integration/database.test.js` para céntimos, límites, FK, WAL y aplicación de migraciones una sola vez; usar DB temporal fuera de `server/data/`.
- [X] T014 Crear `server/src/middleware/csrf.js` con validación de `Origin` contra `APP_ORIGIN` y contrato de token CSRF por sesión; exigirlo en todos los métodos de escritura, incluidos registro e inicio de sesión.

**Checkpoint**: la aplicación arranca, devuelve errores uniformes, abre DB persistente y las escrituras quedan protegidas por origen/CSRF.

---

## Phase 3: User Story 1 - Descubrir y elegir productos (Priority: P1) 🎯 MVP

**Goal**: Explorar categorías, buscar y filtrar productos persistidos, y consultar detalles y precios verificables.

**Independent Test**: Cargar seed, abrir portada, filtrar por texto/categoría/precio/stock y abrir detalle de producto activo; verificar vacío, precio PEN y promoción vigente.

### Tests for User Story 1

> Escribir primero y comprobar que fallan antes de desarrollar la historia.

- [X] T015 [P] [US1] Crear `server/tests/contract/catalog.contract.test.js` para `GET /api/categories`, `GET /api/products` y `GET /api/products/:slug` según `contracts/api.md`, incluyendo búsqueda vacía y filtros combinados.
- [X] T016 [P] [US1] Crear `server/tests/integration/catalog.test.js` para producto/categoría inactivos, promociones vencidas, límites de precio y categoría vacía con DB temporal.
- [X] T017 [P] [US1] Crear `tests/e2e/catalog.spec.js` para portada, búsqueda, categoría, producto sin foto, estado vacío y precios en S/ usando fixtures locales.

### Implementation for User Story 1

- [X] T018 [US1] Crear `server/migrations/001-catalog.sql` para `categories` con `name` de 2..80 y `slug` único, y `products` con `sku` único de 1..64, `slug` único, `name` de 2..120, `description` de 1..4000, `base_price_cents` entero de 1..100000000, `category_id` FK y banderas de publicación.
- [X] T019 [US1] Añadir `product_images`, `inventory` y restricciones a `server/migrations/001-catalog.sql`: 0..4 imágenes por producto, `alt_text` requerido, ruta de asset local permitida y stock entero 0..1000000 con FK al producto.
- [X] T020 [US1] Añadir `promotions` e índices de catálogo en `server/migrations/001-catalog.sql`: un objetivo exacto producto/categoría, precio final menor al base o porcentaje `1..9999` puntos básicos, `starts_at < ends_at` y sin solapamientos vigentes para el mismo objetivo.
- [X] T021 [US1] Implementar repositorio parametrizado, filtros/paginado máximo 100 y `server/src/modules/catalog/catalog.service.js` con producto vigente antes que categoría y redondeo entero descrito en `data-model.md`.
- [X] T022 [US1] Implementar consultas públicas y validación de `q` de máximo 100 caracteres, `minPriceCents <= maxPriceCents`, orden relevance/price_asc/price_desc/name y 404 para slug inactivo en `server/src/modules/catalog/catalog.routes.js`.
- [X] T023 [US1] Crear `client/src/services/api.js`, `client/src/components/SearchBar.jsx`, `ProductCard.jsx`, `ProductGrid.jsx`, `CategoryStrip.jsx`, `CategoryTiles.jsx`, `Price.jsx` y `EmptyState.jsx` consumiendo los contratos, con carga, vacío y error visibles.
- [X] T024 [US1] Crear `client/src/pages/HomePage.jsx`, `CatalogPage.jsx`, `ProductPage.jsx` y `client/src/app/router.jsx` para `/`, `/catalogo`, `/categorias/:slug` y `/productos/:slug`; conservar filtros en URL.
- [X] T025 [US1] Crear `client/public/images/demo/manifest.json` y assets locales licenciados/neutrales de los 20 productos previstos en `contracts/ui.md`, con URL de origen, autor/licencia, fecha y texto alternativo; usar placeholder neutral si falta fotografía.
- [X] T026 [US1] Implementar `server/scripts/seed.js` y `server/src/modules/catalog/seed-data.js` con 5 categorías, 20 productos genéricos, precios/stock deterministas, artículo agotado y una promoción de demostración identificada; seed repetido no sobrescribe compras, precios o stock editados.
- [X] T027 [US1] Ejecutar `server/tests/contract/catalog.contract.test.js`, `server/tests/integration/catalog.test.js` y `tests/e2e/catalog.spec.js`; corregir fallas de búsqueda, filtros, precio efectivo, imagen y estado vacío antes de cerrar el checkpoint.

**Checkpoint**: visitante encuentra productos reales de DB y ve detalle, existencia y promoción vigente sin claims inventados.

---

## Phase 4: User Story 2 - Registrarse y mantener una cuenta (Priority: P1)

**Goal**: Registro y acceso de clientes, sesión revocable, perfil/direcciones y cuenta de ADMIN provisionada, sin alta pública de rol.

**Independent Test**: Registrar cliente nuevo, iniciar/cerrar sesión, persistir una dirección, comprobar propiedad y denegar acceso a ADMIN; provisionar administrador por comando seguro.

### Tests for User Story 2

> Escribir primero y comprobar que fallan antes de desarrollar la historia.

- [X] T028 [P] [US2] Crear `server/tests/contract/auth.contract.test.js` para GET session, registro, login, logout, CSRF, cuenta duplicada, contraseña incorrecta y no aceptación de `role`/`is_active` del cliente.
- [X] T029 [P] [US2] Crear `server/tests/integration/account.test.js` para titularidad 404, sesión expirada/inactiva, rotación de token, direcciones y rechazo de acceso administrativo de CUSTOMER.
- [X] T030 [P] [US2] Crear `tests/e2e/account.spec.js` para registrar, autenticar, editar perfil, crear/editar dirección, salir y volver a entrar.

### Implementation for User Story 2

- [X] T031 [US2] Crear `server/migrations/002-identity.sql` con `roles.code` único `CUSTOMER|ADMIN`; `users.email` único y almacenado trim/lowercase ASCII, máximo 254, `name` 2..100, `phone` opcional 7..20, `password_hash` requerido (sin contraseña en texto), `role_id` FK, `is_active` y `version`.
- [X] T032 [US2] Añadir `sessions` y `addresses` a `server/migrations/002-identity.sql`: `token_hash` único de token aleatorio de 32 bytes, `csrf_token` aleatorio, expiración absoluta 8 h/inactiva 30 min; direcciones con `recipient` 2..100, `phone` 7..20 requerido, `region/province/district` 2..100, `street` 5..200 y `reference` opcional <=200; sesión invitada sin Max-Age y limpieza de carrito anónimo huérfano a 24 h.
- [X] T033 [US2] Implementar `server/src/lib/passwords.js` con scrypt asíncrono N=131072, r=8, p=1, salt aleatoria >=16 bytes, maxmem 192 MiB, comparación de longitud fija y máximo dos hashes concurrentes.
- [X] T034 [US2] Implementar `server/src/modules/auth/session.service.js`, middleware de cookie opaca HttpOnly/SameSite=Lax, Secure bajo HTTPS, rotación al registrar/login, revocación al logout/desactivar, expiración de 8 h absoluta y 30 min inactiva.
- [X] T035 [US2] Implementar `server/src/modules/auth/auth.routes.js`: GET session, POST register y login, POST logout; correo trim/lowercase <=254, contraseña 12..128 sin recorte, errores genéricos y registro que solo asigna `CUSTOMER`.
- [X] T036 [US2] Implementar `server/src/modules/customers/customer.routes.js` para GET/PATCH `/me` y CRUD de direcciones propias, campos explícitos y control de versión; jamás devolver `password_hash`.
- [X] T037 [US2] Implementar `server/src/middleware/auth.js` y `server/src/middleware/rate-limit.js` para consultar usuario activo/rol en cada petición, 401/403/404 de titularidad y límites login 10/15 min y registro 5/15 min por IP+cuenta.
- [X] T038 [US2] Crear `server/scripts/provision-admin.js` que requiere `ADMIN_EMAIL` y `ADMIN_PASSWORD` local, aplica hash, crea únicamente primer rol ADMIN, no imprime secreto, rechaza auto-promoción y elimina la necesidad de ADMIN_PASSWORD al terminar.
- [X] T039 [US2] Ejecutar `server/tests/contract/auth.contract.test.js`, `server/tests/integration/account.test.js` y `tests/e2e/account.spec.js`, incluida revocación de sesión al desactivar la cuenta.

**Checkpoint**: CUSTOMER accede a su perfil/direcciones; el panel solo admite la cuenta ADMIN provisionada y revocable.

---

## Phase 5: User Story 3 - Completar una compra y consultar el pedido (Priority: P1)

**Goal**: Carrito persistido para cliente, cotización revisable, pago simulado aprobado/rechazado, pedido e historial con stock correcto.

**Independent Test**: Con catálogo US1 y cuenta/dirección US2, añadir productos, completar rechazo sin descuento, reintentar aprobación una sola vez, reiniciar servidor y consultar el mismo pedido.

### Tests for User Story 3

> Escribir primero y comprobar que fallan antes de desarrollar la historia.

- [X] T040 [P] [US3] Crear `server/tests/contract/checkout.contract.test.js` para cart, quote, create-order, payment retry, idempotency y errores 409/422/503 según `contracts/api.md`.
- [X] T041 [P] [US3] Crear `server/tests/integration/checkout-transaction.test.js` para rechazo intacto, aprobación atómica, reintento mismo pedido, fallo/rollback, dos compradores para una unidad y clave idempotente con cuerpo igual/distinto.
- [X] T042 [P] [US3] Crear `tests/e2e/checkout.spec.js` para registro/login, dirección, carrito, rechazo, historial, reintento aprobado y persistencia tras reinicio usando DB aislada.

### Implementation for User Story 3

- [X] T043 [US3] Crear `server/migrations/003-cart.sql` con un carrito por usuario autenticado o sesión invitada, propietario exactamente uno, líneas PK `(cart_id,product_id)`, cantidad 1..99 y máximo 100 líneas distintas.
- [X] T044 [US3] Crear `server/src/modules/cart/cart.service.js` y `cart.routes.js` con PUT de cantidad absoluta, quitar línea, stock advertido sin reserva, carrito anónimo persistido por sesión, restauración del carrito del cliente y aviso de que no se fusionan carritos al ingresar.
- [X] T045 [US3] Crear `server/migrations/004-orders.sql` con `orders.status` CHECK `AWAITING_PAYMENT|CONFIRMED|PREPARING|SHIPPED|DELIVERED`, `payment_status` CHECK `REJECTED|APPROVED`, `currency=PEN`, importes enteros seguros <=990000000000 y cliente requerido; guardar snapshots `recipient/phone/region/province/district/street/reference`, y `order_items` inmutables con SKU/nombre, precio entero, `quantity` 1..99 y `line_total_cents=unit_price_cents*quantity`.
- [X] T046 [US3] Añadir `simulated_payments`, `inventory_movements`, `order_status_history` e `idempotency_records` a `server/migrations/004-orders.sql`: pago `outcome=APPROVED|REJECTED`, `amount_cents` igual al pedido, `currency=PEN`, un único APPROVED; movimiento SALE con `delta<0`, `quantity_after>=0`, `order_id/product_id` únicos por venta; historial con actor/to_status requerido; idempotencia con `UNIQUE(user_id,operation,key)`, `request_hash`, `response_status` y `response_json`.
- [X] T047 [US3] Implementar cotización HMAC en `server/src/lib/quotes.js` con user, alcance CART/ORDER, id/version, nonce, fingerprint y vencimiento 5 min; no incluir contraseña ni dirección completa y renovar ante cambio material.
- [X] T048 [US3] Implementar `server/src/lib/idempotency.js` para `Idempotency-Key` UUID, hash del cuerpo y respuesta JSON persistida; devolver resultado original para repetición exacta y 409 `IDEMPOTENCY_CONFLICT` si cambia el cuerpo.
- [X] T049 [US3] Implementar `server/src/modules/checkout/checkout.service.js` con BEGIN IMMEDIATE, relectura de precio/promoción/stock/dirección, pedido pendiente e intento REJECTED sin movimiento para rechazo, y APPROVED + CONFIRMED + descuento condicional + movimientos + respuesta idempotente en una única transacción.
- [X] T050 [US3] Completar `checkout.service.js` para reintentar el mismo pedido `AWAITING_PAYMENT`, preservar snapshots/intententos y cart editado, requerir carrito nuevo si cambió el precio (`NEW_CHECKOUT_REQUIRED`) y no permitir segundo pago aprobado ni doble descuento.
- [X] T051 [US3] Implementar `server/src/modules/checkout/checkout.routes.js` con POST quote, create-order, payment-quote y simulated-payments; convertir stock/tokens/cambios en errores 409 especificados y timeout DB en 503 recuperable.
- [X] T052 [US3] Implementar `server/src/modules/orders/orders.routes.js` para listado/detail solo titular con snapshots, historial e intentos separados; confirmar pago/stock antes de responder éxito.
- [X] T053 [US3] Implementar `client/src/pages/CartPage.jsx`, `CheckoutPage.jsx`, `OrderListPage.jsx`, `OrderDetailPage.jsx` y componentes `MiniCart.jsx`, `QuoteSummary.jsx`, `PaymentChoice.jsx`, `OrderTimeline.jsx`; elegir sin preselección rechazo/aprobación y mostrar aviso de cero cobros.
- [X] T054 [US3] Implementar persistencia de `Idempotency-Key` por intención en `client/src/services/checkout.js`, doble clic bloqueado, recuperación ante timeout con misma clave y reintento explícito con nueva cotización.
- [X] T055 [US3] Ejecutar `server/tests/contract/checkout.contract.test.js`, `server/tests/integration/checkout-transaction.test.js` y `tests/e2e/checkout.spec.js`; cumplir SC-003/004 antes de iniciar administración completa.

**Checkpoint**: pedido rechazado queda pendiente sin descuento; aprobado confirma el mismo pedido y descuenta una vez; importe y estado persisten tras reiniciar.

---

## Phase 6: User Story 4 - Administrar catálogo y operación (Priority: P1)

**Goal**: ADMIN mantiene productos, imágenes, precios, categorías, promociones, stock, clientes y estados de pedidos mediante la misma DB del storefront.

**Independent Test**: Crear/publicar producto con imagen local y stock, verlo en la tienda, crear cliente/pedido, ajustar stock con motivo, cambiar estado permitido y observarlo en la cuenta titular.

### Tests for User Story 4

> Escribir primero y comprobar que fallan antes de desarrollar la historia.

- [X] T056 [P] [US4] Crear `server/tests/contract/admin.contract.test.js` para todas las rutas de `contracts/api.md`, rechazo a CUSTOMER, schemas inválidos y control de versión.
- [X] T057 [P] [US4] Crear `server/tests/integration/admin.test.js` para alta/desactivación, historial FK RESTRICT, movimientos actor/motivo, solapamiento de promociones y transiciones inválidas de pedido.
- [X] T058 [P] [US4] Crear `tests/e2e/admin.spec.js` para login ADMIN, alta/edición de producto, categoría, imagen de biblioteca, promoción, ajuste stock, cliente y pedido.

### Implementation for User Story 4

- [X] T059 [US4] Implementar guard `ADMIN` y validación de propiedad/rol para rutas en `server/src/modules/admin/admin.routes.js`; no permitir editar directamente `payment_status`, hash, email/rol de cliente ni borrar historial.
- [X] T060 [US4] Implementar `server/src/modules/admin/products.routes.js` y `products.service.js` para CRUD lógico de producto y categorías, optimistic locking, categoría activa y límites de FR-003/data-model; excluir inventario de PATCH de producto.
- [X] T061 [US4] Implementar `server/src/modules/admin/images.routes.js` y `image-library.js` para seleccionar 0..4 rutas de biblioteca `client/public/images/demo/`, validar ruta local segura, ordenar y exigir `alt_text`; rechazar URLs y paths arbitrarios.
- [X] T062 [US4] Implementar `server/src/modules/admin/promotions.routes.js` y `promotions.service.js` para precio final menor al base o `PERCENT_BPS` 1..9999, objetivo único, vigencia, terms 1..500, sin solapamientos y sin precio efectivo cero.
- [X] T063 [US4] Implementar `server/src/modules/admin/inventory.routes.js` para ajuste de stock con `expectedVersion`, cantidad nueva 0..1000000, reason 3..200, actor y `inventory_movements` atómicos.
- [X] T064 [US4] Implementar `server/src/modules/admin/customers.routes.js` para lista/detalle de CUSTOMER sin hash, edición de `name` 2..100 y `phone` opcional 7..20, y desactivación que revoca todas las sesiones.
- [X] T065 [US4] Implementar `server/src/modules/admin/orders.routes.js` para pedidos, snapshots, filtros y transiciones únicas `CONFIRMED->PREPARING->SHIPPED->DELIVERED`, creando historial por actor y versión.
- [X] T066 [US4] Crear `client/src/admin/AdminLayout.jsx`, `AdminDashboardPage.jsx`, `AdminProductsPage.jsx`, `AdminProductFormPage.jsx`, `AdminCategoriesPage.jsx`, `AdminPromotionsPage.jsx`, `AdminInventoryPage.jsx`, `AdminCustomersPage.jsx`, `AdminOrdersPage.jsx` y `AdminOrderDetailPage.jsx` según `contracts/ui.md`.
- [X] T067 [US4] Conectar formularios y tablas admin en `client/src/admin/adminApi.js`, con errores por campo, 401/403/409, estados vacíos y recarga sin sobrescribir ediciones concurrentes.
- [X] T068 [US4] Ejecutar `server/tests/contract/admin.contract.test.js`, `server/tests/integration/admin.test.js` y `tests/e2e/admin.spec.js`; comprobar que cada cambio admin aparece inmediatamente en storefront y detalle del pedido.

**Checkpoint**: ADMIN gestiona los datos que ven cliente y tienda; CUSTOMER/visitante no pueden ejecutar ninguna operación de panel.

---

## Phase 7: User Story 5 - Usar la tienda en distintos dispositivos (Priority: P2)

**Goal**: Completar fidelidad visual a referencia, responsive, tema claro/oscuro, controles accesibles y animaciones breves, con el flujo real ya funcional.

**Independent Test**: Recorrer catálogo, login, carrito, checkout, pedidos y panel en 360/1280 px, teclado, lector de estados y ambos temas; comprobar `prefers-reduced-motion`.

### Tests for User Story 5

- [X] T069 [P] [US5] Añadir `tests/e2e/responsive-accessibility.spec.js` para 360/1280 px, foco visible, flujo teclado, labels, contraste AA, tema persistido y movimiento reducido en rutas cliente/admin.
- [X] T070 [P] [US5] Añadir fixtures/viewport a `playwright.config.js` y `tests/e2e/fixtures/accessibility.js` sin cambiar reglas de negocio ni datos de producción.

### Implementation for User Story 5

- [X] T071 [US5] Implementar tokens de color, superficies, tipografía, espaciado y foco AA en `client/src/styles/tokens.css`, `themes.css` y `base.css` con amarillo/azul/blanco y tema oscuro legible.
- [X] T072 [US5] Implementar `client/src/app/ThemeProvider.jsx` con preferencia del sistema inicial, selector claro/oscuro y persistencia solo del tema en localStorage; no guardar sesión ni credenciales en navegador.
- [X] T073 [US5] Aplicar layout 360..1280 px, grillas, menú móvil, product cards, tablas adaptables y mini carrito en `client/src/styles/layout.css` y `components.css` sin overflow horizontal.
- [X] T074 [US5] Implementar `client/src/components/HeroCarousel.jsx`, CTA al catálogo real y CategoryTiles con controles de teclado/foco, sin avance automático, banners genéricos y sin descuentos no configurados.
- [X] T075 [US5] Añadir estados accesibles de foco/hover/error/stock y anuncios `aria-live` en `client/src/components/` y `client/src/styles/accessibility.css`; respetar `prefers-reduced-motion` con animaciones de 150..250 ms o apagadas.
- [X] T076 [US5] Corregir cualquier prueba fallida de `tests/e2e/responsive-accessibility.spec.js` y completar la evaluación de contraste/contenido en rutas cliente/admin.

**Checkpoint**: el recorrido completo funciona con ambos temas y a ambos anchos antes de aceptar detalles secundarios de acabado.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Preparar inicio repetible, seguridad final, documentación del examen y validación de criterios transversales.

- [X] T077 [P] Crear `server/scripts/backup.js` para cerrar/validar DB, copiar conjunto SQLite/WAL/SHM consistente, escribir destino y nunca guardar copias bajo Git.
- [X] T078 Crear `server/scripts/reset-demo.js` con confirmación `JM-STORE-DEMO`, proceso parado, ruta permitida dentro de `server/data/` y backup previo; prohibir uso desde arranque normal.
- [X] T079 [P] Actualizar `README.md` con setup, `.env.local`, seed/provision admin, seguridad de secretos, backup/reset, límites del pago simulado y enlaces Spec Kit.
- [X] T080 [P] Crear `client/public/images/demo/ATTRIBUTION.md` con archivo, descripción, origen, autor, licencia/permiso y fecha para cada imagen distribuida; reemplazar assets que no cumplan licencia o parezcan representar falsamente un producto.
- [X] T081 Ejecutar build de producción, node:test, integración, E2E, flujo `quickstart.md` y carga de referencia de 100 productos/20 sesiones; documentar resultado real y atender cualquier fallo en `specs/001-jm-store-ecommerce/quickstart.md`.
- [X] T082 Revisar rastreo FR-001..024 y SC-001..008 en `specs/001-jm-store-ecommerce/quickstart.md`; solo marcar cada criterio satisfecho con evidencia y guardar cuestiones restantes en el mismo artefacto.

**Definition of Done verificable**: recorrido registro -> catálogo -> carrito -> dirección -> rechazo sin cambio stock -> reintento aprobado -> pedido confirmado con un solo descuento -> panel cambia estado -> cliente ve historial, todo tras reinicio; todos los gates de seguridad y rol pasan; 360/1280 px, temas, teclado y reduced motion verificados; importes S/ consistentes; seed, imágenes y claims comerciales con fuente comprobable; tareas FR/SC mapeadas y sin secretos versionados.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: puede empezar inmediatamente; completa workspaces, ignore y documentación base.
- **Foundational (Phase 2)**: depende de T001..T006; bloquea todas las historias al finalizar T007..T014.
- **US1 Catálogo (Phase 3)** y **US2 Cuenta (Phase 4)** pueden desarrollarse en paralelo después de Foundation; US1 crea productos/categorías, US2 crea clientes/sesiones.
- **US3 Compra (Phase 5)** depende de US1 catálogo/stock y US2 sesión/dirección.
- **US4 Administración (Phase 6)** depende de US1 productos e imágenes, US2 rol ADMIN y US3 pedidos.
- **US5 Responsive y temas (Phase 7)** puede comenzar sobre layouts existentes; ejecutar pasada de validación después de integrar US1..US4.
- **Polish (Phase 8)** depende de los recorridos P1 y UX P2 seleccionados; prepara respaldo, guía y chequeo final.

### User Story Dependencies

- **US1 (P1)**: Foundation; independiente de otras historias para explorar catálogo.
- **US2 (P1)**: Foundation; independiente de US1 para probar cuenta y direcciones.
- **US3 (P1)**: requiere US1 producto/stock y US2 autenticación/dirección; integra compra y pedido completos.
- **US4 (P1)**: requiere US1 entidades de catálogo, US2 sesiones/rol y US3 pedidos/detalles.
- **US5 (P2)**: requiere esqueleto de rutas y componentes de historias anteriores; se valida sobre la tienda completa.

### Parallel Opportunities

- Setup: T002..T005 en archivos separados después de T001.
- Foundation: T009 y T010 pueden avanzar en paralelo; T013 pruebas aisladas puede escribirse junto a la conexión/migración.
- US1: T015..T017 son archivos de prueba separados; migración y componentes se pueden repartir después de las pruebas.
- US2: T028..T030 son pruebas separadas; T031..T032 dependen solo de migration ordering, mientras T033 puede desarrollarse aparte.
- US3: T040..T042 son suites separadas; cotizaciones/idempotencia solo paralelas si mantienen módulos separados; no paralelizar dos ediciones al mismo archivo de servicio.
- US4: T056..T058 pruebas separadas; módulos routes por entidad pueden trabajarse por responsables distintos tras contratos comunes.
- US5: T069..T070 pruebas separadas; CSS de temas y Playwright pueden avanzar en archivos diferentes.
- Polish: T077, T079 y T080 se encuentran en archivos distintos; T081 depende de la integración completa.

### Parallel Example: User Story 3

```text
# Tras T001..T014 y con US1/US2 disponibles:
T040 -> server/tests/contract/checkout.contract.test.js
T041 -> server/tests/integration/checkout-transaction.test.js
T042 -> tests/e2e/checkout.spec.js
# Estos tres archivos de prueba se pueden crear en paralelo.
# Después de que fallen según lo esperado, implementar en secuencia:
T043..T046 -> migraciones cart y orders
T047..T048 -> server/src/lib/quotes.js y idempotency.js
T049..T052 -> servicio transaccional y rutas
T053..T054 -> pantallas cliente y clave de repetición
T055 -> ejecutar pruebas y cerrar checkpoint
```

---

## Implementation Strategy

### MVP First: recorrido completo P1

1. Completar Setup y Foundation.
2. Completar US1 catálogo y US2 cuenta; validar cada historia con sus pruebas independientes.
3. Completar US3 carrito, rechazo sin stock, reintento aprobado y pedido persistido.
4. Completar US4 panel operativo mínimo para producto, categoría, imagen, precio, promoción, stock, cliente y pedido.
5. Verificar Definition of Done del recorrido de examen antes de ampliar detalles visuales.
6. Completar US5 responsive/tema/accesibilidad y Polish en paralelo solo donde archivos no colisionen.

### Incremental Delivery

- Después de US1, visitante puede explorar el catálogo con datos de DB.
- Después de US2, un cliente mantiene perfil/dirección y el acceso admin es seguro.
- Después de US3, el examen ya demuestra pedido rechazado y aprobado, con stock verificable.
- Después de US4, se administran entidades del recorrido desde panel.
- US5 y Polish completan apariencia y comprobación de presentación completa.

No tratar US1 como único MVP de entrega final: el alcance aprobado para el examen requiere como mínimo US1, US2, US3 y capacidades esenciales de US4.

---

## Notes

- `[P]` significa archivos diferentes y ninguna dependencia pendiente.
- Las etiquetas `[US1]`..`[US5]` siguen las cinco historias de `spec.md`.
- Toda prueba DB usa temporal y rechaza rutas de DB de demo.
- Un rechazo simulado deja el pedido pendiente con intento REJECTED; aprobación confirma y descuenta stock una vez; no hay cobro real.
- Versiones/estados válidos y límites de campos se describen con sus restricciones en las tareas de migración/validación para evitar decisiones implícitas durante Implement.
- Confirmar que ningún secreto, base de datos, sesión, datos personales de demo ni backup entra al control de versiones.
- La lista se generó en Tasks y se ejecutó en Implement; la evidencia actual se registra abajo. La feature permanece abierta.

## Verificación de Implement — 2026-11-03

Las 82 tareas técnicas están implementadas y verificadas. Se aprobaron 3 pruebas de
unidades, 20 de API/integración y 9 de navegador; el build de producción es correcto.
Evidencia, alcance de las pruebas y trazabilidad FR/SC: [quickstart.md](quickstart.md).

La aceptación con 10 participantes (SC-001) y la medición humana de tiempo de SC-002
siguen pendientes. T082 corresponde a la revisión y registro de esos criterios, no a
afirmar que hubo participantes. No se cierra la feature ni se crea un commit adicional;
se conserva el WIP `d98a94d` y los archivos anteriores.
