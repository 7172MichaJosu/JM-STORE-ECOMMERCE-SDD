# Modelo de datos: D1 y seguridad administrativa

Diseño futuro, 2026-11-04. Basado en las cinco migraciones SQLite existentes y
[modelo de feature001](../001-jm-store-ecommerce/data-model.md). No se ejecutan DDL ni
conversiones en Plan. Todas las ampliaciones siguientes son del esquema cloud; SQLite
local conserva sus datos y compatibilidad. Firebase es autoridad de credenciales online;
D1 conserva IDs comerciales, roles, perfiles y sesiones. Diseño reconciliado con Clarify;
[protocolo Firebase](contracts/firebase-auth.md). No ejecutar DDL desde este Plan.

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
| users.auth_version | INTEGER NOT NULL DEFAULT0,>=0; cambia al revocar acceso o iniciar cambio de password; monotónica |
| users.firebase_auth_not_before | Epoch seconds,>=0; nuevo login exige auth_time posterior al corte de revocación |
| users.security_state | ACTIVE o LOCKED; LOCKED deniega acceso comercial, permite solo conciliación privada tras nueva autenticación válida |
| external_identities | user_id FK UNIQUE,provider=firebase,project_id,firebase_uid,status,source_run_id nullable,version,created_at,updated_at; UNIQUE(project_id,firebase_uid) |
| identity_email_reservations | normalized_email PK UNIQUE,purpose ACCOUNT/IMPORTED/REGISTRATION/EMAIL_CHANGE,user_id FK nullable,operation_id UNIQUE nullable,source_run_id nullable,expires_at nullable,version; registro común de propiedad/reservas, nunca vínculo por email |
| registration_operations | UUID PK,normalized_email,expected_firebase_uid nullable,status PREPARED/PROVIDER_ACCEPTED/COMPLETED/RECONCILIATION_REQUIRED,created_at,updated_at; sin passwords/tokens, reserva previa a signup y prueba de UID propio antes de completar perfil |
| session_token_envelopes | session_id PK/FK ON DELETE CASCADE,project_id,firebase_uid,key_version,nonce,ciphertext,token_expires_at,auth_time,version; ID/refresh tokens solo dentro de sobre AES-GCM |
| credential_operations | UUID PK,user_id FK,kind EMAIL/PASSWORD,expected_user_version,expected_auth_version,expected_uid,old_email,target_email nullable,status,expires_at nullable,provider_result,revocation_cutoff,request_id,created_at,updated_at; sin passwords, OOB, tokens ni hashes nuevos; correos privados solo para reconciliar |
| sessions.auth_version | INTEGER nullable; versión comprobada al crear/renovar sesión y dentro de guardas de mutación |
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

external_identities.status: RESERVED (UID previsto y email reservado), IMPORTED (Firebase
importado sin abrir acceso), ACTIVE (vínculo verificado), LOCKED (conflicto o conciliación).
El UID se asigna mediante manifiesto/provisión privada, estable y distinto entre entornos;
no deriva del email. Cambiar email no cambia user_id, UID, roles, FK ni historial.
Registro público solo crea CUSTOMER después de verificar un UID nuevo no reservado.

Conservar password_hash original de cuentas importadas para equivalencia histórica y
backups protegidos; nunca autentica online. Nuevos usuarios Firebase llevan marcador
explícito no autenticable external:firebase para satisfacer NOT NULL del baseline.
Ningún fallback cloud puede llamar al verificador SQLite o tratar ese marcador como hash.
El hash vigente de Firebase no se replica en D1 y el hash histórico no se actualiza tras
cambiar contraseña online. La SQLite original conserva sus propias credenciales intactas.

session_token_envelopes solo existe para sesiones Firebase activas. AES-256-GCM usa nonce
96 bits único por cifrado, clave fuera de DB y AAD entorno/proyecto/UID/sesión/key_version.
CAS sobre sesión y sobre cifrado al renovar; no revivir fila eliminada durante logout.
Nunca devolver sobres al cliente ni guardar ID/refresh tokens en claro. Rotación de clave
retiene claves antiguas protegidas hasta reenvolver o expirar; si no se pueden descifrar,
revocar y pedir login. Backup D1 no incluye la clave y no basta para activar tokens.

