# Contrato operativo: destinos, migración, release y recuperación

Revisión de diseño Firebase,2026-11-04. Algunos scripts cloud ya existen; las ampliaciones
Firebase siguientes son futuras. No se crean scripts/configs ni recursos desde Plan.
Diseño de correo resuelto en Clarify; validación alojada pendiente en R-EMAIL.
Protocolo: [contrato Firebase](firebase-auth.md).
Las operaciones no tienen un target remoto por defecto. CLI según AGENTS.md: `cf` hasta
existir configuración Wrangler; después Wrangler con config explícita y target validado.

## Identidad de entornos

| Entorno | Config prevista | Datos y exposición |
|---|---|---|
| local existente | configuración actual Node | SQLite actual, localhost; no reset/import cloud |
| cloud-local | cloud/wrangler.local.jsonc | D1 emulada temporal; nunca archivo SQLite actual |
| staging nuevo | cloud/wrangler.staging.jsonc | Worker/D1 propios, dataset sintético, acceso restringido |
| production nuevo | cloud/wrangler.jsonc | Worker/D1 nuevos, snapshot aprobado, CLOSED hasta validación |

Allowlist por entorno: cuenta autorizada, nombre Worker,UUID D1,origen,identificador
interno de deployment_state, auth_provider y project_id Firebase asignado explícitamente. Los IDs remotos reales no se inventan en Plan. Antes de
mutar, herramienta contrasta configuración, identidad remota y estado; muestra target y
plan de acción sin secretos. Cualquier incongruencia falla antes de escribir. Los recursos
del proyecto viejo se registran como prohibidos; nunca adoptarlos por colisión de nombre.

Config y build de staging jamás reciben DB/secret productivo. Ninguna PR de fork ejecuta
con credenciales Cloudflare. Secrets runtime: QUOTE_SECRET,RATE_LIMIT_SECRET,FIREBASE_SESSION_ENCRYPTION_KEY versionada
y, si se usa, secreto temporal de validación; son valores distintos por entorno. No guardar ADMIN_PASSWORD
permanente después de provisión. Account/database IDs no son credenciales, pero el token
de administración no se sirve desde el Worker ni se añade al bundle cliente.

## Momento de crear Firebase y preflight

Proyecto Firebase todavía no creado. Secuencia futura: revisar este Plan y
actualizar/aprobar Tasks; después, en Implement con autorización específica, crear un
proyecto Firebase staging independiente en Spark base antes de las pruebas de integración.
No asignar en documentos un project_id que no se verificó. No registrar el proyecto viejo,
vincular billing, activar Blaze/Identity Platform ni añadir Analytics/otros productos.
Si la consola/API exige pago para una operación necesaria, detenerse y consultar.

Registrar project_id/project_number y orígenes propios en allowlist; verificar plan Spark
y Email/Password, protección de enumeración y política Require12..128. Public API key
restringida a Auth/Token Service, no reutilizada para otras APIs. Ninguna service-account
key ni credencial IAM se despliega al Worker. Auth REST usa usuario/password y sus tokens;
los permisos administrativos quedan solo en herramientas Node privadas de operador.

R-EMAIL está diseñado pero no probado. Configurar plantilla de acción/URL y dominios
solo del nuevo staging; EEP activo y sin servicios de pago. La prueba sintética valida scrypt,
revocación y cuotas reales; no concede permiso para migrar personas reales. Un proyecto
productivo de identidad sería un destino separado con aprobación específica; nunca
promover cuentas sintéticas mezclándolas con cuentas reales sin preflight/manifiesto.

## Interfaz de scripts propuesta

Los nombres son contrato de diseño; comprobar cuáles existen antes de ejecutarlos.
Los cuatro comandos Firebase/identidades todavía no se implementan ni ejecutan en Plan:

| Script raíz | Entrada requerida | Resultado verificable |
|---|---|---|
| cloud:targets:check | --target staging o production | identidad y cuota; rechaza target viejo/inesperado |
| cloud:snapshot | --source <ruta SQLite> --output <directorio privado> | snapshot consistente, esquema, digests y manifiesto con cutoff |
| cloud:migrate | --target --manifest <release> | backup/restore previo, ledger D1 y esquema compatible; no abre tienda |
| cloud:import | --target --manifest <snapshot> | destino CLOSED, chunks+checkpoint atómicos, sin duplicados |
| cloud:verify | --target --manifest <snapshot> | counts/digests/FK/totales/stock/assets; pasa a VERIFIED solo si concilia |
| cloud:backup | --target --output <directorio privado> | export protegido, hash, esquema y bookmark disponibles |
| cloud:restore:verify | --target staging --backup <privado> | restore aislado, checks y reporte; no toca producción |
| cloud:release | --target production --manifest <release aprobado> | target/gates/schema compatibles, versión desplegada y apertura explícita |
| cloud:close | --target --reason <sin datos sensibles> | CLOSED y escrituras comerciales bloqueadas |
| cloud:firebase:preflight | --target --firebase-project <id aprobado> | Spark/EmailPassword/policy/EEP y allowlist; aborta target viejo o configuración de pago |
| cloud:firebase:test-import | --target staging --synthetic-manifest <privado> | STANDARD_SCRYPT exacto, login/UID/roles y negativos; ninguna cuenta real |
| cloud:identities:import | --target --manifest <privado> | herramienta Node privada, preflight UID/email, lotes<=1000, resultados/checkpoints por cuenta |
| cloud:identities:verify | --target --manifest <privado> | coincidencia project_id/UID/user_id/rol y estado; no abre automáticamente tienda |

