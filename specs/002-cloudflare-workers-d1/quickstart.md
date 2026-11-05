# Quickstart de validación: despliegue independiente JM-STORE

**Estado**: implementación parcial (2026-11-04). T001–T033 y T048–T056 completadas. T034 sigue
pendiente por R-AUTH: la suite alojada pasó 3/3, pero el scrypt de registro/login midió
máximos de CPU de 602/522 ms y promedios de 451.75/435 ms, por encima de los 10 ms de
Workers Free. No se observó 1102; las métricas agregadas no informan memoria usada por
invocación. Staging aloja solo productos/categorías sintéticos (5/20), sin usuarios ni
pedidos reales. Mi cuenta → Seguridad está implementada y verificada en D1 emulada con
credenciales sintéticas; no se desplegó esa actualización. La migración SQLite sigue pendiente.
**Implementacion Firebase (2026-11-05):** el proyecto Spark `jm-store-ecommerce-sdd` y la app `JM-STORE-WEB` fueron configurados manualmente por el propietario. Esta continuacion agrega Firebase Auth REST en el Worker, verificacion RS256/JWKS, reservas de correo y sesiones cifradas con AES-GCM. Los tests locales sinteticos pasan; el `projectId`, API key y action URL real todavia no se verificaron, por lo que no hay prueba Firebase alojada ni deployment de esta version. Staging scrypt previo permanece historico. La migracion real de usuarios sigue bloqueada.

Esta ejecucion de Implement no modifica la base SQLite ni el Worker anterior. La confirmacion de correo requiere que el template de Firebase use el handler JM-STORE `/admin/mi-cuenta/seguridad/confirmar-correo` en el Worker staging, con el dominio autorizado; la pantalla GET es inerte y la aplicacion ocurre por POST despues de inspeccionar el codigo y revocar sesiones. Los valores Firebase pendientes deben ir en `cloud/.dev.vars` (local, ignorado) y en secrets del Worker staging; nunca en `VITE_*`, documentos versionados o GitHub.

## Prerrequisitos

- Node24.15+ de rama24 y npm11. Repositorio fuente JM-STORE-ECOMMERCE-SDD.
- Firebase Auth REST, JWKS and D1 session integration are implemented locally and covered by synthetic tests; no real Firebase values or hosted Worker deployment have been used.
- Workspace `cloud/` y config Wrangler ya creados. Scripts de destino fallan cerrados;
  los comandos de esta guía son locales, salvo tareas remotas expresamente autorizadas.
- Datos sintéticos para cloud-local/staging; rutas de DB temporal distintas de
  server/data. Backups/dumps/session keys fuera de Git. Extender ignores futuros para
  `.dev.vars*`, `.wrangler/`, snapshots y reportes privados antes de crear secretos.
- Para las siguientes operaciones alojadas de staging: validar el destino y la cuota con
  la allowlist antes de aplicar migraciones/seed o activar una ruta. No copiar datos reales.
- La CLI será cf si aún no existe config Wrangler; con la config creada se usa Wrangler
  fijado y `--config` explícito. Staging ya está identificado en
  [staging-resources](../../cloud/deploy/staging-resources.md); producción sigue sin destino.

## 1. Regresión local existente

Estos comandos de regresión local pasaron durante la continuación de Implement sin tocar
los datos reales de la demo:

```powershell
npm ci
npm run build
npm test
npm run test:integration
npm run test:e2e
```

Resultado registrado: `npm test` 3/3, `npm run test:integration` 20/20 y
`npm run test:e2e` 9/9. El build Vite también pasó. No ejecutar setup/reset sobre una
instalación existente para continuar el desarrollo.

## 2. Workers y D1 locales aislados

Comandos locales implementados y verificados:

```powershell
npm run cloud:build
npm run cloud:test
npm run cloud:test:e2e
```

`cloud:test` usa una D1 aislada de pruebas. `cloud:prepare-local` aplica migraciones a la
D1 local persistente y agrega datos sintéticos; no abre `server/data`. Comandos de ejecución:

```powershell
npm run cloud:prepare-local
npm run cloud:dev
```

