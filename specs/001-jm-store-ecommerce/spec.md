# Feature Specification: JM-STORE Ecommerce MVP

**Feature Branch**: `001-jm-store-ecommerce`

**Created**: 2026-11-03

**Status**: Draft

**Input**: User description: Crear JM-STORE, una tienda electrónica completa para el examen con recorrido desde registro del cliente hasta administración y confirmación de pedido, basada visualmente en la referencia adjunta.

## Clarifications

### Session 2026-11-03

- Q: ¿Cómo quieres que funcione el pago simulado durante la demostración? → A: El cliente elige aprobar o rechazar un pago simulado; el sistema registra el resultado sin cobrar dinero real.
- Q: Si el cliente rechaza el pago simulado, ¿qué debe pasar con el pedido y el inventario? → A: Registrar el pedido con pago rechazado, no descontar stock y permitir otro intento.
- Q: ¿Cómo debe habilitarse la cuenta de administrador para la demostración? → A: Provisionar de forma segura una cuenta administrativa inicial; el registro público solo crea cuentas de cliente.
- Q: Cuando el cliente aprueba el pago simulado, ¿el sistema debe confirmar el pedido y descontar el stock en ese mismo paso? → A: Sí; la aprobación simulada confirma el pedido y descuenta stock de forma consistente en la misma operación.
- Q: Para llegar a la demostración de hoy antes de las 5:30 p. m., ¿qué alcance debe tener el MVP? → A: Completar catálogo, cuenta de cliente, carrito, checkout con pago simulado, pedidos y panel administrativo básico; dejar integraciones externas para después.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Descubrir y elegir productos (Priority: P1)

Como visitante, quiero explorar productos por categoría, buscarlos y filtrarlos, revisar sus fotografías y precios, y conocer promociones vigentes para decidir qué comprar.

**Why this priority**: Sin un catálogo confiable no se puede demostrar el valor principal de la tienda ni iniciar una compra.

**Independent Test**: Con productos y categorías de demostración cargados, un visitante puede abrir la portada, navegar una categoría, buscar un término, aplicar filtros y abrir un producto.

**Acceptance Scenarios**:

1. **Given** productos activos disponibles, **When** el visitante abre la tienda, **Then** ve productos, categorías, fotografías y precios en S/ con navegación visible hacia búsqueda y carrito.
2. **Given** productos de distintas categorías y precios, **When** el visitante busca texto y aplica filtros disponibles, **Then** ve solamente productos que cumplen la búsqueda y los filtros, o un estado vacío claro si no hay coincidencias.
3. **Given** un producto con promoción configurada y vigente, **When** el visitante abre su detalle, **Then** ve el precio y las condiciones configuradas; si no hay promoción vigente, no se muestra una afirmación de descuento.
4. **Given** un producto sin fotografía disponible, **When** aparece en una tarjeta o detalle, **Then** se presenta un recurso visual neutral sin atribuirlo a una marca o producto distinto.

---

### User Story 2 - Registrarse y mantener una cuenta (Priority: P1)

Como cliente, quiero crear una cuenta e iniciar sesión para administrar mis datos y direcciones y consultar mis pedidos.

**Why this priority**: La compra debe quedar vinculada a un cliente autenticado para demostrar perfil e historial persistente.

**Independent Test**: Una persona registra una cuenta, inicia sesión, agrega o modifica una dirección, cierra sesión y vuelve a ingresar para comprobar que sus datos persisten.

**Acceptance Scenarios**:

1. **Given** un correo no registrado y datos válidos, **When** la persona envía el registro, **Then** obtiene una cuenta y puede iniciar sesión.
2. **Given** un correo ya utilizado o datos inválidos, **When** se intenta registrar, **Then** se informa el error sin duplicar una cuenta ni revelar información sensible.
3. **Given** credenciales válidas, **When** el cliente inicia sesión, **Then** accede a su perfil, sus direcciones y sus pedidos; con credenciales inválidas permanece sin autenticar y recibe un mensaje seguro.
4. **Given** un cliente autenticado, **When** intenta ver o modificar datos de otro cliente, **Then** la acción se rechaza y los datos ajenos no se revelan.