credential_operations es persistente y no se confunde con mutation_contexts: conserva
solo estados/resultados seguros para reconciliar Firebase y D1 tras caída. Por usuario,
máximo una operación activa (PASSWORD o EMAIL), con índice parcial para estados no
terminales. EMAIL contiene correo antiguo/propuesto y expires_at=created_at+60min;
PASSWORD no guarda credenciales ni target_email. Envío combinado se rechaza antes de mutar.

identity_email_reservations es el único espacio de direcciones para usuarios actuales,
cuentas importadas, registros y cambios pendientes. Poblar propiedad ACCOUNT/IMPORTED
antes de abrir registro. Cada write de users.email y su claim se confirma en el mismo
batch con guardas; no basta consultar tres tablas desde JavaScript antes de insertar.
Al pedir EMAIL se conserva claim ACCOUNT antiguo y se adquiere EMAIL_CHANGE destino.
Al confirmar, batch actualiza email y convierte destino en ACCOUNT, libera anterior y
termina operación/auditoría sin recrear sesiones. Cancelar/expirar CAS solo libera claim
temporal del dueño correcto; nunca claims ACCOUNT/IMPORTED ni estados APPLYING/inciertos.
Las reservas activas se rechazan genéricamente antes de signup/OOB. Comprobar en SQL
propiedad/versión/expiry al competir registro/confirmación/cancelación/limpieza.
El índice UNIQUE protege JM-STORE, no direcciones globales en Firebase. Un UID externo
no enlazado no completa perfil por email. Desfase remoto requiere bloqueo/reconciliación.
Los correos de operaciones son datos personales privados: sin retorno público ni logs.

`mutation_contexts` no es API pública ni cola: solo conserva datos durante una transacción.
Al finalizar el batch se elimina su fila. No quedan passwords/hash de verificación en
el payload ni se registra SQL con parámetros. Las respuestas idempotentes son privadas.

## Transiciones

| Entidad | Transiciones |
|---|---|
| Order | AWAITING_PAYMENT→CONFIRMED al aprobar reintento; CONFIRMED→PREPARING→SHIPPED→DELIVERED por admin |
| Payment | intento inmutable REJECTED o APPROVED; máximo un APPROVED/pedido |
| Inventory | rechazo no modifica; aprobación descuenta una vez y genera SALE; ajuste genera ADJUSTMENT |
| Admin email | reautenticar; PENDING_VERIFICATION y reserva, email antiguo vigente; confirmar OOB→APPLYING+LOCKED+revocación→COMPLETED y email nuevo; exigir login |
| Admin password | reautenticar Firebase mismo UID, PREPARED+LOCKED+revocación D1; cambio remoto; reconciliar y COMPLETED; nunca actualizar hash local |
| credential_operations PASSWORD | PREPARED→PROVIDER_ACCEPTED→COMPLETED; fallo/timeout→RECONCILIATION_REQUIRED; resolución autenticada sin rollback implícito |
| credential_operations EMAIL | PENDING_VERIFICATION→APPLYING→COMPLETED; envío incierto→SEND_UNKNOWN; cancelación conocida→CANCELED, límite local→EXPIRED; apply/finalización incierta→RECONCILIATION_REQUIRED; SEND_UNKNOWN puede conciliar a pendiente o cancelarse/expirar con guardas antes de APPLYING |
| identity_email_reservations | REGISTRATION→ACCOUNT tras prueba UID/perfil; IMPORTED→ACCOUNT tras manifiesto; EMAIL_CHANGE→ACCOUNT al confirmar, o liberada al cancelar/expirar conocido; incierto retiene reserva |
| external_identities | RESERVED→IMPORTED→ACTIVE; conflicto/fallo de credenciales→LOCKED; activar solo tras verificación del manifiesto/proveedor |
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

