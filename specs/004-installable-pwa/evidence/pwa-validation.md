# Evidencia PWA local — 2026-11-06, America/Lima

## Confirmación manual adicional del propietario — 2026-11-06

El propietario confirmó que JM-STORE se instaló correctamente como aplicación PWA en su
teléfono Android y en su laptop Windows. Se registra únicamente esa confirmación: no se
indicaron modelo, navegador o versión, ni se reportó explícitamente abrir la app desde el
launcher/menú del sistema y verificar nombre, icono y ventana standalone. En consecuencia,
T026 permanece parcial y sin marcar; no se infiere cobertura para Chrome/Edge por separado,
tabletas ni iPadOS. Evidencia registrada también en [tasks.md](../tasks.md).

Checkpoint local anterior a la publicación. El estado posterior autorizado de staging,
incluida la corrección del aislamiento de tráfico de pruebas, está en
[pwa-staging.md](pwa-staging.md); las menciones de publicación pendiente más abajo son históricas.

## Alcance y estado

Implementación local de feature 004. Nombre/id/scope de JM-STORE, iconos PNG derivados de
SVG propio, standalone en manifest, instalación voluntaria, Service Worker y aviso offline
implementados. No se desplegó esta revisión ni se accedió a recursos remotos de Cloudflare
o Firebase; solo se descargaron dependencias públicas de desarrollo y se consultó documentación.
No hubo commit/push, migraciones, provisión de cuentas reales o cambio de planes.

## Entorno de prueba

Windows, Node 24.15.0, npm 11.12.1, Vite 7.3.7 y Playwright/Chromium headless del repositorio.
Dependencias nuevas fijadas: vite-plugin-pwa 2.0.0 y workbox-precaching 7.4.1, solo desarrollo.
Las pruebas usan SQLite temporal, D1 emulada sin persistencia y FirebaseDouble. Las suites
cloud prohíben salida a proveedores reales y no leen `.dev.vars` del operador.

## Resultados

| Comando / validación | Resultado observado |
|---|---|
| `npm run test:pwa` | 9/9: identidad, PNG/MIME/dimensiones, allowlist, exclusión de datos, no-store/private, redirección offline exacta, instalación voluntaria y degradación ante almacenamiento bloqueado |
| `npm run test` | 17/17: dinero, hashing y controlador de carrito existentes |
| `npm run test:integration` | 20/20 con SQLite temporal; compras, stock, idempotencia, persistencia, backup y controles de acceso |
| `npm run cloud:test` | 93/93 en 22 archivos: contratos/unidad/integración Worker/D1; exit 0 |
| `npm run test:e2e` | 22/22: recorridos de cliente/admin, carrito y 7 casos PWA |
| `npm run cloud:test:e2e` | 16/16, incluidos PWA con control efectivo de Service Worker, D1, pedidos y ADMIN |
| Firebase E2E: build + `node cloud/scripts/local-e2e.js --firebase` | 15/15 finales: registro, login, roles, revocación de contraseña, enlaces sintéticos, carrito/pedido y los dos casos PWA |
| Reejecución focalizada offline/lifecycle tras compatibilidad Cloudflare | 3/3; versión de producción del Service Worker, dos ventanas y conservación de caché ajena |
| `npm run cloud:build` | Build Vite/Service Worker y Wrangler dry-run aprobados; sin despliegue |
| Revisión de SQLite local real | 4 archivos comparados por hash antes/después; 0 cambios |
| Revisión de secretos conocidos | 0 coincidencias en archivos de cambios y bundles examinados; sin imprimir valores |

La suite Vitest emitió un mensaje de desconexión de pipe de workerd al cerrar; ambas
ejecuciones completaron 93/93, exit 0. No se presenta como medición de CPU del Worker alojado.

El primer `npm run cloud:test:firebase:e2e` terminó 14/15: el nuevo caso de continuidad
agotó su espera para checkout usando el primer artículo del catálogo compartido. Se hizo
determinista seleccionando stock disponible ≥10 y comprobando explícitamente líneas,
issues y sincronización antes de continuar. El caso aislado pasó 1/1 y la suite completa
volvió a pasar 15/15 con el runner tras el mismo build; no se cambió autenticación ni API.
Las cifras de las suites finales suman 192 comprobaciones (algunos journeys se repiten
entre modos); los reintentos focalizados no se cuentan de nuevo.

## Caché y privacidad

Se observaron 6 entradas de precache (~420.11 KiB): dos bundles con hash JS/CSS, tres
iconos JM y aviso offline. No se incluyen index/HTML de navegación, manifest, catálogo ni
fotografías, `/api/**`, cuentas, direcciones, carrito, pedidos, tokens o sesiones. La página
abierta puede conservar el estado React normal en memoria; no se crea persistencia offline
de negocio. Las cookies HttpOnly existentes siguen siendo parte del mecanismo de sesión,
no de Cache Storage.

