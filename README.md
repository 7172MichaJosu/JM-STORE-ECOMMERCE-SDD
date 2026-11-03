# JM-STORE

Tienda de demostración para el examen. React/Vite, Express y SQLite persistente.
Requiere Node 24.15+ (rama 24) y npm 11. Los pagos son simulados, sin cobros reales.

## Preparación

1. `npm ci`
2. Copiar `.env.example` a `.env.local` y completar `QUOTE_SECRET` aleatorio de 32 bytes o más.
3. `npm run db:migrate` y `npm run db:seed`.
4. Provisionar admin con variables locales `ADMIN_EMAIL` y `ADMIN_PASSWORD` (12..128 caracteres) y `npm run admin:provision`. Retirar la contraseña del entorno al finalizar.
5. En terminales distintas: `npm run dev --workspace server` y `npm run dev --workspace client`. Abrir http://localhost:5173.

Para demo compilada usar APP_ORIGIN=http://localhost:3001, `npm run build` y `npm start`.
El registro público solo crea clientes. No hay credenciales públicas ni pagos bancarios.

[Documentación SDD](specs/001-jm-store-ecommerce/plan.md) · [Guía de validación](specs/001-jm-store-ecommerce/quickstart.md).
