# Contrato UI y transporte

GET `/api/cart`, PUT `/api/cart/items/:id` con `{quantity,cartVersion}` y DELETE con
`{cartVersion}` permanecen sin cambios. Servidor valida sesión, CSRF, stock, precio y CAS.

El cliente expone add(product), adjust(product_id,delta), quantity(product_id,n),
refreshCart() y estado cart/pending/error/needsSync. Métodos retornan promesas de
confirmación mientras la representación cambia antes de esperar. Solo una mutación
remota por carrito; una lectura de inicio/refresh/error puede ser necesaria.

Respuesta confirmada reemplaza base y reaplica intenciones pendientes. GET obsoleto o
respuesta de otra generación no sustituye estado nuevo. Price/stock de servidor prevalecen.
Refresh/flush esperan escrituras; errores no confirmados impiden checkout hasta revisión.

Header: contador proyectado y data-cart-pending para observación de confirmación.
CartPage: botones habilitados durante guardado salvo límites, aviso accesible de guardado
y error/reintento. Checkout: revisión/confirmación protegidas y quote invalidada al editar.
No endpoint para privilegios, pagos nuevos ni cambios de credenciales.