El seed local produce 20 productos y 5 categorías. Suites ejecutadas: `npm run cloud:test`
24/24 y `npm run cloud:test:e2e` 2/2; esta última incluye Vite build, Wrangler dry-run y
recorrido con Worker/Miniflare. La continuación US3 amplió cloud a36/36 y E2E cloud a6/6.
Integración SQLite20/20 y E2E SQLite9/9 volvieron a pasar. La suite alojada anterior3/3
no cubre la nueva seguridad administrativa: esta actualización no fue desplegada.
El emulador no es prueba del plan Free alojado ni reemplaza staging remoto.

Validar deep links y API404 JSON, imágenes locales, búsqueda/promociones reales, cuenta,
direcciones, carrito y pedidos. Con100 líneas verificar límite de consultas y parámetros;
CPU observado en emulador no demuestra cumplir los límites del servicio alojado.

## 3. Ensayo alojado y gates Firebase

**Evidencia histórica**: Worker/D1 staging se crearon y cloud:targets:check los verificó.
cloud:test:hosted anterior pasó3/3 con datos sintéticos y scrypt. Registro midió CPU
máxima602ms/promedio451.75ms; login522ms/435ms. Superó10ms de Workers Free; sin1102
observado ni memoria por invocación disponible. Nada de esto prueba Firebase. No repetir
ese runner suponiendo que el adaptador Firebase ya existe.

**Antes de crear Firebase**: revisar este Plan y actualizar/aprobar Tasks. Obtener
autorización específica de creación en Implement; no se presupone por aprobar documentos. En futura Implement autorizada se crea proyecto staging Spark base independiente,
sin billing/Blaze/Identity Platform. Registrar allowlist y comprobar Email/Password,
Require12..128, protección de enumeración y API key restringida. No crear recursos ahora.

Los comandos cloud:firebase:preflight, cloud:firebase:test-import, cloud:identities:import
y cloud:identities:verify son interfaces previstas en [operación](contracts/operations.md),
aún no ejecutables. Su implementación/ejecución corresponde a Tasks/Implement posteriores.

Matriz futura con cuentas sintéticas, sin tokens/cuerpos privados en trazas:

1. Mantener registro/login propios y cookie HttpOnly; comprobar user CUSTOMER y UID fijo,
   reinicio/reload, direcciones, carrito y orden persistentes. Reautenticar mismo UID ADMIN.
2. JWT firmado con clave efímera en unitarias: alg/kid/iss/aud/sub/exp/iat/auth_time,
   tenant/proyecto ajeno, firma inválida, claves rotadas/expiradas, refresh concurrente y
   Firebase caído. Emulador/mocks no pueden aceptarse en staging por una opción de bypass.
3. Spark real: cuentas desactivadas, password cambiado/reset externo, ID token previo aún
   vigente y eventos en el mismo segundo. Deben denegar sesión antigua y reintercambio;
   verificar lookup/validSince/passwordUpdatedAt reales. Sin evidencia, R-AUTH sigue cerrado.
4. Verificar que D1/backups solo contienen tokens cifrados; manipular nonce/AAD/key_version,
   perder clave y cerrar sesión. Nunca token en navegador, logs, screenshots o respuestas.
5. Medir Worker Free con claves cold/warm, registro/login/lookup/refresh/seguridad y
   concurrencia. Registrar CPU<=10ms, memoria/cuotas/subrequests y ausencia1102; agregar
   llamadas Firebase y escrituras D1 por sesión. La latencia HTTPS se mide aparte.
6. R-IDENTITY: crear en memoria passwords sintéticos y hashes con el módulo SQLite actual;
   importar STANDARD_SCRYPT exacto en Spark. Login original funciona, incorrecto falla,
   UID/roles/relaciones concilian; import parcial/duplicados/reintento no sobrescriben.
   El emulador no sustituye esta prueba. Si falla, ninguna cuenta real se migra.
7. R-EMAIL: EEP activa; enviar VERIFY_AND_CHANGE_EMAIL y verificar solicitud pendiente,
   correo antiguo vigente, enlace aplicado explícitamente y UID/destino reconciliados.
   202 no acredita entrega. Probar destino ocupado con error suprimido, colisión de
   signup directo y deriva externa; ningún UID no enlazado obtiene acceso D1.