Cada script devuelve exit0 solo ante éxito completo; exit distinto de0 y error seguro
ante fallo. Manifiestos privados contienen recuentos y checksums, no passwords en claro,
tokens o dumps completos en stdout. Incluir --dry-run donde aplique; dry-run no escribe.
No existe script de reset remoto con comodín; fuente/destinos se verifican por realpath/UUID.
Provisión admin solo si no existe uno en un destino sintético vacío; import conserva el
administrador existente. No crear un administrador público adicional tras migrar.

## Snapshot y copia única

1. Registrar alcance/versions/tables del origen, fecha UTC de corte y autoridad de datos.
2. Detener la API local limpiamente y verificar su lock liberado. Copiar y validar SQLite
   y WAL/SHM que existan; nunca leer un `.sqlite` suelto mientras recibe escrituras.
3. Verificar integridad, hacer hash y copia restaurable privada. Leer esa copia para
   exportar filas; no escribir schema/provenance de cloud dentro del origen.
4. Proteger backups con permisos restrictivos y cifrado en reposo del almacén local;
   no repositorio Git ni artifacts CI públicos. Guardar manifiesto privado por snapshot.
5. Comparar origen pre/post antes de reanudar API local. Reanudar local cuando la copia
   es consistente; modificaciones posteriores locales quedan fuera de esa copia única.
6. Importar solo en producción nueva CLOSED. Ensayo previo con datos sintéticos en
   cloud-local/staging y restore verificado; no importar datos reales a previews públicos.
7. Transformación de sesiones al namespace inerte documentada. No cambiar hashes de
   passwords ni relaciones; no volver a sembrar catálogo/roles/stock sobre el import.
   Identidades Firebase requieren R-IDENTITY previo y autorización distinta a este Plan:
   STANDARD_SCRYPT desde snapshot protegido, mismo hash/salt, UID asignado por manifiesto.
   Importar identidades y filas D1 no es un commit conjunto; mantener CLOSED y checkpoints
   por cuenta. Preflight exhaustivo UID/email: Firebase no rechaza todos los duplicados.
   No ejecutar imports repetidos ciegamente ni sobrescribir una cuenta ya creada.
8. Verificar counts/digests/FK y pruebas de lectura de datos privados con operador
   autorizado. Pruebas de compra con writes se hacen en staging; no alterar registros
   migrados reales para fabricar una reconciliación o un demo.
9. Abrir solo tras gates y autorización explícita del corte; retirar acceso temporal
   de validación. No hay sincronización continua ni cambio al proyecto antiguo.

Un import parcialmente completado conserva CLOSED. Reanudar solo con snapshot y target
idénticos; cada chunk y su checkpoint confirman juntos. Un target ya OPEN con nuevas
escrituras se rechaza. Reintento con contenido/digest distinto nunca sobreescribe filas.

## GitHub → Workers Builds

Seleccionar `7172MichaJosu/JM-STORE-ECOMMERCE-SDD`, instalar integración con acceso solo
al repo necesario y conectar al Worker nuevo; su nombre debe coincidir con config.
Raíz repo, build previsto `npm ci` y script cloud de build/checks. Dependencias y Wrangler
fijados en lockfile; instalación limpia con Node24 de rama24.

Staging sigue rama de integración propia y usa config staging. Production sigue main
solo después de validar migración y gates. Comando de publicación siempre usa config
producción explícita. No habilitar auto deploy inicial durante provisión/importación;
no ejecutar migrate/import en todo build ni cambiar DB por variables ambiguas.

Builds y tests de PR no exponen DB productiva. Runtime secrets y build secrets tienen
almacenes distintos; no confiar en que un secret de build aparezca automáticamente en
runtime. Código/config se revisan en GitHub antes de la publicación; Plan no hace commit,
push o conexión remota.

## Respaldos y restauración

Antes de migrar: backup export privado validado, bookmark Time Travel y ensayo de restore.
Retener exports diarios30días y previos a cada release; registrar fecha/schema/digest y
target. Verificar un restore antes de cambio destructivo y en cada nueva estrategia de
backup. Proteger contenido de usuario/hash/sobres cifrados; no incluir secrets Workers.
Mantener backup SQLite y manifiesto de identidades; auth:export Firebase puede omitir
hash/salt externos antes del primer login y rehash. Exportar configuración/mapeos de forma
privada, sin asumir que un export equivale a respaldo completo de identidad. Las claves
AES quedan en almacén separado, con recuperación y rotación; si faltan, revocar sesiones.
El objetivo<=60min aplica al dataset D1 MVP, no promete SLA de recuperación Firebase.

