# Administrador personal de staging — 2026-11-05

El propietario autorizó explícitamente verificar su UID de Firebase y asignarle ADMIN
únicamente en `jm-store-ecommerce-d1-staging`. Corresponde al aprovisionamiento privado
de una identidad nueva de FR-014, sin copiar cuentas SQLite ni usar registro público.

## Procedimiento y resultados

1. Se renovaron las sesiones administrativas de Firebase CLI y Wrangler. Los tokens se
   usaron en memoria, sin mostrarlos ni añadirlos a Git.
2. Se verificó el proyecto activo `jm-store-ecommerce-sdd`, facturación deshabilitada,
   ausencia de Identity Platform y proveedor Email/Password habilitado.
3. Consulta administrativa `projects.accounts.lookup` por el UID autorizado, con campos
   mínimos. El UID existía, estaba activo, tenía proveedor password y no tenía claims
   ADMIN reconocidos. No se solicitó contraseña ni se emitieron custom tokens/sesiones
   en nombre del propietario.
4. La allowlist y configuración Wrangler coincidieron con staging y D1 UUID
   `ce073401-aae5-4889-8d32-047010650987`. No existía cuenta D1 para ese UID/correo ni
   reserva de correo en conflicto.
5. Se reutilizó `cloud/scripts/staging-session.js backup`: export privado de 56,357 bytes,
   27 tablas restauradas, integrity_check=ok, foreign_key_check=0 y recuentos iguales.
   También se conservaron código/configuración y versión activa.
6. El bloque existente admite exclusivamente identidades sintéticas y se conservó
   intacto. Se adaptó privadamente su patrón SQL al único UID autorizado, con
   verificación administrativa previa y comprobación del digest antes de escribir.
7. Se añadió un usuario activo FIREBASE con rol ADMIN y su email_claim ACCOUNT por UID
   exacto. `password_hash` contiene solo el marcador `firebase-managed:<UID>`; Firebase
   sigue gestionando la contraseña.
8. Comparación con el respaldo: las 10 cuentas D1 anteriores y todos sus claims se
   conservaron iguales; total posterior 11. Consulta independiente confirmó ADMIN
   activo, UID correcto y cero infracciones FK.

Las operaciones D1 usaron Wrangler con target explícito. No hubo cambios del Worker,
Firebase Auth, planes, producción ni proyecto antiguo. Tres archivos SQLite originales
conservaron sus hashes. Esta autorización acotada no elimina el guard de CPU ni aprueba
R-AUTH/R-EMAIL.

## Evidencia y acceso

UID, correo, procedimiento operativo, respaldo y resultados detallados permanecen solo
en `cloud/private/`, ignorado. Este documento omite datos personales y secretos.

La primera comprobación encontró cero sesiones activas del propietario. Posteriormente
el propietario confirmó que ingresó y vio el panel. A las 16:20:31 UTC del 2026-11-05,
una consulta independiente confirmó ADMIN activo por UID exacto, una sesión vigente
en el namespace de staging con auth_version actual y cero infracciones FK. El acceso
interactivo queda verificado sin solicitar ni leer contraseña, cookies o tokens.

Acceso:

https://jm-store-ecommerce-sdd-staging.josue-hinostroza-27.workers.dev/admin/ingresar

Esta evidencia acredita el aprovisionamiento y el login administrativo personal; los
gates generales de CPU y cambio de correo continúan pendientes.

Referencia oficial de la consulta administrativa:
[projects.accounts.lookup](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/projects.accounts/lookup).
