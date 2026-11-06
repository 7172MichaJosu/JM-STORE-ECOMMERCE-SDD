# Evidencia del carrito — 6 de noviembre de 2026

El carrito tiene respuesta visual inmediata y persistencia verificada en staging.
**La repetición de CPU pasó en la muestra medida y el código se publicó en GitHub.**
No se declara terminado el proyecto ni aprobada toda la feature 002.

## Diagnóstico y medición comparable

El cliente anterior aguardaba GET + GET + PUT al agregar, y GET + PUT/DELETE al editar.
Cada HTTP tardaba aproximadamente 1,4–2,7 s: la espera acumulada era visible porque
React se actualizaba después de la última respuesta y los controles se bloqueaban.
La solución proyecta intenciones inmediatamente y serializa escrituras CAS; elimina
los GET redundantes, conserva los controles del servidor y agrupa ráfagas contiguas.

Tres repeticiones de agregar, aumentar, disminuir y quitar por viewport: 24 acciones
antes y 24 después, mismo producto, Chromium y conexión de esta máquina. Se excluye
la carga inicial. El tiempo visual es clic → primer frame con cantidad/contador
esperados; el confirmado termina cuando se recibe y aplica la respuesta del servidor.

| Viewport | p95 visual antes | p95 visual después | p95 confirmado después |
|---|---:|---:|---:|
| Escritorio 1280 px | 4.685,7 ms | 11,2 ms | 1.956,3 ms |
| Móvil emulado 360 px, touch | 4.551,4 ms | 11,3 ms | 2.073,8 ms |

| Acción | HTTP por clic antes → después | p95 visual después escritorio / móvil |
|---|---|---:|
| Agregar | 3 → 1 | 6,3 / 6,8 ms |
| Aumentar | 2 → 1 | 9,4 / 9,4 ms |
| Disminuir | 2 → 1 | 8,5 / 10,4 ms |
| Quitar | 2 → 1 | 11,2 / 11,3 ms |

Una solicitud individual sigue tardando segundos. Se comunica guardado pendiente;
checkout no usa estimaciones del cliente ni avanza con escrituras pendientes/error.
Los importes usan céntimos enteros; la respuesta autoritativa sustituye precios/stock.
Datos agregados por acción, HTTP y fase: [measurements.json](measurements.json).
No equivale a una prueba en teléfono físico ni a carga masiva.

## Pruebas ejecutadas

| Suite | Aprobadas |
|---|---:|
| Node y controlador: unitarias | 17 (14 del controlador nuevas) |
| Node: integración/contratos | 20 |
| Worker: unidades/contratos/D1 | 93 (6 de actividad de sesión nuevas) |
| Navegador Node | 15 |
| Navegador Worker local | 14 |
| Navegador Firebase con proveedor sintético local | 13 |
| Total local | 172 |
| Navegador contra staging, solo carrito | 5 |

Las pruebas nuevas fallaron antes de implementar (controlador inexistente y espera de
red incompatible con respuesta ≤100 ms). En el primer verde se corrigieron dos
selectores de pruebas que exigían texto exacto dentro de un toast con icono; se
espera ahora la señal de persistencia y el contador, sin depender del toast.

Se verificaron red lenta de 1.500 ms en ambos tamaños, contador/importes inmediatos,
una sola escritura en vuelo, ráfagas sin duplicar líneas ni perder cantidades,
persistencia tras recargar, rollback por HTTP 500 y respuesta perdida después de
guardar sin repetir el incremento. El controlador cubre conflicto CAS/reintento
acotado, varios productos, límites/stock, precios corregidos, sesión expirada y
respuesta antigua tras reset. Las compras, idempotencia, roles y seguridad se
comprobaron con bases efímeras; los cinco E2E alojados no crean pedidos ni descuentan
stock del catálogo existente. Los clientes registrados por la medición son sintéticos.

## Publicación y protección

- URL: https://jm-store-ecommerce-sdd-staging.josue-hinostroza-27.workers.dev
- Antes: Worker `76534b2c-9ab0-402b-8c77-617112fdbf8a`.
- Primera UI optimista: `50f3d761-70ec-4696-9d71-9e80d7c81f06`.
- Versión final con CPU optimizada: `12de1af0-2b92-4223-8ad6-0658a43522e4`, assets `index-CZ9ceQip.js`.
- Segundo respaldo previo de D1: 100.073 bytes, restauración de 27 tablas, integrity `ok`,
  cero errores FK y conteos coincidentes. El respaldo privado permanece ignorado.
