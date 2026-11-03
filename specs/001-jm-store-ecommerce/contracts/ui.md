# Contrato de interfaz: JM-STORE

**Fecha**: 2026-11-03 | **Referencia visual principal**: imagen JM-STORE adjunta al chat

La imagen está disponible como referencia de conversación; no se encontró archivo local
de esa imagen en el repositorio. Este contrato registra su distribución para implementar
sin inventar una ruta de recurso. Fotografías y piezas finales se preparan en Implement.

## Composición y sistema visual

| Área de la referencia | Comportamiento y diseño previsto |
|---|---|
| Cabecera amarilla | Marca propia JM-STORE, buscador central, categorías, cuenta, tema y carrito con cantidad real |
| Hero azul eléctrico | Banner ancho con imagen genérica y llamada a catálogo; navegación manual con controles accesibles |
| Accesos a categorías | Fila de tarjetas compactas; cada una filtra catálogo real; scroll móvil por controles y gesto |
| Banners de categoría | Mosaicos con nombre y fotografía; mostrar descuento solo si la promoción configurada lo respalda |
| Tarjetas de producto | Fondo claro, bordes suaves, foto, nombre, precio S/, disponibilidad y botón Agregar; sin estrellas ficticias |
| Carrito emergente | Líneas reales, cantidades, subtotal y enlace a carrito; accesible con teclado, cerrar con Escape y devolver foco |
| Barra inferior de accesos | Enlaces operativos de cuenta, pedidos y acceso administrador; sin promesas de envío, cuotas o soporte 24/7 |
| Panel administrativo | Navegación lateral/escritorio, menú móvil, tablas adaptables, formularios y badges de estado |

Paleta inicial: amarillo #FFE600, azul #0050FF, azul profundo #08227A, blanco #FFFFFF,
fondo claro #F5F7FC, texto #111827. Tema oscuro: fondo #0F172A, superficies #1E293B,
texto #F8FAFC, amarillo como acento; verificar contraste de cada combinación y usar texto
oscuro sobre amarillo. Botones azules pueden ajustar luminancia para alcanzar contraste.
Radio 12..20 px, sombras suaves y espaciado coherente. Imágenes con proporción estable
y object-fit contain para evitar saltos y recortes del producto.

Responsive desde 360 px: cabecera y buscador en filas, grilla 1..2 columnas según ancho
útil; escritorio 4..5, manteniendo controles legibles. Sin overflow horizontal de página.
Tablas admin pueden usar región de scroll etiquetada o tarjetas por fila en móvil.
Microanimaciones de 150..250 ms para hover y carrito; preferencia reduced-motion las
suprime. Carrusel manual sin avance automático para simplificar accesibilidad.

Tema sigue preferencia del sistema inicialmente y se conserva selección explícita en
localStorage (solo tema, nunca sesión/credenciales). Targets interactivos de al menos
44x44 px donde sea posible, etiquetas, orden de foco lógico, contraste AA y foco visible.
Mensajes de carrito/errores anunciados sin mover foco inesperadamente. Color no es el
único indicador de stock, error o estado. Formularios mantienen entradas no sensibles.

## Rutas de cliente y componentes

| Ruta | Pantalla y componentes principales | Acceso |
|---|---|---|
| / | Home: Header, HeroCarousel, CategoryStrip, CategoryTiles, ProductGrid | Público |
| /catalogo | Catalog: SearchBar, Filters, ProductGrid, Pagination, EmptyState | Público |
| /categorias/:slug | Catalog con categoría preseleccionada | Público |
| /productos/:slug | Product: Gallery, Price, StockLabel, QuantitySelector, AddToCart | Público |
| /carrito | Cart: CartLine, Totals, avisos y acceso a checkout | Público con sesión |
| /registro | Register: validación de campos y aviso de cuenta cliente | Anónimo |
| /ingresar | Login: correo/contraseña y retorno a carrito | Anónimo |
| /checkout | Dirección, QuoteSummary, SimulationChoice y confirmación explícita | CUSTOMER |
| /cuenta | ProfileForm y enlaces a direcciones/pedidos | CUSTOMER |
| /cuenta/direcciones | AddressList y AddressForm | CUSTOMER |
| /cuenta/pedidos | OrdersList con estados separados de pedido/pago | CUSTOMER |
| /cuenta/pedidos/:publicId | OrderDetail, Timeline, PaymentHistory y reintento si válido | Titular |

