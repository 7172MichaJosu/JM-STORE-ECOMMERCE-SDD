# Quickstart de validación — PWA JM-STORE

Guía técnica para las fases Tasks/Implement. Este documento no crea recursos ni autoriza
despliegue. No usar datos/credenciales reales; staging remoto requiere autorización aparte.

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

## Validación automatizada prevista

Las pruebas PWA deben agregarse en Tasks antes de implementarse; no existen aún comandos
específicos `pwa:check` ni tests PWA y no deben tratarse como aprobados. Criterios mínimos:

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

## Resultado actual del Plan

No se ejecutaron los comandos anteriores ni pruebas de la aplicación durante Plan. El
diagnóstico de Specify encontró ausencia de manifest/iconos y SW en un perfil limpio; no
acreditó instalación en Android/Windows. Ver [diagnosis.md](diagnosis.md) y criterios en
[contracts/installation.md](contracts/installation.md) y [contracts/cache-and-updates.md](contracts/cache-and-updates.md).