Los gates de Firebase alojado no se ejecutaron en esta revision. Las pruebas locales sinteticas no prueban cuotas Free, entrega de email ni compatibilidad remota de cuentas.
se reduce y la importación/corte siguen bloqueados hasta evidencia y autorización.

## 4. Compra y administración

1. Registrar cliente, iniciar sesión, crear dirección, buscar producto y modificar carrito.
2. Checkout REJECTED: pedido AWAITING_PAYMENT e intento guardados, stock/carrito intactos.
3. Retry APPROVED: mismo pedido confirmado, una aprobación, un descuento y movimientos.
4. Repetir idéntica clave y cuerpo tras timeout; mismo status/body, sin duplicación.
5. Última unidad con100 intentos concurrentes/repetidos: máximo una venta y stock>=0.
6. Cambiar precio/stock entre quote y compra:409 sin cambios parciales. Inyectar fallo
   después de escribir stock y comprobar rollback completo de todas las tablas.
7. Admin gestiona catálogo/imágenes/categorías/promos/stock/clientes/pedido; cliente ve
   estado permitido e historial tras nueva sesión. Usuarios ajenos reciben404/403 correctos.
8. Cerrar/volver a abrir runtime cloud: datos continúan en D1, sin depender de Node local.

## 5. Mi cuenta → Seguridad

Evidencia histórica US3 scrypt, previa a Firebase:12 casos cloud contrato/integración y
4E2E administrativos; navegación, validación, submit lento, respuesta perdida, capacidad
SQLite ausente y axe en360/1280px/ambos temas. Esta version Firebase no se ha desplegado ni prueba en staging.

Validación futura del protocolo [Firebase](contracts/firebase-auth.md):

1. Password actual incorrecto, UID ajeno, versión obsoleta, falta de CSRF/Origin y rate
   limit: credenciales sin cambio. Antes de llamada remota, fallo de auditoría revierte D1.
2. Password solo correcto: Firebase reautentica mismo ADMIN; D1 LOCKED+revocación antes
   de cambiar en proveedor; completar auditoría/reconciliar, limpiar cookie y pedir login.
   Old password/sesiones/JWT previos fallan; password nuevo funciona tras corte temporal.
3. Inyectar timeout/caída en cada frontera Firebase/D1. Estado incierto mantiene
   RECONCILIATION_REQUIRED y acceso cerrado, sin falso rollback/éxito ni guardar password.
   Login con credenciales elegidas concilia el mismo UID antes de dar acceso comercial.
4. Carrera login/refresh/mutación con password change: CAS/corte/versiones impiden recrear
   sesión o confirmar checkout con identidad anterior, incluso en el mismo segundo.
5. Correo solo: reautenticar mismo ADMIN, reservar destino y recibir 202 pendiente sin
   modificar email. Abrir enlace no muta; confirmar por POST con código inspeccionado,
   incluso sin sesión original. UID/destino acreditados, email D1 nuevo, todas las
   sesiones anteriores revocadas; exige login nuevo y correo anterior no accede a cuenta.
   Respuesta sin prueba suficiente/timeout mantiene bloqueo hasta login y reconciliación.
6. Carreras: registro contra reserva, dos cambios al mismo email, cancelar/expirar contra
   confirmar, link ajeno/reutilizado/expirado y operación tardía. Máximo un ganador, sin
   identidad creada por signup de JM-STORE rechazado. A 60min expira límite local, no se
   promete TTL Firebase. APPLYING/incierto no se libera automáticamente. Código aplicado
   directamente tras cancelar causa deriva que debe bloquear/revocar antes de autorizar.
7. Ambos tipos en un PATCH: 422 antes de Firebase/D1; pending impide otro cambio. Tras
   completar correo o password, login nuevo antes de operación siguiente. Ningún secreto
   o código aparece en URLs persistidas, logs, screenshots, respuestas o referrers.
8. Regresión visual completa, accesibilidad y modo SQLite sin dependencia Firebase. Las
   pruebas nuevas se ejecutarán cuando existan tareas/implementación aprobadas, no en Plan.

## 6. Migración y recuperación

