# Firebase staging: estado vigente e historial

Checkpoint vigente: 2026-11-05, operaciones remotas de staging autorizadas. Se preservaron copias privadas antes de modificar configuración. Se confirmó proyecto exacto, facturación deshabilitada (Spark), Identity Platform deshabilitado, Email/Password, dominio autorizado, EEP, política 12–128 y API key restringida a Identity Toolkit/Token Service. El callback personalizado no quedó guardado: el API respondió EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED y el propietario indicó continuar con el predeterminado. La versión staging 08151cb7-7c41-40ad-8447-e679b02150de publica el cambio de correo bloqueado antes de cualquier efecto y permite password. La tabla siguiente conserva el checkpoint previo; esta nota y tasks.md son el estado vigente.

| Configuración | Evidencia actual |
|---|---|
| Spark, proyecto/app y Email/Password | Declarados configurados manualmente por el propietario |
| Project ID y Web API Key | Presentes en `.dev.vars` ignorado; configuración runtime válida; valores omitidos |
| Clave AES de sesión | Presente; cifrado/descifrado local verificado sin imprimirla |
| Dominio staging autorizado | Declarado configurado por el propietario; pendiente comprobación remota |
| Restricción de API key | Pendiente: Identity Toolkit API y Token Service API |
| EEP y política de contraseñas | Pendientes de comprobar en Firebase; backend exige 12–128 caracteres |
| Plantilla de cambio de correo | Pendiente: handler personalizado y entrega del enlace |
| Ausencia de Blaze/Identity Platform | Spark declarado por propietario; pendiente verificar sin activar servicios |
| Secrets y variables del Worker nuevo | Pendientes de cargar/verificar con autorización |
| R-AUTH/R-EMAIL/R-IDENTITY alojados | Pendientes; ninguna suite local acredita estos gates |

Handler previsto:
`https://jm-store-ecommerce-sdd-staging.josue-hinostroza-27.workers.dev/admin/mi-cuenta/seguridad/confirmar-correo`.
El host autorizado debe ser exactamente el correspondiente al Worker nuevo. No se usa
Firebase Hosting ni se necesita SDK web en React: la integración usa REST desde Worker.

La preparación de [rotación](secret-rotation.md) de `QUOTE_SECRET` y `RATE_LIMIT_SECRET`
debe aplicarse a una versión revisada de staging antes de publicar esa versión. Se
requiere autorización del propietario para operaciones remotas de settings/secrets,
migraciones 0003/0004 en D1 staging, despliegue solo en staging y pruebas sintéticas.
No se crean recursos adicionales ni se migra ninguna cuenta real. La importación exacta
STANDARD_SCRYPT sigue bloqueada hasta la prueba sintética de T104/T105.

Las pruebas locales usan claves/tokens/usuarios generados para el test y un proveedor
simulado sin salida a Internet. No prueban la validez de estas credenciales reales, los
límites Spark, la semántica real de revocación, el correo entregado ni la CPU alojada.


Optimizaci?n autorizada completada con R-AUTH no aprobado (registro 15/19 ms). Operaciones remotas detenidas. Ver [cpu-optimization.md](cpu-optimization.md); el estado de configuraci?n Firebase/Spark y el bloqueo de correo no cambiaron.
