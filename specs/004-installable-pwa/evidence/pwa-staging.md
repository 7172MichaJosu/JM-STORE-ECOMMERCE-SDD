# PWA publicada en staging — 2026-11-06, America/Lima

Autorización explícita del propietario: publicar exclusivamente la revisión PWA en el
staging existente, sin producción, planes de pago, migración, commit ni push.

**Enlace**: https://jm-store-ecommerce-sdd-staging.josue-hinostroza-27.workers.dev

**Versión publicada**: `90329748-1c78-439c-b1d9-380ccf4dcfba`.
Versión previa conservada: `12de1af0-2b92-4223-8ad6-0658a43522e4`.

## Gates previos

- Checklist de requisitos: 16/16, leída sin modificar marcadores.
- Escaneo de cambios y bundles contra valores secretos conocidos: cero coincidencias;
  `.env.local`, `.dev.vars`, respaldos y datos privados siguen ignorados.
- `npm run test:pwa`: 9/9.
- `npx playwright test tests/e2e/pwa`: 7/7, incluidos offline, dos ventanas, privacidad y axe.
- `node cloud/scripts/local-e2e.js --firebase`: 15/15 finales, sin proveedores reales.
- Build Vite, SW injectManifest y Wrangler dry-run aprobados.
- API `worker.js`: byte por byte igual al código ejecutable ya publicado. Solo el sourcemap
  difería; no cambió lógica API, autenticación, inventario, pedidos ni esquema.
- Variables de runtime del config iguales al estado publicado; binding D1 esperado.

La repetición previa a publicar detectó intermitencia en el test nuevo de continuidad:
una lectura de API devolvió un envelope sin `data` dentro de la suite compartida. La suite
usa el límite real de 300 solicitudes/minuto por origen de tráfico. Se añadió diagnóstico
de status/código y se aislaron los dos clientes PWA con direcciones TEST-NET distintas en
el harness **solo loopback**, manteniendo el limitador de producción intacto. La suite
completa final pasó 15/15. Esto sustituye la atribución provisional al artículo compartido
en el informe local; no se cambió autenticación ni se desactivó protección alguna.

## Respaldo y publicación

Se exportó D1 a un directorio privado ignorado y se restauró en SQLite de verificación
separada: 90,348 bytes, 27 tablas, `integrity_check=ok`, FK 0, recuentos iguales.
Se guardaron metadata, configuración y código anterior del Worker. No se restauró ni
alteró la D1 remota y no se aplicó ninguna migración.

Publicación mediante Wrangler con `cloud/wrangler.staging.jsonc`, nombre/account/binding
contrastados con la allowlist y el respaldo, `deploy --keep-vars`. El código y assets
se publicaron en el Worker existente; no se crearon recursos, namespaces, secretos o planes.

Tras publicar, `versions view --json` confirmó nombres de secretos y D1 preservados.
Consultas D1 agregadas de solo lectura comparadas con el respaldo confirmaron:
recuento de usuarios, recuento/total de pedidos, recuento/total de inventario iguales; FK 0.
Las únicas escrituras de verificación fueron sesiones sintéticas y un carrito invitado
nuevo, agregado/modificado/eliminado hasta quedar vacío; no se crearon pedidos ni se tocó stock.

## Recursos y recorridos publicados

`node cloud/scripts/pwa-staging-verify.js --admin`: **22/22 PASS**.

- Manifest, SW, offline e iconos 192/512/maskable: HTTP 200 y hashes iguales al build local.
- MIME correcto y SW revalidable; diagnóstico de manifest válido en Chromium.
- Service Worker controlando página same-origin; exactamente seis recursos públicos
  en Cache Storage, sin catálogo, fotos, API, credenciales o datos de usuario.
- Catálogo conectado a API, layout sin overflow en 360/1280 px.
- Carrito invitado: agregar, incrementar, reducir, quitar y persistencia vacía en D1.
- Firebase: login de ADMIN sintético existente, rol ADMIN, resumen y Seguridad legibles;
  logout normal, sin cambios de correo/contraseña y sin datos privados en caché.
- Offline: aviso público; API falla por red en lugar de devolver un resultado cacheado;
  recuperar conexión vuelve a la tienda.

Los pedidos se comprobaron en la suite local completa y mediante preservación de agregados
remotos. No se crearon compras/pedidos de prueba adicionales en esta publicación.
Ningún resultado equivale a instalación física en Android/Windows/tablets.

## Rendimiento y gratuidad

Carrito local de esta revisión: 20 acciones con API demorada 1.5 s, p95 visual **10.8 ms**,
máximo 11.1 ms (muestra anterior 9.6/10 ms, conservada en informe local).

Wrangler tail capturó **21 invocaciones** durante la verificación; CPU por invocación entre
1 y **7 ms**, ninguna sobre 10 ms en la muestra. Incluyó sesión, catálogo, carrito, login
y administración; no es una prueba de carga ni un máximo garantizado para tráfico futuro.

No se activó ningún servicio/plan de pago ni se modificó Firebase Spark. La sesión OAuth
no expuso suscripciones de facturación (`billingVisible=false` en backup); el modelo de
uso existente permaneció `standard`. CPU/memoria y cuotas compartidas completas siguen
pendientes de revisión; no se infieren de una muestra breve. **T031 sigue parcialmente
pendiente**, aunque su UI, build y muestra CPU ya tienen evidencia real.

## Estado SDD

**28/32 tareas completas**. T025 completada tras publicación/verificación. Pendientes:
T026 (instalación física Android y Windows), T027 (tablets), T028 (iPadOS opcional),
T031 (revisión integral restante de consumo/cuotas).

T026–T028 se mantienen sin marcar. No hubo cambios de producción ni del proyecto antiguo,
migración real, cambios de credenciales, commit o push. Los archivos SQLite originales
se verifican por hash; respaldos, credenciales y reportes detallados quedan privados.