Firebase Auth REST verifica la contraseña actual; comprobar firma/claims, account lookup
y UID igual al administrador activo. Una reautenticación de otra cuenta no autoriza nada.
Password solo: batch con CAS de users.version, auth_version, sesión y vínculo de identidad
crea credential_operations, bloquea usuario, registra corte, revoca sesiones/sobres y audita.
Solo tras ese commit se llama a Firebase. Guardas de checkout/admin revisan también LOCKED.

Un cambio remoto no comparte transacción con D1. Si la llamada/finalización resulta
incierta, mantener RECONCILIATION_REQUIRED y bloqueo; no restaurar sesiones ni almacenar
password para reintento. Nuevo login con UID exacto y credenciales vigentes reconcilia
operación antes de obtener acceso. Sin prueba suficiente mantener bloqueo y recuperación
privada auditada. Tras éxito desbloquear sin recrear sesiones; exigir login posterior
al corte y completar auditoría sin valores secretos.

Correo: crear operación/reserva conservando email actual y sesiones durante espera.
Inspección OOB no consume código. Solo CAS PENDING_VERIFICATION→APPLYING dentro de batch
bloquea/revoca; entonces aplicar Firebase y exigir prueba de UID/destino antes del batch
final. No asumir campos siempre presentes: falta de prueba mantiene bloqueo y exige
login nuevo con UID exacto. Cancelación/expiración pierde contra APPLYING y no libera
reserva incierta. SEND_UNKNOWN no significa que Firebase no envió enlace. Cancelar D1
no revoca OOB remoto: deriva detectada en lookup bloquea acceso y no cambia roles.
Ambos cambios juntos devuelven 422 antes de cualquier llamada o write. Un pending activo
impide password u otro email; tras completar, nueva sesión es obligatoria.

Login/refresh usa CAS sobre versión, vínculo, namespace y estado. auth_time debe superar
firebase_auth_not_before; rechazar igualdad de segundo ambigua. Verificar estado Firebase
actual mediante accounts:lookup sin caché de revocación. Si no se dispone de validSince/
passwordUpdatedAt con semántica suficiente para revocación real, R-AUTH falla y no hay
acceso privado. Un refresh token viejo o JWT aún firmado no puede reconstruir acceso.
No confiar en claims de rol ni usar email como llave de enlace.

## Importación y equivalencia

Preservar todas las tablas de negocio, IDs, versiones e historial del snapshot. Esquema
cloud añade metadatos, vínculos Firebase y sobres de sesión. Hashes importados quedan
intactos pero inactivos; credenciales Firebase deben superar el gate STANDARD_SCRYPT remoto
con cuentas sintéticas del mismo módulo local, nunca con cuentas reales para experimentar. Roles no se siembran otra vez antes
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

La copia de identidades usa manifiesto conjunto user_id/project_id/firebase_uid, email
normalizado reservado, digest de hash/salt original y resultado por cuenta; el manifiesto
es privado. Preflight antes de importar detecta UID/email repetidos en origen y destino.
STANDARD_SCRYPT: memoryCost131072, parallelization1, blockSize8, derivedKeyLength64;
hex se decodifica a bytes, no a bytes de texto hex. Probar exactamente esos parámetros,
password original/incorrecto y roles antes de autorizar cualquier cuenta real.

importUsers no comprueba duplicados y no es transaccional con D1. Lotes<=1000, CLOSED,
checkpoints por usuario/lote y conciliación de éxitos parciales; no repetir ciegamente
ni sobrescribir un UID existente. La lista de cuentas Firebase/D1 debe conciliar antes
de marcar ACTIVE. No marcar emailVerified=true sin evidencia de verificación previa.

Tras restore, nuevo namespace y revocación impiden revivir sesiones/sobres restaurados.
No restaurar passwords Firebase al recuperar D1. Consultar identidad vigente, conciliar
eventos/operaciones de credenciales y ventas posteriores al backup, volver a fijar corte
antes de activar acceso. auth:export no incluye necesariamente hash/salt de cuentas
externas pendientes de rehash; conservar snapshot SQLite protegido y manifiesto como
parte de recuperación, no declarar que export Firebase garantiza todos los hashes.