---

### User Story 3 - Completar una compra y consultar el pedido (Priority: P1)

Como cliente autenticado, quiero administrar el carrito, confirmar los productos y dirección, y registrar el pedido para tener constancia de mi compra y su estado.

**Why this priority**: El registro real de un pedido y su posterior consulta representan el recorrido central que debe demostrarse en el examen.

**Independent Test**: Un cliente con productos en stock añade artículos, cambia cantidades, confirma dirección y resumen, registra un pedido y lo consulta desde su cuenta.

**Acceptance Scenarios**:

1. **Given** un producto activo con stock, **When** el cliente lo agrega al carrito o ajusta su cantidad, **Then** el carrito refleja las cantidades disponibles y un total en S/ calculado con precios vigentes.
2. **Given** un carrito no vacío y una dirección válida, **When** el cliente revisa el resumen y elige aprobar el pago simulado, **Then** se registra el pedido como confirmado con cliente, dirección de entrega, artículos, precios unitarios y total, y se actualiza el inventario de forma consistente.
3. **Given** un carrito vacío, una dirección incompleta, o stock insuficiente, **When** el cliente intenta confirmar, **Then** el pedido no se registra y se indica qué debe corregir.
4. **Given** que el precio o stock cambió antes de la confirmación, **When** el cliente confirma, **Then** se le presenta el resumen actualizado y debe confirmarlo antes del registro.
5. **Given** un pedido registrado, **When** el cliente abre su historial o detalle, **Then** ve el número identificador, fecha, artículos, total, dirección registrada y estado vigente.
6. **Given** un resumen vigente y válido, **When** el cliente elige rechazar el pago simulado, **Then** se registra el pedido pendiente de pago y el intento rechazado, sin descontar stock ni afirmar un cobro real.
7. **Given** un pedido con pago rechazado que sigue siendo válido, **When** su titular revisa el resumen y aprueba un nuevo intento simulado, **Then** se confirma el mismo pedido y se descuenta stock una sola vez, conservando los intentos anteriores.

---

### User Story 4 - Administrar catálogo y operación (Priority: P1)

Como administrador autorizado, quiero gestionar productos, categorías, imágenes, precios, inventario, clientes y pedidos para mantener la tienda y procesar las compras.

**Why this priority**: El examen requiere demostrar administración de la operación conectada a los mismos datos que usa la tienda.

**Independent Test**: Un administrador inicia sesión, crea y actualiza un producto y categoría, ajusta stock, consulta un cliente y cambia el estado de un pedido; los cambios se reflejan en la tienda o en la consulta del pedido.

**Acceptance Scenarios**:

1. **Given** una sesión de administrador autorizada, **When** crea o modifica un producto con campos válidos, **Then** los cambios quedan guardados y el producto se refleja según su estado de publicación.
2. **Given** campos requeridos ausentes, precio inválido o stock negativo, **When** se intenta guardar un producto, **Then** la acción se rechaza con errores de campo y los datos anteriores permanecen intactos.
3. **Given** una sesión de cliente o visitante, **When** intenta acceder a una operación administrativa, **Then** el acceso se deniega.
4. **Given** pedidos existentes, **When** el administrador cambia un estado permitido, **Then** el nuevo estado queda registrado y el cliente ve el estado actualizado.
5. **Given** una categoría o producto asociado a pedidos históricos, **When** se intenta eliminarlo, **Then** se preserva la integridad del historial y se ofrece una alternativa segura, como desactivación.

---

### User Story 5 - Usar la tienda con comodidad en distintos dispositivos (Priority: P2)

Como visitante o cliente, quiero una interfaz adaptable, accesible y personalizable para comprar cómodamente en distintos tamaños de pantalla y con tema claro u oscuro.

**Why this priority**: La referencia visual y la experiencia pulida son importantes para la demostración, manteniendo el recorrido disponible para distintos usuarios.

