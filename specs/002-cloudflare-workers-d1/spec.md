# Feature Specification: Cloudflare Workers and D1 Deployment

**Feature Branch**: `002-cloudflare-workers-d1`

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "Deploy JM-STORE from JM-STORE-ECOMMERCE-SDD as an independent Cloudflare Workers application with persistent D1 data, preserving the existing local SQLite application and its commerce behavior; migrate existing records safely; provide secure administrator email and password changes; preserve the responsive JM-STORE experience; prioritize Cloudflare's free plan."

## Clarifications

### Session 2026-11-04

- Q: ¿Cómo quieres aislar la nueva tienda del proyecto antiguo de Cloudflare? → A: Crear un Worker y una base D1 nuevos en la misma cuenta, con nombres y rutas independientes; no modificar ningún recurso del proyecto antiguo.
- Q: Después de copiar y validar los datos, ¿quieres que la tienda local y la tienda Cloudflare sigan sincronizando sus cambios? → A: Hacer una copia única validada; tras aprobar el corte, cada entorno mantiene sus propios datos y no sincroniza cambios posteriores.
- Q: ¿El cambio de correo del administrador debe aplicarse después de verificar la contraseña actual, o también debe requerir confirmar el nuevo correo mediante un enlace? → A: Decisión inicial: verificar la contraseña actual y actualizar el correo de inmediato; sustituida por la aclaración posterior que requiere verificar el nuevo correo antes de aplicarlo.
- Q: Después de cambiar la contraseña, ¿quieres cerrar también la sesión actual del administrador o mantenerla activa mientras se cierran las demás? → A: Revocar todas las sesiones, incluida la actual, y solicitar un nuevo inicio de sesión.
- Q: ¿Qué debe ocurrir con la migración de cuentas reales mientras no exista un método de verificación de identidad compatible con Workers Free? → A: Mantener bloqueada la migración real hasta especificar y aprobar un método seguro; staging conserva solo datos sintéticos. No reducir el costo del hash, restablecer credenciales ni habilitar un plan pagado para eludir el bloqueo.

- Q: ¿Qué proveedor administrará las credenciales de clientes y del administrador en la aplicación Cloudflare? → A: Evaluar y adoptar Firebase Authentication en el plan gratuito Spark para correo y contraseña, sujeto a validar importación scrypt con cuentas sintéticas; no migrar cuentas reales mientras falle esa prueba y nunca reducir el hash ni exportar contraseñas en texto claro.
- Q: ¿Aceptas verificar el nuevo correo del administrador antes de aplicarlo para conservar la protección contra la enumeración de correos de Firebase? → A: Sí. Tras reautenticar con la contraseña actual, Firebase envía un enlace al correo nuevo; el cambio queda pendiente y el correo vigente sigue siendo el anterior hasta completar la verificación. Al confirmarse, la identidad Firebase y el correo de D1 se reconcilian.
- Q: Después de verificar el nuevo correo, ¿qué debe ocurrir con las sesiones abiertas del administrador? → A: Revocar todas las sesiones anteriores, incluida la del navegador que inició el cambio, y requerir un nuevo inicio de sesión con el correo actualizado.
- Q: Si el administrador solicita cambiar el correo y la contraseña en un mismo envío, ¿cómo debe procesarlo JM-STORE? → A: Permitir un solo tipo de cambio por solicitud. Completar la verificación del correo y volver a iniciar sesión antes de cambiar la contraseña, o realizar la operación por separado en el orden inverso.
- Q: Mientras el administrador espera verificar su correo nuevo, ¿qué debe ocurrir si un cliente intenta registrarse con esa dirección? → A: Reservar el correo pendiente hasta confirmarlo, expirar o cancelar la solicitud; rechazar registros que lo usen con un mensaje genérico y sin crear una identidad.

