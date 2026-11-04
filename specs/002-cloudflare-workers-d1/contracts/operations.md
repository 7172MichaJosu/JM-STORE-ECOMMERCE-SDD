# Contrato operativo: destinos, migración, release y recuperación

Diseño de herramientas futuras. No se crean scripts/configs ni recursos desde Plan.
Las operaciones no tienen un target remoto por defecto. CLI según AGENTS.md: `cf` hasta
existir configuración Wrangler; después Wrangler con config explícita y target validado.

## Identidad de entornos

| Entorno | Config prevista | Datos y exposición |
|---|---|---|
| local existente | configuración actual Node | SQLite actual, localhost; no reset/import cloud |
| cloud-local | cloud/wrangler.staging.jsonc en modo local | D1 emulada temporal; nunca archivo SQLite actual |
| staging nuevo | cloud/wrangler.staging.jsonc | Worker/D1 propios, dataset sintético, acceso restringido |
| production nuevo | cloud/wrangler.jsonc | Worker/D1 nuevos, snapshot aprobado, CLOSED hasta validación |

Allowlist por entorno: cuenta autorizada, nombre Worker,UUID D1,origen,identificador
interno de deployment_state. Los IDs remotos reales no se inventan en Plan. Antes de
mutar, herramienta contrasta configuración, identidad remota y estado; muestra target y
plan de acción sin secretos. Cualquier incongruencia falla antes de escribir. Los recursos
del proyecto viejo se registran como prohibidos; nunca adoptarlos por colisión de nombre.

Config y build de staging jamás reciben DB/secret productivo. Ninguna PR de fork ejecuta
con credenciales Cloudflare. Secrets runtime: QUOTE_SECRET,RATE_LIMIT_SECRET y, si se usa,
secreto temporal de validación; son valores distintos por entorno. No guardar ADMIN_PASSWORD
permanente después de provisión. Account/database IDs no son credenciales, pero el token
de administración no se sirve desde el Worker ni se añade al bundle cliente.

## Interfaz de scripts propuesta

Se crearán solo durante Implement; nombres previstos para quickstart:

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
backup. Proteger contenido de usuario y hash; no incluir secrets externos de Workers.

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
resúmenes anteriores a la recuperación. Conciliar también cambios de credenciales
posteriores al backup; si no se puede acreditar la identidad vigente, mantener cerrado
el acceso afectado hasta resolverlo mediante operación privada auditada.

## Fallos y observabilidad

Registro estructurado por requestId/operación/estado/duración/IDs no sensibles, sin
passwords, cookies, CSRF, cotizaciones firmadas, emails/direcciones completas ni payload SQL.
Registrar recursos consumidos por ruta mediante métricas agregadas y metadatos D1.
Alertar cuotas y revisar reserva de capacidad para el proyecto anterior; no modificarlo.

Auth Free que excede CPU/memoria o incompatibilidad nativa: ERROR R-AUTH, release cerrado;
elevar decisión SDD. No bajar coste del hash, habilitar pagos, añadir un proveedor o
resetear passwords como fallback oculto. D1/cuota agotada:503 y misma clave para resolver
resultado incierto de checkout, nunca registrar rechazo de pago ficticio por un error
técnico. Rollback inyectado debe probar cero cambios parciales.
