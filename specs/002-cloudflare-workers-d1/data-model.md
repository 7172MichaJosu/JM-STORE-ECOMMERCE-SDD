# Modelo de datos: D1 y seguridad administrativa

Diseño futuro, 2026-11-04. Basado en las cinco migraciones SQLite existentes y
[modelo de feature001](../001-jm-store-ecommerce/data-model.md). No se ejecutan DDL ni
conversiones en Plan. Todas las ampliaciones siguientes son del esquema cloud; SQLite
local conserva sus datos y compatibilidad.

## Tipos, identidad y validación

- IDs INTEGER positivos existentes se preservan; pedidos conservan UUID público y nonce
  únicos. Nuevas filas D1 pueden usar PK INTEGER; referencias entre sentencias usan el
  identificador de operación/UUID, no un lastInsertRowid supuesto entre conexiones.
- Dinero INTEGER en céntimos, currency PEN, UI S/. Precio1..100000000, cantidad1..99,
  stock0..1000000; total exacto y dentro de rango seguro de JavaScript.
- Fechas UTC ISO8601. Slugs/SKU/email únicos. Email ASCII trim/lowercase,3..254 y formato
  válido; nombre cliente2..100, teléfono opcional7..20. Password12..128 sin trim.
- Producto: nombre2..120, descripción1..4000; categoría2..80; SKU1..64. Imágenes de
  manifiesto permitido, alt no vacío, posición0..3 única por producto.
- Dirección: recipient2..100, teléfono7..20, región/provincia/distrito2..100,
  street5..200 y referencia<=200. Cliente solo accede a sus recursos; ajenos devuelven404.
- FK y CHECK activos; desactivación lógica de entidades referenciadas. No borrar pedidos,
  pagos, historial o movimientos. Snapshots de compra no cambian con catálogo/direcciones.

## Tablas conservadas

El baseline D1 reproduce el esquema efectivo después de001..005, no vuelve a ejecutar
actualizaciones demo sobre los datos importados. El inventario fuente y sus versiones
se registran en el manifiesto. Preservar estas tablas y sus campos actuales:

| Tabla | Campos principales y relaciones |
|---|---|
| roles | id,code UNIQUE CUSTOMER/ADMIN |
| users | id,role_id FK,email UNIQUE,name,phone,password_hash,is_active,created_at,updated_at,version |
| sessions | id,token_hash UNIQUE,user_id FK nullable,csrf_token,created_at,last_seen_at,expires_at |
| addresses | id,user_id FK,recipient,phone,region,province,district,street,reference,is_active,version |
| categories | id,name,slug UNIQUE,is_active,version |
| products | id,category_id FK,sku UNIQUE,slug UNIQUE,name,description,base_price_cents,is_active,is_featured,version |
| product_images | id,product_id FK,asset_path,alt_text,position; UNIQUE(product_id,position) |
| inventory | product_id PK/FK,quantity,version,updated_at |
| promotions | id,product_id o category_id FK,kind,value,starts_at,ends_at,terms,is_active,version |
| carts | id,user_id o guest_session_id FK,version,updated_at; propietario exclusivo y único |
| cart_items | cart_id/product_id PK compuesta y FK,quantity; máximo100 líneas |
| orders | id,public_id,creation_nonce,user_id FK,status,payment_status,currency,subtotal_cents,total_cents,campos recipient/phone/region/province/district/street/reference_snapshot,source_cart_id,source_cart_version,created_at,updated_at,version |
| order_items | id,order_id/product_id FK,sku_snapshot,name_snapshot,unit_price_cents,quantity,line_total_cents,promotion_snapshot; UNIQUE(order_id,product_id) |
| simulated_payments | id,order_id FK,outcome,amount_cents,currency,created_at |
| inventory_movements | id,product_id/order_id/actor_user_id FK,kind,delta,quantity_after,reason,created_at |
| order_status_history | id,order_id/actor_user_id FK,from_status,to_status,created_at |
| idempotency_records | id,user_id FK,operation,key,request_hash,response_status,response_json,created_at; UNIQUE(user_id,operation,key) |
| schema_migrations | version,applied_at; procedencia SQLite importada, no dirige migraciones D1 |

