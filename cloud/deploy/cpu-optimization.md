# Optimización autorizada y resultado de CPU — 2026-11-05

El propietario autorizó optimización automática y repetición de pruebas únicamente en
staging, manteniendo Workers Free y Firebase Spark. No autorizó producción, pagos,
migración real, modificación de SQLite/Worker antiguo ni commit/push.

## Requisitos y checklist

Se generó [free-staging.md](../../specs/002-cloudflare-workers-d1/checklists/free-staging.md)
con 16 preguntas sobre calidad de requisitos: presupuesto/unidades CPU, evidencia,
revocación, aislamiento, recuperación y servicios gratuitos. Todas las casillas quedan
pendientes de revisión; no son resultados de ejecución. La autorización actual permite
optimización/pruebas mientras el propietario revisa ese documento.

## Cambios acotados a cloud

- Router de autenticación construido una vez, con selección de proveedor por solicitud.
- Reutilización de claves CryptoKey AES-GCM no extraíbles y claves públicas del JWKS.
  La clave AES cambia al cambiar el secreto; cada cifrado conserva un IV aleatorio nuevo.
  El JWKS expirado/rotado reemplaza su objeto y su CryptoKey, incluso si reutiliza kid.
- Conversión binaria mediante Buffer nativo, sin cambiar AES-256-GCM ni RS256.
- Reserva de registro en batch atómico con rechazo de cuentas existentes y reservas
  concurrentes. RETURNING obtiene usuario/reserva sin lecturas remotas adicionales;
  se comprueba expiración nuevamente después de que responde Firebase.
- Creación de sesión y lectura segura de usuario en el mismo batch con las guardas de
  auth_version/UID/estado existentes. Se conserva la comprobación de revocación en
  Firebase y D1, CSRF, límites de intentos y cookies seguras.
- Scripts operativos conservan metadatos previos al renovar un respaldo y distinguen
  una consulta de Analytics no disponible de mediciones anteriores.

## Respaldos y despliegues

Antes de cada nueva versión se exportó exclusivamente la D1 de staging y se restauró
en SQLite temporal privado, ajeno al SQLite original:

| Versión preparada después del respaldo | Export | Tablas | Integridad / FK / recuentos |
|---|---:|---:|---|
| 5ef93d10-b881-483f-abcd-bf59c0474942 | 60,875 bytes | 27 | ok / 0 / iguales |
| c0f43974-41a7-4c15-9ddb-231b76763c81 | 66,435 bytes | 27 | ok / 0 / iguales |

Se respaldaron código/configuración/versiones anteriores. No se reaplicaron migraciones
ni se provisionó otro administrador. Se conservaron los secretos ya rotados y el
namespace de sesiones. La versión activa final es
`c0f43974-41a7-4c15-9ddb-231b76763c81`, solo en
`jm-store-ecommerce-sdd-staging`; D1 `jm-store-ecommerce-d1-staging` sigue OPEN.
La renovación de OAuth de Wrangler resolvió un 401 inicial antes de modificar recursos.

## Evidencia funcional y CPU real

Pruebas locales actuales: cloud **82/82**, E2E Firebase **7/7**, E2E cloud local **8/8**.
Incluyen rotación de claves, rechazo de firma inválida, expiración/reutilización de kid,
duplicidad concurrente de registro y reserva vencida durante la llamada al proveedor.

Cada intento alojado pasó **11/11** comprobaciones HTTP: registro, login, credenciales
incorrectas, sesión, acceso privado, logout, rol administrador, Seguridad y resumen.
Son 22 comprobaciones en dos repeticiones, no una aceptación integral de comercio.
Las cuentas creadas fueron sintéticas. No se imprimieron sus credenciales ni tokens.

| Intento | Versión | CPU registro, Wrangler tail | CPU demás 10 llamadas, tail | Analytics |
|---|---|---:|---:|---|
| 1 | 5ef93d10-b881-483f-abcd-bf59c0474942 | 15 ms | 3–8 ms | mayor P99 de bucket 15,350 µs = 15.350 ms; 19 invocaciones, 0 errores |
| 2 | c0f43974-41a7-4c15-9ddb-231b76763c81 | 19 ms | 3–8 ms | no disponible por rate limiter de consultas; no se reintentó |

Tail registró 11 invocaciones por intento, todas outcome=ok; los tiempos anteriores son
CPU de la plataforma, no reloj local ni latencia de Firebase. Analytics es una métrica
agregada distinta; sus P99 no se presentan como máximos individuales. Las diferencias
entre intentos no acreditan una mejora de CPU ni una comparación estadística controlada.
No hubo 1102. Esa tolerancia no permite aceptar el presupuesto de 10 ms. Memoria por
invocación, carga de 100 productos/20 sesiones, cuotas compartidas al cierre y el resto
de gates no fueron acreditados.

## Decisión operativa

**R-AUTH sigue NO APROBADO**. Tras el segundo resultado se detuvieron ensayos y cambios
remotos; se dejó bloqueado el guard privado de operaciones. No se continuó con checkout,
CRUD integral ni cambio de contraseña alojados. T034/T075/T103 siguen pendientes.

Staging puede abrirse para revisión, pero no se declara listo para uso estable ni
aceptación completa del examen. El cambio de correo sigue deshabilitado por falta de
handler personalizado guardado; T102/R-EMAIL continúan pendientes. No se habilitó el
handler predeterminado para eludir la revocación previa aprobada.

La alternativa sin costo más directa a evaluar es conservar frontend, Firebase Spark,
D1 y reglas/repositorios, reemplazando solo la entrada HTTP cloud Express/Node por un
handler Fetch nativo de Workers. Es una hipótesis de reducción de sobrecarga, no una
garantía de CPU: exige reconciliar el Plan y las tareas afectadas antes de implementarla,
mantener contratos y volver a medir frío/caliente/concurrencia. Express/SQLite local
permanecería intacto. No se hizo ese cambio arquitectónico en esta ejecución.

Fuentes oficiales consultadas el 2026-11-05:
[Workers Free: CPU 10 ms por invocación](https://developers.cloudflare.com/workers/platform/limits/),
[precios y plan Free](https://developers.cloudflare.com/workers/platform/pricing/),
[handler Fetch nativo](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/).

Los exports, credenciales sintéticas y mediciones detalladas permanecen en
`cloud/private/`, ignorado por Git y protegido; ninguna evidencia pública contiene
valores de secretos, cuerpos de peticiones, tokens ni cookies.