La aplicación online delega el registro, inicio de sesión y cambio/reautenticación de contraseña a Firebase Authentication. El cambio de correo del administrador queda pendiente hasta completar verifyBeforeUpdateEmail; el correo anterior permanece vigente hasta entonces. Una vez confirmado el enlace, el correo Firebase y el perfil D1 se reconcilian de forma verificable y se revocan todas las sesiones de aplicación; se requiere un nuevo inicio de sesión con el correo actualizado. El Worker acepta un ID token solo tras verificar firma RS256, `kid`, `iss`, `aud`, `sub`, `exp` e `iat` con claves públicas de Firebase y caché respetando su vencimiento; el rol y estado activo se consultan en D1 por UID y no se confían claims de rol del cliente. Las autorizaciones usan sesiones revocables/versionadas en D1 para que el cambio de contraseña invalide inmediatamente el acceso de la aplicación aunque un ID token ya emitido aún no haya vencido. Se habilitan protección contra enumeración de correo y límites contra abuso; no se habilita Identity Platform ni facturación Blaze. Firebase API keys de cliente no son credenciales de autorización, y no se almacena una service-account key en el Worker ni en el navegador.

Las cuentas locales solo podrán importarse conservando su hash/salt scrypt mediante el procedimiento de importación documentado por Firebase después de demostrar equivalencia de inicio de sesión en cuentas sintéticas y validar la asociación UID-cuenta/rol en D1. Si los parámetros o el hash no son compatibles, la migración de cuentas reales queda bloqueada hasta aprobar una alternativa de recuperación verificable; no se descartan hashes, no se crean cuentas con contraseña nueva, no se promueven roles por datos del cliente y no se exponen hashes ni contraseñas temporales.
## User Scenarios & Testing *(mandatory)*

### User Story 1 - Access JM-STORE online (Priority: P1)

A customer opens JM-STORE from a computer or phone and uses the familiar store to
browse products and categories, search, manage a cart, sign in, and complete a simulated
purchase. The online store uses the same current prices, stock rules, order history, and
visual identity as the approved local application.

**Why this priority**: Online access to a complete store is the main purpose of this
feature and must be demonstrated end to end.

**Independent Test**: Open the deployed store on desktop and mobile, find a seeded
product, add it to the cart, and complete a simulated approved purchase. Confirm the
order and stock change are visible after a new session.

**Acceptance Scenarios**:

1. **Given** the online store is available, **When** a customer searches or browses a
   category, **Then** matching products, current prices in S/, and available stock are
   shown using the JM-STORE design.
2. **Given** a customer has a valid cart and address, **When** they choose an approved
   simulated payment, **Then** one confirmed order is recorded and stock is reduced once.
3. **Given** a customer chooses a rejected simulated payment, **When** the attempt is
   recorded, **Then** the order remains retryable and stock is unchanged.
4. **Given** the customer opens the same account in a later session, **When** they view
   their purchases, **Then** the persisted order and its status are present.

---

### User Story 2 - Preserve existing commerce data online (Priority: P1)

An operator moves the current JM-STORE commerce data to the online store without losing
products, categories, prices, inventory, customer accounts, addresses, carts in scope,
orders, or simulated payment records. The current local SQLite store remains intact and
usable as a separate application.

**Why this priority**: The deployed shop must continue the existing business state, while
the Constitution requires local and online environments to remain isolated.

**Independent Test**: Compare pre-migration and post-migration counts and representative
records for each included entity; verify relationships, customer sign-in, order totals,
and stock. Confirm that the local SQLite database remains unchanged and opens normally.

**Acceptance Scenarios**:

1. **Given** a recoverable source backup and an online migration candidate, **When** the
   migration is validated, **Then** every included record and relationship is accounted
   for and representative order totals match.
2. **Given** local accounts are included in a migration candidate, **When** the documented Firebase scrypt import is tested with synthetic accounts, **Then** each test account must authenticate with its original password and preserve its Firebase UID to D1 account/role mapping; any mismatch blocks real-account migration without changing local credentials.
3. **Given** validation fails or is incomplete, **When** an operator reviews the result,
   **Then** the online store does not accept commerce writes and the original local data
   remains available for recovery.
