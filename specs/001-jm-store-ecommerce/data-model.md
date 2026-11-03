# Data Model: JM-STORE

**Fecha**: 2026-11-03 | **Referencia**: [spec.md](spec.md), FR-004..017, FR-021..023

Modelo lógico y restricciones para futuras migraciones; este archivo no contiene
migraciones ejecutables. SQLite pertenece exclusivamente al backend.

## Convenciones y validación

- PK `id`: INTEGER generado por SQLite. Identificador público de pedido adicional UUID.
- Timestamps UTC ISO 8601; UI presenta America/Lima. Vigencia de promoción: inicio incluido,
  fin excluido. Nunca interpretar una fecha sin zona como instante de servidor.
- Dinero INTEGER en céntimos PEN, 1..100000000 por precio; total <=990000000000
  (100 líneas x 99 unidades x precio máximo). Validar safe integer antes de operar.
- Stock entero 0..1000000; cantidad de carrito/detalle 1..99; máximo 100 líneas distintas.
- Correo trim/lowercase ASCII, máximo 254, único. Nombre 2..100, teléfono opcional 7..20,
  contraseña 12..128 caracteres sin recorte silencioso. Solo se guarda hash versionado.
- Producto: nombre 2..120, descripción 1..4000, SKU único 1..64; categoría 2..80 y slug
  único. Direcciones: destinatario 2..100, teléfono requerido, región/provincia/distrito
  2..100 y dirección 5..200; referencia opcional <=200.
- TEXT con CHECK para enumeraciones; INTEGER con CHECK para rangos; FK en cada relación.
  No aceptar roles, usuario propietario, totales ni estado pagado desde formularios libres.
- Recursos comerciales referenciados se desactivan, no se borran físicamente. FK RESTRICT
  protege historial. Los snapshots permanecen aunque cambie el dato actual.

## Entidades y relaciones

| Tabla | Campos principales | Relaciones y restricciones |
|---|---|---|
| roles | id, code | code UNIQUE: CUSTOMER, ADMIN; catálogo inicial fijo |
| users | id, role_id, email, name, phone?, password_hash, is_active, created_at, updated_at, version | N:1 roles; email UNIQUE; registro fija CUSTOMER |
| sessions | id, token_hash, user_id?, csrf_token, created_at, last_seen_at, expires_at | token_hash UNIQUE; user_id NULL para visitante; revocar al salir o desactivar |
| addresses | id, user_id, recipient, phone, region, province, district, street, reference?, is_active, version | N:1 users; solo titular; desactivar sin modificar snapshot de pedidos |
| categories | id, name, slug, is_active, version | slug UNIQUE; una categoría por producto |
| products | id, category_id, sku, slug, name, description, base_price_cents, is_active, is_featured, version | N:1 categories; sku y slug UNIQUE; activo solo es público con categoría activa |
| product_images | id, product_id, asset_path, alt_text, position | N:1 products; posición UNIQUE por producto; 0..4 imágenes, ruta de biblioteca local permitida |
| inventory | product_id, quantity, version, updated_at | PK/FK products 1:1; quantity >=0; toda modificación genera movimiento |
| promotions | id, product_id?, category_id?, kind, value, starts_at, ends_at, terms, is_active, version | EXACTAMENTE un objetivo; FINAL_PRICE para producto o PERCENT_BPS para categoría; sin períodos activos superpuestos en mismo objetivo |
| carts | id, user_id?, guest_session_id?, version, updated_at | Exactamente un propietario; UNIQUE(user_id), UNIQUE(guest_session_id); invitado FK sessions |
| cart_items | cart_id, product_id, quantity | PK compuesta; FK carts/products; mismo producto agrega cantidad, no otra línea |
| orders | id, public_id, creation_nonce, user_id, status, payment_status, currency, subtotal_cents, total_cents, recipient_snapshot, phone_snapshot, region_snapshot, province_snapshot, district_snapshot, street_snapshot, reference_snapshot?, source_cart_id?, source_cart_version?, created_at, updated_at, version | public_id y creation_nonce UNIQUE; cliente obligatorio; currency=PEN; snapshot de dirección independiente; FK source_cart solo informativa |
| order_items | id, order_id, product_id, sku_snapshot, name_snapshot, unit_price_cents, quantity, line_total_cents, promotion_snapshot? | FK orders/products RESTRICT; UNIQUE(order_id, product_id); línea = precio x cantidad; inmutable |
| simulated_payments | id, order_id, outcome, amount_cents, currency, created_at | N:1 orders; outcome APPROVED/REJECTED; una aprobación máxima por pedido mediante índice único parcial |
| inventory_movements | id, product_id, order_id?, actor_user_id?, kind, delta, quantity_after, reason, created_at | kind SEED/ADJUSTMENT/SALE; SALE negativo, UNIQUE(order_id, product_id) para ventas; motivo requerido para ajuste |
| order_status_history | id, order_id, from_status?, to_status, actor_user_id, created_at | N:1 orders/users; creación y cada transición registrada |
| idempotency_records | id, user_id, operation, key, request_hash, response_status, response_json, created_at | UNIQUE(user_id, operation, key); respuesta y mutación en una misma transacción |
| schema_migrations | version, applied_at | PK version; backend ejecuta migraciones ordenadas una vez |

