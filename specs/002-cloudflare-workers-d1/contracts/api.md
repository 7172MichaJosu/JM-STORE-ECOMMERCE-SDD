# Contrato HTTP cloud

Diseño2026-11-04; base `/api`, JSON UTF8, mismo origen que el cliente. Extiende
[contrato001](../../001-jm-store-ecommerce/contracts/api.md); no cambia nombres de campos,
formatos de pedido/carrito/producto, códigos ni semántica actuales al adaptar persistencia.
La implementación futura deberá capturar las respuestas vigentes como pruebas de paridad.
La autenticación online se delega a Firebase Auth REST según [contrato Firebase](firebase-auth.md).
El modo SQLite mantiene su autenticación y no recibe esta dependencia. Esta revisión es
solo diseño alineado con Clarify, sin certificar funcionalidades Firebase.

## Rutas preservadas

| Grupo | Interfaces que deben continuar disponibles |
|---|---|
| Salud/auth | GET /health, GET /auth/session, POST /auth/register, /auth/login y /auth/logout |
| Cuenta cliente | GET/PATCH /me; GET/POST /me/addresses; PATCH/DELETE /me/addresses/:id |
| Catálogo | GET /categories, /products y /products/:slug con búsqueda/filtros/paginación |
| Carrito | GET /cart; PUT/DELETE /cart/items/:productId |
| Compra | POST /checkout/quote, POST /orders; POST /orders/:publicId/payment-quote y /orders/:publicId/simulated-payments |
| Historial | GET /orders y /orders/:publicId |
| Administración | GET /admin/summary; CRUD ya existente de products/categories/promotions; GET /admin/image-library; PUT /admin/products/:id/images |
| Inventario | GET /admin/inventory; POST /admin/inventory/:id/adjustments; GET /admin/inventory/:id/movements |
| Clientes/pedidos admin | GET /admin/customers y /:id, PATCH /admin/customers/:id; GET /admin/orders y /:id, PATCH /admin/orders/:id/status |

No se añaden rutas de migración, backups, provisión, reset o apertura de tienda a la API
pública. Imágenes siguen siendo selección/orden de biblioteca local permitida.

## Reglas cloud

- Respuestas `{data:...}` o `{error:{code,message,fields?,requestId}}`; no SQL/stack/hash.
  200 lectura/cambio,201 creación,204 logout/desactivación;400 JSON,401 sesión,
  403 rol/CSRF,404 inexistente/ajeno,409 conflicto,422 validación,429 rate limit,
  503 almacenamiento/cuota/mantenimiento y500 inesperado sin detalles internos.
- Métodos de escritura requieren sesión, Origin exacto y X-CSRF-Token incluso en login
  y registro. GET /auth/session crea sesión visitante/token si corresponde; login/registro
  rotan ambos. Sin CORS abierto ni sesión local reutilizada.
- Cookie online `__Host-jm-sdd.sid`; Secure/HttpOnly/SameSite=Lax/Path=/, sin Domain.
  Usuarios8h absolutas/30min inactividad, visitante24h con cookie no persistente.
  Rol/estado/auth_version comprobados en primaria. Dato privado ajeno404.
- JSON<=100KiB; listas page>=1,pageSize20 por defecto y máximo100; filtros desconocidos422.
  Cuotas o D1 no disponible:503 seguro, sin simular éxito ni convertir a pago rechazado.
- `no-store` en auth/cuenta/carrito/checkout/admin/pedidos y errores privados; el frontend
  no cachea tokens, credenciales ni datos personales en almacenamiento persistente.
- Rate limit distribuido D1 con Retry-After: auth y checkout conservan límites001;
  nueva seguridad5 intentos/15min por admin+IP. La IP se toma del contexto confiable.
- Idempotency-Key UUID con mismo alcance/hash/cuerpo y replay exacto de feature001;
  rollback completo y retorno409 ante guarda de versión/stock. Máximo100 líneas se conserva.

## Autenticación delegada conservando el contrato cliente

POST /auth/register conserva name,email,password,phone opcional, validación y CSRF;
Worker adquiere primero reserva REGISTRATION en el espacio único de emails D1 y luego
llama a accounts:signUp. Una dirección vigente/importada/pendiente devuelve 422
REGISTRATION_UNAVAILABLE genérico sin llamada signup ni nueva identidad; no se revela
qué clase de reserva existe. El login no completa perfil de cualquier UID externo:
requiere operación de registro propia con UID acreditado. Rol CUSTOMER solo en D1. El201 con
cookie/CSRF renovados llega después de confirmar identidad y perfil D1 enlazados; si
Firebase creó identidad pero D1 falló,503 ACCOUNT_SETUP_PENDING sin falso éxito. Nuevo
login del mismo UID completa el perfil mediante CAS, sin duplicar ni elevar roles.