4. **Given** migration validation succeeds, **When** online service is enabled, **Then**
   later catalog, cart, customer, inventory, and order changes persist online without
   changing the local SQLite data.

---

### User Story 3 - Manage administrator credentials safely (Priority: P1)

An authenticated administrator opens **Mi cuenta → Seguridad**, verifies their current
password, and changes their email address or password in separate operations. The administrator receives
a clear result and remains able to sign in with the new credentials.

**Why this priority**: The deployed administrator needs a secure way to own and recover
access to the online account without public or default credentials.

**Independent Test**: Request an administrator email change and verify it remains
pending until the new address is confirmed; after confirmation, sign in with the new
email. Separately verify password change, session revocation, and safe failures.

**Acceptance Scenarios**:

1. **Given** an administrator reauthenticates with the current password and enters a
   valid unused email, **When** they request the change, **Then** Firebase sends a
   verification link, the change is pending, and the current email remains active.
2. **Given** the administrator completes the valid verification link, **When** the
   identity update is confirmed, **Then** Firebase and D1 show the new email, every
   previous application session is revoked including the current one, and a new login
   with the new email is required; the previous email no longer authenticates.
3. **Given** an administrator enters the correct current password and a valid new
   password, **When** they save the change, **Then** the new password works, the old one
   fails, every active session is revoked, and sign-in with the new password is required.
4. **Given** the current password is wrong, the verification link expires/is reused, or
   the new email becomes unavailable before confirmation, **When** the change is
   attempted, **Then** no unconfirmed email is applied, the current email remains
   authoritative, and the user receives a safe recovery message.
5. **Given** an administrator email change is pending, **When** a customer registers with
   that proposed email, **Then** registration is rejected generically, creates no Firebase
   identity or D1 account, and leaves the pending change intact.
6. **Given** a customer account or unauthenticated visitor, **When** they request the
   administrator security area, **Then** access is denied and no administrator data is
   disclosed.

---

### User Story 4 - Operate the store as an administrator (Priority: P2)

An authorized administrator manages the existing catalog, categories, prices, images,
promotions, customers, inventory, and orders from the online panel. The administrator
can review payment simulation outcomes and progress orders through the existing allowed
states.

**Why this priority**: Online administration is necessary to keep the deployed shop's
catalog and order lifecycle current after launch.

**Independent Test**: Change a product and stock quantity, review a customer and order,
update an allowed order state, then confirm that a customer sees the persisted result
and that a second session sees the same administration changes.

**Acceptance Scenarios**:

1. **Given** an administrator is signed in, **When** they update permitted catalog or
   inventory data, **Then** the change is validated, saved, and reflected in the store.
2. **Given** an administrator reviews customers and orders, **When** they open a record,
   **Then** only authorized fields and the correct persistent order/payment state are
   displayed.
3. **Given** a customer or unauthenticated visitor requests an administrative action,
   **When** the request is processed, **Then** it is denied without changing data.

---

### User Story 5 - Use the store on different devices (Priority: P2)

Customers and administrators use the same JM-STORE identity and essential workflows on
desktop and mobile devices. They can switch light/dark themes and navigate with keyboard
or assistive technology.

**Why this priority**: Public deployment makes the service available beyond the local
exam computer, so mobile usability and accessibility must carry over.

**Independent Test**: Complete catalog, account, cart, checkout, and administrative
review at 360 px and desktop width in both themes; verify keyboard access, readable
contrast, and reduced-motion preferences.

**Acceptance Scenarios**:

1. **Given** a supported phone or computer viewport, **When** a user opens each primary
   flow, **Then** content remains readable and operable without page-level horizontal
   scrolling.
2. **Given** a user chooses dark mode or requests reduced motion, **When** the store is
   navigated, **Then** the selected theme is legible and non-essential animation is
   reduced or removed.
3. **Given** a user navigates by keyboard, **When** they use search, cart, checkout, or
   account controls, **Then** focus is visible and controls have accessible names.