Dirección y fotografía no son credenciales. Sessions, hashes, idempotency responses y
datos de clientes son privados y nunca se sirven como contenido estático.

### Propiedad y eliminación

Un usuario tiene muchas direcciones y pedidos y un carrito. Una categoría tiene muchos
productos; un producto tiene un inventario y varias imágenes. Un pedido tiene muchas
líneas, intentos de pago e hitos de estado. Un ajuste administrativo registra actor y causa.
Una sesión de visitante solo puede usar su carrito; al iniciar sesión se restaura el
carrito persistente del cliente, se descarta el de invitado y se informa que no se fusionó.
La cookie de visitante no tiene Max-Age; filas anónimas huérfanas se limpian tras 24 h.
Sesiones autenticadas respetan expiración absoluta de 8 h e inactividad de 30 min.
Eliminar una sesión anónima elimina en cascada su carrito y sus líneas; ninguna de esas
filas puede estar vinculada a un pedido porque checkout requiere carrito de cliente.
Las demás referencias históricas conservan RESTRICT; la limpieza no elimina pedidos.

La administración puede actualizar nombre/teléfono y desactivar clientes; no ver hashes,
asignar ADMIN ni cambiar contraseñas de clientes. Desactivar revoca sus sesiones. Sin
borrado de pedidos, pagos, movimientos o usuarios referenciados. Un pedido conserva sus
snapshots aunque una dirección se desactive o se edite.

### Promociones y totales

Precio base positivo. FINAL_PRICE es menor que precio base; PERCENT_BPS está entre 1 y
9999. Promoción de producto prevalece sobre categoría, sin acumular descuentos. La regla
se evalúa en servidor con hora UTC y se vuelve a evaluar al confirmar. No permitir una
promoción que produzca precio cero. Aplicar redondeo de céntimos mitad hacia arriba.
No hay impuestos ni cargos adicionales calculados en el MVP; total es suma de líneas.
Mostrar «Entrega y pago: demostración»; no afirmar envío gratis ni facturación tributaria.
Editar precio base exige revalidar o desactivar promociones incompatibles.

## Estados y transiciones

| Entidad | Estado | Transición permitida |
|---|---|---|
| users/products/categories | activo/inactivo | administrador; cliente solo edita su perfil |
| orders | AWAITING_PAYMENT | Se crea al registrar rechazo simulado; sin stock descontado |
| orders | CONFIRMED | Creación con aprobación o reintento aprobado desde AWAITING_PAYMENT |
| orders | PREPARING | Solo administrador desde CONFIRMED |
| orders | SHIPPED | Solo administrador desde PREPARING |
| orders | DELIVERED | Solo administrador desde SHIPPED; terminal |
| orders.payment_status | REJECTED | Último intento rechazado; pedido sigue AWAITING_PAYMENT |
| orders.payment_status | APPROVED | Pedido confirmado; nunca vuelve a REJECTED |
| simulated_payments | APPROVED/REJECTED | Resultado inmutable de cada intento; no edición administrativa |

Se muestran dos etiquetas: «Pendiente de pago / Pago simulado rechazado» o
«Confirmado / Pago simulado aprobado». Seguimiento es historial manual del administrador,
sin servicio de transportista ni plazos garantizados. Cancelación, devoluciones y reembolso
quedan fuera del MVP; no hay botones para transiciones no implementadas.

## Cotización y confirmación

1. Cliente pide resumen de carrito con dirección activa de su propiedad, o resumen de
   reintento del pedido rechazado. Servidor calcula precios, disponibilidad y total.