POST /auth/login conserva email,password y200 con usuario seguro/CSRF renovado. Worker
llama a accounts:signInWithPassword y valida ID token, proyecto/UID y lookup Firebase;
D1 comprueba vínculo/rol/activo/corte/bloqueo. No se enlazan usuarios históricos por email.
Cuenta ajena, contraseña inválida o inactivo devuelven401 genérico; colisión/reserva se
resuelve de forma privada sin revelar la existencia de otra cuenta.429/503 nunca se
transforma en credenciales incorrectas. No se aceptan roles, UID ni hashes del cliente.

GET /auth/session conserva bootstrap y añade provider/capacidades no sensibles cuando
la integración esté lista; no retorna ID/refresh tokens ni claves de cifrado. POST
/auth/logout elimina sesión/sobre cifrado y cookie, sin cerrar la sesión de otros usuarios.
Cada request privado pasa por revocación D1 y accounts:lookup; JWT firmado por sí solo
no autoriza. Fallo temporal del proveedor503 cerrado, revocado/expirado definitivamente401.
La revocación se prueba con JWT anterior aún vigente y refresh concurrente.

## Nueva interfaz: seguridad del administrador

GET /auth/session cloud puede añadir `data.capabilities:{adminSecurity:true,authProvider:"firebase"}`
solo tras cerrar gates y verificar flujo completo. El true actual de US3 scrypt es evidencia
histórica y no prueba compatibilidad Firebase. Es una ampliación
aditiva: ausencia del campo en el backend local equivale a false; no obliga a implementar
los endpoints cloud en el servidor SQLite ni a mostrar allí enlaces que no funcionan.
La capacidad solo controla navegación, nunca autorización.

### GET /admin/me/security

Solo ADMIN activo; 200 `{data:{id,email,version,pendingEmailChange}}`, sin hash, secretos
ni sesiones. pendingEmailChange es null o {operationId,status,targetEmail,expiresAt},
visible exclusivamente al dueño ADMIN; el email principal sigue siendo el antiguo.
La respuesta permite llenar el formulario y efectuar una modificación con CAS. En lectura
no hace falta volver a introducir la contraseña actual.

### PATCH /admin/me/security

Contrato futuro ADMIN activo con cookie/Origin/CSRF. Campos conservados:

| Campo | Regla |
|---|---|
| currentPassword | string12..128 sin trim, obligatorio; Firebase reautentica y debe devolver el mismo UID |
| email | opcional; ASCII trim/lowercase3..254 válido, distinto al vigente; reserva única y verificación previa |
| newPassword | opcional;12..128 sin trim, distinto al actual; política Require equivalente en Firebase |
| confirmNewPassword | obligatorio si newPassword; igualdad exacta |
| version | INTEGER positivo; CAS de usuario y vínculo vigentes |

Exigir exactamente un cambio material: email o newPassword. Ambos presentes devuelven
422 ONE_CREDENTIAL_CHANGE_REQUIRED antes de reautenticar, reservar o llamar al proveedor.
Rechazar role,is_active,userId. Operación de seguridad activa→409 SECURITY_CHANGE_PENDING;
tras completarla, nuevo login antes de siguiente cambio. No fallback hash D1/SQLite.

Correo solo: reautenticar, reservar y enviar OOB según [Firebase](firebase-auth.md).
202 {data:{status:"PENDING_VERIFICATION",operationId,expiresAt,requiresLogin:false}};
no garantiza entrega, no actualiza email ni informa disponibilidad del destinatario.
Reservas/colisiones devuelven 422 SECURITY_CHANGE_UNAVAILABLE genérico. Una solicitud
repetida no extiende expiry ni envía otro enlace automáticamente; estado se consulta en
GET de seguridad. Timeout conserva estado seguro y devuelve 503 con requestId.

### POST /auth/email-change/confirm

