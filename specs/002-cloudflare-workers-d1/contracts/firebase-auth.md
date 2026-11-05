# Diseño de autenticación Firebase Spark

Revisión Plan: 2026-11-04. Contrato futuro; no acredita implementación, creación de
proyecto, pruebas Firebase ni autorización remota. Complementa [API](api.md),
[modelo](../data-model.md), [operación](operations.md) e [investigación](../research.md).

## Estado del diseño

Firebase Authentication base Spark administra correo/password sin KDF en Worker. Clarify
aprobó verificar destino, reserva temporal, cambios separados y revocación total. El
anterior P-FIREBASE-EMAIL se resuelve documentalmente; R-EMAIL/R-AUTH/R-IDENTITY siguen
pendientes de pruebas sintéticas alojadas. No hay proyecto Firebase creado.
No se requiere identidad Google privilegiada en runtime ni se desactiva EEP.

## Límite de confianza y dependencias

Conservar los formularios React y las rutas Express del mismo origen. El Worker actúa
como backend de Firebase Auth REST: envía las credenciales transitorias a
`accounts:signUp`/`accounts:signInWithPassword` y recibe ID/refresh tokens. No ejecuta
scrypt, Argon2 o PBKDF2 ni recibe un hash calculado en el navegador. Las contraseñas
solo viven en la petición y en memoria durante la llamada HTTPS; sin logging de cuerpos.

Usar `fetch`, Web Crypto y una biblioteca JWT compatible con Workers, propuesta `jose`
ESM fijada en lockfile durante Implement. No instalar Firebase Admin SDK en Worker.
Firebase Admin SDK se limita a herramientas Node privadas de importación/provisión,
fuera del runtime y con permisos mínimos y credenciales de operador protegidas.
No se necesita Firebase Web SDK en el bundle para este diseño REST; se conserva el
contrato de cookie HttpOnly y no se almacenan refresh tokens en localStorage/IndexedDB.

Configuración por entorno: `AUTH_PROVIDER=firebase`, `FIREBASE_PROJECT_ID` y
`FIREBASE_API_KEY` restringida a las APIs requeridas de Auth/Token Service. La API key
identifica el proyecto y no autoriza roles D1. El Worker no exporta tokens al navegador.
Añadir secreto independiente `FIREBASE_SESSION_ENCRYPTION_KEY` con identificador de
versión; no es una credencial administrativa de Firebase. No activar Identity Platform,
Blaze, teléfono/SMS, Functions, Firestore, Storage o extensiones por esta integración.

## Verificación de ID tokens

Usar únicamente certificados de la URL oficial fija
`https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`.
`kid` selecciona una clave de ese conjunto, nunca una URL del token. Importar certificado
con `importX509` y verificar RS256 con Web Crypto. Exigir:

- `alg=RS256`, firma válida y `kid` conocido; rechazar `none`, HS256, custom tokens,
  tokens de emulador sin firma y tokens de otro proyecto o tenant.
- `aud` igual a `FIREBASE_PROJECT_ID`, `iss` exactamente
  `https://securetoken.google.com/<projectId>`, `sub` no vacío de hasta 128 caracteres.
- `exp` futuro, `iat` y `auth_time` no futuros, tipos/rangos válidos; tolerancia de reloj
  documentada de como máximo 30 segundos, nunca para eludir un corte de revocación.
- UID de respuesta Firebase igual a `sub`, proveedor password y cuenta D1 enlazada al
  proyecto/UID exactos. Email y custom claims no pueden seleccionar/promover roles.

Cachear certificados y CryptoKeys hasta `Cache-Control: max-age`. Un `kid` desconocido
provoca una única renovación acotada; si sigue ausente se rechaza. Coalescer renovaciones
concurrentes, limitar tamaño/tiempo de respuesta y no usar claves caducadas tras un fallo.
No cachear un resultado de autorización o revocación entre peticiones.

## Sesiones de aplicación y revocación

Después del login, emitir cookie opaca aleatoria de 32 bytes, hash en D1, nombre
`__Host-jm-sdd.sid`, Secure/HttpOnly/SameSite=Lax/Path=/, sin Domain. Mantener 8 horas
absolutas y 30 minutos de inactividad. La sesión visitante sigue separada. Auth exige
Origin exacto, CSRF y rate limit antes de llamar al proveedor.

Guardar ID/refresh tokens cifrados con AES-256-GCM en una fila privada ligada a la sesión;
nonce aleatorio de 96 bits distinto por cifrado y AAD con entorno, proyecto, UID, sessionId
y versión de clave. D1, dumps o logs no contienen tokens en claro. Borrar el sobre cifrado
al cerrar/revocar/expirar la sesión. Retener las claves de descifrado solo en el almacén
de secretos, con rotación y recuperación documentadas; perder la clave exige nuevo login.

