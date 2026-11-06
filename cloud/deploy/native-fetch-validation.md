# Validación de demostración: Fetch nativo

**Actualización 6 de noviembre:** la UI del carrito se publicó después en la versión
`50f3d761-70ec-4696-9d71-9e80d7c81f06` y se optimizó después en
`12de1af0-2b92-4223-8ad6-0658a43522e4`. Tras detectar 11 ms en registro, la repetición
autorizada midió 67 invocaciones con máximo 9 ms. Respuesta visual y persistencia
pasaron; la muestra no cierra las pruebas de carga/memoria de feature 002.
[Evidencia actual y pendientes](../../specs/003-cart-response/results.md).
Las cifras y versión que siguen son evidencia histórica de la publicación anterior.

**Estado, 5 de noviembre de 2026**: apto para los recorridos de demostración verificados
en staging. Entrega solicitada: 6 de noviembre, 08:00 America/Lima. La aceptación integral
de la feature y producción permanecen pendientes.

- URL: https://jm-store-ecommerce-sdd-staging.josue-hinostroza-27.workers.dev
- Worker: `jm-store-ecommerce-sdd-staging`.
- Versión: `76534b2c-9ab0-402b-8c77-617112fdbf8a`.
- D1: `jm-store-ecommerce-d1-staging`, misma identidad, OPEN y migraciones 0001–0004.
- Firebase Spark, Email/Password; sin cambios de planes ni reprovisión del ADMIN personal.

## Diseño e implementación

Plan y Tasks se actualizaron antes de T106–T112. Fetch nativo sustituye el puente HTTP
Node/Express solo en cloud; conserva handlers, repositorios D1, contratos, CSRF/Origin,
rate limit, cookies, roles, firmas y revocación Firebase/D1. Express/Helmet permanecen en
el modo Node/SQLite y se retiraron de cloud. Sin nuevo framework o dependencia de runtime.
El bundle pasó de 1,293.52 KiB a 121.90 KiB (gzip 329.13 a 29.32 KiB), sin
`httpServerHandler` o Express. Namespace, esquema y credenciales actuales se conservaron.

## Pruebas locales

| Suite | Aprobadas |
|---|---:|
| Cloud: unidades, contratos e integración D1 | 87 |
| E2E Firebase / E2E cloud local | 7 / 8 |
| Node/SQLite: unitarias / integración / E2E | 3 / 20 / 9 |
| Total | 134 |

Build y dry-run correctos. Los contratos nativos fallaron antes de implementar y luego
pasaron: prefijos/params, espera y fallos async, cookies, HEAD, JSON inválido, límite
100 KiB incluyendo streaming sin Content-Length, tipo no JSON, queries repetidas y
escapes inválidos. Cancelar el stream grande puede producir el diagnóstico de pipe
abortado de workerd; la respuesta 413 y la prueba son correctas. SQLite usa bases
temporales en las pruebas; los tres archivos originales conservan sus hashes.

## Staging: evidencia funcional y CPU

**API principal 40/40**: registro/login correcto e incorrecto, logout, roles, categoría/producto
sintéticos con foto, búsqueda, dirección y carrito. REJECTED conserva stock 5; APPROVED
descuenta a 3; repetir clave devuelve el mismo pedido sin duplicar pago o stock. Historial
y PREPARING son visibles para el cliente. El ADMIN sintético cambia contraseña por
separado, con currentPassword, revocación de otra sesión y rechazo de la anterior.

**Navegador 3/3 E2E**, sin omitidos/reintentos, 94.125 s en conjunto: panel completo
(categoría, imagen/producto, inventario, promoción, compra, seguimiento y edición de
cliente), responsive 360/1280/assets/SPA/API404 y registro/login Firebase con cookie
Secure/HttpOnly. Las compras crean productos propios; no usan la cuenta personal ni
descuentan stock de productos anteriores. Los registros sintéticos se conservan.

