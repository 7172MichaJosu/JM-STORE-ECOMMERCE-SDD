# Quickstart de validación: despliegue independiente JM-STORE

**Estado**: guía prevista por Plan, 2026-11-04. Los comandos cloud siguientes todavía
no existen; se crearán durante Implement. No se ejecutaron pruebas, migraciones ni
despliegues en esta fase. [Operación](contracts/operations.md), [API](contracts/api.md),
[modelo](data-model.md) y [diseño](contracts/ui.md) son los contratos de referencia.

## Prerrequisitos

- Node24.15+ de rama24 y npm11. Repositorio fuente JM-STORE-ECOMMERCE-SDD.
- Implementación posterior de cloud/, scripts y config Wrangler explícita. No ejecutar
  comandos cloud copiando esta guía antes de que existan esos artefactos.
- Datos sintéticos para cloud-local/staging; rutas de DB temporal distintas de
  server/data. Backups/dumps/session keys fuera de Git. Extender ignores futuros para
  `.dev.vars*`, `.wrangler/`, snapshots y reportes privados antes de crear secretos.
- Para operaciones remotas futuras: cuenta autorizada con cuota libre para Worker y D1
  nuevos de staging/producción, allowlist confirmada, secrets nuevos y permisos mínimos.
  Nombres/UUID y origen reales se completan al implementar, nunca se inventan aquí.
- La CLI será cf si aún no existe config Wrangler; con la config creada se permite
  Wrangler de lockfile y --config explícito. En Plan no se inicia sesión ni se inspecciona
  o crea recurso remoto alguno.

## 1. Regresión local existente

Después de implementar la adaptación, estos comandos ya existentes deben seguir pasando
sin tocar los datos reales de la demo:

```powershell
npm ci
npm run build
npm test
npm run test:integration
npm run test:e2e
```

Resultado esperado: contratos y recorridos Node/SQLite intactos. No ejecutar setup/reset
sobre una instalación existente para continuar el desarrollo. Las32 pruebas anteriores
de feature001 son evidencia histórica local, no resultados Workers.

## 2. Workers y D1 locales aislados

Scripts previstos que se implementarán después de Tasks:

```powershell
npm run cloud:build
npm run cloud:test
npm run cloud:test:e2e
```

`cloud:test` inicializa D1 temporal, aplica solo migraciones cloud y seed sintético y
destruye únicamente su directorio temporal verificado. Nunca abre server/data.
La guía de ejecución local prevista con la config futura es:

```powershell
npx wrangler d1 migrations apply DB --local --config cloud/wrangler.staging.jsonc
npx wrangler dev --config cloud/wrangler.staging.jsonc --persist-to cloud/.wrangler/local
```

Validar deep links y API404 JSON, imágenes locales, búsqueda/promociones reales, cuenta,
direcciones, carrito y pedidos. Con100 líneas verificar límite de consultas y parámetros;
CPU observado en emulador no demuestra cumplir los límites del servicio alojado.

## 3. Ensayo alojado y gate de autenticación

Solo después de autorización de implementación remota, crear los targets nuevos y
confirmar su identidad mediante cloud:targets:check --target staging. Config de staging
y dataset sintético, sin accesos del proyecto viejo o base real. No copiar tokens a URLs.

Ejecutar el script futuro `cloud:test:hosted -- --target staging`. Debe cubrir scrypt
exacto N131072,r8,p1,key64,salt16 con contraseñas sintéticas; registro/login/cambio de
password, usuarios inexistentes y concurrencia. Medir CPU/memoria/error1102 con métricas
del servicio y verificar los parámetros contra las credenciales migradas.

Esperado: derivación correcta sin límites/incompatibilidad, estabilidad bajo concurrencia
y presupuestos de consulta satisfechos. Si no pasa R-AUTH no se abre producción ni se
afirma que Free es viable; se solicita una decisión SDD sobre arquitectura/coste. Ninguna
prueba se omite o debilita para declarar éxito. No existe aún resultado de esta medición.

## 4. Compra y administración

1. Registrar cliente, iniciar sesión, crear dirección, buscar producto y modificar carrito.
2. Checkout REJECTED: pedido AWAITING_PAYMENT e intento guardados, stock/carrito intactos.
3. Retry APPROVED: mismo pedido confirmado, una aprobación, un descuento y movimientos.
4. Repetir idéntica clave y cuerpo tras timeout; mismo status/body, sin duplicación.
5. Última unidad con100 intentos concurrentes/repetidos: máximo una venta y stock>=0.
6. Cambiar precio/stock entre quote y compra:409 sin cambios parciales. Inyectar fallo
   después de escribir stock y comprobar rollback completo de todas las tablas.
7. Admin gestiona catálogo/imágenes/categorías/promos/stock/clientes/pedido; cliente ve
   estado permitido e historial tras nueva sesión. Usuarios ajenos reciben404/403 correctos.
8. Cerrar/volver a abrir runtime cloud: datos continúan en D1, sin depender de Node local.

## 5. Mi cuenta → Seguridad

