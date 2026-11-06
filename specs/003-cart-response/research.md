# Research: respuesta del carrito

## Diagnóstico previo

Providers.add realiza GET/cart, llama quantity que vuelve a hacer GET/cart y finalmente
PUT. Cada quantity/remove hace GET+write. CartPage mantiene busy global hasta respuesta.
El diagnóstico definitivo observó p95 visual 4.685,7 ms en escritorio/4.551,4 ms móvil;
su conteo excluye el GET inicial aún descargándose de la observación preliminar.
La demora visual está ligada a la red; el contador cambia después de la escritura.

## Decisión

Controlador de intenciones y snapshot inmutable suscrito por React; mantener CAS remoto
y una sola escritura en vuelo. React documenta la obligación de caché/estabilidad del
snapshot y las suscripciones para useSyncExternalStore. No actualizar React ni añadir
biblioteca. Alternativa descartada: solo eliminar un GET reduce tiempo pero la interfaz
continúa esperando la conexión. Un estado optimista sin cola permite respuestas fuera
de orden y pierde clics; tampoco resuelve resultados inciertos de una escritura.

Medir click→frame visible y click→confirmación por separado, y HTTP desde request hasta
requestfinished (cuerpo descargado). Playwright distingue respuesta/cabeceras de fin de
descarga. Es HTTP extremo a extremo, no CPU ni tiempo exclusivo de base de datos.

Fuentes: [React useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore),
[Playwright Request](https://playwright.dev/docs/api/class-request#request-timing).
## Adenda de diagnóstico de registro

El registro pasa por sessionMiddleware antes del rate limit y del proveedor Firebase.
Con cookie de visitante se hace SELECT de sesión y un UPDATE `last_seen_at` que no
participa en su expiración ni en la guarda de mutaciones anónimas. La sesión se
reemplaza tras registrar al usuario. Se puede eliminar ese UPDATE conservando todas
las reglas existentes. Se verificarán por pruebas las diferencias de acceso D1 y por
tail el efecto real; no se atribuye el pico completo a ese UPDATE sin medición.
