# Feature Specification: Carrito con respuesta inmediata

**Feature**: `003-cart-response` (rama Git actual `main`, sin cambiar historial).
**Created**: 2026-11-06
**Status**: Especificación revisada; implementación y aceptación sujetas a evidencia.
**Input**: El usuario solicita diagnosticar el carrito publicado, responder inmediatamente
a agregar/quitar/cambiar cantidades, conservar persistencia y corregir errores/concurrencia.

## User Scenarios & Testing

### US1 — Modificar el carrito sin esperar la conexión (P1)

El comprador ve reflejada su intención inmediatamente en la línea, contador y total,
mientras el sistema guarda el cambio y comunica cuándo termina.

**Independent Test**: realizar agregar, aumentar, disminuir y quitar en móvil/escritorio,
incluida una conexión lenta; comparar la respuesta visual con la confirmación guardada.

1. Dado un producto disponible, al agregarlo aparecen su línea, contador y total sin
   esperar la confirmación remota, con señal de guardado pendiente.
2. Dada una línea, al aumentar/disminuir/quitar cambian inmediatamente sus cantidades,
   importes y contadores; los controles no se bloquean globalmente por la conexión.
3. Al completar el guardado, recargar muestra el mismo carrito confirmado.

### US2 — Conservar integridad ante ráfagas, fallos y sesiones (P1)

Las acciones rápidas conservan su orden e intención, sin líneas duplicadas; un fallo
restaura una representación coherente y comunica lo que no se pudo confirmar.

**Independent Test**: múltiples clics, cambios de productos distintos, conflicto con otro
cliente, falta de stock, error y respuesta perdida; verificar estado visible y guardado.

1. Diez aumentos rápidos seguidos de disminuciones conservan la cantidad final esperada,
   sin líneas duplicadas ni respuestas antiguas que deshagan acciones posteriores.
2. Si se rechaza un cambio, se retiran los cambios pendientes afectados, se informa el
   error y se recupera el estado guardado cuando la conexión lo permite.
3. Una respuesta perdida no provoca repetir automáticamente un incremento ya aplicado.
4. Un cambio de sesión elimina el borrador de la sesión anterior e ignora sus respuestas
   tardías. La cuenta ADMIN continúa sin comprar con privilegios administrativos.

### US3 — Comprar solo lo que está confirmado (P1)

El comprador confirma precios, cantidades y stock guardados antes de crear un pedido.

**Independent Test**: intentar revisar/confirmar durante guardado o después de un error,
y completar luego una compra simulada sin duplicar pedido o descontar stock dos veces.

1. Los cambios pendientes no se presentan como un pedido confirmado ni habilitan una
   confirmación basada en un borrador aún no guardado.
2. Precios/stock corregidos por el servicio prevalecen sobre la estimación visual.
3. Revisar y confirmar tras sincronizar conserva los controles e idempotencia actuales.

### Edge Cases

Carrito inicialmente desconocido, vacío, producto agotado/inactivo, stock cambiado,
precio/promoción modificados, cantidades 0/1/99, límite 100 líneas, clics rápidos en
varios productos, quitar y volver a agregar, dos pestañas, expiración de sesión, fallo
antes o después de guardar, recarga durante guardado y navegación a checkout.

## Requirements

- **FR-001**: Cada acción válida actualiza inmediatamente línea, contador y total en soles.
- **FR-002**: El estado provisional se distingue del guardado mediante un aviso accesible;
  el guardado no bloquea globalmente los controles de edición del carrito.
- **FR-003**: Solo el servicio persistente confirma precios, stock, permisos y cantidades;
  se conservan los límites actuales de 100 líneas y cantidades 1..99 (0 elimina la línea).
- **FR-004**: Ráfagas y respuestas asíncronas conservan la intención final sin duplicar líneas.
- **FR-005**: Fallos producen reversión y aviso; resultados inciertos requieren consultar
  el estado guardado antes de continuar, sin repetir ciegamente el cambio incierto.
- **FR-006**: Sesiones distintas no comparten borradores ni aplican respuestas antiguas.
- **FR-007**: Checkout espera sincronización y revalida el carrito; conserva protección
  frente a pedidos duplicados y sobreventa.
- **FR-008**: Móvil y escritorio mantienen teclado, controles accesibles y mensajes claros.
- **FR-009**: Se documentan métricas comparables antes/después de respuesta visual,
  confirmación y número/duración de solicitudes, distinguiéndolas entre sí.
- **FR-010**: Verificación exclusivamente con sesiones/cuentas sintéticas en staging,
  sin alterar cuentas reales, SQLite original, proyecto antiguo, planes o producción.

## Key Entities

Carrito confirmado, intención pendiente de edición, representación provisional y
generación de sesión. No se añade información comercial persistente nueva.

## Assumptions & Dependencies

Se conservan Constitution y reglas comerciales de features 001/002. No se promete
guardar borradores offline o sobrevivir a cerrar la página: al recargar prevalece lo
persistido. La velocidad del guardado depende de la conexión; el objetivo inmediato
corresponde a la respuesta visual. El registro público sigue creando solo clientes.
El cambio de correo y otros pendientes de feature 002 permanecen fuera de alcance.

## Success Criteria

- **SC-001**: p95 de respuesta visual <=100 ms en agregar/aumentar/disminuir/quitar,
  con 3 repeticiones por acción en 1280 y 360 px, también bajo demora remota de 1.5 s.
- **SC-002**: 100% de recorridos verificados coinciden con el carrito guardado al recargar.
- **SC-003**: Ráfagas, fallos, conflictos, respuesta perdida y sesión nueva superan sus
  pruebas sin duplicaciones ni pérdida silenciosa de cambios confirmados.
- **SC-004**: Comprar durante un borrador pendiente no genera un pedido con datos
  provisionales; la regresión del checkout simulado continúa aprobada.