**Independent Test**: Recorre las funciones públicas y de cuenta en anchos móvil y escritorio, usa navegación por teclado, cambia el tema y activa la preferencia de movimiento reducido.

**Acceptance Scenarios**:

1. **Given** un viewport móvil o de escritorio, **When** el usuario navega por portada, catálogo, carrito y perfil, **Then** el contenido se adapta sin pérdida de funciones ni desplazamiento horizontal injustificado.
2. **Given** el tema claro u oscuro seleccionado, **When** se navega entre páginas, **Then** la preferencia se conserva durante la sesión y textos, controles e imágenes siguen siendo legibles.
3. **Given** navegación por teclado o preferencia de movimiento reducido, **When** se recorren controles y animaciones, **Then** el foco es visible, los controles son operables y se reducen los movimientos no esenciales.

### Edge Cases

- Una búsqueda sin texto no aplica filtros por término; espacios en blanco se tratan como búsqueda vacía.
- Búsquedas sin coincidencias y categorías vacías presentan un estado vacío informativo y permiten volver al catálogo.
- Si un artículo queda inactivo o sin stock mientras está en el carrito, no puede confirmarse; el usuario recibe el estado actualizado.
- Si dos clientes intentan comprar las últimas unidades, solo se registran pedidos compatibles con el stock disponible; la otra confirmación falla de manera comprensible.
- Repetir una confirmación por doble clic o reintento no debe duplicar un pedido inadvertidamente. Un rechazo del pago simulado deja el pedido pendiente de pago con resultado de pago rechazado, no descuenta inventario y permite un nuevo intento; una aprobación confirma el pedido y descuenta inventario de forma consistente.
- Cambios de precio, promoción, stock o estado entre agregar al carrito y confirmar deben mostrarse antes de crear el pedido.
- Si una imagen no carga o su dirección no es válida, se conserva la tarjeta y se muestra un reemplazo visual neutral.
- El total de una compra se redondea de forma consistente a dos decimales en S/ y se calcula con los precios vigentes confirmados.
- Un error de persistencia durante el registro no debe mostrar una confirmación de compra ni dejar un pedido parcial o un descuento de stock sin pedido.
- Las acciones administrativas no autorizadas, estados de pedido no permitidos y datos malformados se rechazan sin alterar datos.
- Una cuenta desactivada o una sesión vencida no permite confirmar compras ni acceder a datos privados hasta autenticarse nuevamente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La tienda MUST mostrar una portada con navegación a categorías, búsqueda, acceso al carrito y productos destacados existentes en el catálogo.
- **FR-002**: Los visitantes MUST poder explorar categorías y buscar productos por nombre o descripción, con filtros disponibles por categoría, rango de precio y disponibilidad.
- **FR-003**: La tienda MUST mostrar detalle de producto con nombre, descripción, fotografías, categoría, precio en S/ y disponibilidad; toda promoción mostrada MUST estar configurada, vigente y sujeta a condiciones visibles.
- **FR-004**: La tienda MUST permitir agregar productos disponibles al carrito, quitar artículos, cambiar cantidades y ver subtotales y total en S/.
- **FR-005**: El carrito MUST persistir para el cliente autenticado entre sesiones; para visitantes, su duración se limita a la sesión de navegación y no implica reserva de stock.
- **FR-006**: La aplicación MUST permitir registro e inicio y cierre de sesión de clientes, con validación de campos, unicidad de cuenta y mensajes que no expongan datos sensibles.
- **FR-007**: El cliente autenticado MUST poder consultar y editar sus datos de perfil y crear, editar y seleccionar direcciones de entrega.
- **FR-008**: La aplicación MUST restringir datos y operaciones de cliente a su titular y operaciones de gestión a usuarios con rol de administrador. El registro público MUST crear únicamente cuentas de cliente; una cuenta administrativa inicial MUST ser provisionada de forma segura y no debe originarse mediante el registro público.
- **FR-009**: El checkout MUST requerir autenticación, un carrito no vacío, una dirección válida y una revisión del resumen vigente antes de permitir el registro.
- **FR-010**: Al confirmar la compra, la aplicación MUST registrar el pedido y sus artículos con precio unitario, cantidad, total, cliente, dirección de entrega como constaba al comprar, fecha, estado de pago simulado y estado de pedido; el pedido y la actualización de stock MUST quedar consistentes o fallar juntos. El cliente MUST elegir aprobar o rechazar el pago simulado y la aplicación MUST indicar que no hay cobro real. Solo un pago simulado aprobado confirma el pedido y descuenta stock de forma consistente en la misma operación; el rechazo se registra sin descuento y permite reintentar el pago.
- **FR-011**: La aplicación MUST prevenir la compra por encima del stock vigente y solicitar nueva confirmación cuando haya cambiado el precio o cualquier dato material del resumen.
- **FR-012**: El cliente MUST poder consultar el historial y detalle de sus pedidos con su estado actual, resultado de pago simulado y totales en S/, y reintentar un pago rechazado mientras el pedido siga siendo válido.
- **FR-013**: Un administrador autorizado MUST poder crear, consultar, editar, publicar, desactivar y organizar productos y categorías, incluyendo imágenes, descripciones, precios y promociones configurables.
- **FR-014**: Un administrador autorizado MUST poder consultar clientes y mantener inventario mediante ajustes de stock no negativos, con resultado persistente.
- **FR-015**: Un administrador autorizado MUST poder consultar pedidos y cambiar su estado únicamente entre transiciones permitidas; el cliente asociado MUST ver el estado actualizado. El estado del pago simulado MUST conservar por separado el resultado elegido por el cliente; los pedidos con pago rechazado no descuentan stock y permiten reintentar mientras sigan siendo válidos.
- **FR-016**: La aplicación MUST conservar la integridad de los pedidos históricos ante desactivación de productos, categorías, clientes o direcciones ya referenciados.
- **FR-017**: Todos los importes MUST expresarse en soles peruanos (S/), con dos decimales y cálculo consistente de subtotales y totales a partir de datos confiables.
- **FR-018**: La interfaz MUST ser responsive y ofrecer tema claro y oscuro, navegación por teclado, etiquetas comprensibles, foco visible, contraste legible y respeto a la preferencia de movimiento reducido.
- **FR-019**: Las animaciones y carruseles MUST permitir el uso de sus controles de navegación y no impedir acceso al contenido mediante teclado o tecnologías de asistencia.
- **FR-020**: La aplicación MUST ofrecer datos de demostración identificables como tales y fotografías propias, neutrales o con derechos adecuados; MUST NOT inventar marcas, calificaciones, promociones, cuotas, ventajas o condiciones de envío.
- **FR-021**: Los formularios de cliente, dirección, catálogo, inventario y compra MUST validar campos requeridos, formatos, límites y reglas de negocio, e identificar errores sin perder datos válidos ya ingresados cuando sea posible.
- **FR-022**: Las respuestas de éxito MUST ocurrir solo después de que los cambios relevantes hayan quedado persistidos; errores de guardado MUST ser comunicados sin afirmar éxito.
- **FR-023**: Los estados de producto, promoción, inventario y pedido MUST compartir una única fuente de datos persistente entre tienda, carrito y panel administrativo.
- **FR-024**: El recorrido de registro, inicio de sesión, selección de producto, carrito, checkout, registro de pedido, consulta del cliente y gestión administrativa MUST poder verificarse mediante pruebas funcionales y criterios de aceptación reproducibles.