- Sin cambios de esquema, API, roles, credenciales personales o aprovisionamiento.
  Se conserva namespace, Firebase Spark y la configuración de secretos existente.
- Los tres hashes de SQLite original coinciden. No se modifica el Worker antiguo,
  producción, cuentas reales ni planes. El cambio de correo administrativo sigue
  deshabilitado; no se reabre su aceptación pendiente.

## CPU: detección inicial y repetición autorizada

Tail capturó 56 invocaciones, todas con outcome `ok`, sin 1102 en esta muestra.
Las 36 de carrito consumieron como máximo 10 ms (24 escrituras: 5–10 ms; GET: 4–6 ms).
**Un registro sintético consumió 11 ms**; el resto de rutas midió 1–8 ms.
Por ello falló la comprobación estricta del presupuesto de 10 ms de Workers Free.
El éxito HTTP no permite declarar aprobado ese presupuesto ni margen suficiente.

[Cloudflare documenta 10 ms y cierta tolerancia a excesos aislados](https://developers.cloudflare.com/workers/platform/limits/#cpu-time).
Esta muestra no demuestra que Free sea inviable; tampoco garantiza cumplimiento bajo
carga. No se activó ningún plan o servicio de pago. Se detuvieron nuevas operaciones
remotas al detectar el resultado y solo se recogió el resultado del ensayo ya iniciado.
El usuario autorizó después optimizar `/auth/register` y repetir staging sin cambiar
planes. Plan y Tasks se ampliaron antes de modificar el middleware.

Se eliminó un UPDATE D1 de actividad por petición de visitante, cuyo vencimiento es
absoluto y no usa inactividad. Se mantiene el UPDATE en cada petición autenticada,
incluido el idle de 30 min y las comprobaciones de usuario, revocación y Firebase.
No se redujo protección criptográfica, rate limit ni validación de tokens. Las seis
pruebas nuevas verificaron primero el fallo y después pasaron; se repitieron 93
pruebas Worker y los 13/14 E2E Firebase/local. Un primer arranque consecutivo del
harness local no inició pruebas; la repetición completa pasó 14/14.

La nueva muestra contiene **67 invocaciones con outcome `ok`, máximo 9 ms**:

| Ruta | Muestras | CPU observada |
|---|---:|---:|
| Registro | 3 | 4–7 ms |
| Login | 3 | 4–6 ms |
| Carrito (GET y escritura) | 36 | máximo 9 ms |

Las 11 comprobaciones API de registro/login/logout, roles y acceso administrativo
sintético pasaron. La repetición de las 24 acciones del carrito volvió a confirmar
persistencia y una solicitud por clic. El pico inicial de 11 ms se conserva en los
datos publicados y reportes privados; no se descarta una muestra fallida para afirmar
éxito. El cambio evita trabajo demostrado, pero muestras de red/CPU no aíslan toda
la variabilidad de plataforma. La aceptación corresponde a estos recorridos medidos;
carga, memoria, cuotas compartidas y margen integral de feature 002 siguen pendientes.

## Estado SDD y entrega

15/15 tareas completas. Las cinco pruebas E2E alojadas se repitieron con la versión
final y pasaron sin reintentos ni omitidas. T012: se escanearon 342 archivos públicos,
el historial y los 29 archivos preparados; sin secretos conocidos, patrones de
credenciales ni archivos privados. `git diff --cached --check` pasó.

Código publicado en `main` mediante
[`8eaaa5b`](https://github.com/7172MichaJosu/JM-STORE-ECOMMERCE-SDD/commit/8eaaa5b504b17d5ce42c857b737ee04c49f257d8).
El push y el SHA remoto se comprobaron; el árbol quedó limpio antes de este registro
documental posterior. Se conserva el historial, sin force push ni cambios al repo antiguo.
Feature 002 mantiene 76/112 tareas completas y sus 36 pendientes anteriores. Los
reportes detallados están en `cloud/private/` y no se publican. La mejora del carrito
está verificada para demostración en staging; no se declara producción ni finalización
integral de JM-STORE.
