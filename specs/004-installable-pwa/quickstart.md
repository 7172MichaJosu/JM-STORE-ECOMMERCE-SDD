# Quickstart de validación — PWA JM-STORE

Guía de desarrollo y validación local de la implementación PWA. No usar datos/credenciales
reales; staging remoto requiere autorización aparte.

## Requisitos previos

- Node 24 (rama `>=24.15.0 <25`) y dependencias del monorepo instaladas.
- Cuenta de prueba sintética si el recorrido requiere autenticación; nunca incluir claves,
  tokens o `.dev.vars` en screenshots o evidencias.
- Para aceptación manual: teléfono Android con Chrome, equipo Windows con Chrome y Edge,
  tablet Android y tablet Windows compatibles. Si no están disponibles, marcar ese caso
  pendiente; emulación responsive no sustituye la instalación real.

## Build local existente

Desde la raíz del repositorio:

```powershell
npm run build
npm run cloud:build
```

Resultado esperado: Vite produce frontend para `client/dist`, Cloud build empaqueta Worker y
Static Assets. Después de Implement, confirmar en esos artefactos `manifest.webmanifest`,
iconos, `offline.html`, worker generado y lista precache. Ningún comando de este paso publica.

## Validación automatizada local disponible

La implementación incluye pruebas Node y Playwright. Desde la raíz:

```powershell
npm run test:pwa
npm run test:e2e
npm run cloud:test
npm run cloud:test:e2e
npm run cloud:test:firebase:e2e
```

Las pruebas cloud usan Miniflare, D1 temporal y FirebaseDouble con salida de red bloqueada.
El script de build cloud usa exclusivamente Wrangler `--dry-run`; no despliega. Los iconos
versionados se regeneran desde su SVG maestro con `node client/scripts/generate-icons.js`
(requiere el navegador Chromium de Playwright instalado).

Criterios comprobados por estas suites:

1. Parsear manifest; comprobar nombre, start/scope same-origin, standalone, colores y que
   cada `src` responda correctamente con MIME/dimensiones declaradas.
2. Confirmar que el precache solo incluye archivos allowlist, todos same-origin, con hash
   donde aplique; asegurar que no se incluyan `images/demo/**`, HTML, URLs con query ni `/api/**`.
3. Con perfil de navegador limpio, online: load shell, registro same-origin, Console sin
   errores de manifest/ícono/SW, rutas públicas y links profundos.
4. Offline después de visita online: abrir una navegación → aviso offline accesible; catálogo
   y API no se sirven desde caché; intento de compra/cambio de cuenta nunca indica éxito.
5. Inspeccionar Cache Storage después de catálogo, login, logout, cambio de cuenta y checkout:
   solo archivos de allowlist; cero API, credenciales, cookie, token, dirección o pedido.
6. Abrir dos ventanas en build A, publicar build B en servidor local: A sigue en A sin reload;
   B espera; cerrar todas, reabrir y comprobar B. Checkout no se envía automáticamente.
7. Playwright/axe, responsive 360/768/1280 px, orientación tablet, teclado/foco, temas claro/
   oscuro, reduced-motion; regresión p95 visual del carrito ≤100 ms en la prueba especificada.

`npm run test:e2e`, `npm run cloud:test`, `npm run cloud:test:e2e` y `npm run test`
existentes cubren regresión del sitio/Worker; su resultado no sustituye estas nuevas pruebas
PWA ni la aceptación humana por OS.

## Instalación manual (obligatoria en aceptación)

1. Usar únicamente el build/origen que se haya aprobado para esa ejecución.
2. Borrar instalación y datos de sitio del perfil de prueba o crear perfil limpio; comprobar
   HTTPS/contexto seguro y manifest/iconos válidos desde DevTools.
3. Chrome Android: instalar desde UI de Chrome, comprobar icono/nombre JM-STORE, cerrar,
   lanzar desde launcher y verificar modo standalone. Registrar OS/dispositivo/browser.
4. Windows: repetir por separado en Chrome y Edge; instalar desde menú/browser y abrir desde
   Start/taskbar o `chrome://apps`/`edge://apps`. Verificar ventana propia y recorrido básico.
5. Tablets Android/Windows: probar orientación vertical/horizontal, touch y teclado; no
   aceptar solo screenshot de viewport emulado como evidencia de instalación.
