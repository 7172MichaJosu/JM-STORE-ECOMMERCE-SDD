# Modelo de estado del carrito

Sin cambios D1. Se conservan carts.version, cart_items UNIQUE(cart_id,product_id), límites
de 100 líneas y cantidades 1..99, precios en céntimos y CAS en API.

- **ConfirmedCart**: respuesta íntegra del servicio: cartId/version/items/totales/issues/PEN.
- **Intent**: ID local, product_id, delta o cantidad absoluta (0 elimina), imagen/precio/stock
  conocidos para representar una línea nueva, callbacks de resultado y contador de retry.
- **SessionGeneration**: contador monotónico en memoria; reset invalida respuestas anteriores.
- **Snapshot**: carrito proyectado, pending, error y needsSync. Referencia estable hasta
  cambio; nunca se considera la versión provisional una nueva versión del servidor.

Transiciones: desconocido→carga→confirmado; enqueue→provisional→write→confirmado+rebase;
error→rollback→reconciliación→revisión/reintento; reset→desconocido en nueva generación.
Un resultado incierto no se convierte en nuevo intento automático de incremento.