Cada petición privada revalida sesión, namespace, rol/actividad, `auth_version`, bloqueo
de seguridad y corte `firebase_auth_not_before` en primaria. Verificar el ID token; si
expiró, renovar mediante Secure Token API con refresh token descifrado y reemplazar el
sobre mediante CAS. Dos renovaciones simultáneas no pueden restaurar una sesión revocada.

Consultar `accounts:lookup` con el ID token antes de autorizar cada petición privada,
sin caché de estado activo/revocación. Usar solo UID/email/disabled/validSince y
passwordUpdatedAt necesarios; ignorar y no registrar otros campos sensibles. Comparar
`auth_time` con el estado autoritativo y el corte D1. Esto cubre cambios hechos fuera
de JM-STORE, incluido reset de contraseña; verificar solamente la firma no los detecta.
La semántica y presencia de esos campos en la respuesta de usuario Spark se validan con
cuentas sintéticas: si no permiten detectar revocación, ERROR R-AUTH y no se abre el acceso.
Un fallo de lookup/refresh devuelve 503 cerrado o 401 para credencial definitivamente
revocada; no se sirve acceso privado con un resultado antiguo. No degradar a scrypt local.

El corte D1 requiere `auth_time` estrictamente posterior al segundo revocado. Cuando
los timestamps de Firebase no distinguen dos eventos en un mismo segundo, exigir nuevo
login después de ese segundo. No permitir reintercambiar un JWT antiguo para reconstruir
sesiones. Guardas de mutación vuelven a comprobar `auth_version` dentro del batch D1.

## Registro, vínculo e identidad existente

`POST /auth/register` conserva validación y adquiere primero una reserva D1 única
normalizada de tipo REGISTRATION, compartida con emails vigentes/importados y cambios
pendientes. Conflicto devuelve error genérico antes de accounts:signUp; no crea identidad
ni revela motivo. CAS convierte la reserva en ACCOUNT al completar perfil, solo CUSTOMER.
Timeout de signup conserva reserva/operación incierta para conciliar, sin reintento ciego.
No admitir cualquier UID no enlazado al hacer login: completar un perfil pendiente solo
si coincide el UID acreditado de su operación de registro, nunca por email ni por poseer
solo la dirección. Signup directo a Firebase no crea usuario/rol/sesión de JM-STORE. Un resultado Firebase sin commit D1 es una inscripción pendiente,
no un registro completo. Reintentar autenticación del mismo UID puede completar el perfil
sin crear otra identidad. No borrar automáticamente una cuenta Firebase tras timeout.

Enlaces únicos por `(project_id,firebase_uid)` y `user_id`; preservar IDs de cliente y FK
de negocio. Nunca vincular por coincidencia de email. Las cuentas importadas se enlazan
mediante manifiesto privado; reservar sus emails antes de abrir registro para impedir
que un registro nuevo reclame un cliente o administrador histórico. Colisiones bloquean
la cuenta/importación, sin sobrescribir, fusionar ni reasignar roles. Firebase es fuente
de la credencial/email confirmado como vigente; D1 conserva roles y perfil comercial.

## Mi cuenta → Seguridad: contraseña y consistencia

Mantener campos y validación password12..128 sin trim, confirmación exacta y email ASCII
normalizado. Configurar en Firebase política Require con mínimo12/máximo128; no usar
el mínimo6 por defecto. CurrentPassword se verifica mediante nuevo
`accounts:signInWithPassword`, validando que el UID recibido coincide con el administrador
de la sesión. No basta un JWT antiguo ni el rol enviado desde el cliente.

Firebase y D1 no comparten transacción ACID. Sustituir la anterior promesa de un batch
que cambia el hash por un protocolo explícito con estados y recuperación:

1. Validar campos/versión; rechazar 422 si contiene email y newPassword o si no hay cambio
   material, antes de Firebase o mutación D1. Una operación activa devuelve 409 sin empezar
   otra. Reautenticar password actual y exigir UID ADMIN exacto; solo entonces preparar
   una operación PASSWORD. Email usa el protocolo separado siguiente.
2. En batch D1 con CAS, registrar operación sin contraseñas, marcar cuenta LOCKED,
   incrementar auth_version, fijar corte de revocación y eliminar todas sus sesiones y
   sobres cifrados. Registrar inicio de auditoría. Ninguna llamada comercial posterior
   de una sesión antigua puede confirmar una escritura.
