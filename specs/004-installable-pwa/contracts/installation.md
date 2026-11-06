# Contrato de identidad e instalación PWA

## Surface

La SPA pública en el origen autorizado expone un Web App Manifest y arte JM desde el mismo
origen. El navegador conserva la autoridad de ofrecer, posponer o negar instalación. La web
normal sigue funcionando si el dispositivo no ofrece instalación o si el usuario cancela.

## Manifest

- Enlace `<link rel="manifest">` disponible en el documento principal y rutas SPA.
- `name` y `short_name`: `JM-STORE`; descripción en español, sin beneficios comerciales.
- `id` estable, `start_url` en la tienda pública y `scope` limitado al origen/rutas de la app.
- `display: "standalone"`; `theme_color` amarillo JM y `background_color` claro de marca.
- Iconos same-origin con `src`, `type: image/png`, `sizes` exactos: 192×192, 512×512 y
  512×512 `purpose: maskable`. Los tres conservan el símbolo JM dentro de safe zone.
- MIME del manifest/íconos, status HTTP, dimensiones y bytes deben validarse desde el build.
- No se añaden `related_applications`, protocol handlers, push, share targets, pagos o permisos.

## Comportamiento por plataforma

| Plataforma objetivo | Ruta de validación obligatoria | Resultado esperado |
|---|---|---|
| Android teléfono | Chrome, instalación ofrecida por navegador y lanzamiento desde el sistema | Nombre e icono JM visibles; inicio y navegación de tienda en ventana standalone |
| Android tablet | Chrome en equipo físico compatible; orientación vertical/horizontal | Instalación/relanzamiento si el navegador la ofrece; catálogo y navegación táctil/teclado sin overflow |
| Windows desktop/laptop | Chrome y Edge, instalación desde UI de navegador y relanzamiento desde app del OS | JM-STORE aparece como app y abre en ventana propia; acceso directo simple no cuenta como evidencia |
| Windows tablet | Chrome y Edge cuando estén disponibles; táctil/teclado y ambas orientaciones | Mismo flujo standalone, layout adaptable y controles accesibles |
| iPadOS | Safari/dispositivo físico solo si disponible | Evidencia informativa adicional; fuera de bloqueo de aceptación acordado |

Registrar OS/modelo, navegador/versión, origen, método de instalación y resultado. La
emulación responsive no acredita una instalación. `matchMedia('(display-mode: standalone)')`
puede complementar evidencia de ventana, pero no demuestra por sí sola que la aplicación
esté instalada. No exigir un botón custom cuando la plataforma no expone evento de prompt.

## Criterios de rechazo seguro

- Si el manifest o iconos no cargan/son inválidos, no simular instalación; la versión web
  sigue accesible y la evidencia de compatibilidad falla.
- Si el navegador no soporta instalación o el prompt no aparece, presentar una explicación
  compatible con ese navegador o continuar como web; no declarar soporte universal.
- Cambiar el hostname cambia el contexto de identidad/instalación; no trasladar ni migrar
  automáticamente instalaciones desde staging.
