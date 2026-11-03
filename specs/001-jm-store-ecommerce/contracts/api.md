# Contrato HTTP: JM-STORE

**Versión de diseño**: 1 | **Base**: `/api` | JSON UTF-8 | [Modelo](../data-model.md)

Contrato normativo para frontend, backend y pruebas futuras. No es código implementado.
La API es del mismo origen que la interfaz: proxy Vite en desarrollo y Express en demo.

## Reglas comunes

- Respuesta singular `{data: recurso}`; listados `{data: [], meta: {page,pageSize,total}}`.
  IDs enteros positivos; UUID público para pedidos. Timestamps UTC ISO 8601.
- Moneda `currency: "PEN"`; importes `*_cents` enteros. Nunca enviar importes binarios
  decimales como precio autoritativo. UI muestra S/ y dos decimales.
- Listas paginadas: page>=1, pageSize=20 por defecto, máximo 100. Orden fijo por id si no
  se especifica; pedidos por creación descendente. Filtros y parámetros desconocidos
  inválidos devuelven 422. Bodies JSON máximo 100 KiB.
- Métodos de escritura requieren cookie y `X-CSRF-Token`, incluso login y registro.
  Bootstrap GET `/auth/session` crea sesión anónima y token CSRF si faltan. Validar Origin
  en escrituras contra origen configurado y rechazar orígenes externos; GET no muta negocio.
  Sin CORS abierto. Sesión/CSRF rotan al entrar y registrarse, y se revocan al salir.
- CUSTOMER solo opera sus recursos; ADMIN solo rutas administrativas autorizadas. Un
  recurso privado de otro cliente responde 404. ADMIN no puede simular pago de un cliente.
  Middleware vuelve a consultar estado y rol del usuario en cada petición autenticada.
- Límites iniciales por IP+cuenta: login 10 intentos/15 min, registro 5/15 min;
  escrituras checkout 20/min por usuario y resto API 300/min por IP. Responder 429 con
  Retry-After; almacenamiento en memoria es suficiente en la única instancia local.
- 200 consulta/edición, 201 creación incluyendo pedido rechazado correctamente guardado,
  204 eliminación lógica/cierre de sesión; 400 JSON inválido, 401 sin sesión válida,
  403 rol/CSRF, 404 recurso inexistente o ajeno, 409 conflicto, 422 validación, 429 límite,
  503 persistencia temporalmente ocupada, 500 fallo inesperado sin detalles internos.
- Error uniforme `{error:{code,message,fields?,requestId}}`; fields mapea nombre de campo
  a mensaje legible. No devolver hashes, cookies, firma, stack, SQL ni secretos en errores.

## Sesión y cliente

| Método y ruta | Acceso | Entrada | Salida / comportamiento |
|---|---|---|---|
| GET /health | Público | Ninguna | 200 `{status:"ok"}` si DB accesible, 503 si no; sin ruta de DB |
| GET /auth/session | Público | Cookie opcional | user seguro o null, csrfToken y expiry; crea sesión anónima si corresponde |
| POST /auth/register | Anónimo + CSRF | name,email,password,phone? | 201 user CUSTOMER y csrfToken nuevo; duplicado 409 con mensaje genérico |
| POST /auth/login | Anónimo + CSRF | email,password | 200 user y csrfToken nuevo; credenciales incorrectas/inactivo: mensaje genérico 401 |
| POST /auth/logout | Sesión + CSRF | Vacío | 204, invalida sesión y elimina cookie |
| GET /me | CUSTOMER | Ninguna | id,name,email,phone,is_active; nunca hash |
| PATCH /me | CUSTOMER | name,phone | 200 perfil; email/rol no editables en MVP |
| GET /me/addresses | CUSTOMER | page,pageSize | Lista de direcciones activas propias |
| POST /me/addresses | CUSTOMER | recipient,phone,region,province,district,street,reference? | 201 dirección y version |
| PATCH /me/addresses/:id | Titular | mismos campos y version | 200 nueva versión; 409 edición concurrente |
| DELETE /me/addresses/:id | Titular | version | 204 desactiva; preserva snapshots de pedidos |

`user` seguro: id,name,email,phone,role (CUSTOMER/ADMIN). Login ADMIN usa la misma API,
pero pantalla independiente. Registro nunca acepta role/is_active. Campos no permitidos
producen 422; no se propagan cuerpos completos a actualizaciones SQL.

## Catálogo y carrito

