# Propuesta SDD: autenticación compatible con Workers Free

**Estado:** la decisión de mantener bloqueada la migración real está aprobada y registrada
en `spec.md`; el método de verificación de identidad y el diseño de autenticación siguen
sin aprobar para implementación.
**Fecha:** 2026-11-04.

## Evidencia observada

En el Worker `jm-store-ecommerce-sdd-staging`, con usuarios y contraseñas sintéticos,
Workers Observability registró estos agregados durante las pruebas de registro/login:

| Ruta | Invocaciones | CPU máxima | CPU promedio |
|---|---:|---:|---:|
| `/api/auth/register` | 4 | 602 ms | 451.75 ms |
| `/api/auth/login` | 2 | 522 ms | 435 ms |

El límite publicado para Workers Free es 10 ms de CPU por petición HTTP. Las solicitudes
de prueba respondieron con los códigos esperados y no hubo error 1102; eso no demuestra
que el margen del plan sea suficiente para cargas sostenidas. La telemetría consultada no
proporcionó una medida de memoria por invocación. La observabilidad se desactivó al acabar
la medición. La D1 y las cuentas/pedidos creados por las pruebas son sintéticos.

Las contraseñas locales usan scrypt `N=131072`, `r=8`, `p=1`. OWASP recomienda como mínimo
esa configuración de scrypt cuando Argon2id no está disponible. Reducir sus parámetros
para pasar el límite de CPU debilitaría la protección y no es una opción propuesta.

## Conflicto que requiere decisión

La especificación y la Constitution requieren conservar los hashes de contraseña al
migrar datos y ofrecer autenticación en Cloudflare. El presupuesto Free medido no admite
de forma fiable verificar esos hashes. El plan gratuito y la preservación de la
autenticación actual no pueden declararse compatibles con la evidencia disponible.

## Caminos candidatos

1. **Mantener Free y definir una transición de credenciales en SDD.** Antes de migrar
   cuentas, especificar un mecanismo seguro de reautenticación/reinscripción compatible
   con Free. No hay hoy un canal de recuperación o verificación aprobado; no asumir correo,
   códigos manuales, acceso al sistema local ni restablecimiento masivo. Debe decidirse
   cómo demostrar la titularidad, tratar al administrador, conservar la relación con
   pedidos/carritos, revocar sesiones y recuperar cuentas. Elegir y calibrar el hash nuevo
   requiere verificar una implementación aprobada contra recomendaciones actuales y
   medirla en staging. Hasta completar Specify/Clarify/Plan/Tasks de ese cambio, T034 y la
   migración real siguen bloqueadas.
2. **Conservar scrypt y hashes existentes con un presupuesto de CPU distinto.** Requiere
   evaluar un plan pagado de Workers y su costo total. No está autorizado ni se debe
   habilitar sin aprobación expresa del propietario.
3. **Usar un proveedor de identidad separado.** Cambia el alcance, incorpora una
   dependencia externa y requiere diseñar mapeo de cuentas, recuperación, privacidad y
   costo; no se recomienda para el MVP sin aprobación SDD.

## Recomendación

La decisión aprobada mantiene la cuenta de Cloudflare en Free y bloquea la importación de
usuarios/pedidos reales y el corte. No reducir el costo de scrypt, no reemplazar hashes, no restablecer
credenciales y no habilitar un servicio pagado. La siguiente decisión SDD debe especificar
un método viable de prueba de titularidad y transición de credenciales, o confirmar que la
autenticación desplegada queda fuera del corte hasta resolver esa carencia. La base SQLite
local y el Worker antiguo permanecen independientes.

## Alcance de este borrador

La decisión de bloqueo ya está registrada en `spec.md`. Este documento no elige un método
de autenticación ni de verificación, no cambia código, no marca tareas completadas y no
autoriza migrar datos o crear/modificar recursos remotos. Cualquier solución requiere su
propio Specify/Clarify/Plan/Tasks antes de implementación.

## Alternativas técnicas revisadas durante Implement

La implementación local de US3 conserva scrypt y no resuelve el presupuesto Free. Ninguna
alternativa de esta tabla está aprobada o medida en staging; no se presenta como viable
en producción sin un gate alojado con parámetros seguros y carga representativa.

| Alternativa | Protección y trabajo en Worker | Cambio SDD necesario |
|---|---|---|
| Servicio de identidad con nivel gratuito | El proveedor protege contraseñas; Worker valida firmas y conserva roles/sesiones revocables. Evita ejecutar el hash de contraseña en Worker. | Elegir y revisar proveedor, cuotas, privacidad, reautenticación del administrador, vínculo de cuentas e inscripción/recuperación verificadas. No hay proveedor ni compatibilidad de importación de scrypt confirmados. |
| PBKDF2 nativo con Web Crypto | Workers admite PBKDF2; OWASP recomienda HMAC-SHA256 con 600000 iteraciones cuando se utiliza. El soporte de la API no demuestra cumplir 10 ms. | Medición sintética alojada, política de hashes versionados y transición de cuentas. Los hashes scrypt existentes no se convierten a PBKDF2 sin la contraseña y su verificación segura. |
| Passkeys/WebAuthn | Worker verifica una firma de clave pública; evita almacenar una contraseña cloud y ejecutar su derivación. | Cambia el requisito de contraseña actual por una prueba de autenticador; necesita inscripción, compatibilidad de dispositivos, recuperación y titularidad de cuentas importadas. También exige medir CPU del flujo completo. |
| Mantener scrypt exacto en Worker Free | Conserva la política y las contraseñas, pero los resultados medidos exceden 10 ms. | No es aceptable declarar R-AUTH aprobado con la evidencia actual. |

La opción que evita directamente el costo de derivación de contraseñas en Worker es
separar la autenticación en un servicio de identidad. Es una solución de arquitectura
candidata; incorpora una dependencia que el alcance actual excluye y no se implementa sin
aprobar la modificación de especificación/plan y revisar un proveedor concreto. Si se
mantiene toda la autenticación dentro de Workers, PBKDF2 nativo es únicamente un candidato
a evaluar, no un reemplazo aprobado ni una forma de eludir el presupuesto de CPU.

No se propone SHA-256 rápido, hashing exclusivo en el navegador, reducción arbitraria del
costo criptográfico, compartir cuentas o restablecer contraseñas sin prueba de identidad.
La comparación se apoya en la documentación oficial de Web Crypto y OWASP enlazada abajo.

## Fuentes

- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
