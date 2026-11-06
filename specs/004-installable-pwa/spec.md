# Feature Specification: JM-STORE PWA instalable

**Feature Branch**: `004-installable-pwa` (identificador SDD; rama Git actual `main`, sin cambio de rama).
**Created**: 2026-11-06
**Status**: Clarify completado; listo para Plan cuando el usuario lo solicite.
**Input**: Convertir JM-STORE en una tienda instalable con identidad JM, modo standalone,
seguridad de caché y continuidad del comercio existente, sin activar servicios de pago.

## Clarifications

### Session 2026-11-06

- Q: ¿Qué contenido debe quedar disponible si se abre JM-STORE sin conexión? → A: Guardar solo recursos estáticos de la aplicación y un aviso offline, sin catálogo ni respuestas de API almacenados; las compras requieren conexión.
- Q: ¿Qué combinación de dispositivos debe ser obligatoria para validar la instalación? → A: Chrome en Android y Chrome/Edge en Windows, incluidas tablets Android/Windows; iPadOS será adicional si hay un dispositivo físico disponible.
- Q: ¿Cuándo se debe aplicar una nueva versión instalada? → A: Después de cerrar todas las ventanas de JM-STORE y volver a abrir; sin recarga forzada ni interrupción de operaciones.

## User Scenarios & Testing

### User Story 1 - Instalar y abrir JM-STORE (Priority: P1)

Como comprador quiero instalar JM-STORE desde un navegador compatible y abrirla
mediante su ícono JM, en una ventana propia, para acceder fácilmente a la tienda.

**Why this priority**: Es el objetivo principal; actualmente faltan metadatos de instalación.
**Independent Test**: Con un perfil sin instalación previa, instalar desde el navegador,
cerrar, abrir desde el sistema y verificar nombre, ícono, inicio y navegación.

**Acceptance Scenarios**:

1. **Given** una conexión segura y un navegador compatible, **When** el comprador solicita
   la instalación, **Then** el navegador presenta JM-STORE y su ícono JM sin errores de
   metadatos; la aceptación o cancelación corresponde al usuario.
2. **Given** la aplicación instalada, **When** se abre desde su ícono, **Then** inicia en la
   tienda pública, en modo standalone donde esté soportado, con amarillo, azul, blanco,
   tema claro/oscuro, navegación accesible y sin depender de la API local del desarrollador.
3. **Given** instalación cancelada, ya realizada, navegación privada o navegador sin
   soporte, **When** se visita la tienda, **Then** sigue funcionando como web y cualquier
   ayuda de instalación describe honestamente las opciones disponibles, sin forzar permisos.

### User Story 2 - Comprar con los mismos datos y permisos (Priority: P1)

Como cliente quiero conservar mi cuenta, carrito y pedidos al usar la tienda instalada;
como administrador quiero mantener acceso y controles sin cambios de permisos.

**Why this priority**: Instalar no puede introducir pérdida de datos o un canal de acceso distinto.
**Independent Test**: Usar una cuenta sintética en web y app instalada, modificar el carrito,
recargar, completar una compra simulada y consultar su pedido; verificar permisos ADMIN.

**Acceptance Scenarios**:

1. **Given** el mismo origen y un perfil que comparta sesión según su plataforma, **When**
   se abre la app, **Then** aplica la sesión válida existente; si el sistema usa otro
   contenedor o la sesión venció, exige login normal, sin crear otra cuenta ni copiar tokens.
2. **Given** un cliente autenticado, **When** añade productos, cambia cantidades y compra,
   **Then** persisten en D1 según las reglas actuales, con precios/stock autoritativos,
   confirmación de pedidos y pagos exclusivamente simulados, sin duplicaciones por instalar,
   abrir varias ventanas, reintentar conexión o actualizar la app.
3. **Given** un cliente o visitante, **When** intenta entrar al panel administrativo,
   **Then** se mantienen las restricciones actuales; una cuenta ADMIN sintética conserva
   su acceso autorizado, login, logout y cambio de contraseña habilitado.
4. **Given** logout, revocación o cambio de usuario, **When** otra persona abre la app,
   **Then** no recibe datos de la cuenta anterior a través de contenido guardado por la PWA.

### User Story 3 - Manejar desconexión y versiones nuevas con seguridad (Priority: P1)

Como comprador quiero entender si estoy sin conexión y recibir nuevas versiones sin
perder una compra, un cambio pendiente del carrito o un formulario en edición.

**Why this priority**: Una instalación persistente no debe aparentar una compra exitosa offline.
**Independent Test**: Cortar/restablecer conexión antes y durante edición/checkout; disponer
una versión nueva durante una operación y comprobar que no se repite ni se pierde.

**Acceptance Scenarios**:

1. **Given** pérdida de conexión, **When** se abre o usa la app, **Then** comunica el estado
   y ofrece reintento; no muestra autenticación, stock, pago o pedido ficticiamente confirmados.
   Solo están disponibles recursos estáticos y un aviso offline; no hay catálogo ni respuestas de API almacenados.
