# Tasks: Carrito con respuesta inmediata

**Input**: spec.md, plan.md, research.md, data-model.md y contracts/cart.md.
**Scope**: feature 003; no cambia las marcas ni los pendientes de feature 002.
**Tests**: solicitadas por el usuario; rojo antes de implementar y evidencia antes de marcar.

## Phase 1 — Diagnóstico y diseño

- [X] T001 Medir UI y HTTP del carrito publicado con sesiones sintéticas mediante `cloud/scripts/cart-feedback.js`; archivar baseline separado de carga inicial en `cloud/private/cart-feedback-before.json`.
- [X] T002 Revisar Constitution y redactar Specify/Plan/modelo/contrato/quickstart/checklist de `specs/003-cart-response/` antes de cambiar código funcional; documentar decisiones sin aclaraciones esenciales pendientes.

## Phase 2 — Pruebas previas

- [X] T003 [US1] [US2] Crear pruebas en rojo del controlador en `client/tests/cart-controller.test.js`: respuesta síncrona, una escritura en vuelo, agrupación, productos distintos, límites 100/1..99, precios, conflictos, rollback/red y reset de sesión.
- [X] T004 [US1] [US2] [US3] Crear E2E en rojo de latencia 1500 ms, ráfagas, error/reconciliación y checkout en `tests/e2e/cart-optimistic.spec.js`, reutilizados en `cloud/tests/e2e/cart-optimistic.spec.js`.

## Phase 3 — US1 y US2: edición inmediata y recuperación

- [X] T005 [US1] [US2] Implementar `client/src/services/cart-controller.js` con snapshot confirmado+intenciones, cola FIFO serializada y agrupación, precios en céntimos, CAS/retry acotado y recuperación sin repetir cambios inciertos; reset/abort por generación.
- [X] T006 [US1] [US2] Integrar controlador en Providers/Header/CartPage: eliminar GET previos por acción y busy global, actualizar contadores/importes inmediatamente, límites de stock/99/100 y avisos accesibles de guardado/error/reintento.

## Phase 4 — US3: compra segura

- [X] T007 [US3] Hacer que refresh/revisión/confirmación de `client/src/pages/CheckoutPage.jsx` esperen estado confirmado; invalidar quotes al editar y preservar idempotencia existente, sin cambiar pagos ni API remota.

## Phase 5 — Verificación y entrega

- [X] T008 Aprobar unidades/controlador, regresiones API y E2E Node/Worker/Firebase en bases efímeras; incluir móvil/escritorio y capturar hashes SQLite original sin modificarla.
- [X] T009 Respaldar/restaurar/verificar D1 staging y publicar solo el Worker nuevo mediante scripts existentes; preservar ADMIN, namespace, secretos, datos y planes. No migrar ni reaprovisionar cuentas reales.
- [X] T010 Medir con el mismo protocolo `cart-feedback.js --after` y verificar persistencia en staging, ráfagas/fallos controlados, ausencia de duplicados y presupuesto Free observado; no declarar éxito antes de resultados.
- [X] T011 Documentar resultados antes/después, alcance y límites en `specs/003-cart-response/quickstart.md`, `results.md`, README y docs cloud; conservar pendientes ajenos y declarar emulación móvil.
- [ ] T012 Escanear contenido Git/historial por secretos y archivos privados; commit/push a `JM-STORE-ECOMMERCE-SDD` solo tras pruebas críticas, verificar remoto y árbol limpio; registrar evidencia después de publicar.

## Dependencias y estrategia

T001/T002 → T003/T004 (archivos distintos, independientes) → T005 → T006 → T007 →
T008 → T009 → T010 → T011 → T012. Primero pruebas del núcleo, luego UI y checkout;
no se paralelizan ediciones del mismo archivo. Las regresiones API sin cambios y la
revisión documental pueden ejecutarse de forma independiente de la medición alojada.

US1/US2 son el MVP de respuesta inmediata, pero entrega exige además US3 y los ensayos
de persistencia/fallo. Checklist Specify 16/16 solo acredita requisitos escritos.

## Evidencia y bloqueo inicial — 2026-11-06

Tras la primera publicación: 10/12 tareas completas. T010: funcionalidad y latencia alojadas aprobadas, presupuesto
Free pendiente por 11 ms en registro (carrito máximo 10 ms, todas las respuestas `ok`).
T012: escaneo final de 341 archivos y seis revisiones sin valores secretos conocidos,
sin archivos privados; commit/push condicionados a cerrar la aceptación. Ver results.md.

## Adenda autorizada — CPU de registro

- [X] T013 Crear pruebas en rojo de sessionMiddleware: visitante no renueva actividad
  inútil; usuario conserva touch, idle, expiración y revocación. Documentar llamadas
  D1 evitadas antes de implementar, sin perfilar con secretos ni cuentas reales.
- [X] T014 Eliminar exclusivamente el UPDATE redundante de visitante en
  `cloud/src/security/sessions.js`; pasar pruebas Worker y E2E Firebase/carrito.
- [X] T015 Respaldar/verificar D1, publicar solo staging y medir nuevamente registro y
  carrito con tail; conservar muestra previa y cerrar T010 solo si la verificación pasa.

Dependencias: Plan adenda → T013 → T014 → T015 → cierre T010 → actualizar T011/T012.
La autorización recibida habilita esta repetición gratuita; no modifica pendientes de 002.

## Repetición autorizada: resultado

14/15 completas; solo T012 pendiente de commit/push. Pasaron 172 pruebas locales,
11 comprobaciones API alojadas, cinco E2E alojados y 24 acciones de latencia.
67 invocaciones capturadas: máximo 9 ms; registro 4–7 ms, login 4–6 ms.
Carrito visual p95 11,2/11,3 ms en escritorio/móvil emulado, una solicitud por acción.
El alcance medido pasa; no cierra la aceptación de carga/memoria de feature 002.
