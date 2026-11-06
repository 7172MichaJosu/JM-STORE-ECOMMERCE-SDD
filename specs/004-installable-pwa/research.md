# Research: JM-STORE PWA instalable

**Fecha de consulta**: 2026-11-06. Fuentes primarias de Chrome/web.dev, MDN, Microsoft
Edge y Cloudflare. Esta investigación es de diseño; no valida una instalación real.

## R-01 — Identidad instalable y modo standalone

**Decision**: publicar un manifest enlazado desde la shell SPA con `name`, `short_name`,
`id`, `start_url`, `scope`, `display: "standalone"`, `theme_color`, `background_color` e
iconos PNG JM de 192×192, 512×512 y 512×512 `maskable`. La ayuda de instalación seguirá
siendo opcional y respetará la UI nativa del navegador.

**Rationale**: las guías de instalación de navegadores Chromium requieren identidad,
iconos de tamaño útil, URL de inicio y display mode; el manifest define cómo se lanza la
app instalada. PNG conserva amplia compatibilidad; una variante maskable permite que el OS
recorte el logo dentro de distintas formas sin cortar el símbolo. El diagnóstico encontró
0 enlaces de manifest y 0 iconos declarados, por lo que la primera dependencia técnica es
publicar esos recursos y verificar su respuesta desde Static Assets.

**Alternatives considered**: seguir solo como sitio sin manifest no satisface la instalación;
usar un acceso directo del navegador no prueba standalone; imitar una app nativa con APK o
tienda añade distribución y coste fuera del MVP. No se usa un logo/marca de terceros.

