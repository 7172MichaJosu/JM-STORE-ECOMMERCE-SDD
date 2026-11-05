# JM-STORE cloud

## Estado vigente: Fetch nativo, 5 de noviembre de 2026

Staging: https://jm-store-ecommerce-sdd-staging.josue-hinostroza-27.workers.dev

Versión `76534b2c-9ab0-402b-8c77-617112fdbf8a`; recorridos críticos verificados para
demostración: 134 pruebas locales, 71 comprobaciones API y 3 E2E navegador aprobadas.
146 invocaciones de tail con máximo 9 ms; Analytics inicial P99 de bucket 9.912 ms.
Se preservaron ADMIN personal, namespace, secretos, cuentas originales y SQLite local.
Correo sigue deshabilitado; carga/memoria, migración real y producción están pendientes.
[Evidencia actual](deploy/native-fetch-validation.md). Los checkpoints Express/scrypt
y fallos de CPU siguientes son históricos; esta sección describe el estado vigente.

Workspace independiente; `npm start` conserva Node/Express/SQLite. Se provisionaron los
recursos nuevos de staging, documentados en `cloud/deploy/staging-resources.md`. Su
configuración de staging usa `workers_dev=true`, sin routes y `REMOTE_ENABLED=true` solo
para el Worker nuevo. Producción mantiene sus IDs vacíos. El staging tiene catálogo
sintético y secretos aleatorios guardados solo en Cloudflare; no se copiaron datos reales
ni se modificó el proyecto Cloudflare antiguo.

Desde raíz: `npm run cloud:build`, `npm run cloud:test`, `npm run cloud:test:e2e`.
Para usar la tienda emulada: `npm run cloud:prepare-local` aplica migraciones a D1 local,
crea secretos cloud privados si faltan y carga20 productos/5 categorías sintéticos.
Después `npm run cloud:dev` abre http://localhost:8787. D1 persiste independientemente
en cloud/.wrangler/local/v3; repetir preparación no cambia stock editado ni secretos.
No se carga SQLite real ni `.env.local`. Los tests preparan su D1 temporal separada.

La tienda emulada permite registro/login, perfil/direcciones, catálogo/carrito, pago
simulado rechazado/aprobado y pedidos. Mi cuenta → Seguridad permite a un administrador
sintético cambiar correo/password con contraseña actual, auditoría atómica y revocación
de todas las sesiones al cambiar password. Está implementado y probado solo localmente;
no se desplegó esta actualización. El CRUD administrativo cloud restante devuelve503.
El backend SQLite no anuncia esta capacidad y conserva su navegación anterior.

Secrets de desarrollo irán en cloud/.dev.vars (ignorado): QUOTE_SECRET y RATE_LIMIT_SECRET
de al menos32bytes distintos. Nunca usar valores reales en tests, VITE_* o repositorio.
Cada ambiente necesita su origen exacto, namespace e identidad D1 independientes.
La configuración de producción permanece sin destino hasta autorización expresa.
Staging tiene migraciones y catálogo sintético. La suite alojada previa pasó3/3, pero
R-AUTH excede el presupuesto Free de CPU; la importación real sigue bloqueada. Evidencia
agregada en `cloud/deploy/staging-resources.md`.

`npm run cloud:test` pasó71/71 (2026-11-05); `npm run cloud:test:e2e`/runner local pasó8/8. Los E2E
generan administradores sintéticos y contraseñas aleatorias en memoria y solo preparan
la D1 efímera de Miniflare en loopback. No usar credenciales reales en estos tests.

No copiar un token local a Cloudflare. La allowlist de destinos será un archivo privado
cloud/deploy/targets.local.json revisado por operador. `cloud:targets:check` no tiene target
por defecto y falla si faltan identidad o evidencia. No consulta Cloudflare por sí solo.
Cuando corresponda, la CLI será cf hasta existir config Wrangler; con estas configs se
usará Wrangler explícito. El proyecto antiguo no se selecciona ni modifica.


## Firebase Auth para Workers (Implementacion local verificada)

El proveedor local conserva SQLite/scrypt. Workers staging/production requieren estas variables; su ausencia cierra el servicio:

