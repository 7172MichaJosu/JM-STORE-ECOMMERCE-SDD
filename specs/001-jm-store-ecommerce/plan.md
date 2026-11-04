# Implementation Plan: JM-STORE Ecommerce MVP

**Branch**: `001-jm-store-ecommerce` (identificador Spec Kit)
| **Date**: 2026-11-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-jm-store-ecommerce/spec.md`

## Summary

Planificar una tienda con registro, catálogo, carrito, direcciones, pago simulado,
historial y panel administrativo conectados a SQLite. React/Vite presenta la interfaz y
Express concentra validación, autorización, precios y transacciones. Se preservan todas
las decisiones de Clarify: elección aprobado/rechazado sin cobros, rechazo persistido sin
descontar stock, reintento válido, administrador provisionado y aprobación atómica.

Este documento conserva el diseño aprobado durante Plan. La aplicación y sus pruebas
se desarrollaron posteriormente en Implement; su estado actual se registra en
[quickstart.md](quickstart.md) y [tasks.md](tasks.md). La rama Git existente y su commit WIP
se preservan durante la continuación, sin crear commits adicionales.

## Technical Context

**Language/Version**: JavaScript ESM, Node 24 LTS >=24.15.0, npm 11; versiones exactas de
dependencias fijadas con lockfile durante Implement.

**Primary Dependencies**: React 19, Vite estable compatible, React Router 7, Express 5,
Helmet y express-rate-limit; node:crypto, node:sqlite y Fetch integrados. Desarrollo:
Playwright; node:test para unidades e integración. CSS propio, sin ORM ni librería global
de estado. Investigación y justificaciones en [research.md](research.md).

Implement añadió Lucide para iconos consistentes y `@axe-core/playwright` como dependencia
de desarrollo para comprobar accesibilidad. No añaden servicios externos al runtime.

**Storage**: SQLite local en `server/data/jm-store.sqlite`, WAL y FK activas; sesiones,
usuarios, catálogo, carrito autenticado, pedidos, intentos y movimientos persistidos.
Fotografías locales en `client/public/images/demo/`; no depender de hotlinks.

**Testing**: node:test con DB temporal y servidor efímero; Playwright para navegador,
permisos, checkout, reinicio, temas y tamaños. Plan describe pruebas; no las ejecuta.

**Target Platform**: Windows local para el examen, navegador actual Chromium/Firefox;
servidor único con filesystem persistente. HTTPS si se publica en una fase posterior.

**Project Type**: Aplicación web client/server en un repositorio con npm workspaces.

**Performance Goals**: En máquina del examen con 100 productos y 20 sesiones de prueba,
95% de búsquedas y navegaciones de catálogo visibles en <=2 s; confirmación en <=3 s
sin contención artificial. Timeout de escritura de 5 s produce error recuperable, nunca
éxito parcial. Checkout de usuario en <4 minutos y SC-001..008 siguen siendo aceptación.

**Constraints**: Moneda PEN en céntimos; sin cobros ni servicios externos; ninguna
credencial en Git. Una instancia de API y disco local; no ofrecer escala distribuida.
node:sqlite RC aceptado para el runtime concreto y encapsulado. Presupuesto de memoria
de referencia: 1 GiB disponible para servidor y hashing; como máximo dos hashes a la vez.

**Scale/Scope**: Seed de 20 productos en 5 categorías, hasta 4 imágenes por producto,
100 artículos distintos por carrito, hasta 99 unidades por línea y 100 productos en
validación de carga. Límites de datos y rutas se concretan en los contratos.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Regla | Antes de investigación | Después del diseño / evidencia |
|---|---|---|
| I. SDD y trazabilidad | PASS: Specify y cinco respuestas Clarify disponibles | PASS: diseño enlaza FR/SC; Tasks e Implement pendientes |
| II. Persistencia y consistencia | PASS: SQLite y transacción de compra previstos | PASS: restricciones, idempotencia y snapshots en data-model |
| III. Seguridad | PASS: roles y administrador seguro aprobados | PASS: scrypt, sesiones persistentes, CSRF y contratos con titularidad |
| IV. Recorrido completo y soles | PASS: incluye tienda y toda administración requerida | PASS: rutas y pruebas cubren registro, compra e historial |
| V. Simplicidad, pruebas y documentación | PASS: monolito modular local | PASS: guía reproducible, pruebas definidas y sin integraciones |
| Diseño y veracidad comercial | PASS: referencia visual y restricciones conocidas | PASS: ui-contract define composición y claims verificados |
| Migraciones, configuración y respaldo | PASS: requisitos incorporados | PASS: quickstart y data-model definen persistencia y recuperación |

No hay violaciones de la Constitution. La simulación está etiquetada como tal y sus
resultados son reales en la base de datos; nunca representa un cobro bancario.
El TODO de fecha original de ratificación no se inventa ni se enmienda desde Plan.

## Project Structure

### Documentation (this feature)

```text
specs/001-jm-store-ecommerce/
  spec.md
  checklists/requirements.md
  plan.md
  research.md
  data-model.md
  contracts/
    api.md
    ui.md
  quickstart.md