2. **Given** una edición con resultado remoto incierto, **When** vuelve la conexión,
   **Then** conserva la reconciliación actual y nunca reenvía compras automáticamente.
3. **Given** una nueva versión y operaciones o formularios pendientes, **When** está lista
   la actualización, **Then** espera a que se cierren todas las ventanas de JM-STORE y se vuelva a abrir; no fuerza recarga ni pierde la operación.
4. **Given** datos sensibles o una respuesta privada, **When** se examinan los recursos
   persistidos por la PWA, **Then** no existen copias de credenciales o respuestas privadas.

### User Story 4 - Usar dispositivos compatibles y recibir ayuda (Priority: P2)

Como usuario de Android, Windows, laptop o tablet quiero instalar cuando sea compatible
y continuar en la web cuando mi entorno no permita hacerlo.

**Why this priority**: El soporte se define por navegador/sistema; no por el tamaño de pantalla.
**Independent Test**: Ejecutar la matriz obligatoria indicada en Clarifications, registrar versiones y distinguir instalación
real, comprobación automatizada, emulación responsive y casos no soportados.

**Acceptance Scenarios**:

1. **Given** Chrome en Android y Chrome/Edge en Windows,
   **When** se instala y relanza la aplicación, **Then** funciona desde el acceso del sistema,
   sin tratar un acceso directo de navegador como prueba suficiente de standalone.
2. **Given** tablets Android/Windows, **When** cambia orientación y navega con tacto o teclado,
   **Then** puede buscar, usar carrito y consultar su cuenta sin desbordamiento horizontal,
   controles ocultos o dependencia de hover. iPadOS es adicional si hay dispositivo físico disponible,
   no un bloqueo de aceptación.

### Edge Cases

- Ícono inaccesible, ilegible, recortado, con dimensiones incorrectas o manifest no válido.
- Recurso esperado como manifest que devuelve HTML o una redirección de login.
- Instalación ya existente, cancelada o bloqueada por política del equipo; evento de
  promoción ausente por heurísticas del navegador. No equivale siempre a una PWA defectuosa.
- Primer inicio offline sin recursos previos; almacenamiento denegado, lleno o evacuado.
- Catálogo/precios/stock que cambian mientras hay desconexión; jamás son confirmación de venta.
- Varias ventanas con versiones diferentes, nueva versión durante checkout o carrito pendiente.
- Sesión caducada/revocada, logout en otra ventana y cambio de cuenta en un equipo compartido.
- Apertura de una ruta privada o enlace de seguridad desde el sistema o una app externa:
  conservar autenticación, no guardar códigos de acción ni datos personales en la caché PWA.
- Desinstalar/reinstalar o borrar datos del dispositivo: no elimina registros D1 ni cuentas;
  no se promete conservar sesión o carrito invitado si se borra su identificador local.
- Cambio futuro de origen: no prometer transferir automáticamente una instalación o sesión.

## Requirements

### Functional Requirements

- **FR-001**: Mantener nombre JM-STORE y emplear el logo JM identificable como ícono de
  instalación, sin marcas ajenas; conservar la identidad visual y accesibilidad actuales.
- **FR-002**: Publicar un Web App Manifest válido y descubrible que describa nombre, íconos
  apropiados para las plataformas objetivo, identidad estable, inicio en la tienda pública,
  ámbito de navegación y apertura standalone. No incluir información de cuenta o secretos.
- **FR-003**: Permitir instalación voluntaria en la matriz aprobada; no exigir APK, tiendas
  de aplicaciones, suscripciones o permisos ajenos a la instalación web para el MVP.
- **FR-004**: Mantener navegación por enlaces directos, recarga y retorno desde rutas de
  cuenta/carrito/pedidos; salir a otro origen no debe hacerse pasar por navegación interna.
- **FR-005**: Mantener autenticación Firebase Spark y D1 como fuente de datos del negocio,
  roles y sesiones revocables; instalar no aprovisiona cuentas ni altera permisos.
- **FR-006**: Conservar catálogo, búsqueda, carrito inmediato, precios en S/, inventario,
  direcciones, pedidos, perfil, administración y compras simuladas existentes.
- **FR-007**: Evaluar Service Worker y caché solo para recursos estáticos de la aplicación
  y un aviso offline, sin catálogo ni respuestas de API almacenados;
  nunca añadir copias de contraseñas, cookies, tokens, encabezados de autorización, códigos
  de acción, respuestas de autenticación, perfil, direcciones, carrito, pedidos o administración
  a la caché PWA. Se conservan las cookies/sesiones del mecanismo seguro existente.
- **FR-008**: Respetar las respuestas que prohíben almacenamiento y no reutilizar una
  respuesta personalizada como contenido público ni servir un éxito offline para escrituras.
  No se aprueban cambios de encabezados de API para cachear datos durante Specify.
- **FR-009**: Las compras, pagos, cambios de cuenta y stock requieren confirmación remota;
  no habrá cola de compras offline ni reenvío automático al recuperar conexión.