Free Time Travel conserva7días y no clona a otro target. Restauración de ensayo usa un
export y D1 staging aislada; no restaurar producción para hacer una prueba. Objetivo
operativo inicial: ensayo de recuperación del dataset MVP en<=60min; RPO del export
diario<=24h, y cambios más recientes se recuperan con bookmark cuando esté disponible.
Esto no autoriza perder pedidos: cualquier retorno anterior requiere conciliación de
todas las escrituras confirmadas posteriores al punto restaurado.

Incidente: CLOSED, exportar estado actual, guardar versión/corte/operaciones, identificar
backup/bookmark, restaurar target aprobado, conciliar nuevos pedidos/pagos/stock y volver
a verificar antes de OPEN. Rollback del código requiere esquema compatible; una versión
de Worker anterior no revierte D1. Ante duda de pérdida no abrir la tienda.

Un restore no puede reactivar sesiones revocadas: cambiar namespace online y cerrar
todas las sesiones restauradas antes de abrir. Rotar la firma de cotizaciones invalida
resúmenes anteriores a la recuperación. La base Firebase vigente no se retrocede con un restore D1. Consultar UID/estado y conciliar
credential_operations, versiones/cortes y cambios de credenciales posteriores al backup; si no se puede acreditar la identidad vigente, mantener cerrado
el acceso afectado hasta resolverlo mediante operación privada auditada.

## Fallos y observabilidad

Registro estructurado por requestId/operación/estado/duración/IDs no sensibles, sin
passwords, cookies, CSRF, cotizaciones firmadas, emails/direcciones completas ni payload SQL.
Registrar recursos consumidos por ruta mediante métricas agregadas y metadatos D1.
Alertar cuotas y revisar reserva de capacidad para el proyecto anterior; no modificarlo.

Auth REST/JWT/cifrado/lookup/refresh que excede Free: ERROR R-AUTH, release cerrado;
registrar evidencia sintética y volver a decisión SDD. No desactivar comprobación de
revocación, usar claves vencidas, bajar el hash, activar pagos ni resetear passwords.
R-EMAIL exige enlace, reserva, carreras y reconciliación probados antes de release.
D1/cuota agotada:503 y misma clave para resolver
resultado incierto de checkout, nunca registrar rechazo de pago ficticio por un error
técnico. Rollback inyectado debe probar cero cambios parciales.

## Recuperación de cambios de credenciales Firebase

La operación remota puede confirmarse aunque el Worker no reciba respuesta. Mantener
cuenta LOCKED/RECONCILIATION_REQUIRED y sesiones revocadas; ninguna restauración de D1
puede reactivar un acceso previo al corte. No guardar passwords para compensar o reintentar.
Login privado del UID exacto concilia estado vigente antes de crear sesión; si queda
ambigüedad, intervención de operador con permisos mínimos/auditoría, sin revelar datos.
No intentar actualizar email mediante API administrativa ni crear un broker IAM mientras
no se apruebe esa alternativa. Ningún script de recuperación toca SQLite ni el proyecto
antiguo. No borrar cuentas Firebase automáticamente por un fallo de commit D1.

## Reservas, enlaces y recuperación de correo

Antes de habilitar registro, poblar y verificar el registro único de emails actuales e
importados; sin duplicados entre claims ACCOUNT/IMPORTED/REGISTRATION/EMAIL_CHANGE.
No hay limpieza remota en Plan. En Implement, limpieza oportunista indexada y acotada de
pending vencido a los 60min; nunca borrar reservas APPLYING/RECONCILIATION_REQUIRED por
TTL. Registrar estados/cantidades agregadas sin direcciones ni códigos. Cancelación no
invalida código remoto: no documentar esa garantía ni borrar identidades para compensar.

Desactivar query logging/trazas de cuerpos en ruta de acción; no incluir códigos en
screenshots/artifacts/referrers. Action handler mismo origen y plantilla Firebase deben
validarse en Spark sintético antes de producción. Ningún GET de enlace confirma cambio.
Confirmación explícita CAS serializa con cancelación/expiración y revoca todas las sesiones.

Tras restore D1, Firebase conserva credenciales vigentes: cerrar acceso, cambiar namespace,
revocar sobres y conciliar UID/email/operaciones/reservas con estado remoto. No reactivar
una reserva vieja, una sesión o enlace por restaurar backup. Una colisión de email externo
bloquea/reconcilia cuenta afectada; no toca SQLite ni el Worker anterior. Recuperación
privada auditada si faltan pruebas, sin inventar un canal de reset aprobado.
