# Diagnóstico de instalación — Specify, 2026-11-06

## Resultado y alcance

La aplicación publicada carece de un manifest enlazado y de íconos declarados para
instalación. Es un impedimento estructural para ofrecer la PWA prevista. No es un
problema de HTTPS en la muestra observada. No se reprodujo el mensaje literal
«No se puede instalar esta app» en el Chrome personal del usuario; todavía pueden
intervenir políticas del equipo, perfil, instalación previa o diferencias de versión.

Esta inspección fue de lectura: no hubo instalación, login, cambio de configuración,
despliegue, migración ni activación de servicios. Las peticiones de la página hacia
`/api/**` se bloquearon en el navegador de diagnóstico para no crear sesiones ni
escribir en D1. No se usaron cuentas reales ni se leyeron secretos.

## Evidencia local y publicada

Inspección con Chromium headless 156.0.8078.4 el **2026-11-06T15:09:02.861Z**, mediante
Playwright existente y las consultas de diagnóstico de manifest de DevTools.
Origen: https://jm-store-ecommerce-sdd-staging.josue-hinostroza-27.workers.dev

| Comprobación | Resultado observado |
|---|---|
| Documento principal | HTTP 200 sobre HTTPS |
| Contexto seguro | true |
| Enlaces de manifest | 0 |
| Manifest detectado por DevTools | URL vacía, sin contenido |
| Enlaces de íconos en el documento | 0 |
| Service Workers registrados en perfil nuevo | 0 |
| Color de tema | `#ffe600` |
| Ventana standalone | false; se abrió como página normal |
| Errores de instalación devueltos por DevTools headless | Lista vacía; no acredita instalación |

En `client/index.html` existe color de tema pero no enlace de manifest ni ícono.
La búsqueda en `client/` no encontró manifest, registro de Service Worker o promoción
de instalación. `client/src/components/Header.jsx` dibuja una bolsa y texto JM-STORE;
no existe un archivo dedicado de ícono de instalación encontrado en los activos públicos.

La cabecera de seguridad permite recursos del propio origen. Esta observación no
demuestra que deban relajarse protecciones. Las respuestas de API tienen `no-store`;
la ruta de confirmación de correo también se protege contra almacenamiento. Esas
restricciones deben preservarse en el trabajo posterior. No se evaluó caché privada
real: aún no existe un Service Worker de esta aplicación en el perfil inspeccionado.

## Interpretación contrastada con documentación

Chrome documenta metadatos de identidad, inicio, presentación e íconos adecuados
(incluidos tamaños 192 y 512) para promover la instalación. También intervienen
compatibilidad y heurísticas de interacción. Los faltantes observados justifican
especificar una identidad instalable completa; no garantizan que corregirlos elimine
todo bloqueo de cualquier equipo. [Criterios oficiales de Chrome](https://web.dev/articles/install-criteria).

No se debe atribuir el fallo exclusivamente a no tener Service Worker: Chrome
documentó la eliminación del requisito de un manejador fetch para instalación desde
menú desde Android 108/escritorio 112. El soporte offline sigue mereciendo una decisión
propia y pruebas. No añadir un manejador vacío solo para aparentar conformidad.
[Cambios de criterios de Chrome](https://developer.chrome.com/blog/update-install-criteria).

Manifest y ejecución standalone también forman parte de la experiencia instalable
descrita por Microsoft. La instalación desde el sistema operativo y el menú del
navegador requieren evidencia real; emular una pantalla no equivale a instalar.
[Documentación de Microsoft Edge](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/).

Las consultas `Page.getAppManifest` y `Page.getInstallabilityErrors` son señales de
diagnóstico. Aquí, un arreglo de errores vacío convive con la ausencia total de manifest;
no se interpreta como PASS. [Protocolo DevTools](https://chromedevtools.github.io/devtools-protocol/tot/Page/).

## Lo que queda por comprobar en fases posteriores

Reproducción del mensaje en el Chrome y perfil concretos del usuario; disponibilidad
de equipos Android/Windows/tablet; manifest e íconos definitivos; instalación real,
reapertura y standalone; caché/privacidad, navegación offline, actualización y regreso
a versión funcional; regresiones de cuenta/ADMIN/carrito/checkout y consumo gratuito.

No se ejecutaron pruebas de aceptación de una PWA ni se declaró corregida la instalación.
El diagnóstico informa Specify; no constituye Plan ni una implementación.