- **FR-010**: Versionar y retirar recursos públicos obsoletos de la PWA sin borrar datos
  del negocio ni almacenamiento de otros proyectos. Aplicar una versión nueva únicamente
  después de cerrar todas las ventanas de JM-STORE y volver a abrir; nunca forzar una recarga
  ni interrumpir compras, sincronización o formularios con cambios sin resolver.
- **FR-011**: Conservar las protecciones de autenticación, revocación, CSRF, origen y
  contenido; no reducirlas para habilitar instalación o acceso sin conexión.
- **FR-012**: Conservar responsive, temas, teclado, lector de pantalla y movimiento reducido;
  medir posibles regresiones respecto del carrito verificado, cuyo objetivo visual es p95 ≤100 ms.
- **FR-013**: Verificar primero local y staging con cuentas sintéticas. La matriz obligatoria
  es Chrome Android y Chrome/Edge Windows, incluidas tablets Android/Windows. Registrar
  instalación real; iPadOS es adicional si hay dispositivo físico disponible. Si falta equipo,
  conservar esa validación pendiente, sin sustituirla por una afirmación basada en emulación.
- **FR-014**: Mantener Cloudflare Free y Firebase Spark, medir el consumo afectado y no
  activar planes pagos, Identity Platform o servicios adicionales para cumplir el MVP.
- **FR-015**: Mantener SQLite local, cuentas/datos existentes, Worker antiguo y producción
  intactos; preparar validación/recuperación antes de cualquier publicación futura autorizada.

### Key Entities

- **Identidad de instalación**: nombre, ícono JM, origen, destino inicial y ámbito; independiente
  de una identidad de cliente. No contiene sesiones ni secretos.
- **Versión de recursos públicos**: conjunto identificado y reemplazable de recursos de
  presentación; separado de datos privados y del estado autoritativo del negocio.
- **Contexto de conexión**: disponibilidad y estado de guardado confirmado/pendiente;
  condiciona mensajes y acciones, no sustituye autorización ni confirmación remota.
- **Evidencia de compatibilidad**: plataforma/navegador/versiones, instalación real o
  emulada, pasos y resultado; distingue casos pendientes y no soportados.

## Success Criteria

### Measurable Outcomes

- **SC-001**: En cada combinación obligatoria definida en Clarifications, un usuario instala y abre desde el
  sistema JM-STORE con ícono JM y ventana propia, cierra y vuelve a abrir correctamente;
  100% de los casos obligatorios deben tener evidencia real para cerrar la aceptación.
- **SC-002**: El 100% de los recorridos críticos verificados (login/logout, permisos,
  carrito, compra simulada, historial y acceso ADMIN) conserva el mismo resultado guardado
  desde web y app instalada; cero cuentas, líneas o pedidos duplicados por esta función.
- **SC-003**: En las comprobaciones offline, logout y cambio de cuenta hay cero respuestas
  de API, catálogo, datos privados o credenciales almacenados por la PWA y cero confirmaciones
  de compra/stock fabricadas; al volver la conexión se consulta el estado real.
- **SC-004**: La nueva versión se aplica solo tras cerrar todas las ventanas y volver a abrir;
  esto causa cero recargas forzadas, reenvíos de pedidos o pérdidas silenciosas.
- **SC-005**: En 360, 768 y 1280 px y ambas orientaciones de tablet se completan los
  recorridos táctiles/teclado sin desbordamiento horizontal; p95 visual del carrito ≤100 ms
  en la muestra acordada, incluso con respuesta remota demorada 1,5 s.
- **SC-006**: Cero planes pagos, alteraciones de SQLite local, cuentas reales, Worker antiguo
  o producción por los ensayos; se documentan consumo observado y límites pendientes.

## Assumptions

- La Constitution 1.1.0 continúa vigente: se revisó y esta PWA no necesita modificar sus
  principios de identidad, seguridad, persistencia, pruebas o aislamiento. No se repite
  ni se omite una fase ya aprobada; este trabajo termina en Specify.
- El diagnóstico identifica faltantes de instalación en código y staging; no certifica
  haber reproducido el mensaje exacto del Chrome personal. Ver diagnosis.md.
- El ícono JM se adaptará a instalación conservando la referencia visual suministrada;
  actualmente el encabezado combina una bolsa y el texto JM-STORE, sin un activo de
  instalación dedicado. No se genera ni cambia ningún logo en esta fase.
- HTTPS ya existe. El soporte depende del navegador/sistema, sus políticas y el perfil;
  no se garantiza compatibilidad universal ni instalación idéntica entre plataformas.
- El objetivo de validación inicial es el staging actual. Un dominio definitivo,
  producción o traslado de instalaciones requiere autorización y decisión posteriores.
- Desinstalar no borra la cuenta o sus pedidos remotos; la recuperación exige autenticación
  normal y disponibilidad de los servicios. El carrito invitado depende de su sesión.
- No se incluyen push, sincronización de compras en segundo plano, pagos reales, APK,
  publicación en tiendas ni JM Assistant. Este último solo recibe evaluación preliminar
  en future-assistant-evaluation.md, sin crear otra feature ni aprobar proveedor.
- Los pendientes de features anteriores (incluido correo administrativo y carga/memoria)
  continúan abiertos; esta especificación no los declara completados.
