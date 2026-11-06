# Implementation Plan: JM-STORE PWA instalable

**Branch**: `004-installable-pwa` | **Date**: 2026-11-06 | **Spec**: [spec.md](spec.md)

**Input**: Especificación aprobada para Clarify; Constitution 1.1.0; decisiones Q1–Q3 de Clarify.
La rama Git actual observada continúa siendo `main`; `004-installable-pwa` es el identificador SDD.

## Summary

Añadir a la aplicación React/Vite existente metadatos de instalación JM-STORE, iconos JM
aptos para los destinos acordados y un Service Worker con lista explícita de recursos
públicos. La tienda se seguirá sirviendo como SPA desde Cloudflare Workers Static Assets;
la API Fetch, Firebase Spark, D1, autenticación, datos comerciales y SQLite local no cambian.
Sin conexión se muestra únicamente una página estática de aviso; no se precargan el catálogo,
imágenes de productos ni respuestas de API. Una versión nueva espera a que cierren todas
las ventanas controladas y se abre en el siguiente lanzamiento, sin `skipWaiting` ni
recarga forzada. La instalación y el modo standalone se prueban realmente en Chrome Android
y Chrome/Edge Windows; se incluyen tablets Android/Windows. iPadOS queda como evidencia
adicional si se dispone de equipo físico.

## Technical Context

**Language/Version**: JavaScript ESM; React 19 y Vite 7 existentes; Node 24 para build y pruebas.

**Primary Dependencies**: React/Vite existentes; APIs Web App Manifest, Service Worker,
Cache Storage y `matchMedia` del navegador. Recomendación: integrar `vite-plugin-pwa` con
estrategia `injectManifest` y Workbox para el precache estático explícito y la página offline.
Es una dependencia de desarrollo justificada por generación del precache e inspección de
actualizaciones; no añadir SDKs, servicios de datos ni código de IA. Evitar los modos de
actualización automática del plugin.

**Storage**: Cache Storage del navegador solo para recursos públicos de presentación
permitidos: bundles fingerprinted JS/CSS, fuente/ícono JM y página estática offline. Excluir
HTML de navegación, imágenes de catálogo, `/api/**`, credenciales, cookies, tokens, respuestas
privadas y escrituras. Sin IndexedDB, tablas D1, cambios de esquema o persistencia nueva.
Workers Static Assets sigue publicando `client/dist`; las respuestas API mantienen `no-store`.

**Testing**: Vite build y pruebas unitarias del manifest, precache y política de red;
Playwright para online/offline, errores, caché y lifecycle en perfiles limpios; axe/teclado,
responsive y ambos temas; instalación manual real en Chrome Android y Chrome/Edge Windows,
incluyendo tablets Android/Windows disponibles. `display-mode: standalone` es señal auxiliar,
no prueba suficiente de instalación. Cuentas/datos de ensayo sintéticos.

**Target Platform**: Origen HTTPS actual de staging; Chrome en Android y Chrome/Edge en
Windows, teléfonos, equipos de escritorio y tablets compatibles. El origen identifica la
instalación; un futuro dominio o cambio de origen necesita decisión y prueba separadas.

**Project Type**: SPA React/Vite existente, distribuida como assets estáticos junto al Worker
Fetch existente de staging/producción nueva. No se crea una aplicación ni un Worker aparte.

**Performance Goals**: Sin llamada extra bloqueante antes de renderizar la tienda. Los assets
estáticos se sirven localmente en visitas repetidas; el objetivo existente del carrito
visual p95 ≤100 ms no debe empeorar. No se fija una promesa de rendimiento offline para API.

**Constraints**: Conservar Q1 (solo recursos estáticos y aviso offline; ninguna respuesta
de API o catálogo), Q2 (Chrome Android, Chrome/Edge Windows y tablets Android/Windows como
matriz obligatoria; iPadOS opcional con equipo), Q3 (activación tras cierre de todos los
clientes y reapertura). Cloudflare Free y Firebase Spark; sin planes pagos. No tocar D1,
SQLite, identidades, Worker anterior, cuentas reales ni despliegue durante este Plan.

**Scale/Scope**: Manifest, iconos, página offline, registro/lifecycle de Service Worker,
cacheo allowlist, accesibilidad, actualización y validación PWA. Se mantienen intactas las
funciones de tienda/admin y el proceso de compra remoto.

## Constitution Check

*Gate previo a Phase 0 y revalidado tras Phase 1.*

| Principio | Antes de investigación | Después del diseño |
|---|---|---|
| I. SDD | PASS: Specify y Clarify completados; solo Plan | PASS: no se genera Tasks ni se implementa |
| II. Datos persistentes y consistentes | PASS: D1 actual y SQLite local conservadas | PASS: sin datos comerciales/cacheados ni cambios de esquema |
| III. Seguridad de acceso | PASS: se conserva Firebase/cookie actual | PASS: allowlist de assets; API y contenido privado fuera de Cache Storage |
| IV. Recorrido completo | PASS: PWA es otro contenedor de la misma tienda | PASS: catálogo, sesión, carrito, compras y admin siguen usando los contratos actuales |
| V. Calidad y simplicidad | PASS: validaciones aisladas, sin modificar producción | PASS: un plugin de build especializado, sin servicios/runtime nuevos |
| Experiencia y accesibilidad | PASS: marca JM y responsive vigentes | PASS: nombres/íconos accesibles, foco, temas, reduced motion y tablet probados |
| Aislamiento Cloudflare | PASS: Worker/Static Assets existentes | PASS: no se altera Worker viejo, configuración, binding ni entorno remoto |