### Key Entities *(include if feature involves data)*

- **Cliente**: Cuenta de comprador, datos de perfil, estado y relación con direcciones, carrito e historial de pedidos.
- **Administrador**: Cuenta con rol autorizado para mantener catálogo, inventario, clientes y pedidos.
- **Categoría**: Grupo navegable de productos, con nombre y estado de publicación.
- **Producto**: Artículo comercial con descripción, imágenes, precio vigente, estado, categoría e inventario disponible.
- **Promoción**: Regla comercial configurable con vigencia, producto o categoría aplicable, precio o descuento y condiciones visibles.
- **Carrito**: Selección vigente de un cliente o visitante, compuesta por productos y cantidades; no reserva inventario.
- **Dirección**: Datos de destino asociados a un cliente y seleccionables para una compra.
- **Pedido**: Registro de una compra con cliente, dirección capturada, fecha, estado del pedido, estado del pago simulado, moneda y total; puede tener intentos de pago simulados asociados.
- **Detalle de pedido**: Línea histórica con producto asociado, descripción identificable, precio unitario y cantidad al momento de compra.
- **Movimiento de inventario**: Cambio trazable de existencias por ajuste administrativo o compra, asociado a su causa.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En una prueba guiada, al menos 9 de cada 10 participantes completan registro, selección de producto, carrito y confirmación de pedido sin ayuda externa.
- **SC-002**: Un cliente puede completar un pedido de demostración en menos de 4 minutos desde una cuenta ya iniciada, incluyendo la revisión del resumen.
- **SC-003**: El 100% de los pedidos de prueba muestra el mismo total y estados de pedido y pago simulado en confirmación, detalle e historial, y conserva cliente, artículos y precios tras cerrar y volver a abrir la aplicación.
- **SC-004**: En todas las pruebas de compra con stock insuficiente, doble confirmación o fallo durante el registro, no se crea pedido inválido ni se altera parcialmente el inventario; el rechazo de pago no descuenta existencias.
- **SC-005**: El 100% de las operaciones administrativas probadas se deniega para visitante o cliente sin rol administrador y se completa para administrador autorizado con datos válidos.
- **SC-006**: Las tareas críticas de catálogo, cuenta, carrito y pedido se pueden completar en viewport móvil de 360 px y escritorio de 1280 px sin pérdida de controles ni desplazamiento horizontal de la página.
- **SC-007**: El 100% de los precios y totales visibles usa la moneda S/ y corresponde al valor vigente mostrado al cliente antes de confirmar.
- **SC-008**: En una revisión del catálogo de demostración no hay afirmaciones de promoción, descuentos, cuotas, envíos, calificaciones o marcas sin respaldo de datos configurados y verificables.