Ensayar con copia sintética completa antes del snapshot real. R-IDENTITY debe pasar en
Spark remoto antes de importar una sola cuenta real; el project_id/UID se registran en
manifiesto protegido y los roles se asignan por vínculo explícito, nunca por email.
Preflight exhaustivo de duplicados: importUsers no comprueba todos los conflictos.
 Usar los scripts de
[operación](contracts/operations.md), con --target y --manifest explícitos; no hay target
remoto por defecto. Los argumentos de rutas reales son privados y no se versionan.

Detener API local para snapshot final; backup consistente y restaurable, integridad y
digest, comparación pre/post origen. Reiniciar local solo tras capturar copia verificada.
Importar una vez al D1 nuevo CLOSED, chunks/checkpoints atómicos, preservar IDs/hashes y
relaciones. Sesiones importadas inertes; cliente entra de nuevo y recupera carrito propio.
Conciliar también Firebase/D1 por cuenta y éxitos parciales, sin asumir commit conjunto.
Conservar snapshot SQLite: auth:export puede omitir hashes externos aún no rehasheados.
Comparar counts/digests por tabla, FK, snapshots, pedidos y stock; diferencias bloquean
VERIFIED/OPEN. No importar sobre datos online posteriores ni ejecutar seed tras import.

Ensayar corrupción/archivo ausente, interrupción de chunk, reintento idéntico, snapshot
distinto y target incorrecto. Probar restore de export en staging separado y recuperación
de pedidos posteriores al backup antes de una restauración real. Registrar tiempo de
ensayo<=60min para dataset MVP y disponibilidad de export diario<=24h/Time Travel.
Capturar export privado y bookmark antes de cada migración; retener exports30días.

## 7. Responsive, seguridad y rendimiento

Playwright+axe en360/1280px, ambos temas, teclado, foco, reduced-motion, sidebar admin,
mini carrito, checkout y nueva seguridad. Verificar CSP/caché/cookies en assets y API,
errores sin datos privados y refresh de todas las rutas SPA.

Medir búsquedas con100 productos y20 sesiones sintéticas bajo Free: p95<=2s de resultado
visible; registrar región/red/CPU/filas consultadas. Recorrido cliente<4min, sin cobros
ni datos bancarios. Los ensayos no sustituyen los pendientes humanos de feature001.

## 8. GitHub y aceptación de release

Workers Builds se conecta en una fase futura solo al repositorio/Worker nuevo. Config
staging separada de producción, main habilitada únicamente tras revisión de gates y
aprobación del corte. No migrar ni importar por cada push. Comprobar repositorio, nombre,
UUID D1 y origen antes de publicar; prueba de identidad equivocada debe abortar.

| Evidencia requerida | Resultado en Plan |
|---|---|
| Build/suites locales y cloud | Cloud36/36, E2E cloud6/6, integración SQLite20/20, E2E SQLite9/9; build y dry-run aprobados |
| R-AUTH en staging Free | Firebase pendiente, no ejecutado; scrypt histórico excedió10ms |
| R-EMAIL | Diseño resuelto con Clarify; enlace, reserva y carreras pendientes de pruebas Spark sintéticas |
| R-IDENTITY | Pendiente: STANDARD_SCRYPT remoto exacto con cuentas sintéticas y manifiesto conjunto |
| Proyecto Firebase Spark | Proyecto/app creados manualmente; ID/API key y action URL pendientes de verificacion |
| Copia/restauración/reconciliación | No ejecutadas; importación real bloqueada |
| Seguridad administrativa | REST Firebase, cambio de correo con enlace y password separados implementados; pruebas D1 sinteticas locales; staging pendiente |
| Worker/D1/Builds nuevos | Worker/D1 de staging creados; Worker activo en workers.dev; Builds no conectado |
| Validaciones humanas antiguas | Siguen pendientes según quickstart001 |

Tras un restore verificar nuevo namespace, revocación de todas las sesiones restauradas,
rotación de firma de cotizaciones y conciliación de credential_operations/identidad vigente
en Firebase. No se restaura una contraseña Firebase al restaurar D1.
No se deben reactivar contraseñas o sesiones antiguas por recuperar un backup.

## Trazabilidad de validación