No se identifica desviación que requiera excepción. Revalidación documental: los artefactos
de diseño no habilitan cuenta, staging ni producción; cualquier prueba remota o publicación
requiere autorización propia y un cambio de fase a Implement.

## Design Decisions

1. **Manifest**: `client/public/manifest.webmanifest`, enlazado desde `client/index.html`.
   Nombre `JM-STORE`, nombre corto `JM-STORE`, `start_url` en la tienda pública, `scope` del
   origen y `display: standalone`; color de tema amarillo institucional y fondo blanco/azul
   coherente con la identidad. `id` estable dentro del origen elegido. No declara pagos,
   notificaciones, handlers, shortcuts ni permisos no solicitados.
2. **Iconografía**: derivar un arte cuadrado del símbolo JM/bolsa de la marca existente,
   respetando zona segura y contraste; generar PNG declarados de 192×192, 512×512 y
   512×512 `purpose: maskable`, más favicon según necesidad. No reproducir iconos de marcas
   de terceros. Validar MIME, dimensiones, transparencia/recorte y legibilidad reducida.
3. **Build PWA**: usar `vite-plugin-pwa` en `injectManifest`; mantener una pequeña política
   de Service Worker del proyecto y limitar Workbox a emitir/servir la precache allowlist.
   No usar `autoUpdate`, `skipWaiting()` ni `clientsClaim()`; el valor predeterminado de
   espera del ciclo Service Worker cumple Q3. No se añade lógica PWA al Worker salvo que
   una validación local identifique un header o fallback incompatible; cualquier ajuste
   vuelve al artefacto SDD antes de tocarlo.
4. **Cache**: versionar caché propiedad de JM-STORE. Precache solo bundles JS/CSS con hash,
   iconos JM y `/offline.html`; excluir `index.html`, `images/demo/**`, catálogo, toda ruta
   `/api/**` y cualquier URL con datos de usuario. Navegaciones siempre intentan red y, si
   falla, devuelven el aviso offline estático precacheado. Otras solicitudes usan red y no
   se guardan. Respetar `Cache-Control: no-store`; ninguna respuesta privada se convierte
   en recurso de fallback. Limpiar únicamente cachés con prefijo/versión propios durante
   activación confirmada, nunca todo Cache Storage.
5. **Continuidad de versión**: el Worker nuevo se instala y prepara su lista mientras la
   versión actual sigue atendiendo ventanas abiertas. No se la fuerza a ceder control. Al
   cerrarse todos los clientes, el navegador activa la versión pendiente; al volver a abrir,
   se carga el bundle correspondiente. No borrar formularios/carrito en memoria ni reemitir
   compras; el estado de negocio permanece en D1.
6. **Instalación**: usar la UI de instalación del navegador (y el evento `beforeinstallprompt`
   solo donde exista) con una ayuda accesible y opcional; no simular el prompt ni bloquear la
   navegación web si no es instalable. No afirmar instalación solo por manifest/DevTools.

## Project Structure

### Documentation (this feature)

```text
specs/004-installable-pwa/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── installation.md
    └── cache-and-updates.md
```

`tasks.md` pertenece a Tasks y no se crea ni actualiza aquí.

### Source Code (repository root)

```text
client/
├── index.html                         # referencia del manifest/icono
├── public/
│   ├── manifest.webmanifest           # identidad y ventana standalone
│   ├── offline.html                   # aviso público mínimo
│   └── icons/                         # iconos derivados del símbolo JM
├── src/pwa/
│   └── register.js                    # registro y señal opcional de instalación
├── service-worker.js                  # estrategia injectManifest y cache allowlist
├── vite.config.js                     # plugin PWA en build
└── tests/pwa/                         # manifest, cache, lifecycle y seguridad
tests/e2e/pwa/                         # navegador online/offline y responsive
cloud/src/worker.js                    # sin cambio esperado; sirve assets y conserva API
cloud/src/assets/_headers              # referencia vigente; no relajar seguridad/no-store
```

**Structure Decision**: ampliar el proyecto React/Vite en el lugar actual y entregar el
build resultante mediante la configuración de Static Assets existente en `cloud/`.
No crear un segundo frontend/backend, Worker, base de datos, dominio ni servicio remoto.

## Phase 0 Research

Decisiones, alternativas, fuentes oficiales y limitaciones de navegador: [research.md](research.md).

## Phase 1 Design

- Modelo de metadatos y caché cliente sin cambios de negocio/base de datos:
  [data-model.md](data-model.md).
- Contratos de identidad/instalación: [contracts/installation.md](contracts/installation.md).
- Contratos de almacenamiento y actualizaciones: [contracts/cache-and-updates.md](contracts/cache-and-updates.md).
- Pasos locales y matriz manual de validación: [quickstart.md](quickstart.md).

## Post-Design Constitution Check

PASS en los principios I–V, experiencia y aislamiento (ver tabla). El diseño no modifica
autenticación, claims, cuentas, D1, SQLite, Worker antiguo o claims de negocio; no depende de
API durante arranque o instalación. No se aceptan API cacheadas como datos offline. El único
almacenamiento nuevo es cache efímero de recursos públicos de UI con versión y allowlist.
La instalación es voluntaria y dependiente de navegador/sistema; evidencias manuales reales
son criterio de aceptación. Sin excepción constitucional ni funcionalidad adicional de IA.

## Complexity Tracking

No hay violaciones a la Constitution ni componentes adicionales de runtime. `vite-plugin-pwa`
se propone como una dependencia de desarrollo dedicada al precache y al build injectManifest;
su incorporación/versionado deberá detallarse en Tasks; cambiar esta elección de diseño
requiere actualizar Plan antes de Implement y no amplía el alcance aprobado.