- `FIREBASE_PROJECT_ID`: Project ID exacto de Firebase Console > Project settings > General (no el nombre visible `jm-store-ecommerce-sdd`).
- `FIREBASE_API_KEY`: Web API Key de la app web `JM-STORE-WEB`. Es una clave de identificacion del proyecto, no una clave privada; mantenerla fuera de VITE y restringirla a Identity Toolkit API y Token Service API ([guía oficial de claves Firebase](https://firebase.google.com/docs/projects/api-keys)).
- `FIREBASE_SESSION_ENCRYPTION_KEY`: aleatoria, 32 bytes como hex (64 caracteres), solo secret local ignorado o Wrangler Secret. Nunca guardar la clave en SQLite, D1, config versionada o Git.

Local: agregar valores de prueba/sinteticos a `cloud/.dev.vars` (ignorado). Staging: usar secretos del Worker y volver a desplegar solo tras confirmar valores y permisos. No habilitar Blaze ni Identity Platform. No usar Firebase SDK en el navegador: el Worker usa Firebase Auth REST, valida RS256/JWKS y aloja cookies opacas; D1 guarda roles, perfiles y tokens cifrados.

El template de Firebase para cambio de correo debe usar como action URL personalizada `https://jm-store-ecommerce-sdd-staging.josue-hinostroza-27.workers.dev/admin/mi-cuenta/seguridad/confirmar-correo`, con el host `jm-store-ecommerce-sdd-staging.josue-hinostroza-27.workers.dev` autorizado en Firebase Authentication. El handler GET no modifica la cuenta; solicita una accion explicita POST. Email/contrase?a cambian por separado, cada flujo requiere reautenticacion y cierra las sesiones de D1. Una reserva de D1 no impide que alguien se registre directamente en Firebase; un UID sin relacion D1 no obtiene permisos.

Cuotas vigentes documentadas (04-11-2026): Workers Free 100,000 requests/dia, 10 ms CPU/invocacion, 128 MB memoria; D1 Free 5 M rows read/dia, 100,000 rows written/dia, 500 MB por DB, 5 GB por cuenta, 50 queries D1/invocacion y 7 dias de Time Travel; Firebase Auth Spark 100 registros/hora/IP y hasta 1,000 emails/dia de cambio de direccion. Llegar al limite diario D1 puede rechazar queries hasta el reset. No se midio el Worker con Firebase real en este checkpoint; la prueba de CPU, cuotas/email y memoria en staging sigue pendiente.

## Checkpoint local y rotación preparada — 2026-11-05

`npm run cloud:config:check` valida offline la configuración de `.dev.vars` sin imprimir valores. Las cinco variables requeridas están presentes, el archivo está ignorado/no trackeado y el round-trip AES-GCM pasa. Esto no acredita API key, cuotas, EEP, plan ni plantilla en Firebase real.

`npm run cloud:test` pasa 71/71 sin leer `.dev.vars`, con bindings sintéticos y barrera de red; `node cloud/scripts/local-e2e.js` pasa 8/8 y `npm run cloud:test:firebase:e2e` pasa 6/6 con el Worker compilado, D1 efímera y REST/JWKS sintético. Todos los intentos de salida del Worker Firebase de test quedan interceptados localmente. Se verifican registro/login, roles D1, compra simulada, cambio de password, reserva/cancelación y confirmación de correo desde otro navegador, rechazo de código vencido y revocación de sesiones.

La aplicación Node/SQLite conserva su autenticación. Atención al entorno de desarrollo cloud: `cloud:dev` usa Firebase real cuando `.dev.vars` contiene sus variables; ese comando no forma parte de estas pruebas aisladas y no se ejecutó en este checkpoint.

`npm run cloud:secrets:prepare` prepara reemplazos de QUOTE_SECRET/RATE_LIMIT_SECRET en un archivo privado ignorado, con ACL del usuario y sin imprimirlos. Se consideran comprometidos por exposición informada. El escaneo de valores actuales no encontró coincidencias en archivos publicables o commits locales. La preparación no aplica rotación a secretos activos. [Procedimiento](deploy/secret-rotation.md) y [configuración pendiente](deploy/firebase-staging.md). Antes de publicar staging se requiere autorización para rotación, configuración/migraciones y pruebas sintéticas alojadas. No se modificaron recursos remotos ni cuentas reales.

## Resultado de staging autorizado — 2026-11-05

URL: https://jm-store-ecommerce-sdd-staging.josue-hinostroza-27.workers.dev
Versión activa: 08151cb7-7c41-40ad-8447-e679b02150de; D1 nueva en OPEN, migraciones 0003/0004 verificadas tras respaldo restaurado (25 tablas, 52,486 bytes, integrity_check ok, FK 0 y recuentos iguales). Dos secretos expuestos reemplazados en la versión publicada y Firebase configurado como secrets; namespace nuevo. No se reutilizó ni modificó el Worker anterior.

Estado funcional: administración cloud implementada con guards D1 y versión, biblioteca permitida de imágenes, precios/promociones, inventario y movimientos, clientes/roles y pedidos/historial. Última suite cloud 79/79; E2E Firebase local 7/7, E2E cloud local 8/8 y regresión SQLite 3/3 + 20/20 + 9/9 con DB temporales. Hash de tres archivos SQLite reales permanece igual. Estas pruebas no son validación alojada completa.

Firebase Spark real confirmado sin facturación y sin Identity Platform; EEP y password 12–128 activos, dominio autorizado y clave restringida a Auth/Token Service. Se verificaron firma/proyecto/UID/lookup en una identidad sintética. El callback personalizado sigue predeterminado por indicación del propietario tras EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED. FIREBASE_EMAIL_ACTION_READY=false bloquea cambios y confirmaciones de correo antes de efectos; el formulario informa disponibilidad y permite cambiar password. R-EMAIL pendiente, sin fallback que aplique el cambio antes de revocar D1.

Staging real: 11/11 comprobaciones de sesiones, registro, login correcto/incorrecto, rol CUSTOMER/ADMIN y lectura de Seguridad/resumen. R-AUTH NO aprobado: Analytics midió una invocación de 11,294 μs = 11.294 ms frente a 10 ms Free (bucket de una solicitud); cero errores/1102 en la muestra. Tail mostró otras llamadas de 4 ms y 8 ms; ello no invalida el exceso. Memoria por invocación no expuesta. Observability REST respondió 403; GraphQL funcionó al reducir el límite de consulta tras un rate limit temporal. Cuotas D1 iniciales: 266,240 bytes, 13,130 filas leídas y 957 escritas en las 24h previas; no hay medición de cierre posterior al stop.

Se detuvieron pruebas/mutaciones remotas inmediatamente al detectar el exceso de CPU, según instrucción del propietario. Quedan por probar en staging carrito/checkout, CRUD completo y cambio de contraseña; localmente sí están verificados. El correo requiere callback guardado. T034/T075/T103 y migración real siguen bloqueados. Se necesita nueva autorización para optimizar/repetir ensayos Free. Observabilidad del Worker quedó habilitada; no se ejecutó otra publicación tras el hallazgo. Sin datos reales migrados, pagos, producción, commit o push. Conteo: 68/105 tareas completas y 37 pendientes.


## Resultado final de optimizaci?n gratuita ? 2026-11-05

Staging activo en versi?n c0f43974-41a7-4c15-9ddb-231b76763c81. La nueva autorizaci?n permiti? dos optimizaciones/publicaciones aisladas, cada una con export/restauraci?n previa verificada. Resultado local actual: 82 cloud + 7 E2E Firebase + 8 E2E cloud + 3 unitarias + 20 integraci?n + 9 E2E SQLite = 129 pruebas aprobadas; build/dry-run aprobados y tres archivos SQLite originales sin cambios por hash.

Ambos intentos alojados pasaron 11/11 comprobaciones funcionales iniciales, pero registro consumi? 15 ms y 19 ms de CPU en Wrangler tail, sobre 10 ms. Analytics del primer intento: P99 de bucket m?ximo 15.350 ms, 19 invocaciones, 0 errores. Segundo Analytics no disponible por rate limiter; no se atribuyen al segundo los datos anteriores. No 1102 no equivale a aprobar Free. Memoria, carga y cuotas compartidas al cierre siguen pendientes.

Se detuvieron operaciones remotas y se cerr? el guard de recursos. El enlace puede abrirse para revisi?n, pero no se declara listo para uso estable. Checkout/CRUD/password alojados no se ejecutaron en esta ronda; correo sigue bloqueado por el handler no guardado. 68/105 tareas completas; 37 pendientes. No se modificaron recursos antiguos ni datos reales, ni se activaron planes pagados, producci?n, commit o push.

V?ase cloud/deploy/cpu-optimization.md para cambios, evidencia y alternativa gratuita propuesta: entrada Fetch nativa solo en cloud, conservando React/Firebase/D1. Requiere actualizar el dise?o SDD antes de esa sustituci?n y acreditar CPU despu?s; no se implement? todav?a.
