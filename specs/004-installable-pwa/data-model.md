# Modelo de datos de la feature 004 — PWA instalable

## Alcance de persistencia

Esta feature no introduce ni migra datos comerciales. SQLite local y Cloudflare D1 mantienen
sin cambios sus esquemas, filas, roles, sesiones, carritos, inventario y pedidos. Firebase
Spark conserva la autenticación actual. No se agrega IndexedDB, entidad de servidor ni dato
de usuario local nuevo.

## Recursos de instalación

| Recurso lógico | Contenido | Ciclo de vida / validación |
|---|---|---|
| Identidad de aplicación | Nombre JM-STORE, nombre corto, URL inicial/ámbito por origen, display standalone, colores e iconos referenciados | Público y versionado con el frontend; JSON válido y todas las referencias resuelven desde el mismo origen |
| Arte de icono JM | Master de marca y derivados PNG 192×192, 512×512 y 512×512 maskable | Sin cuentas ni comercio; prueba de dimensiones, MIME, safe zone y visual en tamaño reducido |
| Precache de presentación | Ficheros fingerprinted JS/CSS del build y recursos propios de identidad incluidos en allowlist | Claveado por versión; se reemplaza/limpia solo al activarse la versión nueva |
| Aviso offline | Documento estático mínimo y de marca, sin sesión, catálogo ni formularios | Público, precache explícito; se devuelve únicamente si una navegación falla por red |

## Separación de negocio

```text
Cache Storage del origen (público, prescindible)
  ├── recursos estáticos permitidos de JM-STORE
  └── aviso offline estático

Cloudflare D1 (fuente de verdad existente; sin modificación)
  ├── perfiles, roles y sesiones revocables
  ├── catálogo, precios e inventario
  ├── carritos, pedidos y pagos simulados
  └── direcciones y datos administrativos

Firebase Authentication Spark (identidad existente; sin modificación)
```

Cache Storage no almacena catálogo, imágenes de producto, respuestas `/api/**`, cookies,
tokens, identificadores de sesión, datos de cuenta, formularios ni resultados de escritura.
Al desinstalar/borrar los datos del sitio se puede perder el precache; no cambia ni borra
registros de D1/SQLite y no crea garantía de carrito invitado local.

## Invariantes

1. Solo URLs locales enumeradas del build público pueden entrar al precache; no se admite
   cacheo por URL genérica, patrón `/api/*`, navegación, query de usuario o respuesta runtime.
2. La página offline no incluye precios, productos, estados de autenticación ni enlaces que
   aparenten realizar una operación sin servidor.
3. Datos de negocio y autorización siempre se consultan/validan desde los servicios actuales.
4. El SW solo borra caches con namespace JM-STORE propio; nunca borra todo Cache Storage.
5. Versión en espera no altera clientes abiertos. Al activar, la limpieza se limita a recursos
   obsoletos del namespace PWA y no toca localStorage, cookies, Firebase o datos D1.
