# Contrato UI: continuidad visual y seguridad

Mantener el cliente y [contrato visual001](../../001-jm-store-ecommerce/contracts/ui.md).
La referencia JM-STORE sigue siendo principal: amarillo, azul eléctrico, blanco,
header/buscador, categorías, banners, cards, mini carrito, navegación, temas y animaciones.
No rediseñar el sitio por cambiar de hosting. No añadir descuentos, valoraciones, cuotas
o condiciones de envío sin datos configurados.

## Rutas y navegación

- Preservar inicio/catálogo/detalle, registro/login, carrito, checkout, perfil/direcciones,
  pedidos/detalle y secciones administrativas. Deep links sobreviven recarga con fallback
  SPA; recursos y rutas API inexistentes conservan sus errores adecuados.
- Añadir grupo administrativo **Mi cuenta → Seguridad**, enlace con nombre accesible a
  `/admin/mi-cuenta/seguridad`. No visible para CUSTOMER ni visitantes; la API protege
  igualmente accesos directos.
- La navegación nueva requiere `capabilities.adminSecurity=true` de la sesión cloud.
  Backend local sin esa capacidad conserva la navegación actual; una visita directa a
  la ruta no soportada usa el estado de página no disponible, sin invocar API inexistente.
- El formulario muestra correo actual, campos nuevo correo, contraseña actual, nueva
  contraseña y confirmación. Permite modificar correo/password independientes o juntos,
  comunica qué campos son obligatorios y verifica password actual en cada guardado.
- Contraseñas ocultas por defecto, toggle accesible, autocomplete current-password y
  new-password; no prellenar, persistir, imprimir en toasts o adjuntar a telemetría.

## Estados observables

Carga anuncia estado accesible sin mostrar campos falsos; error permite reintento.
Submit deshabilitado mientras está en curso para evitar doble clic. Errores junto al
campo y resumen enfocado; mensajes sobre validación no contienen valores secretos.

Correo solo exitoso refresca perfil/email inmediatamente y anuncia confirmación sin
prometer correo de verificación. Password exitoso limpia datos sensibles, estado auth y
carrito de usuario en memoria, y navega al login administrativo con mensaje «Contraseña
actualizada. Inicia sesión nuevamente». Todas las otras sesiones pasan a no autenticadas
en su siguiente operación. Nunca mostrar success antes de confirmar persistencia.

Sesión vencida solicita login; acceso CUSTOMER denegado;409 pide recargar datos actuales;
429 informa espera;503 o red interrumpida no muestra éxito. Una respuesta de resultado
incierto orienta al nuevo login, sin reenviar credenciales automáticamente.

## Accesibilidad y regresión

Labels visibles, inputs de tipo adecuado, foco visible, errores asociados por aria,
anuncios aria-live y uso completo por teclado. Diálogos conservan foco; movimiento
reducido desactiva animación decorativa. Diseño sin overflow de página a360/1280px en
ambos temas; tablas pueden tener su propia región desplazable accesible.

Pruebas futuras: comparación visual con UI existente y recorridos de cliente/admin,
axe WCAG2A/AA/2.1AA en pantallas esenciales, teclado del formulario nuevo, red lenta,
errores, sesiones revocadas y deep links. No se afirma certificación automática ni se
marca como realizada la aceptación humana pendiente de feature001.