2. Devuelve líneas, total y token HMAC SHA-256 con user_id, scope CART/ORDER, source_id,
   source_version, nonce aleatorio, fingerprint y expires_at (5 min). Fingerprint incluye cantidades,
   precios efectivos, promoción, versiones de producto/inventario y dirección o snapshot.
   Token no lleva dirección completa ni contraseña. Se firma con QUOTE_SECRET local.
3. Cliente revisa el resumen y elige explícitamente APPROVED o REJECTED.
4. POST con token y Idempotency-Key. Después de autenticar/autorizar, BEGIN IMMEDIATE.
   Si ya existe misma clave/hash, devolver respuesta guardada sin repetir cambios;
   misma clave con otro cuerpo produce conflicto. Esto se evalúa antes de expirar el token.
5. Validar firma, vencimiento y usuario; releer catálogo, promoción, inventario, dirección
   y versión de origen. Descartar importes enviados por cliente. Cualquier cambio material
   o stock insuficiente produce 409 y rollback sin nuevo pedido, intento ni movimiento.
6. Primera compra: crear pedido y snapshots con creation_nonce del token UNIQUE; reutilizar
   el mismo resumen con otra clave no crea otro pedido, devuelve DUPLICATE_CHECKOUT con
   referencia al pedido propio existente. En rechazo, registrar intento REJECTED y
   estado AWAITING_PAYMENT; dejar carrito y stock intactos. En aprobación, registrar
   APPROVED, CONFIRMED y descontar cantidades con condición stock>=solicitado, escribir
   movimientos SALE, historial y respuesta de idempotencia en la misma transacción.
7. Limpiar carrito únicamente cuando se aprueba la primera compra. En reintento aprobado,
   limpiar solo si source_cart y su versión coinciden con los originales conservados;
   si el usuario lo editó, preservar su carrito y avisar que no se vació.
8. COMMIT antes de responder. Cualquier fallo hace rollback completo. Si vence timeout
   SQLite, 503 temporal; cliente puede repetir la misma clave y recuperar un commit previo.

### Reintento de pedido rechazado

Opera sobre el mismo pedido AWAITING_PAYMENT, con nuevo token y clave por intento.
Revalidar propietario activo, productos/categorías activos, stock y precio actual igual
al snapshot. Rechazo agrega intento sin cambiar inventario ni detalles. Aprobación agrega
el único intento aprobado y mueve a CONFIRMED con una sola venta por producto.
Un pedido ya aprobado devuelve conflicto ante otra clave; nunca vuelve a cobrar stock.
Si precio cambió, devolver NEW_CHECKOUT_REQUIRED y enlace a catálogo/carrito; el pedido
anterior y sus intentos permanecen intactos. El cliente debe revisar una nueva compra.
Si stock/versiones cambian pero precio no, renovar resumen y pedir confirmación nuevamente.
No se reserva inventario por tener un pedido rechazado.

## Índices, auditoría y persistencia

- Índices para products(category_id,is_active), orders(user_id,created_at),
  order_status_history(order_id,created_at), simulated_payments(order_id,created_at),
  sessions(expires_at), y FK de tablas de líneas. Búsqueda parametrizada por nombre y
  descripción; LIKE escapado y paginado basta para 100 productos.
- Índices únicos parciales impiden dos pagos aprobados por pedido y dos movimientos SALE
  por producto/pedido. Comprobaciones multitabla están en el servicio transaccional.
- Ajustes administrativos usan version esperada de inventario; 409 si cambió. No editar
  quantity directamente en update de producto. Historial de estado y movimiento dentro
  de la transacción correspondiente. Modificaciones de catálogo usan version para evitar
  sobrescritura silenciosa de otra edición.
- Logs con requestId, operación, resultado, duración e IDs internos; sin cookies, tokens,
  contraseñas, cuerpos con direcciones ni contenido completo de error SQL.
- Migraciones iniciales: identidad/sesiones; catálogo/inventario/promociones; carrito;
  pedidos/pagos/movimientos/idempotencia. Se ejecutan por orden y registran su versión.
  Seed usa SKU/slugs estables y no sobrescribe estado operativo al repetirse.
- Backup: detener API limpiamente, copiar archivo SQLite y sus WAL/SHM si quedaron tras
  detenerlo, guardar juntos fuera de Git. Restaurar todos los archivos del mismo respaldo
  con aplicación detenida. Reset de demo requiere confirmación y backup; no se invoca
  automáticamente en start, migrate o seed.