3. Invocar `accounts:update` con ID token de reautenticación y nueva contraseña.
   Firebase invalida los refresh tokens previos por el cambio. Descartar cualquier token
   nuevo devuelto; no crear una sesión automáticamente.
4. Confirmar resultado del proveedor, terminar auditoría y marcar operación COMPLETED
   en D1; desbloquear cuenta sin restaurar sesiones. Borrar cookie y solicitar login
   nuevo. Solo entonces anunciar éxito. Las versiones no retroceden.
5. Si Firebase falla, D1 falla después del proveedor, hay timeout o termina el Worker,
   conservar bloqueo y estado RECONCILIATION_REQUIRED. No anunciar rollback de Firebase
   ni guardar la contraseña para reintentar. Una nueva autenticación privada con las
   credenciales elegidas y UID exacto puede conciliar estado; nunca una cookie antigua.
   Si no se acredita el estado, mantener bloqueada y permitir recuperación operativa
   auditada. Invalidar sesiones es definitivo aunque el proveedor no cambiara password.

El usuario puede resolver una respuesta perdida desde el login existente: autenticación
correcta no equivale a acceso comercial hasta conciliar el registro pendiente en D1.
Errores de contraseña/validación previos al paso2 cambian cero credenciales. Un fallo de
auditoría del paso2 aborta D1 antes de llamar Firebase; un fallo posterior requiere
reconciliación, no revierte automáticamente una operación ya aceptada por Firebase.

## Mi cuenta → Seguridad: correo pendiente y confirmación

1. ADMIN con sesión/Origin/CSRF y currentPassword válido reautentica mismo UID. Batch D1
   con CAS sobre usuario/sesión/operación adquiere EMAIL_CHANGE en el registro único de
   direcciones y crea PENDING_VERIFICATION. Conserva ACCOUNT del correo actual. Colisión
   con usuario/import/reserva/registro concurrente falla genéricamente, sin llamada OOB.
   Una operación por usuario; prohibir contraseña mientras haya cambio activo.
2. Enviar `accounts:sendOobCode` con `requestType=VERIFY_AND_CHANGE_EMAIL`, idToken reciente,
   newEmail y continueUrl de origen allowlisted con operationId opaco, nunca UID/email
   usados como autorización. Firebase envía el correo, no un servicio SMTP adicional.
   Configurar su plantilla con action handler `/cuenta/confirmar-correo` del nuevo origen.
   EEP puede suprimir errores de destino ocupado: 202 solo afirma solicitud aceptada.
   No devolver enlace/código/tokens. Antes de confirmar, users.email y credenciales
   siguen vigentes; no revocar sesiones por mero envío ni afirmar correo actualizado.
3. El enlace abre página mínima sin terceros/analytics, Referrer-Policy:no-referrer,
   Cache-Control:no-store y sin logs de URL/query. Extraer oobCode a memoria y limpiar URL
   inmediatamente; nunca persistirlo. GET no aplica cambios (incluidos scanners de email).
   Bootstrap de sesión visitante+CSRF permite confirmación explícita POST en otro navegador,
   sin exigir la sesión ADMIN original. El código es una credencial de uso limitado, no
   prueba de rol: comprobar operación, propósito, par old/new y UID en servidor.
4. Inspeccionar sin consumo con `accounts:resetPassword({oobCode})`. Exigir requestType
   VERIFY_AND_CHANGE_EMAIL, old email y newEmail iguales a la operación D1 activa y no
   expirada. No confiar en apiKey, email, UID, continueUrl o proyecto suministrados por URL;
   usar configuración fija. Un código de otra operación/tipo/proyecto se rechaza.
5. Batch CAS cambia PENDING_VERIFICATION a APPLYING, comprueba reserva/versión, marca
   LOCKED, incrementa auth_version, fija corte, revoca todas las sesiones/sobres y audita.
   Solo después `accounts:update({oobCode})`. Cancelar/expirar ya no puede ganar; registro
   en el mismo correo sigue bloqueado. Antes de este commit, error de auditoría revierte
   D1 sin consumo de código. No guardar el OOB ni passwords para reintentos automáticos.
6. Confirmar respuesta: localId debe ser UID esperado y newEmail/estado acreditado destino
   confirmado; no depender de email obsoleto ni asumir campos/tokens siempre presentes.
   Si falta prueba suficiente o se pierde respuesta, RECONCILIATION_REQUIRED y LOCKED;
   nuevo login con correo verificado y password vigente debe probar UID exacto y lookup.
   Nunca anunciar éxito solo por datos de URL o correo enviado.