| Requisitos | Diseño y validación prevista |
|---|---|
| FR-001/003 | plan runtime/aislamiento; pasos1/2/8, R-ISOLATION y R-LOCAL |
| FR-002/015..017 | modelo/operación/identidades; pasos3/6, R-DATA y R-IDENTITY |
| FR-004..009/022 | API y modelo de comercio; paso4, R-COMMERCE |
| FR-006/010..014 | API/UI/Firebase; pasos3/5, R-AUTH/R-SECURITY/R-EMAIL |
| FR-018 | research Free y operaciones; pasos3/7/8, budgets por cuenta |
| FR-019/020 | UI y cliente conservado; paso7, R-UX |
| FR-021 | suites de todos los pasos, sin DB real de demo |
| SC-001/010 | recorrido cliente<4min, sin cargos ni datos bancarios; paso4 |
| SC-002/003/009 | reconciliación, origen intacto y restores; pasos1/6 |
| SC-004 | 100 intentos contra última unidad; paso4 |
| SC-005/006 | cambios de credenciales, roles y sesiones; paso5 |
| SC-007/008 | anchos/temas y p95 búsqueda; paso7 |

No declarar release completo si falta un gate. Guardar solo evidencia sintética y
redactada en documentación pública; dumps, trazas con datos y credenciales permanecen
privados. Esta guía termina en diseño; no autoriza ejecución remota por sí misma.

## Evidencia de esta revisión Plan

Solo revisión documental de requisitos, enlaces locales y contratos; no se ejecutaron
suites de aplicación ni se atribuyen resultados nuevos a Firebase. Spec y tasks.md no
se modifican. Revisión de enlaces locales, trazabilidad y ausencia de contradicciones:
Constitution 1.1.0 y decisiones vigentes de Clarify incorporadas en Phase 0/1.
El próximo paso SDD, cuando se solicite, será actualizar Tasks; no se realiza aquí.
Proyecto Firebase solo tras Tasks aprobadas y autorización específica en Implement.


## Implementacion Firebase local (2026-11-05)

El entorno `local` conserva autenticacion SQLite/scrypt. En `staging` y `production`, `cloud/src/config.js` exige `FIREBASE_PROJECT_ID`, `FIREBASE_API_KEY` y `FIREBASE_SESSION_ENCRYPTION_KEY` antes de iniciar las rutas Firebase. El SDK no se anade al navegador: React usa la cookie opaca HttpOnly y la API Worker llama a Firebase Auth REST. Los tokens de sesion y de recuperacion de email se guardan cifrados AES-GCM en D1; las contrasenas y codigos OOB no se escriben en D1.

Pendiente para activar pruebas alojadas: copiar el **Project ID** (no el nombre visible del proyecto) y **Web API Key** desde Firebase Console > Project settings > General > Your apps > `JM-STORE-WEB`; configurar el action URL personalizado del template Email address change hacia `https://jm-store-ecommerce-sdd-staging.josue-hinostroza-27.workers.dev/admin/mi-cuenta/seguridad/confirmar-correo` y autorizar `jm-store-ecommerce-sdd-staging.josue-hinostroza-27.workers.dev` en Authentication > Settings > Authorized domains; crear una clave AES-GCM aleatoria de 32 bytes como secret fuera de Git. No habilitar Identity Platform, Blaze, Hosting o facturacion.

Los limites publicos revisados para Workers Free son 100,000 requests/dia, 10 ms CPU por invocacion y 128 MB memoria; D1 Free incluye 5 M rows read/dia, 100,000 rows written/dia, 500 MB por base de datos y 50 consultas D1 por invocacion. Firebase Auth publica 100 cuentas nuevas/hora/IP y limites de envio de email, entre ellos 1,000 correos/dia para cambios de direccion en Spark. Son limites del servicio, no evidencia de que esta app ya cumpla CPU/cuotas: faltan las mediciones contra el Worker staging con Firebase real. No se ejecuto una operacion remota ni se cargaron valores Firebase en este checkpoint.

## Evidencia de implementación Firebase — 2026-11-05

Esta actualización sustituye únicamente como checkpoint vigente los resultados históricos de las tablas anteriores; no afirma haber probado Firebase alojado. Suites locales completadas: Cloudflare/Vitest 69/69, Worker/D1 emulados con Playwright 8/8, regresión SQLite unitaria 3/3, integración SQLite 20/20 y E2E SQLite 9/9. El build Vite/Worker y Wrangler dry-run finalizaron correctamente. El dry-run no desplegó ni escribió datos en la D1 staging.

