# Rotación de secretos de staging — preparación local

Estado al 2026-11-05: **APLICADA EN STAGING**, versión `08151cb7-7c41-40ad-8447-e679b02150de`. Se usó `wrangler versions upload --secrets-file` para incluir código y secretos juntos, y se publicó explícitamente solo esa versión. Los pasos de preparación y el comando alternativo de abajo se conservan como procedimiento; el registro vigente es esta nota. El propietario informó exposición
previa de `QUOTE_SECRET` y `RATE_LIMIT_SECRET`; ambos se consideran comprometidos,
aunque el escaneo de sus valores actuales no encuentre copias publicables. No se
reproducen valores, fragmentos ni huellas en este documento.

## Preparación verificada

`npm run cloud:config:check` valida el archivo ignorado `cloud/.dev.vars`, sus nombres,
ausencia de duplicados, separación de secretos, configuración runtime y un round-trip
AES-GCM con contenido sintético. No verifica credenciales contra Firebase ni consulta
la consola, las cuotas, el plan o la plantilla de correo.

`npm run cloud:secrets:prepare` examina los archivos publicables y todos los commits
locales buscando los valores actuales solo en memoria. Genera dos reemplazos
independientes de 32 bytes mediante el generador criptográfico del sistema, en
`cloud/private/staging-secret-rotation.json`. El archivo está ignorado por Git y en
Windows su ACL permite acceso al usuario actual. Repetir el comando reutiliza y valida
el candidato existente; no imprime claves ni modifica los secretos activos locales o
remotos. Un match público o histórico impide aprobar el preflight.

Se verifican en memoria: una cotización firmada con la clave anterior falla con la nueva,
y el HMAC de rate limit cambia de namespace. Las cotizaciones pendientes deberán
regenerarse; pedidos y pagos ya registrados conservan sus datos. Los contadores anteriores
expiran normalmente y no deben copiarse con identidades supuestas al namespace nuevo.
La clave AES de Firebase no forma parte de esta rotación: requiere su propio procedimiento
si aparece evidencia de exposición.

## Ejecución remota pendiente de autorización

1. Confirmar allowlist: Worker `jm-store-ecommerce-sdd-staging`, D1
   `jm-store-ecommerce-d1-staging` (`ce073401-aae5-4889-8d32-047010650987`). La configuración
   Wrangler explícita es `cloud/wrangler.staging.jsonc`. Nunca seleccionar `jm-store`.
2. Con autorización, preparar el respaldo de staging y mantener el nuevo D1 cerrado a
   escrituras de negocio mientras se revisan migraciones/configuración y rotación. No
   tomar snapshots ni migrar datos del SQLite local.
3. Preparar una versión de Worker con el código Firebase revisado, variables de proyecto
   y secrets correctos de staging. La CLI instalada ofrece
   `wrangler versions secret bulk cloud/private/staging-secret-rotation.json --config cloud/wrangler.staging.jsonc`
   para crear una versión de secretos sin publicar automáticamente. Este comando no se
   ha ejecutado. Revisar el ID de la versión y el código/configuración asociado antes de
   cualquier despliegue explícito; no usar una actualización de secretos que publique
   involuntariamente una versión de código anterior.
4. Desplegar únicamente la versión de staging aprobada con ambas claves nuevas juntas;
   registrar ID y resultado, nunca valores. Las migraciones Firebase 0003/0004 y los
   settings de Spark/EEP/policy/plantilla deben verificarse antes de abrir las pruebas.
5. Ejecutar pruebas sintéticas de cotización/rate limit, registro/login, roles, cambio
   separado de credenciales, entrega de enlace y revocación. Medir CPU/límites Free y
   mantener R-AUTH/R-EMAIL pendientes hasta obtener evidencia real. Retirar candidatos
   privados cuando ya no sean necesarios, sin guardar claves antiguas en Git.

Un rollback revierte código compatible conservando las claves nuevas. No restaurar
secretos expuestos al volver a una versión anterior. La autorización futura debe cubrir
esta preparación remota, migraciones de staging, despliegue solo en staging y pruebas
con cuentas sintéticas. No implica producción, cuentas reales, commit ni push.

## Aislamiento de las pruebas locales

Vitest configura directamente el Worker y D1 efímera, sin leer `.dev.vars`; cualquier
salida de red no simulada recibe 503. Los E2E Firebase ejecutan el Worker real compilado
contra D1 efímera y un proveedor REST/JWKS sintético en memoria. Su `outboundService`
intercepta todas las peticiones, sin fallback a Internet. Los códigos de acción son
sintéticos y temporales, fuera del repositorio, y se borran al terminar el runner. No hay
capturas, vídeo ni trazas del flujo Firebase. Esto prueba integración local, no entrega
real de email, validez de la API key ni CPU/cuotas del Worker alojado.
