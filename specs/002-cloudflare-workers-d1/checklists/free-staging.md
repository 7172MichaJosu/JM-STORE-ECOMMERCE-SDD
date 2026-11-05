# Checklist de requisitos: staging gratuito y seguridad de JM-STORE

**Purpose**: Revisar claridad, cobertura y criterios de aceptación de rendimiento y seguridad antes de aceptar staging.
**Created**: 2026-11-05
**Feature**: [spec.md](../spec.md)
**Depth / audience**: Estándar; propietario/revisor antes de aceptar staging.

**Review Ownership**: Documento de revisión de requisitos generado por `$speckit-checklist`. Cada `[x]` corresponde a una aprobación del revisor sobre calidad de requisitos; no acredita implementación. Los elementos nuevos quedan sin marcar. La autorización del propietario en esta sesión permite optimizar y ensayar staging en paralelo a esta revisión.

## Completitud y claridad

- [ ] CHK001 ¿Están documentados los servicios gratuitos permitidos y la prohibición de activar facturación automáticamente? [Completitud, Spec §FR-018]
- [ ] CHK002 ¿Se distingue CPU por invocación de latencia de usuario y se expresa el límite de CPU en unidades inequívocas? [Claridad, Plan §Technical Context, §R-AUTH]
- [ ] CHK003 ¿Se definen las rutas críticas incluidas en la aceptación de rendimiento y los escenarios fríos, calientes y concurrentes? [Cobertura, Plan §R-AUTH, Tasks §T075]
- [ ] CHK004 ¿Está definida la evidencia mínima y el margen necesario para considerar cumplido el límite, sin depender de tolerancias ocasionales de plataforma? [Medibilidad, Gap]

## Consistencia y seguridad

- [ ] CHK005 ¿Son consistentes los requisitos de optimización con firma, emisor, audiencia, expiración y proveedor de los tokens? [Consistencia, Spec §FR-006, §FR-013]
- [ ] CHK006 ¿Se exige conservar la revocación y la autorización desde la identidad persistente en todos los cambios de credenciales? [Completitud, Spec §FR-011, §FR-012]
- [ ] CHK007 ¿Están diferenciadas la disponibilidad parcial de staging y la aceptación integral del cambio de correo? [Claridad, Spec §FR-010, §FR-011, Plan §R-EMAIL]
- [ ] CHK008 ¿Son explícitas las restricciones sobre datos reales, SQLite local y recursos antiguos durante las pruebas? [Consistencia, Spec §FR-003, §FR-015, §FR-021]

## Cobertura de escenarios y recuperación

- [ ] CHK009 ¿Se especifican las consecuencias de superar CPU, memoria o cuotas sin promover planes de pago ni perder datos? [Cobertura, Spec §FR-018, Plan §R-AUTH]
- [ ] CHK010 ¿Se documenta el tratamiento seguro de proveedor no disponible y claves de firma caducadas o rotadas? [Cobertura, Spec §FR-013, Plan §Sesiones]
- [ ] CHK011 ¿Está documentado el respaldo recuperable y el destino independiente previo a modificaciones de staging? [Completitud, Spec §FR-017]
- [ ] CHK012 ¿Están separados los criterios del registro/login, compras simuladas, administración y cambios de credenciales? [Cobertura, Spec §FR-006–FR-012, §FR-021]

## Dependencias, supuestos y aceptación

- [ ] CHK013 ¿Se distingue la medición disponible de memoria/cuotas de los supuestos que todavía no han sido acreditados? [Claridad, Assumption, Plan §R-AUTH]
- [ ] CHK014 ¿Está explícito que cuentas reales requieren compatibilidad de hashes sintéticos aprobada y autorización independiente? [Dependencias, Plan §R-IDENTITY, Tasks §T104–T105]
- [ ] CHK015 ¿Se define qué información del resultado debe indicar funcionalidades habilitadas, bloqueadas y pendientes? [Medibilidad, Spec §FR-021, Tasks §T086]
- [ ] CHK016 ¿Está documentada la necesidad de una decisión SDD si cumplir el plan gratuito exige cambiar la arquitectura aprobada? [Consistencia, Constitution §Development Workflow and Compliance, Gap]

## Notes

- `$speckit-implement` consulta las casillas y no modifica estos marcadores.
- La autorización actual cubre optimización y pruebas sintéticas de staging; no producción, planes pagados, migración real ni commit/push.
- Esta checklist examina los requisitos escritos; las evidencias de ejecución corresponden a tasks.md y documentos operativos.