Ruta del manejador propio, no requiere sesión ADMIN original: visitante bootstrap, Origin
exacto/CSRF y rate limit 5/15min por operación+IP. Body {operationId,oobCode}; límites
acotados y sin logs. Comprobar OOB con Firebase y operación activa antes de consumir.
GET de página no cambia identidad. No se acepta UID/email/proyecto del cliente como prueba.
Batch CAS bloquea/revoca todas las sesiones antes de aplicar; confirmar UID/newEmail y
finalizar D1/auditoría. 200 {data:{status:"COMPLETED",requiresLogin:true}}, cookie expirada;
no user ni tokens ni sesión nueva. Nuevo login con correo confirmado obligatorio.
Link inválido/ajeno/expirado/cancelado→422 EMAIL_CHANGE_UNAVAILABLE genérico sin mutación;
aplicación incierta→503 SECURITY_RECONCILIATION_REQUIRED, mantiene bloqueo. Repetición
no aplica otra vez ni crea acceso; una respuesta COMPLETED solo si existe prueba propia
suficiente del resultado, sin revelar datos de cuenta al portador de operationId solo.

### POST /admin/me/security/email-change/cancel

ADMIN dueño, Origin/CSRF, currentPassword y {operationId,version}. Reautenticar mismo UID;
CAS pendiente→CANCELED y liberar su reserva temporal conocida; 200 {data:{status:"CANCELED"}}.
APPLYING/incierto que requiere reconciliación→409, sin liberar reserva ni restaurar sesiones.
No promete invalidar OOB en Firebase; el handler rechaza operación cancelada y deriva
externa falla cerrada. Al expirar rige el mismo límite. No se devuelve información pública.

### Finalización de contraseña (PATCH de seguridad)

Password solo: aplicar protocolo persistente [Firebase](firebase-auth.md). Reautenticar,
confirmar mismo UID y versión; batch D1 crea operación/bloqueo/corte/revocación/auditoría,
luego cambiar password en Firebase. Tras confirmación y finalización D1,200
{data:{user:null,requiresLogin:true}}, cookie expirada y todas las sesiones revocadas.
El usuario debe iniciar sesión con nueva contraseña y auth_time posterior al corte.
No se deriva ni actualiza el password_hash histórico en Worker.

Errores previos a cambiar credencial:403 CURRENT_PASSWORD_INVALID,401 sesión,422 campos,
409 ACCOUNT_CHANGED por versión/vínculo y429 rate limit; cero cambios de credencial.
Antes de llamar Firebase, fallo de auditoría revierte batch D1 completo. Una vez llamado
el proveedor, timeout/fallo de D1 no promete rollback remoto:503
SECURITY_CHANGE_PENDING y requestId sin credenciales; cuenta LOCKED hasta reconciliación.
No devolver un200 ni anunciar cambio fallido mientras el resultado sea incierto.

POST /auth/login sirve como entrada de conciliación tras nueva autenticación Firebase
válida del mismo UID; solo obtiene sesión si valida estado real y cierra la operación
pendiente. Si no se puede acreditar,503 SECURITY_RECONCILIATION_REQUIRED y acceso cerrado.
No reintentar automáticamente cambios de contraseña ni restaurar sesiones por un fallo.
Una respuesta perdida orienta al login con las credenciales elegidas; no imprimirlas.

Firebase y D1 no comparten transacción: el rollback indivisible del scrypt anterior no
se promete para el proveedor remoto. Pending/bloqueado es explícito y auditable. Cada
request privado compara identidad y correo vigente con D1; deriva externa revoca/bloquea
hasta reconciliar UID, sin vincular por dirección ni otorgar roles. Accounts sin vínculo
válido no reciben sesión aunque Firebase haya aceptado su signup directo.

## Salud y estado operativo

GET /health no revela account_id,UUID D1, rutas de backup, secretos o detalles de filas.
Antes de OPEN solo responde a salud y tráfico de validación autorizado en staging;
operaciones comerciales públicas devuelven503 `STORE_NOT_READY`. Apertura no es una ruta
HTTP: se controla con herramientas operativas y evidencia de validación. Si se habilita
acceso temporal de operador al destino cerrado, debe autenticarse fuera de la API pública
con secreto de validación; jamás se incluye en el cliente ni en URLs públicas.

## Pruebas de contrato exigidas

Paridad de todas las rutas con SQLite, autorización/propiedad, validación, imágenes,
promociones, sesión y límites; caminos success/error de nueva seguridad; rechazo/retry,
doble submit, timeout, última unidad, price change y fallo SQL dentro del batch.
Las pruebas de HTTP alojadas usan D1 staging nueva y datos sintéticos; no tocan el proyecto
antiguo ni exponen secretos en logs o trazas de navegador.