## Assumptions

- El MVP es una tienda de demostración para un examen antes de las 5:30 p. m.; prioriza catálogo, cuenta de cliente, carrito, checkout con pago simulado, pedidos y panel administrativo básico. Integraciones externas y funciones no necesarias para demostrar este recorrido quedan fuera del MVP.
- El pago usa una simulación explícita elegida por el cliente: aprobar o rechazar. El sistema registra el resultado simulado, sin capturar ni transferir dinero real. Un rechazo deja el pedido registrado con pago rechazado, conserva el inventario y permite un nuevo intento sobre el pedido.
- La entrega se limita a capturar y mostrar la dirección seleccionada; no se promete tarifa, cobertura ni plazo de envío sin datos configurados.
- Las cuentas se crean mediante correo y contraseña. El restablecimiento de contraseña por correo y el inicio de sesión con proveedores externos quedan fuera del MVP salvo nueva especificación.
- Se necesita una cuenta administrativa inicial provisionada de forma segura para mostrar el panel; el registro público solo crea cuentas de cliente y las credenciales administrativas no se incluirán en el repositorio ni en la especificación pública.
- Los datos y fotografías de demostración estarán claramente identificados y usarán nombres genéricos o materiales con derechos adecuados.
- Las promociones permiten exhibir reglas configuradas, pero solo cuando sus condiciones y vigencia estén disponibles para el cliente.
- La interfaz puede retener el carrito persistido de un cliente autenticado; no se garantiza la fusión automática con un carrito de visitante al iniciar sesión.
- No se requiere conexión con pasarela de pagos, transportista, facturación electrónica ni servicio externo de identidad para demostrar el MVP.