7. Batch final actualiza users.email, mueve propiedad ACCOUNT del viejo al nuevo correo,
   completa operación/auditoría y libera reserva temporal; mantiene sesiones revocadas y
   desbloquea solo con resultado acreditado. Responder requiresLogin:true, expirar cookie,
   vaciar estado privado y solicitar nuevo login con correo nuevo. No crear sesión desde
   respuesta OOB; el correo anterior no autentica la misma cuenta. UID/rol/FK no cambian.

### Duración, cancelación y límites de la reserva

Límite de aplicación: expires_at=created_at+60min, no extendido por replay. Firebase puede
rechazar antes; no se presume su TTL ni invalidación al reenviar. Un cambio pendiente
puede cancelarse con sesión ADMIN, Origin/CSRF, versión y contraseña actual. Batch CAS
PENDING_VERIFICATION→CANCELED libera solo reserva EMAIL_CHANGE; expiración conocida hace
EXPIRED. La limpieza oportunista es acotada e indexada; no requiere servicio de pago.
Tras enviar OOB con timeout, conservar SEND_UNKNOWN y reserva hasta conciliar/cancelar
seguramente; no afirmar que no se envió ni volver a enviarlo automáticamente.
APPLYING/RECONCILIATION_REQUIRED nunca se liberan por reloj sin reconciliar proveedor.
Una nueva solicitud usa operación y enlace nuevos; la anterior no se reactiva.

D1 serializa registros/cambios de JM-STORE, pero no controla signup directo ni revoca
un OOB Firebase ya emitido al cancelar/expirar. El handler rechaza enlaces locales
obsoletos; si se consumen directamente en Firebase, detectar deriva email/UID en lookup
antes de autorizar, bloquear, revocar y reconciliar. Nunca copiar correo remoto no
confirmado/conflictivo a otra cuenta ni otorgar rol por email. Si Firebase dice destino
ocupado, conserva correo anterior y ofrece recuperación genérica; si resultado incierto,
no liberar reserva ni permitir comercio. Una identidad externa no enlazada carece de
acceso D1 y no completa registros por coincidencia de dirección.
No prometer reserva global ni reversión del proveedor; no usar blocking functions o
upgrade. Estas carreras forman parte de R-EMAIL y R-SECURITY antes de publicar.

## Pruebas de aceptación de la integración

Fixtures JWT firmadas con claves efímeras y reloj controlado para verificador unitario;
emulador/mocks solo en entorno local aislado. Ninguna opción de token sin firma o de
emulador puede llegar a staging/producción. Pruebas alojadas posteriores con Spark real:

| Área | Evidencia requerida |
|---|---|
| Tokens | firma/alg/kid/issuer/audience/tenant/exp/iat/auth_time; rotación, caché vencida, proveedor caído |
| Roles | claim ADMIN falsificado, UID ajeno y email histórico no enlazan ni elevan privilegios |
| Registro/login | reserva previa a signup; mismo UID de operación completa perfil; duplicado/timeout/signup directo no crean roles o enlaces indebidos |
| Correo | pending mantiene email viejo; OOB correcto/otro proyecto/tipo/cuenta, 202 sin entrega, cancelación/expiración/replay, reserva concurrente, confirmación sin sesión original y deriva externa |
| Cambios separados | email+password rechaza antes de llamadas/mutaciones; operación activa impide otra; tras completar, nuevo login |
| Sesiones | ciphertext no revela tokens; manipulación/AAD incorrectos fallan; refresh concurrente/logout/version CAS |
| Revocación | cambio/reset externo, password en JM-STORE, JWT aún vigente y carrera en el mismo segundo deniegan acceso antiguo |
| Seguridad | password actual incorrecto, cuenta desactivada, CSRF/Origin, rate limit, logs/trazas sin credenciales |
| Consistencia | caída antes/después de Firebase y fallo D1/auditoría dejan bloqueo recuperable; no falso éxito ni replay automático |
| Free | CPU por ruta, cold/warm keys, lookup, refresh y concurrencia bajo10ms; memoria y cuotas documentadas, sin 1102 |
| Regresión | mismas páginas/temas y recorrido de compra; suites SQLite siguen aisladas de Firebase |

R-EMAIL exige este flujo completo con EEP activo, sin falsear entrega ni disponibilidad.
R-IDENTITY exige prueba remota STANDARD_SCRYPT exacta; ningún ensayo usa cuentas reales.
Fuentes primarias: [OOB](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/sendOobCode),
[comprobar código](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/resetPassword),
[aplicar](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/update),
[respuesta](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/SetAccountInfoResponse),
[manejador](https://firebase.google.com/docs/auth/custom-email-handler),
[EEP](https://docs.cloud.google.com/identity-platform/docs/admin/email-enumeration-protection),
[API keys](https://firebase.google.com/docs/projects/api-keys).
