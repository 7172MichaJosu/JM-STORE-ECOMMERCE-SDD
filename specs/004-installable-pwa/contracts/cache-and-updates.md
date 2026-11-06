# Contrato de caché, offline y actualización

## Política de solicitudes

| Solicitud | Comportamiento en red | Cache Storage PWA |
|---|---|---|
| Navegación/documento HTML (incluido index y rutas SPA) | Network-only; en fallo responde `/offline.html` estático | El documento de navegación nunca se guarda |
| Bundle local fingerprinted JS/CSS del allowlist de build | Precache en instalación/update | Guardado con nombre hash/versión |
| Iconos JM y `/offline.html` | Precache público y same-origin | Guardado por versión |
| `images/demo/**`, fotos/categorías/catálogo | Red solo | Nunca cachear |
| Todo `/api/**`, incluyendo GETs | Network-only; respetar status y `Cache-Control: no-store` | Nunca cachear ni hacer fallback de contenido |
| Requests con Authorization/cookie/sesión, formularios y escrituras | Red-only | Nunca guardar request/response/cuerpo |
| Terceros, externo u origen distinto | Navegación normal de navegador | Nunca incorporar al precache |

La allowlist se genera a partir de archivos locales de build; se limita a JS/CSS fingerprinted,
iconografía y aviso offline. Cualquier solicitud que no coincide sigue a red. La lista nunca
se deriva de URL de usuario, parámetros, respuesta API o respuesta personalizada. Fallos de
almacenamiento de navegador degradan a uso online normal sin falsear persistencia.

## Interfaz offline

- Con conexión, ruta interna se resuelve como hoy mediante Cloudflare Static Assets.
- Sin conexión, una navegación fallida muestra aviso claro “Sin conexión”; solo ofrece
  reintentar cuando vuelve la red.
- No muestra catálogo/datos guardados, saldo, stock, precios actuales, auth ni pedido/compra.
- API no disponible nunca se convierte en éxito simulado; compras, cambios de cuenta y stock
  requieren respuesta confirmada del servidor.
- El aviso y recursos de UI son públicos, mismos origin, no contienen datos o estado privado.

## Ciclo de vida y Q3

1. La actualización descarga una nueva versión identificada del SW y prepara su allowlist.
2. La versión activa continúa controlando pestañas/ventanas abiertas.
3. El nuevo SW espera el cierre de todas las ventanas de JM-STORE. No usar `skipWaiting()`,
   `clients.claim()` ni llamadas `location.reload()` para activar la versión.
4. Tras cerrar todos los clientes, el navegador puede activar el worker en espera; al abrir
   JM-STORE de nuevo, se carga la versión nueva. La detección/descarga depende del navegador;
   no prometer disponibilidad instantánea.
5. Solo durante activación el código elimina caches obsoletas con prefijo exacto de JM-STORE.
   No borrar otras caches del mismo origin ni datos del navegador.

Validar con dos ventanas abiertas: una debe seguir sin cambio; al cerrar todas y abrir,
la nueva versión aparece sin perder una operación ni reemitir solicitudes de checkout.

## Seguridad y headers

Mantener `Cache-Control: no-store` en APIs, rutas de seguridad y autenticación; conservar
CSP, Referrer-Policy y `nosniff`. Cache Storage es una segunda barrera, no motivo para
modificar headers. El `service-worker.js` y manifest deben servirse same-origin con MIME
correcto y política que permita el registro; confirmar que CSP existente no lo bloquea.
La caché de borde de Cloudflare Static Assets es distinta de Cache Storage y no autoriza
cachear respuestas personales. Ningún secreto, cookie, UID/claim, email o código de acción
se serializa a recursos estáticos.