### Edge Cases

- The source backup is missing, damaged, or inconsistent; migration MUST stop before
  online writes are enabled.
- A migration is retried after partial failure; it MUST not duplicate records or corrupt
  relationships, and the operator MUST be able to identify its completion state.
- The target database or deployment binding is missing or points to an unexpected
  environment; release or migration MUST fail safely without modifying another database.
- Two customers attempt to buy the last unit concurrently; at most one purchase may be
  approved and stock MUST NOT become negative.
- A simulated payment is rejected, repeated, or retried; it MUST never charge money or
  reduce stock more than once.
- The administrator submits an incorrect current password, weak/invalid new password,
  malformed email, or email already used by another account; no partial credential
  change may be persisted.
- A password change occurs while other sessions are active; those sessions MUST be
  revoked without exposing the new password.
- A Firebase email verification link expires, is reused, or the address becomes unavailable
  before confirmation; the old email MUST remain authoritative and the request can be
  safely restarted without a partial D1 update.
- After a new administrator email is verified, every previous D1 application session,
  including the session that requested the change, MUST be revoked; access requires a
  new sign-in using the updated email.
- If an administrator submits a new email and password together, reject the request
  before contacting Firebase or changing D1; the administrator performs each change in
  a separate operation and signs in again after each completed change.
- A customer registration or second change uses an administrator's reserved pending
  email; reject it generically without creating a provider identity, disclosing the
  reservation, or canceling the owner's request.
- A mobile viewport has long product names, validation errors, or wide administrative
  tables; controls remain usable without clipping primary actions.
- The free-plan capacity or a platform limit is reached; users receive a safe error,
  persisted data remains consistent, and no misleading success is shown.
- Internet connectivity is interrupted during checkout; retries MUST not duplicate an
  order or incorrectly confirm payment.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The online JM-STORE storefront and API behavior MUST be available through
  Cloudflare Workers using project source from the GitHub repository
  `JM-STORE-ECOMMERCE-SDD`. This deployment MUST operate independently of the earlier
  JM-STORE project and its deployment. It MUST use a newly created Worker and D1 database
  in the same Cloudflare account with unique names and independent routes/bindings, and
  MUST NOT modify or reuse any resource belonging to the old project. It MUST NOT require
  the local Express process to remain running.
- **FR-002**: The online application MUST provide persistent Cloudflare D1 storage for
  catalog, categories, prices, inventory, customer accounts, addresses, carts, orders,
  order items, and simulated payment attempts.
- **FR-003**: The current local React/Vite, Express, and SQLite application MUST remain
  operable, and the online deployment MUST NOT overwrite, delete, or redirect its local
  database or configuration.
- **FR-004**: Customers MUST be able to browse categories, search and filter products,
  view details and images, and see persisted current prices and stock.
- **FR-005**: Customers MUST be able to add, remove, and change cart quantities; the
  displayed total MUST reflect persisted current prices and available stock.
- **FR-006**: Customers MUST be able to register and sign in with email and password through Firebase Authentication on the free Spark plan, manage their profile and addresses, and view their persisted orders and statuses. The Cloudflare Worker MUST verify Firebase ID tokens and resolve account status and roles from D1 using the verified Firebase UID. Registration MUST reject a reserved pending administrator email before creating a Firebase identity, with a generic message and no account disclosure.
- **FR-007**: Checkout MUST record an order and simulated payment outcome without collecting banking data or initiating a real charge.
- **FR-008**: A rejected simulated payment MUST retain a retryable order and MUST NOT reduce inventory. An approved simulated payment MUST confirm the order and reduce inventory once, consistently, including when requests are repeated or concurrent.
- **FR-009**: Authorized administrators MUST be able to manage products, images, categories, prices, promotions, inventory, customers, and order states within the existing approved commerce rules.
- **FR-010**: The administration area MUST provide **Mi cuenta → Seguridad** for an administrator to change email and password after Firebase reauthentication with the current password.
- **FR-011**: Email changes MUST enforce valid format and uniqueness against current account emails and pending changes. After Firebase reauthentication, a change request MUST reserve its normalized target email in D1; registration and other changes MUST reject that address generically until the request is confirmed, canceled, or expired. The request MUST remain pending until the new address is verified through Firebase; the old address remains authoritative until confirmation, then the Firebase identity and D1 email MUST be reconciled, all D1 application sessions MUST be revoked, and a new sign-in with the updated email MUST be required. Password changes MUST enforce the approved password validation rules, rely on Firebase to invalidate refresh tokens and invalidate every D1 application session including the current one, and require a new sign-in. A single security request MUST change only the email or the password, never both; combined submissions MUST be rejected before any provider or D1 mutation. Failures or uncertain outcomes MUST be reported safely and reconciled without claiming that the two systems committed atomically.