Filtros en URL para mantener búsqueda al navegar atrás. Header y MiniCart usan API real.
Al ir a checkout sin sesión, redirigir a login y después a carrito; avisar si se restaura
un carrito de cliente diferente. Revisar cotización después de cualquier cambio material.
Botones «Aprobar pago simulado» y «Rechazar pago simulado» claramente rotulados; ninguno
preseleccionado. Indicar «Demostración: no se realizará ningún cobro» antes y después.
Mientras se confirma, bloquear doble envío visualmente y conservar la misma clave de red.
El rechazo abre el pedido registrado con acción Reintentar; la aprobación muestra número,
total, historial y estado Confirmado. Tras timeout no afirmar rechazo ni aprobación sin
consultar/repetir la operación idempotente.

## Rutas de administración

| Ruta | Pantalla / función |
|---|---|
| /admin/ingresar | Acceso a cuenta ADMIN provisionada; sin registro público de administrador |
| /admin | Dashboard con conteos reales y accesos operativos |
| /admin/productos | Tabla, búsqueda, alta, publicación y desactivación |
| /admin/productos/nuevo | Datos, categoría, precio, stock inicial e imágenes de biblioteca |
| /admin/productos/:id | ProductForm y selección/orden de imágenes; enlace a ajuste de stock |
| /admin/categorias | CategoryTable y CategoryForm |
| /admin/promociones | Objetivo, regla, vigencia y condiciones verificables |
| /admin/inventario | StockTable, AdjustmentForm y movimientos |
| /admin/clientes | Lista, detalle, edición básica y desactivación |
| /admin/pedidos | OrdersTable con filtros de pedido y pago |
| /admin/pedidos/:publicId | Detalle, historial y cambio de estado permitido |

Guards de navegación mejoran UX; la autorización efectiva siempre reside en API.
Sesión de cliente en ruta admin muestra acceso denegado y enlace a tienda; no promover rol.
En el MVP, gestionar imágenes significa elegir de biblioteca local, quitar y ordenar,
con texto alternativo; no ofrecer botón Subir si no hay implementación.

## Estados obligatorios de pantalla

Todas las consultas ofrecen carga con estructura estable, contenido, vacío y error con
acción de reintento. Guardado deshabilita botón mientras opera, muestra éxito después
del commit y conserva datos válidos tras error. 401 lleva a login; 403 informa acceso
denegado; 409 recarga resumen o recurso y solicita revisión; 503 permite reintentar.
404 de producto/pedido permite volver a catálogo/listado sin filtrar datos ajenos.

Sin chat, valoraciones inventadas, cuotas ficticias, envío gratis ni marcas ajenas. Banners
y carruseles apuntan a categorías o productos existentes, nunca a navegación vacía.

## Productos de demostración y fotografías

Preparar 20 productos: tecnología (5), hogar (5), accesorios (4), cuidado personal (3),
deportes (3). Nombres genéricos: portátil de estudio, auriculares inalámbricos, lámpara,
organizador, botella deportiva. Cada uno con SKU, precio en S/, stock y foto representativa.
Incluir un artículo agotado y una promoción vigente rotulada «Datos de demostración»;
otros casos de precio/stock se preparan en fixtures de pruebas, sin contaminar el seed.

Manifiesto de assets debe conservar archivo local, descripción, URL de origen, autor,
licencia/permiso y fecha de obtención; verificar logotipos ajenos y correspondencia con
producto antes de incluir. Si falta foto autorizada, usar placeholder neutral identificado
y no afirmar que una fotografía genérica representa características no disponibles.