```

`tasks.md` corresponde a un comando posterior y no se crea en Plan.

### Source Code (repository root)

Estructura propuesta para Implement; estos archivos no se generan ahora:

```text
package.json                    # workspaces client/server; scripts agregados
package-lock.json
.env.example                    # nombres y valores inocuos, sin secretos
.gitignore                      # .env*, DB/WAL/SHM, backups, node_modules, resultados
client/
  package.json
  vite.config.js
  public/images/demo/            # fotografías locales y manifiesto de licencias
  src/
    main.jsx
    app/                         # Router, AuthProvider, CartProvider, ThemeProvider
    components/                  # Header, SearchBar, HeroCarousel, CategoryStrip
                                 # ProductCard, ProductGrid, MiniCart, Price, FormField
                                 # StatusBadge, ErrorState, AdminLayout, DataTable
    pages/                       # Home, Catalog, Product, Login, Register, Cart
                                 # Checkout, Profile, Addresses, Orders, OrderDetail
    admin/                       # Login, Dashboard, Products, ProductForm, Categories
                                 # Promotions, Inventory, Customers, Orders, OrderDetail
    services/api.js              # Fetch, cookies, CSRF y errores uniformes
    styles/                      # tokens, base, componentes, temas, reduced-motion
server/
  package.json
  data/                          # runtime ignorado en Git
  src/
    app.js                       # middleware, API, estáticos, errores
    server.js                    # arranque y cierre limpio
    config.js
    db/                          # conexión, repositorios SQL y migrador
    middleware/                  # sesión, CSRF, auth, roles, límites y validación
    modules/                     # auth, customers, catalog, cart, checkout, orders, admin
                                 # cada módulo: routes, service, repository, validation
    lib/                         # money, passwords, quotes, idempotency, errors
  migrations/                    # SQL numerado, exclusivo del backend
  scripts/                       # migrate, seed, provision-admin, backup, reset-demo
  tests/                         # unit, integration y contratos HTTP
tests/e2e/                       # Playwright y fixtures aislados
playwright.config.js
README.md
```

**Structure Decision**: Dos workspaces sin monorepo framework. Services contienen reglas
de negocio; repositorios concentran SQL; React maneja presentación y estado de interacción.
No duplicar cálculo de precios autoritativo en cliente. Las rutas se fijan en
[API](contracts/api.md) y [UI](contracts/ui.md).

## Complexity Tracking

No se requieren excepciones. Cotización firmada, idempotencia y transacción son controles
necesarios para FR-010/011 y SC-004, no servicios separados.

## Phase 0 — Research

Finalizada en [research.md](research.md): selección de runtime, SQLite, autenticación,
concurrencia, importes, assets y pruebas. No quedan incógnitas técnicas bloqueantes.

## Phase 1 — Design

- [data-model.md](data-model.md): entidades, FK, validaciones, estados y algoritmo transaccional.
- [contracts/api.md](contracts/api.md): operaciones HTTP, schemas y errores verificables.
- [contracts/ui.md](contracts/ui.md): rutas, componentes, tema y fidelidad a la referencia.
- [quickstart.md](quickstart.md): arranque futuro y escenarios de validación del examen.

### Trazabilidad y pruebas previstas

| Requisitos | Diseño y validación |
|---|---|
| FR-001..003, 013, 020 | Catálogo, filtros, biblioteca de imágenes, promociones; E2E búsqueda y admin |
| FR-004..005, 017 | Carrito DB/sesión, límites, dinero entero; unidades de precios y totales |
| FR-006..008, 014 | Auth, perfil, roles, clientes; registro, 401/403/404 y desactivación |
| FR-009..012, 015..016 | Cotización, pedidos, intentos, snapshots, estados; transacción y reinicio |
| FR-018..019 | UI contract; 360/1280 px, temas, teclado y movimiento reducido |
| FR-021..024 | Validación, errores y fixtures DB; rollback, idempotencia y dos compradores |
| SC-001..008 | Guion reproducible quickstart; métricas son objetivos, no resultados ya logrados |

### Prioridad para la demostración

Fecha objetivo proporcionada: 2026-11-03 a las 17:30, America/Lima. Es un límite de
alcance, no una garantía de entrega ni autorización para implementar desde este comando.
En futuras fases, conservar un recorrido vertical: sesión y datos -> catálogo/carrito ->
pago/pedido/stock -> administración completa básica -> validación y pulido visual.
Tema oscuro, responsive y estados accesibles forman parte del MVP. Hero con controles
manuales y microanimaciones breves bastan; no añadir chat, recomendaciones personalizadas,
cupones, facturación, devoluciones, carga remota de medios, pasarelas ni logística externa.
No reducir gestión básica de productos, categorías, promociones, stock, clientes o pedidos.

### Resultado de consistencia

Se corrigen las notas antiguas del checklist que presentaban el pago como pendiente.
Se precisan estados separados: pedido AWAITING_PAYMENT con pago REJECTED; pedido CONFIRMED
con pago APPROVED. La etiqueta española puede decir «Pago rechazado» sin confundir ambos
campos. Los detalles históricos no cambian al editar catálogo o dirección. Las cinco
respuestas aceptadas se preservan literalmente en Clarifications.

La revisión posterior a Phase 1 mantiene todos los gates en PASS. Siguiente artefacto
autorizable: Tasks; este comando termina con los documentos de Plan.
