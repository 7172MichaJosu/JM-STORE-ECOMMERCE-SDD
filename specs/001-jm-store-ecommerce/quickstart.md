# Quickstart y validación: JM-STORE

**Fecha**: 2026-11-03 | **Estado**: implementación local disponible; ver evidencia al final.

Los scripts, paquetes y pruebas de esta guía están implementados. La aplicación usa
SQLite persistente y assets locales. Las credenciales de administrador son privadas y
se provisionan localmente; no están en este documento ni en el código público.

Para una instalación nueva se puede usar `npm ci`, `npm run setup:demo`, `npm run build`
y `npm start`. En una instalación existente se conservan su base, configuración y cuenta
administrativa; continuar con `npm start` después de compilar los cambios.

## Requisitos de entorno

- Node 24 LTS >=24.15.0, npm 11, PowerShell y navegador Chromium/Firefox.
- Un directorio local escribible para SQLite; evitar unidad de red y filesystem efímero.
- Internet durante instalación de paquetes y navegador de pruebas. La demostración final
  funciona con assets y datos locales, sin pasarela, correo ni servicio de fotografías.
- Puertos 3001 para Express y 5173 para Vite durante desarrollo; demo compilada en 3001.

## Preparación manual

Desde la raíz del proyecto y con lockfile disponible:

```powershell
npm ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

Completar `.env.local` localmente antes de iniciar. El backend carga ese archivo desde
la raíz del repositorio, independientemente del workspace; nunca lo expone a Vite.

| Variable | Uso / regla |
|---|---|
| NODE_ENV | development para localhost; production para build |
| HOST | 127.0.0.1 para demostración local |
| PORT | 3001 |
| APP_ORIGIN | http://localhost:5173 en desarrollo; http://localhost:3001 en demo local |
| DATABASE_PATH | server/data/jm-store.sqlite, resuelta desde raíz |
| QUOTE_SECRET | Aleatorio >=32 bytes; firmado del resumen; no usar secreto de ejemplo |
| ADMIN_EMAIL | Solo para provision-admin; correo elegido por usuario |
| ADMIN_PASSWORD | Solo para provision-admin; contraseña local >=12 caracteres, nunca fija en seed |

`VITE_*` solo puede contener configuración pública. Contraseñas, quote secret, DB,
WAL/SHM, backups, sesiones y resultados con datos de clientes se excluyen de Git. El
archivo `.env.example` solo tiene nombres y valores inocuos. Retirar ADMIN_PASSWORD del
archivo local tras provisionar; el backend normal no la necesita ni permite autoalta ADMIN.

```powershell
npm run db:migrate
npm run db:seed
npm run admin:provision
```

Resultados esperados: migraciones versionadas aplicadas una vez; 5 categorías y 20
productos, imágenes locales y al menos un caso agotado. Seed repetido no resetea ventas
ni inventario. Provisionar crea una única cuenta ADMIN con hash y no imprime contraseña.
Si el correo ya existe con rol distinto, el comando aborta; no promueve cuentas existentes.
El cliente de demostración se registra desde la interfaz con datos ficticios identificados.

## Inicio de desarrollo y demo compilada

En dos terminales, ambas en raíz:

```powershell
npm run dev --workspace server
```

```powershell
npm run dev --workspace client
```

Abrir `http://localhost:5173`; Vite reenvía `/api` a 3001. Usar localhost de forma
consistente en ambos orígenes; no mezclar con 127.0.0.1 en navegador. APP_ORIGIN verifica
el origen que realmente usa el navegador. Backend limita bind a la interfaz local.

Para una demostración con un solo proceso, detener ambos procesos de desarrollo, cambiar
APP_ORIGIN a `http://localhost:3001`, fijar NODE_ENV=production y después:

```powershell
npm run build
npm start
```

Abrir `http://localhost:3001`. Express sirve build, assets y API, con fallback de navegación
SPA que no intercepta `/api`. Cookie Secure se activa al usar HTTPS; la demo HTTP local
tiene excepción explícita. Publicación en red y configuración TLS requieren su propia fase.

## Guion verificable del examen