**Sources**:
- [MDN: criterios de instalación](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- [MDN: iconos de aplicación](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons)
- [MDN: aplicación standalone](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Create_a_standalone_app)
- [Microsoft Edge: manifest e instalación](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps-chromium/webappmanifests)

## R-02 — El Service Worker no es sustituto del manifest

**Decision**: incluir Service Worker por las decisiones offline y actualización de Clarify,
no como intento de cumplir un supuesto requisito universal de instalación. Probar por
separado `manifest`/iconos, registro de SW, fallback offline y standalone.

**Rationale**: la documentación de Chrome registra que ya no exige un `fetch` handler para
instalación desde menú en las versiones modernas citadas; el diagnóstico identifica el
manifest faltante como evidencia estructural, no un único causante reproducido del mensaje
del usuario. Los navegadores aún pueden aplicar heurísticas/políticas diferentes.

**Alternatives considered**: añadir un fetch handler vacío solo para habilitar instalación
carece de comportamiento offline útil y de valor verificable; queda rechazado.

**Sources**:
- [Cambios en criterios de instalación de Chrome](https://developer.chrome.com/blog/update-install-criteria)
- [Criterios de instalación de Chrome](https://web.dev/articles/install-criteria)

## R-03 — Política de caché del navegador

**Decision**: `vite-plugin-pwa` en modo `injectManifest` con Workbox para generar un
precache explícito de bundles fingerprinted JS/CSS, iconos JM y `offline.html`. No guardar
`index.html`, fotografías del catálogo, navegación, solicitudes `/api/**`, respuestas
Firebase/sesión, escritura ni dato de cliente. La navegación intenta red; ante fallo usa
la página estática offline, que no declara compra/datos. El resto de fetch continúa a red.

**Rationale**: una lista precache estricta es auditable y evita convertir accidentalmente
las respuestas de API en offline. `no-store` continúa siendo una defensa en API, pero la
política del SW no depende de ese header para excluir `/api/**`. Cloudflare Workers Static
Assets sirve el build junto al Worker y tiene headers propios; esos headers/CDN no sustituyen
ni autorizan la caché Cache Storage del navegador.

**Alternatives considered**: guardar catálogo `stale-while-revalidate` contradice Q1, puede
presentar stock/precios obsoletos y amplía datos; cachear toda navegación puede persistir
contenido personalizado; mantener la tienda solo online evita el aviso offline aprobado.
Una estrategia artesanal sin herramienta de build evita una dependencia, pero requiere
generación/limpieza de lista hash y controles de ciclo de vida propios. Workbox/Vite plugin
se recomienda como dependencia de desarrollo acotada, sin coste de proveedor ni paquete en
runtime; aún debe fijarse/revisarse en Tasks.

**Sources**:
- [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Cloudflare headers de Static Assets](https://developers.cloudflare.com/workers/static-assets/headers/)
- [MDN: Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)
- [vite-plugin-pwa: estrategia injectManifest](https://github.com/vite-pwa/vite-plugin-pwa/blob/main/docs/guide/inject-manifest.md)
- [Workbox: generar e inyectar precache](https://developer.chrome.com/docs/workbox/modules/workbox-build/)

## R-04 — Activación de versiones sin interrumpir clientes

**Decision**: usar el comportamiento de espera del ciclo nativo de Service Worker; no
configurar actualización automática que salte espera, no llamar `skipWaiting()` o
`clients.claim()`. Versionar la caché propia y retirar la anterior cuando se activa la nueva.

**Rationale**: un SW instalado espera al cierre de sus clientes controlados antes de
activar por defecto; al cerrar todas las ventanas, queda apto para controlar el siguiente
lanzamiento. Activación inmediata puede hacer que recursos viejos sean servidos por código
nuevo o alterar una operación en progreso. Las versiones del catálogo/checkout continúan
siendo autoritativas en D1 y no se reenvía ninguna compra.

**Alternatives considered**: `skipWaiting`/`clients.claim` y recarga automática aceleran la
actualización pero incumplen Q3; prompt de actualización voluntaria añade UX no necesaria
cuando Q3 ya define cuándo se instala la versión. El navegador determina el momento de
descargar/detectar una revisión; no se promete actualización instantánea.

**Sources**:
- [MDN: ciclo de vida y Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)
- [web.dev: actualizaciones PWA](https://web.dev/learn/pwa/update)
- [MDN: `skipWaiting()`](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting)

## R-05 — Diferencias de instalación y evidencia

**Decision**: aceptar como matriz obligatoria la definida en Clarify: Chrome en Android;
Chrome y Edge en Windows; tablets Android/Windows dentro de la cobertura física disponible.
Registrar instalación desde navegador, acceso creado por el sistema, relanzamiento y
ventana standalone. iPadOS se documenta como prueba adicional solo si hay dispositivo.

**Rationale**: Android Chrome puede ofrecer una integración de instalación distinta de
otros navegadores Android; Edge integra la PWA instalada en Windows. La manifest no obliga
a cada navegador/sistema a ofrecer el mismo botón o proceso. La emulación responsive mide
layout, no instalación del OS. `matchMedia('(display-mode: standalone)')` es una señal de
modo, pero MDN advierte que no identifica por sí sola si se instaló.

**Alternatives considered**: afirmar soporte basado solo en Lighthouse/DevTools o emulación
no acredita instalación real; exigir iPadOS obligaría a otra matriz y contradice Clarify.

**Sources**:
- [Microsoft Edge: UX e instalación de PWA](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/ux)
- [Microsoft Edge: manifest y diferencias de plataforma](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps-chromium/webappmanifests)
- [MDN: standalone y límites de `display-mode`](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Create_a_standalone_app)

## Resultado de investigación

No quedan decisiones técnicas desconocidas que impidan completar Plan. La falta de equipos
físicos compatibles sigue siendo una incógnita de ejecución/aceptación, no de diseño; debe
quedar pendiente con evidencia explícita en vez de reemplazarse por emulación. El cambio de
origen, la instalación productiva y cualquier ajuste de requisitos requieren una decisión
SDD posterior. No se ha usado ni verificado un recurso remoto durante esta investigación.