6. Probar conectividad desconectada, actualización con dos ventanas, autenticación sintética,
   carrito, compra simulada e historial. La tienda sigue sin habilitar compra offline.
7. Guardar evidencia redactada: navegador/versión, OS/dispositivo, fecha, pasos, resultados
   por criterio y errores. No incluir email/UID de usuarios reales, tokens ni payloads privados.

## Validación en staging, posterior y separada

Después de terminar esta feature hasta Implement, validar primero el artefacto con pruebas
locales. Una prueba alojada exige autorización independiente, despliegue exclusivo al Worker
de staging nuevo, D1 existente intacta y cuentas/datos sintéticos. No cambiar production,
Worker antiguo, SQLite, dominio, base de datos, cuenta Firebase, plan Cloudflare o Firebase.
Revisar Free/Spark y consumo; si se presenta requisito de pago, detenerse.

## Recuperación de una publicación PWA futura

Antes de cualquier publicación autorizada, conservar versión de release y artefactos
anteriores. Para volver a un cliente conocido, construir una revisión nueva que incluya
ese cliente y el endpoint válido `/service-worker.js`, con su allowlist correspondiente;
mantener la espera normal hasta cerrar ventanas. No regresar ciegamente a un release sin
ese endpoint: el SW ya instalado podría continuar activo aunque el sitio haya retrocedido.
Verificar el ensayo de dos versiones y la limpieza exclusiva de caché propia antes de
publicar la recuperación. No usar Clear-Site-Data, borrar cookies/localStorage ni restaurar
D1 para revertir archivos de interfaz. Una desactivación de emergencia exige un procedimiento
específico autorizado y probado; no se realiza en esta fase local.

## Resultado de Implement local — 2026-11-06

Manifest, iconos JM, registro, caché estática, aviso offline y espera de actualización están
implementados y probados localmente. La revisión PWA ya está publicada en staging con
autorización expresa; la instalación física continúa pendiente. Resultado publicado:
[evidence/pwa-staging.md](evidence/pwa-staging.md). Resultados locales y límites:
[evidence/pwa-validation.md](evidence/pwa-validation.md). El diagnóstico inicial permanece
en [diagnosis.md](diagnosis.md); contratos en
[contracts/installation.md](contracts/installation.md) y [contracts/cache-and-updates.md](contracts/cache-and-updates.md).

## Instalar la revisión publicada

Abrir en una pestaña normal (fuera de incógnito):
https://jm-store-ecommerce-sdd-staging.josue-hinostroza-27.workers.dev

**Chrome Android**:
1. Abrir el enlace directamente en Chrome, con conexión.
2. Tocar el botón «Instalar JM-STORE» si aparece; alternativamente ⋮ → «Instalar y crear
   acceso directo» → «Instalar». Según versión puede aparecer como «Añadir a pantalla de inicio».
3. Confirmar el nombre JM-STORE y la instalación. Abrir desde el icono JM en el launcher.

**Chrome Windows**:
1. Abrir el enlace en Chrome.
2. Pulsar el icono de instalación de la barra de direcciones o ⋮ → «Enviar, guardar y
   compartir» → «Instalar página como aplicación».
3. Confirmar «Instalar» y abrir JM-STORE desde Inicio o `chrome://apps`.

**Edge Windows**:
1. Abrir el enlace en Edge.
2. Pulsar el icono de instalación de la barra de direcciones o ⋯ → «Más herramientas» →
   «Aplicaciones» → «Instalar este sitio como una aplicación».
3. Confirmar la instalación y abrir desde Inicio o `edge://apps`.

En el dispositivo comprobar nombre/icono JM, ventana propia y navegación. Si ya había una
revisión abierta, cerrar todas las ventanas/pestañas JM-STORE y abrir de nuevo; no borrar
datos del sitio ni cookies para actualizar. El catálogo y las compras necesitan conexión.
Registrar los resultados físicos antes de marcar T026/T027; no basta con emular la pantalla.

Referencias de pasos de navegador: [Chrome Android](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=es),
[Chrome ordenador](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DDesktop&hl=es),
[Microsoft Edge](https://support.microsoft.com/es-es/edge/install-manage-or-uninstall-apps-in-microsoft-edge).
