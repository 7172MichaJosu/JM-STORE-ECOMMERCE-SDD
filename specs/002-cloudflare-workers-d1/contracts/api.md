# Contrato HTTP cloud

Diseño2026-11-04; base `/api`, JSON UTF8, mismo origen que el cliente. Extiende
[contrato001](../../001-jm-store-ecommerce/contracts/api.md); no cambia nombres de campos,
formatos de pedido/carrito/producto, códigos ni semántica actuales al adaptar persistencia.
La implementación futura deberá capturar las respuestas vigentes como pruebas de paridad.

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

## Nueva interfaz: seguridad del administrador

GET /auth/session cloud añade `data.capabilities:{adminSecurity:true}`. Es una ampliación
aditiva: ausencia del campo en el backend local equivale a false; no obliga a implementar
los endpoints cloud en el servidor SQLite ni a mostrar allí enlaces que no funcionan.
La capacidad solo controla navegación, nunca autorización.

### GET /admin/me/security

Solo ADMIN activo; 200 `{data:{id,email,version}}`, sin hash, secretos o lista de sesiones.
La respuesta permite llenar el formulario y efectuar una modificación con CAS. En lectura
no hace falta volver a introducir la contraseña actual.

### PATCH /admin/me/security

Solo ADMIN activo con cookie, Origin y CSRF válidos. Campos permitidos:

| Campo | Regla |
|---|---|
| currentPassword | obligatorio; string12..128 sin trim; verificación contra hash actual |
| email | opcional; ASCII trim/lowercase3..254, formato válido y UNIQUE |
| newPassword | opcional;12..128 sin trim |
| confirmNewPassword | obligatorio si newPassword está presente; coincidencia exacta |
| version | INTEGER positivo leído de seguridad; CAS contra usuario vigente |

Exigir al menos un cambio material; no se aceptan role,is_active,userId o passwords de
clientes. Hash nuevo mantiene política segura actual. Verificar password, después batch
con guarda de sesión/hash/version para evitar carreras.

- Solo correo:200 `{data:{user:<usuario seguro actualizado>,requiresLogin:false}}`.
  Se aplica inmediatamente, sin enlace, notificación ni proveedor de email. Correo anterior
  deja de servir para login; contraseña permanece. Mantener sesión y refrescar perfil.
- Password, solo o junto con correo:200 `{data:{user:null,requiresLogin:true}}` tras commit,
  expirar cookie. Revocar todas las sesiones y pedir login con correo/password finales.
  La interfaz limpia inmediatamente formularios y estado de cuenta.
- Password actual incorrecto:403 `CURRENT_PASSWORD_INVALID`, sin cambio; sesión caducada:
  401. Campos inválidos422; email ocupado409 `EMAIL_UNAVAILABLE` sin revelar otra cuenta;
  versión/hash cambiados409 `ACCOUNT_CHANGED`; rate limit429; fallo D1503 sin cambio parcial.
- Actualización, auth_version/revocación cuando procede y evento de seguridad se confirman
  juntos. Fallo inyectado de auditoría debe revertir también email/password/sesiones.
- Si se pierde la respuesta después del commit, GET /auth/session detectará logout tras
  password change. Mostrar que la conexión se interrumpió y pedir login con credenciales
  elegidas; no afirmar que el cambio falló ni volver a enviar otra contraseña automáticamente.

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
