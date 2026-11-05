# Contrato UI: continuidad visual y seguridad

Mantener el cliente y [contrato visual001](../../001-jm-store-ecommerce/contracts/ui.md).
La referencia JM-STORE sigue siendo principal: amarillo, azul eléctrico, blanco,
header/buscador, categorías, banners, cards, mini carrito, navegación, temas y animaciones.
No rediseñar el sitio por cambiar de hosting o proveedor de identidad. Formularios React
actuales conservan marca y flujo; Worker delega correo/password a Firebase REST, sin
pantalla FirebaseUI, botones sociales ni persistencia de tokens del SDK en el navegador.
No se devuelve un ID/refresh token a componentes o almacenamiento del cliente. No añadir descuentos, valoraciones, cuotas
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
- Mostrar correo actual y dos formularios separados: «Cambiar correo» y «Cambiar
  contraseña», cada uno con contraseña actual y submit propios. No enviar ambos tipos
  juntos. Mientras haya verificación pendiente, mostrar destino/expiry/estado solo al
  administrador y bloquear otro cambio hasta completar o cancelar; nunca prellenar
  passwords. Tras completar cada cambio se exige nuevo login.
- Correo aceptado muestra «Solicitud de cambio recibida. Revisa el correo nuevo para
  verificarlo»; no garantiza envío/entrega ni disponibilidad. El correo actual sigue
  visible y operativo hasta confirmar. Ofrecer cancelar con reautenticación y errores
  genéricos, sin revelar si existe una cuenta o reserva ajena.
- `/cuenta/confirmar-correo` abre una página de la misma identidad visual, mínima y sin
  terceros. Extraer código solo a memoria, limpiar URL y no cambiar nada al abrir GET.
  Botón accesible «Confirmar correo» ejecuta POST explícito, incluso en otro navegador
  sin sesión ADMIN original. No mostrar email privado por operationId solo. Confirmado
  y reconciliado: «Correo actualizado. Inicia sesión nuevamente»; limpiar cookie/estado
  privado y navegar a login, sin autenticar automáticamente.
- Expirado/reutilizado/cancelado muestra error seguro y ofrece volver al login/seguridad
  para iniciar solicitud nueva; fallo técnico indica resultado pendiente, nunca que el
  cambio se revirtió. Cancelar localmente no asegura invalidación del enlace Firebase;
  el servidor verifica estado y controla deriva según [Firebase](firebase-auth.md).

- Contraseñas ocultas por defecto, toggle accesible, autocomplete current-password y
  new-password; no prellenar, persistir, imprimir en toasts o adjuntar a telemetría.

## Estados observables

Carga anuncia estado accesible sin mostrar campos falsos; error permite reintento.
Submit deshabilitado mientras está en curso para evitar doble clic. Errores junto al
campo y resumen enfocado; mensajes sobre validación no contienen valores secretos.

La interfaz distingue pendiente, confirmado, cancelado, expirado y reconciliación
requerida; no usa éxito de actualización para un envío OOB. Reserva temporal se aplica
en servidor también al registro; la respuesta genérica no identifica al administrador.
Enviar ambos cambios por cliente manipulado se rechaza antes de cualquier efecto.
No reutilizar el estado ni la contraseña de un formulario para enviar el otro.

Password solo exitoso limpia datos sensibles, estado auth y carrito en memoria; navega
al login administrativo con «Contraseña actualizada. Inicia sesión nuevamente». Firebase
y D1 deben confirmar resultado antes del éxito. Otras sesiones pierden acceso en su
siguiente operación; el servidor impide que JWT viejos reconstruyan sesión.

Resultado remoto incierto muestra «No pudimos confirmar el resultado. Vuelve a iniciar
sesión con las credenciales elegidas» y referencia segura requestId. La cuenta queda
protegida hasta conciliar; no afirmar que la contraseña sigue igual ni que hubo rollback.
Login de reconciliación usa campos actuales y no da acceso a comercio antes de confirmar
estado. Nunca reenviar passwords automáticamente ni conservarlas para reintento.

Sesión vencida solicita login; acceso CUSTOMER denegado;409 pide recargar datos actuales;
429 informa espera;503 o red interrumpida no muestra éxito. Firebase no disponible muestra
mensaje recuperable y no cambia a login local. Error genérico de credenciales no revela
si un correo existe. Rate limit de proveedor se comunica sin sugerir upgrade de plan. Una respuesta de resultado
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