Las pruebas de Firebase usan claves RSA, JWT, usuarios y acciones de correo sintéticos. Se verificaron reserva de identidad y email, no-vinculación por email, sesiones con tokens cifrados, renovación concurrente, revocación, cambios separados de correo/contraseña, confirmación explícita, reconciliación de respuesta perdida y ausencia de OOB/password en D1. La prueba de navegador verifica GET inerte, borrado de query del historial y respuesta de error sin éxito falso. No se ha probado la entrega real de correo, configuración efectiva de Firebase, CPU/cuotas alojadas, autenticación alojada ni enlace abierto desde un navegador externo.

Para continuar con pruebas alojadas faltan el **Project ID** y la **Web API Key** de Firebase Console > Project settings > General > Your apps > `JM-STORE-WEB`; restringir esa Web API Key a Identity Toolkit API y Token Service API; establecer el handler personalizado de Email address change y autorizar el host Workers staging. La clave `FIREBASE_SESSION_ENCRYPTION_KEY` debe generarse localmente como 32 bytes aleatorios en hexadecimal y guardarse como secret de staging, nunca en Git. Mantener Spark; no habilitar Blaze, Identity Platform o Hosting. No se cargaron estos valores, no se hizo despliegue ni se modificaron recursos remotos en esta continuación.

## Continuación: configuración offline y Firebase local aislado — 2026-11-05

Estado vigente: 56/105 tareas completas (T089 ahora verificada localmente). Preflight de las cinco variables en `.dev.vars`: PASS, sin duplicados, ignorado/no trackeado y cifrado AES-GCM funcional; cero consultas a proveedores. No se publica ningún valor. El propietario declaró Spark, Email/Password y dominio staging configurados; API key/EEP/policy/plantilla/dominio reales continúan sin verificación remota. T091/T102 conservan pendientes esos criterios.

Resultados nuevos ejecutados: `npm run cloud:test` 71/71 (17 archivos), `node cloud/scripts/local-e2e.js` 8/8, `npm run cloud:test:firebase:e2e` 6/6, build Vite/Worker y Wrangler dry-run aprobados. No hay resultados nuevos de suites SQLite en este checkpoint. Vitest ya no lee credenciales de `.dev.vars` y tiene una barrera de red comprobada por pruebas; el Worker Firebase E2E intercepta toda salida mediante proveedor REST/JWKS sintético, sin fallback a Internet. Los tests cubren registro/login, roles y acceso ADMIN, checkout persistente, contraseña actual inválida, password nuevo con revocación de ambas sesiones, reserva/cancelación inmediata de correo y confirmación explícita desde otro navegador. Un código OOB vencido no cambia el correo ni muestra éxito. Se corrigió en React la pérdida de operationId que impedía cancelar inmediatamente después de solicitar el cambio.

Rotación: `npm run cloud:secrets:prepare` genera/reutiliza dos candidatos criptográficos privados para QUOTE_SECRET y RATE_LIMIT_SECRET. Se consideran expuestos por declaración del propietario; el escaneo de sus valores actuales no encontró copias publicables ni en el historial local. Se comprobó que la clave nueva rechaza cotizaciones anteriores y cambia la identidad HMAC de rate limit. Los candidatos están ignorados y protegidos con ACL del usuario; no se sustituyeron valores activos locales o remotos. [Rotación](../../cloud/deploy/secret-rotation.md) y [preflight Firebase](../../cloud/deploy/firebase-staging.md).

No se ejecutaron pruebas remotas, despliegues, migraciones remotas, cuentas reales, commit o push. Los gates R-AUTH/R-EMAIL (CPU/cuotas, revocación y entrega reales) y R-IDENTITY (hashes sintéticos) siguen sin aprobar. El siguiente paso requiere la autorización solicitada por el propietario: respaldo/configuración del staging nuevo, rotación de secretos, migraciones 0003/0004 y publicación únicamente de la versión staging revisada antes de los ensayos sintéticos. SQLite y el proyecto Cloudflare antiguo quedan fuera de esas operaciones.

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