Las peticiones de instalación de assets usan `credentials: omit`, comprobado con cookie
sintética en el ensayo de lifecycle. No hay runtime cache writes, cola de compras,
background sync o reenvío automático. GET/POST API sin red fallan y nunca reciben el aviso
HTML como respuesta de API. Tras login/logout/cambio de cuenta/checkout, las entradas siguen
perteneciendo a la lista pública; no contienen valores sintéticos de email, password o CSRF.

## Compatibilidad corregida durante Implement

La primera suite Worker local falló en los dos nuevos casos PWA porque Static Assets
canonicaliza `/offline.html` a `/offline`; la protección contra redirecciones impidió instalar
el precache. Se añadió primero una precisión al Plan/contrato y una prueba roja de seguridad.
La corrección acepta solo ese par exacto same-origin, status 200/MIME HTML, nunca `no-store`
o `private`. Otras redirecciones siguen rechazadas. El Worker Cloudflare y su configuración
de routing no se modificaron. La suite completa Worker local volvió a pasar 16/16.

La prueba inicial de manifest falló por ausencia del archivo antes de implementarse.
El ensayo de versión A/B conservó borradores en dos ventanas, esperó el cierre de ambas,
activó B al abrir de nuevo, limpió solo la revisión vieja y conservó otra caché del origen.

## Rendimiento local y límites de su evidencia

Muestra de carrito: 20 acciones (agregar, reducir y quitar), API demorada 1500 ms,
**p95 visual 9.6 ms, máximo 10 ms**, contra el objetivo ≤100 ms. Es una medición local de UI;
no es CPU Cloudflare ni latencia del teléfono, y no se inventa comparación antes/después.

Build observado: JS 355806 bytes, CSS 50772 bytes, SW 14044 bytes, manifest 644 bytes,
offline 1168 bytes. El dry-run mantuvo bundle API/Worker de 121.91 KiB (gzip 29.32 KiB).
No se añaden tablas/servicios ni consultas D1 por la PWA. La publicación y los recorridos
alojados están verificados en [pwa-staging.md](pwa-staging.md). La revisión integral de
CPU/memoria/cuotas de Free/Spark sigue parcial (T031); la evidencia remota disponible es
una muestra corta de CPU, no una medición de carga o consumo total.

## Dispositivos y autorización pendiente

| Cobertura | Estado |
|---|---|
| Layout automatizado 360/768/1024/1280, orientaciones, teclado, temas, reduced motion y axe | PASS local |
| Teléfono Android | Instalación confirmada por el propietario; navegador, versión y apertura desde launcher no registrados; T026 parcial |
| Laptop Windows | Instalación confirmada por el propietario; navegador, versión y apertura desde menú no registrados; matriz Chrome/Edge pendiente |
| Windows Chrome y Edge: instalar + lanzar desde el sistema | Pendiente de verificar individualmente y registrar versiones; pruebas headless/manifest no sustituyen esa comprobación |
| Tablet Android y Windows: instalación/touch/orientaciones | Pendiente de dispositivo y staging autorizado |
| iPadOS Safari | Opcional, pendiente de disponibilidad |

T025 ya se completó con publicación autorizada, según la evidencia vigente en
[pwa-staging.md](pwa-staging.md). T026 queda parcialmente acreditada por confirmación del
propietario pero no se marca completa; T027/T028 siguen pendientes de dispositivos. Este
informe local no sustituye la evidencia alojada de staging.
La base SQLite, Worker antiguo, datos reales, D1 remota y producción se conservan intactos.
El cambio de correo administrativo alojado y otros pendientes históricos no se completan
por esta feature. No se declara la PWA disponible en el celular hasta publicar y verificar
la instalación física según la matriz aprobada.

## Trazabilidad y tareas

Este documento registra el checkpoint histórico local previo a staging: 27/32 tareas.
El estado actual es **28/32**, con T025 publicada; véase la evidencia de staging enlazada
arriba. T026 tiene confirmación manual parcial de Android y laptop Windows, pero permanece
sin marcar hasta registrar el detalle exigido; T027/tablets, T028/iPadOS opcional y la parte
restante de T031 siguen pendientes. T029/T030/T032 se ejecutaron en su alcance documentado.

| Requisitos | Evidencia / límite |
|---|---|
| FR-001–004, SC-001 | Contratos manifest/iconos, ayuda y deep links PASS; aceptación de instalación física pendiente |
| FR-005–006, SC-002 | Worker/D1/FirebaseDouble y recorridos completos PASS; equivalencia instalada en dispositivos pendiente |
| FR-007–011, SC-003–004 | Allowlist, credenciales omitidas, API network-only, espera de dos ventanas y cache ajena PASS |
| FR-012–013, SC-005 | Responsive/axe/teclado/p95 local PASS; instalación y touch físicos pendientes |
| FR-014–015, SC-006 | Sin planes/config remota/datos reales alterados; hashes SQLite PASS; consumo remoto pendiente |