| Método y ruta | Acceso | Entrada | Salida / comportamiento |
|---|---|---|---|
| GET /categories | Público | page,pageSize | Categorías activas id,name,slug |
| GET /products | Público | q,category,minPriceCents,maxPriceCents,inStock,featured,page,pageSize,sort | Productos activos y categoría activa; sort=relevance/price_asc/price_desc/name; filtros combinados AND |
| GET /products/:slug | Público | Ninguna | Producto con descripción, imágenes, precio base/efectivo, promoción vigente y disponibilidad; 404 inactivo |
| GET /cart | Sesión anónima/CUSTOMER | Ninguna | cartId,version,items,subtotal_cents,total_cents,currency,issues |
| PUT /cart/items/:productId | Sesión anónima/CUSTOMER + CSRF | quantity,cartVersion | Cantidad absoluta 1..99, respuesta carrito actualizado; 409 por stock/versión |
| DELETE /cart/items/:productId | Propietario + CSRF | cartVersion | 200 carrito actualizado; borra línea incluso si producto quedó inactivo |

`Product`: id,slug,name,description,category{id,name,slug},images[{id,path,alt,position}],
base_price_cents,effective_price_cents,currency,available_quantity,is_available,
promotion|null,version. Promoción pública incluye terms,starts_at,ends_at y beneficio
calculado; nunca una afirmación estática sin promoción vigente. q máximo 100 caracteres,
trim; búsqueda sin texto equivale a no filtrar. min<=max. Productos sin stock se muestran
con acciones deshabilitadas; categoría inactiva oculta sus productos de catálogo.

`CartItem`: product_id,name,image,quantity,unit_price_cents,line_total_cents,available,
issue|null. Recalcular contra catálogo al leer; líneas obsoletas se conservan con aviso
y no son comprables hasta corregirse. No confiar en precios antiguos guardados por UI.
Actualizar cantidad no reserva stock. Carrito invitado se guarda en DB vinculado a sesión
de navegador; al login se restaura carrito del cliente y se avisa si se descartó el invitado.

## Checkout y pedidos

| Método y ruta | Acceso | Entrada | Salida / comportamiento |
|---|---|---|---|
| POST /checkout/quote | CUSTOMER + CSRF | addressId,cartVersion | 200 Quote de carrito vigente, sin crear pedido |
| POST /orders | CUSTOMER + CSRF + Idempotency-Key | quoteToken,simulationOutcome | 201 Order e intento guardados; APPROVED o REJECTED determinan resultado |
| GET /orders | CUSTOMER | page,pageSize | Solo pedidos propios, incluidos pagos rechazados |
| GET /orders/:publicId | Titular | Ninguna | OrderDetail con artículos, dirección snapshot, intentos e historial |
| POST /orders/:publicId/payment-quote | Titular + CSRF | Vacío | 200 Quote de reintento si sigue AWAITING_PAYMENT y válido |
| POST /orders/:publicId/simulated-payments | Titular + CSRF + Idempotency-Key | quoteToken,simulationOutcome | 201 intento y Order actualizado; rechazo no descuenta stock |

`Quote`: quoteToken,expiresAt,sourceType(CART/ORDER),sourceId,sourceVersion,items,
addressSummary,subtotal_cents,total_cents,currency,simulationOnly:true.
Una cotización vence a los 5 minutos; el servidor vuelve a validar dentro de transacción.
Los precios firmados no sustituyen los precios vigentes y nunca se aceptan totales de UI.

`Order`: publicId,status,paymentStatus,subtotal_cents,total_cents,currency,createdAt,
updatedAt,version,simulationOnly:true. `OrderDetail` agrega items con snapshots,
deliveryAddress snapshot, payments[{id,outcome,amount_cents,currency,createdAt}],
history[{fromStatus,toStatus,createdAt}]. No se solicitan número de tarjeta ni datos bancarios.

`Idempotency-Key`: UUID generado para cada intención y conservado durante su reintento de
red. Alcance: usuario + operación (create-order o pay-order:publicId). Igual clave y cuerpo
devuelve status/body originales, incluso si el token ya venció, después de autorización.
Igual clave con otro cuerpo: 409 IDEMPOTENCY_CONFLICT. Nueva intención usa nueva clave.
El intento/pedido/movimientos y respuesta persistida se guardan juntos. No se permite crear
otro pago aprobado de un pedido ya confirmado aunque la clave sea diferente.