- **FR-012**: Only an authenticated administrator MUST be able to view or modify
  administrator security settings. Customer registration MUST NOT create or promote an
  administrator account.
- **FR-013**: The application MUST protect passwords through Firebase Authentication, verify Firebase ID tokens in the Worker, and protect session material, deployment credentials, and personal data from public source control, browser storage where inappropriate, logs, and unauthorized access. It MUST provide safe user-facing error messages and server-side authorization.
- **FR-014**: Initial administrator access MUST be established through a private, documented Firebase account and D1 role provisioning process; no public default administrator credentials may be provided. Customer registration MUST never assign an administrator role.
- **FR-015**: Migration from the existing local data MUST have a documented inventory of
  included data, preserve entity relationships and historical order/payment snapshots,
  and leave the original SQLite data intact. The migration MUST be a one-time validated
  copy; after cutover, local and Cloudflare data operate independently without ongoing
  synchronization.
- **FR-016**: Before the online store accepts commerce writes, migration validation MUST
  compare source and target record counts, verify relationships, and compare representative
  stock quantities and order totals. Failure MUST block cutover and leave a recoverable
  source.
- **FR-017**: The project MUST provide repeatable, ordered schema changes and protected
  backups with a documented restore path. A recovery check MUST be completed before any
  destructive migration or data conversion.
- **FR-018**: Cloudflare and Firebase Authentication usage MUST prioritize their free plans. The project MUST remain on Firebase Spark and MUST NOT enable Identity Platform or Blaze billing without separate approval. Current quotas, email limits, abuse controls, and any service availability constraints MUST be verified before setup and deployment; reaching a limit MUST not silently lose or corrupt data.
- **FR-019**: The deployed storefront and administration workflows MUST retain JM-STORE's
  yellow, electric-blue, and white identity, banners, categories, product cards, cart,
  animations, and light/dark modes, with no unsupported commercial claims.
- **FR-020**: The storefront and administration interface MUST be responsive and
  accessible on phones and computers, support keyboard navigation and visible focus, and
  respect reduced-motion settings.
- **FR-021**: Automated functional and integration tests MUST verify customer purchase,
  admin access and management, credential changes, data persistence, migration safety,
  authorization, and responsive/accessibility-critical behavior without modifying the
  live local database.
- **FR-022**: User-visible prices and totals MUST use Peruvian soles (S/) and match
  server-calculated persisted values.

### Key Entities *(include if feature involves data)*

- **Product and Category**: Sellable items, their category, description, images, price,
  and active status.
- **Inventory and Movement**: Available product quantities and the recorded changes
  associated with approved commerce or administration actions.
- **Customer and Administrator**: D1 account identity linked to a Firebase UID, role, contact information, and active state; Firebase Authentication owns password credentials, and an administrator has the additional authority to manage the store.
- **Pending Email Change**: One request per administrator containing the normalized proposed email, request/expiry state, and owning account; the proposed email is unique across current account emails and other pending requests, and is released after confirmation, cancellation, or expiration.
- **Address**: A customer's delivery details, owned by that account.
- **Cart and Cart Item**: A customer's selected products and quantities before checkout.
- **Order and Order Item**: A purchase record with customer, status, total, and immutable
  product/price snapshots for its lines.
