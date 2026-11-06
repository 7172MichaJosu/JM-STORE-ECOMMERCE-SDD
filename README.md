# JM-STORE

## Demostración publicada en Cloudflare

**Staging:** https://jm-store-ecommerce-sdd-staging.josue-hinostroza-27.workers.dev

Actualización del 6 de noviembre: carrito optimista publicado y verificado en 1280/360 px.
El p95 visual pasó de 4,69/4,55 s a 11,2/11,3 ms; una solicitud por acción, rollback y
persistencia comprobados. Pasaron 172 pruebas locales y 5 E2E de carrito en staging.
Un registro inicial de 11 ms motivó optimización de sesiones de visitante. La repetición
capturó 67 invocaciones, máximo 9 ms, con registro 4–7 ms y login 4–6 ms.
La mejora está publicada en GitHub. **Entrega integral abierta:** carga/memoria y
otros pendientes de feature 002 continúan abiertos. No se activaron
servicios de pago. [Mediciones, pruebas y pendientes](specs/003-cart-response/results.md).

La evidencia siguiente corresponde a la publicación anterior del 5 de noviembre.

Estado del 5 de noviembre de 2026 para entregar el 6 a las 08:00 (America/Lima):
Fetch nativo, Firebase Spark y D1 persistente. El ADMIN personal está habilitado en
`/admin/ingresar`; el registro público crea clientes. Funcionan catálogo/búsqueda,
carrito, perfil/direcciones, compras/pagos simulados, historial/seguimiento,
administración y cambio de contraseña. **El cambio de correo continúa deshabilitado.**

Pruebas aprobadas: 134 locales, 71 comprobaciones API alojadas y 3 E2E de navegador.
CPU real de 146 invocaciones de tail: máximo 9 ms; Analytics inicial: P99 de bucket
9.912 ms frente a 10 ms. Se acredita la muestra; carga/memoria y aceptación integral
siguen pendientes. No se declara producción ni feature completamente terminada.

[Evidencia, versión y pendientes](cloud/deploy/native-fetch-validation.md).
Las instrucciones siguientes corresponden al modo local independiente.

Tienda de demostración para el examen. React/Vite, Express y SQLite persistente.
Requiere Node 24.15+ (rama 24) y npm 11. Los pagos son simulados, sin cobros reales.

## Demostración local

```powershell
npm ci
npm run setup:demo
npm run build
npm start
```

Abrir **http://localhost:3001**. El asistente prepara `.env.local`, migraciones y 20
productos en 5 categorías. Si aún no existe administrador, crea uno con contraseña
aleatoria y guarda su acceso únicamente en `server/data/admin-access.txt` (ignorado por
Git). No imprime la contraseña ni cambia un administrador existente. El registro público
crea clientes. No vuelvas a generar la base para continuar un trabajo existente.

Para provisionar manualmente el primer administrador, define `ADMIN_EMAIL` y
`ADMIN_PASSWORD` en el entorno local, ejecuta `npm run admin:provision` y retira la
contraseña del entorno. El comando rechaza promover cuentas existentes o crear otro
administrador cuando ya existe uno.

## Desarrollo

En `.env.local`, configurar `NODE_ENV=development` y `APP_ORIGIN=http://localhost:5173`.
En terminales distintas, ejecutar `npm run dev --workspace server` y
`npm run dev --workspace client`. Abrir http://localhost:5173. El proxy de Vite conecta la
API en 3001. Para volver a demo compilada, usar `APP_ORIGIN=http://localhost:3001`.

## Funciones

- Catálogo, categorías, búsqueda, filtros, imágenes y promociones vigentes.
- Registro/login, perfil, direcciones y carrito persistente del cliente.
- Confirmación con pago simulado aprobado o rechazado, reintento, historial y seguimiento.
- Panel de productos, imágenes de biblioteca local, categorías, promociones, precios,
  inventario con movimientos, clientes y pedidos.
- Temas claro/oscuro, responsive, teclado, movimiento reducido y mensajes accesibles.

Un pago rechazado registra pedido e intento sin descontar stock. Una aprobación confirma
el pedido y descuenta stock en la misma transacción. Las claves de idempotencia evitan
duplicar la operación. Nunca se solicitan datos bancarios ni se cobra dinero real.

## Pruebas y datos

```powershell
npm test
npm run test:integration
npx playwright install chromium
npm run test:e2e
```

Las pruebas usan bases temporales independientes. Los datos reales de la demostración
están en `server/data/jm-store.sqlite` y sobreviven al reinicio. `.env.local`, las bases,
sesiones, credenciales locales, respaldos y reportes de pruebas están excluidos de Git.
No poner secretos en variables `VITE_*`.

Con la API detenida, `npm run db:backup` valida integridad y crea un respaldo en `backups/`.
Para restaurar, detener la API, respaldar el estado actual y reponer el conjunto SQLite,
WAL y SHM de un mismo respaldo. El comando manual
`npm run db:reset-demo -- --confirm JM-STORE-DEMO` elimina únicamente la base de demo
permitida tras respaldarla; no se usa para continuar el proyecto ni desde el arranque.

Las imágenes son referenciales; algunas se generaron por IA sin marcas.
[Procedencia de imágenes](client/public/images/demo/ATTRIBUTION.md).

[Documentación SDD](specs/001-jm-store-ecommerce/plan.md) ·
[Guía y evidencia de validación](specs/001-jm-store-ecommerce/quickstart.md).