| Paso | Acción | Resultado esperado / requisito |
|---|---|---|
| 1 | Abrir portada y buscar un producto por texto y categoría; filtrar precio/disponibilidad | Resultados coherentes, vacío útil y fotos locales; FR-001..003 |
| 2 | Registrarse y volver a iniciar sesión; agregar dirección | Cuenta CUSTOMER y dirección persisten; FR-006..008 |
| 3 | Agregar dos artículos, cambiar cantidad y quitar una línea | Totales S/ coinciden, no permite superar stock; FR-004..005,017 |
| 4 | Revisar dirección/resumen y elegir Rechazar pago simulado | Pedido aparece pendiente de pago con intento REJECTED; stock intacto |
| 5 | Abrir ese pedido y reintentar con Aprobar pago simulado | Mismo pedido queda CONFIRMED/APPROVED; un descuento de stock; FR-009..012 |
| 6 | Repetir la respuesta de red con misma clave o recargar el detalle | Mismo resultado sin pedido ni movimiento duplicado; SC-004 |
| 7 | Iniciar admin en otro navegador/contexto | No hay registro público ADMIN; cliente no accede al panel |
| 8 | Crear/editar producto, categoría, precio, promoción e imágenes de biblioteca; ajustar stock con motivo | Datos reales reflejados en tienda y movimientos; FR-013..014 |
| 9 | Consultar cliente, editar dato permitido, desactivar una cuenta de prueba | Datos persistidos y sesiones revocadas; no se revela hash |
| 10 | Avanzar pedido Confirmado -> Preparando -> Enviado -> Entregado | Solo transiciones válidas; cliente ve historial y pago intacto; FR-015 |
| 11 | Cerrar servidor limpiamente, iniciar y consultar pedido/carrito | Datos sobreviven al reinicio; FR-016,022..023 y SC-003 |
| 12 | Repetir recorrido esencial en 360 y 1280 px, ambos temas, teclado y movimiento reducido | Controles utilizables, foco visible y sin overflow de página; FR-018..019 |

No usar la cuenta desactivada del paso 9 para validar el acceso del comprador principal.
Los cambios operativos son manuales y de demostración, no afirman transporte real.

## Pruebas previstas

Los siguientes scripts están disponibles. Cada ejecución usa DB temporal y no
modifica la base de demostración; el arranque de pruebas debe rechazar DATABASE_PATH de demo.

```powershell
npm test
npm run test:integration
npx playwright install chromium
npm run test:e2e
npm run build
```

- Unidades: dinero entero/redondeo, prioridades y vigencias promocionales, validaciones,
  estados, firma y vencimiento de cotización, hash de contraseña y sesión.
- Integración HTTP/DB: registro duplicado, login genérico, CSRF/origen, rol, titularidad,
  sesión vencida y cuenta desactivada, CRUD admin, FK y optimistic locking.
- Compra: aprobación/rechazo/reintento, precio cambiado, token manipulado/vencido, stock
  cambiado, cantidad inválida, pedido ya aprobado y clave con cuerpo diferente.
- Concurrencia: dos usuarios con una unidad, exactamente una aprobación y stock final 0;
  doble confirmación con misma clave; dos claves para reintentar mismo pedido, una sola
  aprobación y un solo movimiento por artículo. Una nueva intención de compra de carrito
  modificado exige otra cotización, no reutiliza token anterior.
- Rollback: provocar fallo después del primer descuento de una compra de varias líneas;
  comprobar cero pedido/pago/movimiento nuevos y stock sin alteración parcial.
- Navegador: recorrido de tabla anterior, historial tras reinicio, fotos sin conexión a
  servicios externos, errores comprensibles y ausencia de claims comerciales inventados.

Medir SC-001 con 10 participantes o documentar la muestra real; no afirmar 9/10 sin prueba.
Medir SC-002 con cronómetro y SC-006 a 360/1280 px. Registrar versión, fixture, resultado,
duración y evidencia. Los objetivos de rendimiento de Plan se miden con 100 productos y
20 sesiones; no son garantías ni resultados obtenidos durante esta fase.

## Respaldo, restauración y reset

El script `npm run db:backup` exige API detenida, crea carpeta fechada bajo
`backups/` y copia juntos SQLite y archivos WAL/SHM que existan después del cierre.
El comando indica la ruta creada sin exponer datos. No copiar solo DB
mientras la aplicación escribe. Para restaurar, detener API, respaldar el estado actual,
reponer el conjunto completo de un mismo backup y ejecutar verificación de integridad.

`npm run db:reset-demo -- --confirm JM-STORE-DEMO` es un comando manual restringido
al entorno de demo. Exige proceso detenido, valida que la ruta esté dentro de server/data,
hace backup, reconstruye esquema/seed y vuelve a requerir provisión segura de admin.
No se ejecuta en Plan ni como parte de start, migrate o seed.

## Diagnóstico esperado

- 401: volver a iniciar sesión; 403: verificar rol/CSRF sin promover cuenta.
- 409: volver a revisar recurso o resumen; si NEW_CHECKOUT_REQUIRED, iniciar nueva compra.
- 503 por DB ocupada: esperar/reintentar; reutilizar la clave si la intención es la misma.
- Imagen ausente: placeholder neutral y enlace a corregir selección desde admin.
- Error de arranque por configuración/DB: mensaje operativo sin imprimir secretos;
  nunca reemplazar silenciosamente la DB por una base vacía.

Detalle de estados, límites y formatos: [data-model.md](data-model.md) y
[contracts/api.md](contracts/api.md). Diseño visual: [contracts/ui.md](contracts/ui.md).

## Resultados de Implement — 2026-11-03

Se retomó el WIP `d98a94d` conservando los archivos y datos existentes. No se reinició el
proyecto, no se regeneró la base de demostración y no se crearon commits. Se corrigieron
el ancho del panel a 360 px, el contraste de sus botones en oscuro y la notificación de
bienvenida del administrador. También se actualizó esta guía y la procedencia de imágenes.

