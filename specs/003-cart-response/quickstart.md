# Validación reproducible

1. Baseline publicado: `node cloud/scripts/cart-feedback.js` (antes de publicar la UI).
   Usa clientes sintéticos, solo carrito; no compra ni modifica inventario.
2. Controlador: `node --test client/tests/cart-controller.test.js`.
3. Regresión: suites locales habituales; E2E nuevos también contra Worker/D1 sintéticos.
4. Tras backup verificado y publicación exclusiva de staging:
   `node cloud/scripts/cart-feedback.js --after` con el mismo protocolo/producto disponible.
5. Revisar `cloud/private/cart-feedback-before.json` y `cart-feedback-after.json`: 3
   repeticiones de 4 acciones por cada viewport, p95 visual <=100 ms, persistencia y
   número/duración HTTP por acción. Datos agregados publicables; no credenciales.

E2E con 1500 ms de demora comprueba respuesta anterior al servidor; otros casos fuerzan
409, 500/red, respuesta perdida tras commit, clics rápidos y sesión nueva. Recargar
comprueba persistencia; checkout no puede avanzar con cambios sin confirmar.

El dispositivo móvil es emulado Chromium a 360 px/touch. No equivale a prueba física.
Los resultados ejecutados y la aceptación pendiente se registran en results.md.

## Resultado actual

Ver [results.md](results.md) y [measurements.json](measurements.json). Las 172 pruebas
locales, los cinco E2E de carrito en staging y las 24 acciones de medición pasaron.
El guardado remoto tarda segundos aunque la UI responde en unos 11 ms de p95.
El registro inicial de 11 ms motivó una pausa y autorización adicional. Tras eliminar
una escritura de visitante redundante, 67 invocaciones midieron máximo 9 ms; registro
4–7 ms. La muestra pasó sin cambiar Free/Spark; no equivale a aceptación de carga global.

Comandos alojados usados (requieren autorización y destino staging verificado):

```powershell
node cloud/scripts/staging-session.js backup
node cloud/scripts/staging-session.js prepare
node cloud/scripts/staging-session.js deploy
node cloud/scripts/staging-tail-cpu.js --cart
node cloud/scripts/hosted-e2e.js --target staging --cart
```

El último comando excluye deliberadamente la compra del catálogo existente. El checkout
de la suite completa solo se ejecuta con las bases efímeras locales del proyecto.