**CRUD adicional 31/31**: edición de precio e imagen, ajuste/historial de inventario,
edición de categoría, alta/edición/baja de promoción, lectura/edición/baja de cliente
sintético y revocación de su sesión. Se rechazó inyectar ADMIN desde edición de cliente.
La baja del producto/categoría fue lógica: el producto dejó de aparecer públicamente y
el pedido conservó su total de 2,000 céntimos y dos intentos de pago. Son 71 comprobaciones
API aprobadas entre las dos suites, además de los 3 E2E.

El primer intento de este script adicional se detuvo tras 15 respuestas correctas por
asumir que un producto nuevo estaba en la primera página de inventario. Se corrigió
el script para filtrar por SKU y la repetición completó 31/31; no fue fallo del backend.
Sus 15 invocaciones iniciales midieron hasta 7 ms y se conservan separadamente, sin
sumarlas al conteo de ejecuciones funcionales aprobadas.

| Medición de plataforma | Invocaciones | CPU |
|---|---:|---:|
| Tail: API crítica | 40 | 2–9 ms |
| Tail: navegador | 75 | 1–8 ms |
| Tail: CRUD adicional | 31 | 2–9 ms |
| Tail total de ejecuciones aprobadas | 146 | máximo 9 ms |
| Analytics inicial | 41, cero errores | mayor P99 de bucket 9,912 µs = 9.912 ms |

El primer registro tras publicar midió 9 ms y los dos registros de navegador, 5 ms.
No se forzó un isolate nuevo por solicitud; esto no equivale a carga fría integral.
P99 de bucket no es máximo individual; CPU no es wall time. No hubo 1102 ni exceso
observado. El margen del agregado inicial es reducido: T075 y la matriz R-AUTH completa
necesitan más carga/memoria, sin afirmar garantía para tráfico futuro.
La consulta final de Analytics fue rechazada por el rate limiter de consultas: no se
reintentó ni se sustituyeron métricas faltantes por datos anteriores. La muestra API
inicial se conserva por separado; la evidencia del navegador proviene de tail.

D1 posterior: 323,584 bytes, 27 tablas, read replication deshabilitada; últimas 24h de
esta base: 28,096 filas leídas y 1,997 escritas. No se infiere cuota restante de toda la
cuenta a partir de esta base.

## Preservación y pendientes

Respaldo previo restaurado: 60,250 bytes, 27 tablas, integridad ok, FK 0 y recuentos
iguales; versión anterior `c0f43974-41a7-4c15-9ddb-231b76763c81` conservada. No se
reaplicaron migraciones. Tras las pruebas, las 10 cuentas originales ajenas al ADMIN de
pruebas conservaron exactamente sus filas, incluida la personal; namespace sin cambio,
FK 0 e identidad D1 correcta/OPEN. Solo el ADMIN sintético cambió credenciales/versión.
El sistema local, su SQLite, proyecto antiguo y producción permanecen intactos.

Se pueden demostrar catálogo/filtros, carrito, registro/login, perfil/direcciones,
compras simuladas, historial/seguimiento, administración y cambio de contraseña.
Pendientes explícitos:

- Correo: handler/enlace y R-EMAIL/T102/T103. La función sigue deshabilitada.
- T075: carga cloud 100 productos/20 sesiones, 100 concurrencias, memoria, margen robusto
  y cuotas compartidas; la aceptación integral no queda aprobada por esta muestra.
- T104/T105 y US2: compatibilidad de hashes e importación real, sin migrar usuarios reales.
- Recuperación integral/RPO/RTO, Workers Builds, producción/corte y revisiones manuales.
- Checklist free-staging: revisión del propietario pendiente, marcadores sin modificar.

Backups, credenciales sintéticas y reportes detallados solo en `cloud/private/` ignorado;
este reporte no contiene correos/UID personales, passwords, cookies o tokens.

Fuentes oficiales: [CPU Free](https://developers.cloudflare.com/workers/platform/limits/),
[Fetch](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/),
[D1](https://developers.cloudflare.com/d1/platform/limits/),
[Firebase Auth](https://firebase.google.com/docs/auth/limits).