1. Admin cambia solo correo con password actual: efecto inmediato, sin email externo,
   sesión permanece y login posterior usa el nuevo correo.
2. Wrong password, email duplicado o versión obsoleta: error seguro y cero cambios.
3. Cambiar password o correo+password: operación indivisible, todas las sesiones caducan,
   cookie se elimina y login con credenciales nuevas funciona; viejas fallan.
4. Carrera entre login antiguo y cambio de password: no puede crearse nueva sesión con
   hash/version obsoletos. Auditoría solo contiene metadatos seguros.
5. Cliente/visitante no acceden a seguridad admin; falta CSRF/Origin y rate limit fallan
   sin cambiar credenciales. Inyectar fallo de auditoría y verificar rollback también
   de password y sesiones. Respuesta perdida no causa reenvío automático del formulario.

## 6. Migración y recuperación

Ensayar con copia sintética completa antes del snapshot real. Usar los scripts de
[operación](contracts/operations.md), con --target y --manifest explícitos; no hay target
remoto por defecto. Los argumentos de rutas reales son privados y no se versionan.

Detener API local para snapshot final; backup consistente y restaurable, integridad y
digest, comparación pre/post origen. Reiniciar local solo tras capturar copia verificada.
Importar una vez al D1 nuevo CLOSED, chunks/checkpoints atómicos, preservar IDs/hashes y
relaciones. Sesiones importadas inertes; cliente entra de nuevo y recupera carrito propio.
Comparar counts/digests por tabla, FK, snapshots, pedidos y stock; diferencias bloquean
VERIFIED/OPEN. No importar sobre datos online posteriores ni ejecutar seed tras import.

Ensayar corrupción/archivo ausente, interrupción de chunk, reintento idéntico, snapshot
distinto y target incorrecto. Probar restore de export en staging separado y recuperación
de pedidos posteriores al backup antes de una restauración real. Registrar tiempo de
ensayo<=60min para dataset MVP y disponibilidad de export diario<=24h/Time Travel.
Capturar export privado y bookmark antes de cada migración; retener exports30días.

## 7. Responsive, seguridad y rendimiento

Playwright+axe en360/1280px, ambos temas, teclado, foco, reduced-motion, sidebar admin,
mini carrito, checkout y nueva seguridad. Verificar CSP/caché/cookies en assets y API,
errores sin datos privados y refresh de todas las rutas SPA.

Medir búsquedas con100 productos y20 sesiones sintéticas bajo Free: p95<=2s de resultado
visible; registrar región/red/CPU/filas consultadas. Recorrido cliente<4min, sin cobros
ni datos bancarios. Los ensayos no sustituyen los pendientes humanos de feature001.

## 8. GitHub y aceptación de release

Workers Builds se conecta en una fase futura solo al repositorio/Worker nuevo. Config
staging separada de producción, main habilitada únicamente tras revisión de gates y
aprobación del corte. No migrar ni importar por cada push. Comprobar repositorio, nombre,
UUID D1 y origen antes de publicar; prueba de identidad equivocada debe abortar.

| Evidencia requerida | Resultado en Plan |
|---|---|
| Build/suites locales y cloud | No ejecutadas |
| R-AUTH en staging Free | Pendiente; riesgo de viabilidad principal |
| Copia/restauración/reconciliación | No ejecutadas |
| Seguridad, compra, UX y rendimiento | Criterios definidos, sin resultados nuevos |
| Worker/D1/Builds nuevos | No creados ni conectados |
| Validaciones humanas antiguas | Siguen pendientes según quickstart001 |

Tras un restore verificar nuevo namespace, revocación de todas las sesiones restauradas,
rotación de firma de cotizaciones y conciliación de cambios recientes de credenciales.
No se deben reactivar contraseñas o sesiones antiguas por recuperar un backup.

## Trazabilidad de validación

| Requisitos | Diseño y validación prevista |
|---|---|
| FR-001/003 | plan runtime/aislamiento; pasos1/2/8, R-ISOLATION y R-LOCAL |
| FR-002/015..017 | modelo y operación; paso6, R-DATA |
| FR-004..009/022 | API y modelo de comercio; paso4, R-COMMERCE |
| FR-010..014 | API/UI/seguridad; pasos3/5, R-AUTH y R-SECURITY |
| FR-018 | research Free y operaciones; pasos3/7/8, budgets por cuenta |
| FR-019/020 | UI y cliente conservado; paso7, R-UX |
| FR-021 | suites de todos los pasos, sin DB real de demo |
| SC-001/010 | recorrido cliente<4min, sin cargos ni datos bancarios; paso4 |
| SC-002/003/009 | reconciliación, origen intacto y restores; pasos1/6 |
| SC-004 | 100 intentos contra última unidad; paso4 |
| SC-005/006 | cambios de credenciales, roles y sesiones; paso5 |
| SC-007/008 | anchos/temas y p95 búsqueda; paso7 |

No declarar release completo si falta un gate. Guardar solo evidencia sintética y
redactada en documentación pública; dumps, trazas con datos y credenciales permanecen
privados. Esta guía termina en diseño; no autoriza ejecución remota por sí misma.
