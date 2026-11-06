# Implementation Plan: Carrito con respuesta inmediata

**Feature**: 003-cart-response | **Date**: 2026-11-06 | **Git branch**: main.
**Input**: [spec.md](spec.md), Constitution 1.1.0 y diagnóstico del cliente publicado.

## Summary

Separar la representación provisional de React del carrito confirmado por D1 mediante
un controlador pequeño por instancia de Providers. Una cola de intenciones proyecta
las líneas, cantidades, contador y totales sin esperar HTTP. Solo una escritura de
carrito está en vuelo; usa la versión de la última respuesta confirmada. Se eliminan
los GET redundantes de cada acción, manteniendo carga inicial y reconciliación.

## Technical Context

- JavaScript ESM, React existente (useSyncExternalStore), Vite; sin dependencias nuevas.
- Worker Fetch/Firebase Spark/D1 existentes; sin cambios del contrato o esquema remoto.
- Servidor Node/SQLite local conserva reglas y datos. La UI compartida sigue compatible.
- Pruebas node:test del controlador, Playwright Node y Worker/D1 sintéticos y medición
  real de Chromium en staging (1280/360, touch en móvil emulado).
- Objetivo visual p95 <=100 ms, incluso con respuesta HTTP retrasada 1500 ms.
- Persistencia, tiempos HTTP y CPU son métricas diferentes; no se promete reducir el
  tiempo remoto a 100 ms ni se usa una estimación del cliente para crear pedidos.

## Constitution Check

PASS documental: Specify antes de Plan/Tasks, persistencia D1 autoritativa, permisos y
credenciales intactos, controles de stock/versiones conservados, acceso accesible,
respaldo antes de publicar staging y pruebas/evidencia antes de declarar completado.
No excepción ni decisión funcional sin resolver. No se aprueban pendientes de feature 002.

## Decisiones y concurrencia

1. `client/src/services/cart-controller.js`: último carrito confirmado + intenciones
   FIFO pendientes (`delta`, `set`, `remove`), generación de sesión y estado de error.
   Snapshot inmutable/caché con subscribe estable para useSyncExternalStore.
2. Enqueue proyecta y publica en el mismo evento del clic. Una proyección por product_id
   evita líneas duplicadas. Calcula soles desde precios enteros conocidos; al responder
   el servidor sustituye precios/stock por los actuales y reaplica intenciones restantes.
3. Bomba de escrituras serializada globalmente por carrito; agrupa intenciones contiguas
   del mismo producto que todavía no se enviaron. PUT usa cantidad absoluta y CAS
   cartVersion confirmada; DELETE envía la versión. No GET previo por acción normal.
4. Versión en conflicto: una recarga y como máximo un reintento de esa intención, porque
   el CAS rechazado no aplicó cambios. OUT_OF_STOCK/422/5xx/NETWORK: retirar pendientes
   afectados y revertir inmediatamente al último confirmado; una lectura de reconciliación
   para fallos no relacionados con sesión. Nunca repetir automáticamente un cambio con
   resultado incierto. Avisar y bloquear checkout hasta sincronización/revisión explícita.
5. 401/403 no se reconcilia silenciosamente con un carrito anónimo: se revierten cambios,
   se muestra error y se requiere refrescar sesión. Reset incrementa generación, aborta
   transporte, rechaza intenciones silenciosamente e ignora respuestas antiguas.
6. Refresh/checkout esperan la cola antes de recargar. El checkout no permite revisar o
   confirmar mientras el carrito tiene cambios pendientes/error. La quote se invalida
   al editar el carrito. No se cambia confirmPayment ni la idempotencia del pedido.
7. Providers centraliza API y avisos; CartPage conserva edición habilitada, límites
   conocidos y feedback accesible. Header/mini carrito leen el mismo snapshot.
8. Borradores solo en memoria, sin localStorage, passwords o tokens adicionales.

## Archivos

`client/src/services/cart-controller.js`, `client/src/app/providers.jsx`, Header,
CartPage/CheckoutPage; pruebas `client/tests/cart-controller.test.js`,
`tests/e2e/cart-optimistic.spec.js` y wrapper/config E2E cloud. Diagnóstico repetible en
`cloud/scripts/cart-feedback.js`; resultados sin credenciales en cloud/private ignorado.

## Validación y publicación

Antes de cambiar la UI: medir baseline con el bundle publicado y cuentas sintéticas;
excluir carga inicial al contar peticiones de una acción. Ejecutar rojo de controlador
y E2E con latencia artificial. Verde: ráfagas, varios productos, rollback, conflicto,
respuesta perdida tras commit, error de sesión y respuesta tardía, precios/stock y
checkout. Regresión local y Worker/D1; comparar SQLite original por hash.

Tras respaldo/restauración de staging, publicar solo nuevo Worker preservando namespace,
secretos y ADMIN. Repetir el mismo diagnóstico sin demora artificial y comparar p95,
peticiones y persistencia en 1280/360. Medir CPU de plataforma sin activar planes.
Registrar límites de muestra y emulación; no afirmar dispositivo físico o carga masiva.
Escanear Git/secretos y publicar commits únicamente tras pasar los criterios críticos.

## Complexity Tracking

Sin violaciones. Se elige una cola explícita pequeña en lugar de añadir una biblioteca
de caché o confiar en respuestas sin orden. El servidor existente ya ofrece CAS y
cantidades absolutas; no requiere migración, nuevas tablas o endpoint de pedidos.

## Adenda autorizada: CPU del registro — 2026-11-06

El usuario autorizó abordar `/auth/register` y repetir staging después del pico de
11 ms. No cambia la arquitectura ni el contrato de autenticación. Se elimina primero
una escritura D1 redundante identificada en `sessionMiddleware`: cada petición de
visitante actualiza `last_seen_at`, aunque las sesiones anónimas solo caducan por
`expires_at` absoluto (24 h) y las guardas transaccionales no aplican idle a invitados.
Al registrar/iniciar sesión, además, esa sesión se elimina y sustituye por otra.

Solo las sesiones con usuario válido mantienen el UPDATE de actividad en cada
petición. Se conservan expiración absoluta, idle autenticado de 30 min, namespaces,
rotación al autenticar, revocación, comprobación Firebase por petición, criptografía,
reserva de correo y rate limit. No se omite ninguna comprobación de seguridad ni se
anticipa trabajo para ocultarlo en otra invocación. Sin cambios de esquema o SQLite.

Antes de modificar: pruebas del middleware en rojo deben demostrar cero UPDATE de
actividad para invitado y mantenimiento de touch/expiración/revocación autenticados.
Después: suite Worker completa, E2E Firebase/cart, backup verificado y nueva versión
de staging; tail real de registros y carrito, preservando la muestra inicial de 11 ms.
El número de llamadas D1 demuestra trabajo evitado, no equivale a CPU de plataforma;
la aceptación requiere medir esa última y conservar cualquier fallo encontrado.