| Verificación ejecutada | Resultado |
|---|---|
| `npm run build` | PASS: build de producción generado por Vite |
| `npm test` | 3/3 pruebas de dinero, firma y contraseñas |
| `npm run test:integration` | 20/20 pruebas de contratos, seguridad, persistencia, compra y operación |
| `npx playwright test` | 9/9 recorridos y comprobaciones en Chromium |
| Revisión adicional del cambio de bienvenida ADMIN | 2/2 recorridos administrativos repetidos correctamente |
| Carga local de referencia | 100 productos, 20 sesiones, p95 de búsqueda 374 ms; objetivo <=2000 ms |
| Persistencia al cerrar y abrir otra instancia de API | Cliente, dirección, pedido, pago y stock conservados |
| Respaldo/reset | Integridad y recuperación comprobadas en DB temporal; rutas y proceso activo protegidos |

Son **32 pruebas automatizadas distintas** aprobadas: 3 de unidades, 20 de API/integración
y 9 de navegador. Las dos repeticiones administrativas no se suman de nuevo al total.
El error interno emitido durante la prueba de rollback es un fallo inyectado
intencionadamente; la prueba verifica que no quedan cambios parciales.

La comprobación axe de WCAG 2 A/AA y 2.1 AA no detectó infracciones en las páginas revisadas:
portada, perfil, direcciones, carrito e historial, y todas las secciones principales del
panel, a 360/1280 px en claro/oscuro. El checkout también fue revisado por axe durante el
recorrido de teclado. Esto es evidencia automática de esas pantallas y estados, no una
certificación de accesibilidad para todos los contenidos que pueda cargar un administrador.

### Trazabilidad de requisitos funcionales

| Requisitos | Implementación y evidencia |
|---|---|
| FR-001..003 | Catálogo, categorías, buscador, filtros, detalle e imágenes; catalog.contract.test.js, catalog.test.js y catalog.spec.js |
| FR-004..005 | Cantidades, eliminación, precios vigentes y carrito persistente; checkout.contract.test.js, recovery.test.js y checkout.spec.js |
| FR-006..008 | Registro, sesión, roles, perfil y direcciones; auth.contract.test.js, account.test.js, security.test.js y account.spec.js |
| FR-009..012 | Resumen firmado, pagos simulados, pedidos y reintento; checkout-transaction.test.js, recovery.test.js y checkout.spec.js |
| FR-013..014 | Productos, biblioteca de imágenes, categorías, promociones, precios, stock y clientes; admin-crud.test.js, admin.test.js y admin-complete.spec.js |
| FR-015..016 | Estados permitidos, historial y snapshots persistidos; admin.test.js, persistence.test.js y admin-complete.spec.js |
| FR-017 | Céntimos enteros y presentación S/ con dos decimales; money.test.js y contratos de catálogo/checkout |
| FR-018..019 | Temas, responsive, teclado, foco, carrusel manual y reduced-motion; responsive-accessibility.spec.js y keyboard.spec.js, más revisión de implementación |
| FR-020 | Datos demo, manifiesto/licencias e imágenes generadas identificadas; revisión visual y ATTRIBUTION.md; promociones calculadas desde DB |
| FR-021..023 | Validaciones, CSRF, permisos, rollback y datos consistentes; security.test.js, recovery.test.js, persistence.test.js y operaciones CRUD |
| FR-024 | Scripts reproducibles y recorrido completo de cliente/administrador; todas las suites anteriores |

### Criterios de éxito y límites de la evidencia

| Criterio | Estado de validación |
|---|---|
| SC-001 | **PENDIENTE MANUAL**: no se realizó una sesión con 10 participantes; no se afirma el resultado 9/10 |
| SC-002 | El recorrido automatizado de compra termina en menos de 4 min; no se midió todavía tiempo de personas |
| SC-003 | PASS en la muestra automatizada: totales/estados consistentes, incluido cierre y reapertura de API |
| SC-004 | PASS en las pruebas de rechazo, stock concurrente, repetición, cambio de precio y rollback |
| SC-005 | PASS en las operaciones probadas: acceso y titularidad controlados por servidor |
| SC-006 | PASS en los recorridos revisados a 360/1280 px; sin overflow de página, con tablas/menús desplazables dentro de su región |
| SC-007 | PASS en importes y totales de la muestra de catálogo y compra; moneda PEN, presentación S/ |
| SC-008 | Revisión de contenido completada: sin cuotas, envíos, estrellas ni beneficios ficticios; imágenes referenciales identificadas |

La revisión T082 documenta el pendiente humano SC-001 y la ausencia de medición humana
de SC-002. Completar tareas técnicas no sustituye esa aceptación del examen. La fecha
original de ratificación de la Constitution permanece como TODO administrativo de su
propio workflow; no se inventó durante Implement. La feature se mantiene abierta.