Conservar índices de catálogo y relaciones; índices parciales `one_approval` y `one_sale`
impiden aprobación/venta duplicada. Conservar triggers cart_limit y payment_amount.
Ampliar índices de sesiones/usuario y expiración y de tablas auxiliares operativas.
No crear índices excesivos: su mantenimiento también consume filas escritas.

## Ampliaciones cloud

| Tabla/campo | Diseño y restricciones |
|---|---|
| users.auth_version | INTEGER NOT NULL DEFAULT0,>=0; cambia al actualizar password/desactivar acceso |
| sessions.auth_version | INTEGER nullable; versión comprobada al crear sesión de usuario |
| sessions.namespace | TEXT NOT NULL; fuente copiada=`imported-source`, nuevas sesiones=identificador del nuevo entorno |
| security_events | UUID PK,user_id FK,event_type,changed_email boolean,changed_password boolean,request_id,created_at; sin email/password/hash/IP/cuerpos |
| rate_limit_buckets | bucket_key HMAC,window_start,expires_at,count>=0; PK(bucket_key,window_start), índice expiración |
| mutation_contexts | operation_id UUID PK,user_id,kind,expected_versions_json,payload_json,created_at; privado y transitorio dentro de batch |
| migration_runs | UUID PK,source_digest,source_schema,target_identity,status,cutoff_at,started_at,verified_at; sin credenciales |
| migration_chunks | run_id FK,table_name,chunk_no,digest,row_count,applied_at; PK(run_id,table_name,chunk_no) |
| deployment_state | fila singleton con environment_id,database_identity,schema_version,source_digest,mode,verified_at |
| d1_migrations | ledger de la herramienta D1; separado de schema_migrations fuente |

Namespace de sesión es identificador de entorno no secreto; nunca aceptar
`imported-source` en auth online. Los campos originales de sesiones se conservan para
mantener carritos anónimos y reconciliación, pero ninguna cookie local autentica online.
Invitados iniciarán nuevo carrito; carritos de clientes se recuperan por user_id.
La expiración/limpieza normal de registros transitorios se ejecuta después de verificar
la importación, no durante la reconciliación.

`mutation_contexts` no es API pública ni cola: solo conserva datos durante una transacción.
Al finalizar el batch se elimina su fila. No quedan passwords/hash de verificación en
el payload ni se registra SQL con parámetros. Las respuestas idempotentes son privadas.

## Transiciones

| Entidad | Transiciones |
|---|---|
| Order | AWAITING_PAYMENT→CONFIRMED al aprobar reintento; CONFIRMED→PREPARING→SHIPPED→DELIVERED por admin |
| Payment | intento inmutable REJECTED o APPROVED; máximo un APPROVED/pedido |
| Inventory | rechazo no modifica; aprobación descuenta una vez y genera SALE; ajuste genera ADJUSTMENT |
| Admin email | currentPassword válido+email único+CAS: cambio inmediato; sin email de confirmación |
| Admin password | currentPassword válido+password válido+CAS: actualizar hash, incrementar auth_version, revocar todas las sesiones y auditar |
| migration_runs | SNAPSHOT→IMPORTING→IMPORTED→VERIFIED; fallo→FAILED, reanudación controlada solo mismo snapshot/target |
| deployment_state.mode | CLOSED→VERIFIED→OPEN; fallo o mantenimiento→CLOSED; apertura explícita solo con verificaciones vigentes |

REJECTED conserva carrito y pedido AWAITING_PAYMENT; APPROVED cambia a CONFIRMED. No
transición inversa, cancelación o devolución nueva. En reintento, precio distinto al
snapshot devuelve NEW_CHECKOUT_REQUIRED sin alterar el pedido anterior. Las promociones
mantienen precedencia producto sobre categoría, sin acumulación ni intervalos solapados,
redondeo al céntimo según feature001 y ningún precio efectivo cero.

## Protocolo transaccional checkout

1. Autorizar usuario/sesión, aplicar rate limit y buscar idempotencia en primaria. Si hay
   mismo hash, devolver status/body guardados antes de comprobar vencimiento de quote.
2. Para intención nueva, verificar HMAC, scope, usuario, nonce y formato. Construir
   JSON de líneas y versiones desde la cotización y datos del servidor; nunca totales UI.
