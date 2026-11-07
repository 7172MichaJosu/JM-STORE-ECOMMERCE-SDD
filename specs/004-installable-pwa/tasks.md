# Tasks: JM-STORE PWA instalable

**Input**: Diseño aprobado en `specs/004-installable-pwa/` (Specify, Clarify y Plan).

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/` y `quickstart.md`.

**Organización**: tareas agrupadas por historias de usuario. Las pruebas aparecen antes de la implementación correspondiente; su inclusión responde a los criterios explícitos de aceptación y la petición del usuario.

**Estado de Implement (2026-11-06)**: 28/32 tareas completadas y verificadas. Staging PWA publicado con autorización expresa; evidencia en [evidence/pwa-staging.md](evidence/pwa-staging.md) y [evidence/pwa-validation.md](evidence/pwa-validation.md). T026–T028 (dispositivos físicos) y parte de T031 siguen pendientes. Producción, Worker antiguo, SQLite y datos reales se conservan; no se cambian planes.

**Confirmación manual del propietario (2026-11-06)**: el propietario informó que JM-STORE
quedó instalada como PWA en su teléfono Android y laptop Windows. No se especificaron
navegador/versión, modelo ni apertura posterior desde el launcher/menú del sistema; por eso
esta evidencia parcial no completa T026 ni permite inferir tabletas, Edge u otros dispositivos.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dependencias de build/test sin cambios en runtime ni servicios.

- [X] T001 [P] Añadir `vite-plugin-pwa` y `workbox-precaching` como dependencias de desarrollo fijadas en `client/package.json` y `package-lock.json`; no añadir dependencias de runtime.
- [X] T002 [P] Añadir el script `test:pwa` con Node `node:test` en `package.json` para ejecutar `client/tests/pwa/*.test.js`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: fixtures locales aislados para validar PWA sin redirección a servicios reales.

- [X] T003 Crear helpers Playwright en `tests/e2e/pwa/fixtures.js` para contexto limpio, control de red, varias páginas y evidencia sin secretos; reutilizar el servidor local de base temporal de `tests/e2e/server.js`.

**Checkpoint**: dependencias y harness de prueba listos; todos los escenarios usan datos sintéticos y endpoints locales.

---

## Phase 3: User Story 1 - Instalar y abrir JM-STORE (Priority: P1) 🎯 MVP

**Goal**: publicar identidad JM verificable, instalar voluntariamente y abrir la tienda en ventana standalone cuando navegador/OS lo permiten.

**Independent Test**: con perfil limpio y origen seguro, comprobar manifest, respuestas e iconos; instalar desde el navegador, cerrar y abrir desde el sistema, verificar nombre, logo JM, inicio y navegación. Cancelar/no mostrar prompt no impide usar la tienda web.

### Tests for User Story 1

- [X] T004 [P] [US1] Crear pruebas de contrato del manifest, campos y referencias de iconos en `client/tests/pwa/manifest.test.js`.
- [X] T005 [P] [US1] Crear prueba E2E de instalación voluntaria, ayuda accesible y fallback web si no existe `beforeinstallprompt` en `tests/e2e/pwa/install-help.spec.js`.

### Implementation for User Story 1

- [X] T006 [US1] Crear arte maestro cuadrado del símbolo bolsa/JM respetando el diseño propio en `client/public/icons/jm-store-master.svg`.
- [X] T007 [P] [US1] Exportar y validar iconos PNG JM de 192×192, 512×512 y 512×512 `purpose: maskable` en `client/public/icons/jm-store-192.png`, `client/public/icons/jm-store-512.png` y `client/public/icons/jm-store-maskable-512.png`.
- [X] T008 [P] [US1] Crear `client/public/manifest.webmanifest` con nombre JM-STORE, id/scope/start_url del origen, display standalone, colores JM y referencias exactas same-origin a iconos.
- [X] T009 [US1] Enlazar manifest e icono JM en el `<head>` de `client/index.html` sin alterar rutas SPA ni añadir claims comerciales.
- [X] T010 [US1] Implementar estado/prompt de instalación progresivo y accesible en `client/src/pwa/install-prompt.js` y `client/src/components/Header.jsx`; mostrar solo cuando el navegador lo permita y conservar navegación web.
- [X] T011 [US1] Ejecutar build Vite y verificar manifest, MIME, status, dimensiones, referencias, icono visible y deep links en `client/dist/manifest.webmanifest`, `client/dist/icons/` y `tests/e2e/pwa/install-help.spec.js`.

**Checkpoint**: identidad de instalación funciona y el usuario puede abrir la tienda instalada o continuar en web.

---

## Phase 4: User Story 2 - Comprar con los mismos datos y permisos (Priority: P1)

**Goal**: conservar autenticación, sesiones, roles, carrito, checkout simulado e historial, con D1 como autoridad cloud y sin copiar tokens a Cache Storage.

**Independent Test**: pruebas E2E locales de Worker/D1 con FirebaseDouble y cuentas sintéticas: cliente inicia sesión, actualiza carrito, realiza compra simulada y consulta pedido; ADMIN conserva su autorización; otro contexto o logout no obtiene datos privados guardados.

### Tests for User Story 2

- [X] T012 [P] [US2] Crear prueba E2E de sesión, carrito persistente, checkout simulado e historial con FirebaseDouble/D1 local en `cloud/tests/e2e/pwa-continuity.spec.js`.
- [X] T013 [P] [US2] Crear prueba E2E de login/logout ADMIN, denegación CUSTOMER, cambio de sesión y ausencia de tokens/datos privados en el almacenamiento PWA en `cloud/tests/e2e/pwa-authorization.spec.js`.

### Integration and Verification for User Story 2

- [X] T014 [US2] Incluir `pwa-continuity.spec.js` y `pwa-authorization.spec.js` en `cloud/playwright.config.js` y `cloud/playwright.firebase.config.js`; ejecutar `npm run cloud:test:e2e` y `npm run cloud:test:firebase:e2e` con D1 emulada y proveedores sintéticos, registrando resultados sin valores secretos.

**Checkpoint**: la app instalada sigue utilizando autenticación/sesión y persistencia de negocio existentes; no hay cambios de API, D1, roles o Firebase.

---

## Phase 5: User Story 3 - Manejar desconexión y versiones nuevas con seguridad (Priority: P1)

**Goal**: dar aviso offline sin catálogo y aplicar versiones solo al cerrar todas las ventanas y abrir de nuevo, sin duplicar compras ni interrumpir operaciones.

**Independent Test**: tras una visita online, desconectar red; la navegación muestra solo aviso estático y Cache Storage contiene solo allowlist. Con dos ventanas en versión A y una B disponible, A no se recarga; al cerrar ambas y abrir de nuevo inicia B. Ninguna API/escritura se confirma offline.

### Tests for User Story 3

- [X] T015 [P] [US3] Crear pruebas unitarias de allowlist/hash/namespace y exclusión de HTML, `images/demo/**`, queries y `/api/**` en `client/tests/pwa/cache-policy.test.js`.
- [X] T016 [P] [US3] Crear E2E de navegación offline y API network-only, comprobando que no se almacenen autenticación, catálogo o respuestas personalizadas, en `tests/e2e/pwa/offline.spec.js`.
- [X] T017 [P] [US3] Crear E2E de dos ventanas y versión en espera; comprobar ausencia de `skipWaiting`, `clients.claim`, reload forzado y reenvío de checkout en `tests/e2e/pwa/update-lifecycle.spec.js`.

### Implementation for User Story 3

- [X] T018 [P] [US3] Crear `client/public/offline.html` con aviso accesible “Sin conexión” y opción de reintentar; excluir catálogo, cuenta, precios, formularios y acciones de compra.
- [X] T019 [P] [US3] Crear `client/service-worker.js` con Workbox `injectManifest`, allowlist solo de bundles JS/CSS fingerprinted, iconos JM y `/offline.html`; rutas de navegación online-only con fallback offline estático, `/api/**` siempre network-only y limpieza limitada a caches JM-STORE propias; no llamar `skipWaiting()` ni `clients.claim()`.
- [X] T020 [US3] Registrar el Service Worker same-origin de forma no bloqueante y registrar fallos recuperables en `client/src/pwa/register.js`; conectar el registro desde `client/src/main.jsx` solo en build de producción/preview.
- [X] T021 [US3] Configurar `vite-plugin-pwa` en modo `injectManifest` en `client/vite.config.js`, incluyendo solo `client/public/offline.html`, iconos JM y bundles permitidos; desactivar auto-update y mantener precache fuera de HTML y catálogo.
- [X] T022 [US3] Ejecutar pruebas unitarias y E2E de caché/lifecycle y comprobar las respuestas estáticas/API, headers `no-store`, CSP y MIME en `client/tests/pwa/`, `tests/e2e/pwa/` y `cloud/tests/e2e/`.

**Checkpoint**: contenido offline limitado a recursos aprobados; la compra, auth, cambios de cuenta y stock requieren conectividad y confirmación remota.

---

## Phase 6: User Story 4 - Usar dispositivos compatibles y recibir ayuda (Priority: P2)

**Goal**: validar de forma observable la instalación y uso en Android, Windows y tablets según Clarify, sin afirmar compatibilidad universal.

**Independent Test**: registrar instalación y apertura real desde el sistema en Chrome Android y Chrome/Edge Windows; probar tablets Android/Windows en ambas orientaciones, touch/teclado y modo standalone. iPadOS es adicional solo si se dispone de dispositivo.

### Tests for User Story 4

- [X] T023 [P] [US4] Crear pruebas responsive y accesibles con axe en 360/768/1280 px, ambas orientaciones tablet, teclado, foco, temas claro/oscuro y reduced-motion en `tests/e2e/pwa/responsive.spec.js`.

### Implementation and Device Verification for User Story 4

- [X] T024 [US4] Corregir únicamente regresiones responsive/accesibles que introduzca la affordance PWA en `client/src/styles/layout.css`, `client/src/styles/accessibility.css` y `client/src/components/Header.jsx`; mantener identidad JM y p95 visual del carrito ≤100 ms.
- [X] T025 [US4] Solo después de aprobar todos los gates locales y recibir autorización explícita de la operación, publicar el build revisado exclusivamente en `jm-store-ecommerce-sdd-staging` con `cloud/wrangler.staging.jsonc`; no migrar datos, cambiar D1, producción ni Worker antiguo.
- [ ] T026 [US4] **Parcialmente verificada**: el propietario confirmó instalación PWA en teléfono Android y laptop Windows (sin datos de navegador/versión ni relanzamiento). Completar la matriz Android Chrome y Windows Chrome/Edge; relanzar desde launcher/menú del OS y registrar nombre, icono JM, standalone y resultado por navegador en `specs/004-installable-pwa/evidence/pwa-validation.md` antes de marcar la tarea.
- [ ] T027 [US4] En staging autorizado, repetir cobertura táctil/teclado y orientaciones en tablet Android Chrome y tablet Windows con navegadores compatibles; registrar modelo/versión/resultado en `specs/004-installable-pwa/evidence/pwa-validation.md`; dejar pendiente cada dispositivo no disponible en vez de sustituirlo por emulación.
- [ ] T028 [US4] Si se dispone de un dispositivo iPadOS físico, registrar comprobación adicional de Safari en `specs/004-installable-pwa/evidence/pwa-validation.md` sin convertirla en bloqueo de aceptación.

**Checkpoint**: evidencia de dispositivos distingue instalación real de DevTools/emulación; cualquier prueba alojada utilizó exclusivamente cuentas sintéticas y el Worker staging autorizado.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: regresión de calidad, seguridad, cuotas y documentación final sin declarar pruebas pendientes como aprobadas.

- [X] T029 Ejecutar suites completas `npm run test`, `npm run test:integration`, `npm run test:e2e`, `npm run cloud:test`, `npm run cloud:test:e2e` y `npm run cloud:test:firebase:e2e`; corregir regresiones y resumir resultados en `specs/004-installable-pwa/evidence/pwa-validation.md`.
- [X] T030 Auditar precache y Cache Storage después de catálogo, login/logout, cambio de usuario, carrito y checkout; verificar cero `/api/**`, cookie, token, email, dirección, catálogo o respuesta privada en `client/tests/pwa/` y `tests/e2e/pwa/`.
- [ ] T031 Medir regresión visual del carrito (p95 ≤100 ms, con escenario de red demorada de 1.5 s), revisar tamaño/tiempos del build y consumo/limitaciones de Cloudflare Free/Firebase Spark; dejar evidencia sin activar servicios de pago en `specs/004-installable-pwa/evidence/pwa-validation.md`.
- [X] T032 Actualizar guía y resultados reales en `specs/004-installable-pwa/quickstart.md` y `specs/004-installable-pwa/evidence/pwa-validation.md`, marcando como pendientes las pruebas manuales de dispositivos que no se hayan realizado.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias. T001 y T002 modifican archivos distintos y pueden ejecutarse en paralelo.
- **Foundational (Phase 2)**: depende de T002; completa el harness aislado antes de pruebas por historia.
- **US1 (Phase 3)**: depende de Setup/Foundation. Manifest, iconos y navegación web instalable forman la base de las demás historias.
- **US2 (Phase 4)**: depende de US1 para verificar continuidad en PWA; no cambia el modelo de datos ni autenticación.
- **US3 (Phase 5)**: depende de US1 por manifest/iconos y de la lista de assets; una vez terminada US1 puede desarrollarse en paralelo con US2 si se mantienen fixtures separados.
- **US4 (Phase 6)**: depende de US1–US3 y de aprobación independiente para staging; los ensayos físicos no se sustituyen por emulación.
- **Polish (Phase 7)**: después de todas las historias deseadas; solo despliegue/revisión staging con autorización vigente.

### User Story Dependencies

- **US1 (P1)**: puede iniciar después de Foundation; no depende de otras historias.
- **US2 (P1)**: depende de US1. Verifica que el mismo origen y app instalada usan sesiones y datos comerciales existentes.
- **US3 (P1)**: depende de US1; puede ir en paralelo con US2 tras integrar manifest/iconos.
- **US4 (P2)**: depende de US1, US2 y US3; requiere staging autorizado y equipos físicos compatibles.

### Parallel Opportunities

- T001 y T002 en Setup pueden ejecutarse en paralelo.
- T004 y T005 pueden escribirse en paralelo; dentro de US1, T007 y T008 pueden trabajar en paralelo una vez fijados los nombres de iconos.
- T012 y T013 pueden crearse en paralelo porque cubren journeys distintos y archivos distintos.
- T015, T016 y T017 pueden escribirse en paralelo. Tras pasar esas pruebas, T018 puede trabajarse en paralelo con el diseño de T019; T020/T021 esperan el worker fuente y sus dependencias.
- US2 y US3 pueden avanzar en paralelo tras completar US1, evitando modificar los mismos archivos de test.
- La prueba responsive T023 puede prepararse en paralelo con evidencia física/documental; T025–T028 son secuenciales por autorización, despliegue y disponibilidad de dispositivos.

## Parallel Example: User Story 1

```text
Después de T003:
Task: T004 contract tests para manifest e iconos
Task: T005 prueba E2E de ayuda/instalación voluntaria

Después de fijar nombres de iconos en T006:
Task: T007 exportar derivados PNG
Task: T008 construir manifest con referencias acordadas
```

## Parallel Example: User Story 3

```text
Después de US1:
Task: T015 pruebas unitarias de allowlist y exclusiones
Task: T016 E2E offline y API network-only
Task: T017 E2E lifecycle con dos ventanas
```

## Implementation Strategy

### MVP First

1. Completar Setup y Foundation.
2. Completar US1: identidad, manifest, iconos JM y experiencia instalable; validar build local.
3. Completar US2 y US3: regresión de comercio, caché segura, offline y actualización controlada.
4. Completar pruebas responsive/accesibilidad antes de cualquier publicación.
5. Solicitar autorización aparte antes de publicar en staging y ejecutar instalación física.

### Incremental Delivery

1. US1 entrega metadatos/instalación sin cambiar API/D1.
2. US2 demuestra que la PWA conserva el recorrido de cliente/admin y la persistencia actual.
3. US3 añade offline estático y actualización segura, sin cachear datos de negocio.
4. US4 verifica dispositivos y staging autorizado; faltantes físicos quedan documentados.
5. Polish corre regresión y deja el expediente con evidencia real y pendientes.

## Notes

- Cada tarea operativa continúa `[ ]` hasta estar implementada y verificada; no marcar por diseño.
- `[P]` solo marca tareas sobre archivos independientes, sin dependencia pendiente.
- Las pruebas PWA y manuales se consideran requisito; ningún resultado se ha ejecutado en esta fase Tasks.
- T025 se completó en staging con autorización expresa; esta tarea no autoriza publicaciones futuras, producción ni cambios del Worker antiguo.
- No realizar commit/push/merge como parte de estas tareas sin instrucción separada.