| Código de conflicto | Resultado verificable y acción del cliente |
|---|---|
| CART_EMPTY / CART_CHANGED | No crear pedido; mostrar carrito actual y solicitar revisión |
| DUPLICATE_CHECKOUT | Resumen ya usado para crear pedido; no duplicar incluso con otra clave; abrir el pedido propio existente |
| QUOTE_EXPIRED / QUOTE_CHANGED | No mutar; recuperar cotización y pedir confirmación explícita |
| OUT_OF_STOCK / PRODUCT_UNAVAILABLE | No mutar; actualizar disponibilidad y corregir carrito |
| NEW_CHECKOUT_REQUIRED | Precio de pedido rechazado ya no coincide; mantener historial y comenzar nueva compra |
| ORDER_ALREADY_PAID | No repetir pago ni stock; mostrar detalle actual |
| INVALID_TRANSITION / VERSION_CONFLICT | No mutar; recargar recurso y revisar |
| STORAGE_BUSY (503) | No afirmar éxito; reintentar misma clave, recuperando resultado previo si hubo commit |

Un rechazo simulado es resultado de negocio registrado, no error HTTP. Se muestra
«Pago simulado rechazado; pedido pendiente de pago». Si el stock cambió entre cotización
y commit, devolver conflicto en lugar de registrar un pago que ya no corresponde al resumen.

## Administración

Todas las rutas siguientes requieren ADMIN, CSRF para escritura y control de versión
en edición. No hay autoalta de administradores, edición directa de pagos ni borrado histórico.

| Método y ruta | Entrada | Resultado |
|---|---|---|
| GET /admin/summary | Ninguna | Conteos calculados de productos, clientes, pedidos y stock bajo; sin métricas inventadas |
| GET /admin/products | q,status,category,page,pageSize | Lista incluyendo inactivos |
| POST /admin/products | categoryId,sku,slug,name,description,basePriceCents,isActive,isFeatured,initialStock,images | 201 producto, inventario inicial y movimiento SEED atómicos |
| PATCH /admin/products/:id | version y campos editables | 200; stock no es campo editable aquí |
| DELETE /admin/products/:id | version | 204 desactivación lógica |
| GET /admin/categories | page,pageSize | Lista completa |
| POST /admin/categories | name,slug,isActive | 201 categoría |
| PATCH /admin/categories/:id | version,name?,slug?,isActive? | 200 categoría |
| DELETE /admin/categories/:id | version | 204 desactiva sin borrar historial |
| GET /admin/image-library | Ninguna | Assets locales permitidos con path, alt sugerido y procedencia |
| PUT /admin/products/:id/images | version,images:[{path,alt,position}] | 200 reemplaza selección/orden, máximo 4; no acepta URLs ni rutas arbitrarias |
| GET /admin/promotions | page,pageSize | Lista con objetivo, tipo, condiciones y vigencia |
| POST /admin/promotions | productId o categoryId,kind,value,startsAt,endsAt,terms,isActive | 201 promoción válida |
| PATCH /admin/promotions/:id | version y campos de promoción | 200; rechaza solapamientos y precios inválidos |
| DELETE /admin/promotions/:id | version | 204 desactiva |
| GET /admin/inventory | q,page,pageSize | Producto, stock y version |
| POST /admin/inventory/:productId/adjustments | expectedVersion,newQuantity,reason | 201 movimiento y stock actualizados juntos |
| GET /admin/inventory/:productId/movements | page,pageSize | Historial sin edición |
| GET /admin/customers | q,status,page,pageSize | Clientes sin hashes, sesiones ni secretos |
| GET /admin/customers/:id | Ninguna | Perfil y resumen de pedidos; solo rol CUSTOMER |
| PATCH /admin/customers/:id | version,name?,phone?,isActive? | 200; desactivar revoca sesiones; no modifica email, rol o contraseña |
| GET /admin/orders | status,paymentStatus,page,pageSize | Lista operativa |
| GET /admin/orders/:publicId | Ninguna | Detalle, comprador, intentos e historial |
| PATCH /admin/orders/:publicId/status | expectedVersion,status | 200; solo CONFIRMED->PREPARING->SHIPPED->DELIVERED |

Toda edición usa campos explícitos; escrituras atómicas con FK/CHECK/UNIQUE. Ajuste
de inventario exige motivo 3..200 caracteres y diferencia distinta de cero. Conflicto
de versión retorna 409 y no descuenta ni sobrescribe datos silenciosamente.