3. Preparar un único batch. Reservar clave idempotente y crear mutation_context. Un trigger
   BEFORE INSERT aborta con códigos controlados si no coinciden usuario activo/auth_version,
   sesión namespace/expiry, quote vigente, carrito/pedido propio/versión, address vigente,
   versiones/actividad de producto-categoría-promoción, precios recalculados o stock de
   cualquiera de las líneas. Guardar nonce nuevo solo si no existe pedido con él.
4. Dentro de esa misma transacción, crear pedido si es primera compra; snapshots y líneas
   con INSERT SELECT y json_each. En retry mantener snapshots y total históricos.
5. Escribir intento. APPROVED aplica UPDATE inventory por conjunto, movimientos SALE y
   transición de pedido/historial; REJECTED solo registra resultado sin tocar stock.
   La guarda y las escrituras son del mismo batch; no hay cambios de otro writer entre
   comprobación y descuento. Índices/checks siguen siendo defensa adicional.
6. Vaciar carrito solo si se aprobó y coincide id/version de origen; conservar carrito
   editado posteriormente. Construir respuesta JSON final en SQL dentro del batch y
   guardarla en idempotency_records; seleccionar esa respuesta antes de devolverla.
7. Eliminar contexto, exigir resultado completo y commit. Nunca persistir una respuesta
   idempotente provisional si falla algún paso. Error SQL revierte todo.
8. Dos requests con misma clave: uno gana UNIQUE, otro hace rollback y relee el registro
   confirmado; si el hash difiere,409. Timeout se recupera con la misma clave.

Los triggers/guardas deben verificarse tanto en D1 local como staging. No se copia una
implementación de transacción SQLite suponiendo que await conserva el lock. Presupuesto
checkout<=30 consultas incluidas auth/lecturas; con100 líneas no crece por artículo.
Los cuerpos JSON permanecen<=100KiB y cada sentencia<=100 parámetros. Si no se cumple
ese presupuesto, rediseñar por conjuntos; no reducir el carrito aprobado silenciosamente.

## Operación de credenciales y carreras

Leer user.version,auth_version,hash y sesión activos; verificar currentPassword fuera
del batch por coste. Si se cambia password derivar hash nuevo con parámetros vigentes.
El primer guard dentro del batch exige que usuario, hash y sesión continúen siendo los
verificados. UNIQUE(email), actualización y evento de seguridad son atómicos. Password
change añade auth_version+1 y DELETE de todas las sesiones de usuario antes del commit.
Un fallo de auditoría provoca rollback, no una credencial cambiada sin registro.

Login también usa versión/hash esperado al insertar sesión. Si password change ocurrió
durante la derivación, no insertar sesión con autenticación antigua. Cada operación
privilegiada revalida la versión en su guarda. Un request comenzado antes de revocación
no puede confirmar una mutación después usando su identidad obsoleta.

## Importación y equivalencia

Preservar todas las tablas de negocio, IDs, versiones e historial del snapshot. Esquema
cloud añade defaults y metadatos, sin cambiar hashes. Roles no se siembran otra vez antes
de importar sus IDs. Los datasets sintéticos usan otro destino y seed independiente.

Exportar por orden: roles/categorías/users, productos, imágenes/inventario/promociones,
sesiones con namespace inerte, direcciones/carritos/líneas, pedidos/líneas/pagos,
movimientos/historial/idempotencia y procedencia de migraciones. Los FK circulares o
dependencias diferidas se manejan con mecanismos D1 soportados dentro de la transacción;
no desactivar constraints globalmente. No reejecutar updates demo005 sobre el import.

Digest SHA256 por tabla con orden PK y serialización canónica, recuentos, rangos de IDs,
sumas de precios/stock/totales, FK y snapshots. La transformación de sesiones y defaults
cloud se documenta por campo y se excluye solo de la comparación de esas columnas nuevas.
Contraseñas nunca se imprimen y los digests de filas privadas tampoco se publican.

Chunk import y su checkpoint deben confirmar juntos. Reejecutar igual chunk/digest es
no-op; otro snapshot o contenido con mismo identificador se rechaza. Ningún import o
reset está disponible desde HTTP. Un destino OPEN con escrituras online nunca se
sobrescribe; se usa recuperación con conciliación y destino explícito.

Tras restore, nuevo namespace y revocación impiden revivir tokens antiguos. Conciliar
los eventos de credenciales y sus hashes vigentes junto a los pedidos posteriores al
backup; no abrir cuentas cuyo estado de seguridad actual no se pueda demostrar.
