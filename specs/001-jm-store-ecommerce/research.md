# Research: JM-STORE

**Fecha**: 2026-11-03 | **Entrada**: [spec.md](spec.md), Constitution v1.0.0

Las decisiones siguientes resuelven los aspectos técnicos de Plan. Son diseño pendiente
de implementación; no se instalaron dependencias ni se ejecutó la aplicación.

## 1. Interfaz y ejecución

- **Decisión**: React 19, Vite estable compatible con Node 24 y React Router 7 en modo
  biblioteca; JavaScript ESM, CSS propio y Fetch. Versiones exactas se fijarán en lockfile
  durante Implement. Usar Node 24; el entorno inspeccionado tiene 24.15.0 y npm 11.12.1.
- **Razón**: Dos carpetas client/server con npm workspaces conservan una arquitectura
  comprensible. Context para sesión, carrito y tema evita una biblioteca global adicional.
  Vite en desarrollo redirige `/api` a Express; Express sirve el build en la demostración.
- **Alternativas**: SSR, Redux y frameworks de estilos completos añaden trabajo que no
  requiere el examen. No se necesita SEO avanzado ni infraestructura distribuida.
- **Fuentes**: [Componentes y estado en React](https://react.dev/learn/thinking-in-react),
  [requisitos de Vite](https://vite.dev/guide/),
  [build de Vite](https://vite.dev/guide/build),
  [Express 5](https://expressjs.com/en/5x/api/),
  [React Router y versiones](https://reactrouter.com/start/declarative/installation).
  Se fija la rama 7 de Router para este diseño; no se instala automáticamente la rama
  latest si ya es otra versión mayor. Implement usará documentación de la versión fijada.

## 2. SQLite sin instalación nativa adicional

- **Decisión**: `node:sqlite`, `DatabaseSync`, encapsulado en server/src/db. Mínimo Node
  24.15.0 para reproducir el entorno; adoptar un parche compatible actualizado al preparar
  el runtime. Usar SQL parametrizado, claves foráneas activadas por conexión, WAL,
  synchronous FULL y timeout de escritura de 5 segundos.
- **Razón**: Disponible en ese runtime sin paquete SQLite nativo ni servidor separado.
  La API está marcada Release Candidate en 24.15.0: se acepta esta dependencia del runtime
  para el examen y se aísla en un módulo pequeño. Lecturas y transacciones síncronas serán
  breves; no hay trabajo de red ni hashing dentro de una transacción.
- **Alternativas**: better-sqlite3 ofrece una opción madura, pero agrega instalación de
  binarios nativos en Windows. Un ORM y PostgreSQL exceden las necesidades del MVP local.
- **Fuentes**: [API exacta de Node 24.15.0](https://nodejs.org/download/release/v24.15.0/docs/api/sqlite.html),
  [claves foráneas](https://www.sqlite.org/foreignkeys.html),
  [WAL](https://www.sqlite.org/wal.html).

## 3. Autenticación y autorización

- **Decisión**: Contraseñas con scrypt asíncrono de node:crypto, sal aleatoria de al menos
  16 bytes, parámetros versionados N=131072, r=8, p=1, maxmem=192 MiB y comparación de
  longitud fija en tiempo constante. Limitar a dos derivaciones concurrentes. Sesión opaca
  de 32 bytes aleatorios; guardar su hash en SQLite. Cookie HttpOnly, SameSite=Lax,
  Path=/, Secure con HTTPS; HTTP solo en localhost. Caducidad autenticada de 8 horas y
  30 minutos de inactividad, comprobadas por servidor. Rotar sesión al autenticar.
- **Razón**: Revocación inmediata al cerrar sesión o desactivar cuenta, sin guardar JWT ni
  credenciales en localStorage. Verificar usuario activo, rol y titularidad en cada acceso.
  Registro público fija CUSTOMER; alta inicial de ADMIN mediante entorno local ignorado.
- **Alternativas**: JWT, OAuth y recuperación por correo no son necesarios. No se usará
  MemoryStore ni una contraseña administrativa fija incluida en el repositorio.
- **Fuentes**: [scrypt de Node](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback),
  [seguridad en Express](https://expressjs.com/advanced/best-practice-security/).

## 4. Pago simulado, concurrencia y reintento

- **Decisión**: Resultado simulado APPROVED/REJECTED, siempre rotulado como demostración.
  APPROVED confirma pedido y descuenta inventario en una misma transacción
  BEGIN IMMEDIATE. REJECTED persiste pedido e intento, sin movimiento de inventario.
  Los intentos son inmutables y el resumen histórico del pedido no se sobrescribe.
- **Razón**: Respeta las cinco respuestas de Clarify. Un reintento usa el mismo pedido si
  sus artículos siguen activos, su precio coincide y hay stock. Si cambia el precio,
  se conserva el pedido rechazado y se exige una nueva compra con resumen actualizado.
  Si solo cambia disponibilidad, se revisa de nuevo y se confirma con una nueva cotización.
- **Alternativas**: Reservar stock al rechazar contradice Clarify; sobrescribir precios
  históricos dificulta verificar los resultados anteriores. No habrá pasarela ni tarjeta.
- **Decisión adicional**: Clave de idempotencia por operación persistida junto con su
  respuesta; repetir la misma petición devuelve el mismo resultado. Cotización temporal
  firmada por servidor vincula usuario, origen del resumen, versiones y vencimiento.
  En el commit se releen precios y stock; la firma nunca sustituye esta comprobación.
- **Fuente**: [Transacciones SQLite](https://www.sqlite.org/lang_transaction.html).

## 5. Dinero y promociones

- **Decisión**: Todos los importes internos y de API son enteros en céntimos PEN. Mostrar
  `S/ 1,299.00` con dos decimales; cantidades enteras positivas. Promociones de producto
  con precio final o de categoría con descuento en puntos básicos; producto prevalece
  sobre categoría, sin acumular. Porcentaje se redondea al céntimo más cercano, mitad
  hacia arriba, mediante aritmética entera. Una promoción por ámbito y período.
- **Razón**: Evita errores de coma flotante y permite reproducir exactamente un total.
  Datos de demostración rotulados; no hay ahorro, estrellas, cuotas o envíos inventados.
- **Alternativas**: Decimales binarios y reglas acumulables crean ambigüedad innecesaria.

## 6. Diseño y fotografías

- **Decisión**: Usar la referencia adjunta como guía de composición: cabecera amarilla,
  buscador central, navegación, hero azul, categorías, mosaicos y tarjetas blancas,
  carrito emergente y botones azules. Identidad JM-STORE propia. Banner enlaza a catálogo
  real y usa texto descriptivo; promociones aparecen solo con datos vigentes.
- **Razón**: La similitud se verifica por distribución y jerarquía, no copiando promesas.
  Tema oscuro por variables CSS; accesibilidad, foco y movimiento reducido desde el inicio.
- **Alternativas**: Copiar marcas, calificaciones o textos de cuotas de la imagen vulnera
  los requisitos. Chat y soporte 24/7 de la referencia quedan fuera del MVP.
- **Decisión**: Fotografías genéricas licenciadas o propias se descargarán y revisarán en
  Implement. Servir archivos locales y conservar fuente/licencia en manifiesto. El admin
  selecciona imágenes de esa biblioteca y cambia orden/texto alternativo; subir archivos
  o buscar fotografías en servicios externos queda fuera del MVP.

## 7. Operación, límites y pruebas

- **Decisión**: Un proceso Express, un archivo local persistente, sin servicios externos.
  Inicialización y migraciones numeradas; seed repetible sin sobrescribir compras o stock
  existentes. Backup con aplicación detenida y copia consistente de DB/WAL/SHM si existen.
  Reset solo en entorno de demostración con confirmación explícita y respaldo previo.
- **Razón**: El objetivo es una demostración local reproducible. Se diseñan pruebas con
  node:test para lógica/API, y Playwright para el recorrido del navegador, con bases de
  datos temporales independientes; no se ejecutan durante Plan.
- **Alternativas**: Kubernetes, analítica externa, colas y disponibilidad distribuida no
  corresponden al alcance. La validación futura medirá 100 productos, 20 sesiones y dos
  compras concurrentes como carga local de referencia, sin prometer escala comercial.

## Cierre de Phase 0

No quedan incógnitas técnicas bloqueantes. Los estados operativos, los límites de entrada
y las reglas de validez de reintento se concretan en data-model y contratos. La fecha
histórica de ratificación de la Constitution sigue siendo un pendiente administrativo y
no se modifica fuera de su workflow.