- **Simulated Payment**: A non-financial record of an approved or rejected attempt linked
  to an order; it contains no bank credentials and triggers no real charge.
- **Session**: A revocable authenticated visit associated with a customer or administrator account, bound to a verified Firebase UID and revocable/versioned in D1.
- **Firebase Identity**: The email/password credential and Firebase UID managed by Firebase Authentication; JM-STORE authorization roles and commerce data remain in D1.
- **Migration and Backup Record**: Evidence of migration/version and recovery artifacts
  needed to prove the data copy is complete and recoverable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a demonstration, a new customer can register, find an item, add it to a
  cart, complete an approved simulated purchase, and view the resulting order in under
  4 minutes.
- **SC-002**: After a successful migration, 100% of included source records are accounted
  for by entity, all required relationships validate, and sampled order totals and stock
  quantities match the source.
- **SC-003**: The local SQLite database remains readable and unchanged by deployment and
  migration operations, verified by a pre/post integrity check and representative data
  comparison.
- **SC-004**: In 100 repeated or concurrent attempts against one remaining unit, no more
  than one approved purchase consumes that unit and inventory never becomes negative.
- **SC-005**: A valid administrator credential change succeeds, old credentials fail,
  new credentials succeed, and invalid or unauthorized attempts change zero account
  fields.
- **SC-006**: Every administrative route tested rejects unauthenticated users and
  customer-role accounts without changing protected data.
- **SC-007**: At 360 px and 1280 px viewport widths, 100% of critical customer and admin
  tasks in the acceptance suite can be completed without page-level horizontal overflow.
- **SC-008**: For the acceptance catalog of 100 products, at least 95% of searches show
  results within 2 seconds under the documented free-plan test conditions.
- **SC-009**: All required functional, migration, security, and responsive acceptance
  tests pass before public cutover; migration and restore checks report no missing
  included records or broken relationships.
- **SC-010**: The online store records zero real charges and requests zero banking
  credentials across all checkout outcomes.

## Assumptions

- The source of application code is the existing `JM-STORE-ECOMMERCE-SDD` GitHub
  repository; the deployment and D1 target are new resources in the same Cloudflare
  account, separately named and routed, and will not reuse or modify the older JM-STORE
  project.
- The existing local SQLite database remains the authoritative source until migration
  is validated and an explicit cutover is approved. Migration is a one-time copy; the
  local database is retained as a recoverable, independently operable copy and subsequent
  local changes are not synchronized to Cloudflare (or vice versa).
- The deployed application retains current customer, administrator, catalog, inventory, order, and simulated-payment behavior. Firebase Authentication is the sole approved external identity integration for the online application; no real payment processing, external shipping, or other unrequested integrations are added.
- The current administrator is authorized to update their Firebase email and password after reauthenticating with the current password, but only one credential changes per security request. A new email remains pending and the old email remains authoritative until the new address is verified through Firebase; D1 is reconciled after confirmation and all application sessions are revoked so the administrator signs in again with the updated email. A later password change is a separate request after that login.
- Existing local accounts may retain their credentials only if Firebase's documented scrypt import accepts the exact local hash format and a synthetic sign-in proves it. Otherwise real-account migration remains blocked pending a separately approved, verifiable recovery path; no plaintext password export or weaker hash is allowed.
- A successful administrator password change revokes all sessions, including the current
  one; the administrator signs in again with the new password.
- Data migration includes products, categories, prices, inventory and movements,
  customers, addresses, carts, orders, order lines, payment attempts, and the relationships
  required for audit and customer history. No personal data is used in public demo output.
- The free plan is a cost priority, not a guarantee of unlimited capacity or a substitute
  for verifying current quotas, retention, and backup options during Plan.
- User-facing prices remain in Peruvian soles and payment outcomes remain explicitly
  simulated with no real charge.
