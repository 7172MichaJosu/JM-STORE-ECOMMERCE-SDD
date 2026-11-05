# Recursos de staging de JM-STORE

Provisionados el 2026-11-04 con autorización explícita. Son independientes del
proyecto Cloudflare anterior y usan el plan gratuito.

| Recurso | Identidad | Estado |
|---|---|---|
| Worker | `jm-store-ecommerce-sdd-staging` | Desplegado en `https://jm-store-ecommerce-sdd-staging.josue-hinostroza-27.workers.dev`; versión vigente `c0f43974-41a7-4c15-9ddb-231b76763c81` |
| D1 | `jm-store-ecommerce-d1-staging` | UUID `ce073401-aae5-4889-8d32-047010650987`; región `ENAM`; migraciones 0001–0004 aplicadas; baseline preservado de 5 categorías y 20 productos; identidades Firebase sintéticas de pruebas, total posterior sin recontar tras detener ensayos |

La configuración Worker→D1 usa el binding `DB`. `workers_dev=true`, `routes=[]` y
`REMOTE_ENABLED=true` solo en `cloud/wrangler.staging.jsonc`. El origen es el host
workers.dev indicado; no se configuró dominio propio. Se guardaron dos secretos
aleatorios de staging en Cloudflare como secrets (`QUOTE_SECRET` y
`RATE_LIMIT_SECRET`); sus valores no están en el repositorio.

La prueba alojada pasó 3/3 casos (dos recorridos de tienda y registro/login). El
muestreo de Workers Observability durante el ensayo sintético encontró para
`/api/auth/register` un máximo de 602 ms y promedio de 451.75 ms de CPU; para
`/api/auth/login`, máximo de 522 ms y promedio de 435 ms. Esto excede el límite Free
de 10 ms por invocación y bloquea T034/R-AUTH, la importación de datos reales y la
viabilidad de autenticación en Free. Las respuestas de registro/login cumplieron los
códigos esperados y no se observó error 1102. La plataforma no expuso uso de memoria
por invocación en estos agregados; no se afirma una medida de memoria ni se marca el
gate aprobado. Workers Observability se desactivó nuevamente después de recoger solo
agregados sintéticos.

El staging contiene solo datos sintéticos creados por el seed y las pruebas E2E.
No se abrió ni modificó la base SQLite local, no se importaron clientes/pedidos reales,
no se activó Workers Paid y no se modificó el Worker antiguo `jm-store`.

Referencias oficiales consultadas el 2026-11-04:
[D1 limits](https://developers.cloudflare.com/d1/platform/limits/),
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/).


## Actualización Firebase 2026-11-05

Respaldo previo restaurado y verificado (25 tablas, 52,486 bytes, integrity_check ok, FK 0). Se aplicaron 0003/0004 en CLOSED; al publicar la versión indicada se rotaron QUOTE_SECRET/RATE_LIMIT_SECRET y se almacenó configuración Firebase como secrets. El namespace de sesiones es nuevo. El Worker antiguo no se modificó.

Staging está OPEN con correo bloqueado por FIREBASE_EMAIL_ACTION_READY=false; el propietario conservó el callback predeterminado y el API rechazó actualizarlo con EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED. Password y demás módulos están publicados. Pruebas iniciales reales 11/11; R-AUTH falla por una invocación de 11.294 ms frente al presupuesto de 10 ms. Tail adicional: 4/8 ms, outcome ok; no 1102. Se detuvieron nuevas pruebas y mutaciones remotas conforme al propietario. No se midió memoria por invocación. Observabilidad quedó habilitada; no se hizo otra publicación después del hallazgo. No hubo planes pagados activados, producción, migración real, commit o push.


Estado final de CPU y versi?n actual: [cpu-optimization.md](cpu-optimization.md). Dos intentos optimizados: registro 15/19 ms; R-AUTH no aprobado, guard cerrado. Staging permanece OPEN para revisi?n, correo bloqueado, observabilidad habilitada; no producci?n ni aceptaci?n integral.
