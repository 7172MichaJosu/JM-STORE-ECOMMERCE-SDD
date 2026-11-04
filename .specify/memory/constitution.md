<!--
Sync Impact Report
Version change: 1.0.0 → 1.1.0 (material expansion for a separate Cloudflare deployment)
Modified principles: II. Real, Consistent Commerce Data → II. Persistent, Consistent Data Across Environments; III. Secure Access and Protected Information → III. Secure Access, Sessions, and Account Changes; V. Verified Quality and Maintainable Simplicity → V. Verified Quality, Recovery, and Maintainable Simplicity
Added sections: Cloudflare Deployment and Data Operations
Removed sections: none
Follow-up TODOs: confirm original ratification date; deployment implementation requires its own Specify, Clarify as needed, Plan, Tasks, and Implement workflow
Deferred intent: create and deploy an independent Cloudflare Workers + D1 application without changing the existing local SQLite application or the prior JM-STORE repository
-->
# JM-STORE Constitution

## Core Principles

### I. Spec-Driven Development (SDD)
All product work MUST follow the GitHub Spec Kit sequence: Specify, clarify when needed,
Plan, Tasks, then Implement. Each phase MUST produce and review its required artifact
before the next phase begins. Implementation MUST trace to approved specification and
tasks; unrecorded scope changes MUST return to the relevant SDD artifact first. This keeps
the examination deliverable demonstrable and its decisions auditable.

### II. Persistent, Consistent Data Across Environments
Products, prices, customers, inventory, carts, and orders MUST use a real persistent
database. The existing local application MUST retain its SQLite database and continue to
work independently. A separately deployed Cloudflare application MUST persist its data in
Cloudflare D1; it MUST NOT silently redirect, overwrite, or replace the local database or
the earlier JM-STORE project. Each environment MUST own its configuration and database
binding explicitly. All writes MUST be validated and preserve relational integrity.
Stock checks, payment simulation, and order creation MUST be atomic and safe under
concurrent or repeated requests. UI success states MUST reflect persisted results.

### III. Secure Access, Sessions, and Account Changes
Customer and administrator authentication MUST be distinct in authorization, with
server-side role checks for every privileged operation. Passwords MUST use a
purpose-built password hashing algorithm; secrets MUST be stored only in local ignored
configuration or the deployment platform's secret store, never in source control, client
bundles, logs, or public documentation. Inputs MUST be validated at trust boundaries,
sessions MUST be protected and revocable, and errors MUST NOT expose credentials or
sensitive implementation details.

Administrators MUST be able to change their own email and password through an authenticated
flow requiring current-credential verification. New credentials MUST satisfy validation
rules; email changes MUST enforce uniqueness and commit consistently. Password changes
MUST invalidate other active sessions, and credential changes MUST produce an auditable
security event without recording secret values. Account changes MUST NOT permit public
registration or a customer account to acquire administrator privileges.

### IV. Complete, Usable Shopping Journey
The customer experience MUST support product search and categories, product details,
a functional cart, customer profile, checkout, order registration, and purchase history.
Administrators MUST be able to manage products, prices, categories, customers, inventory,
and orders through authorized workflows. Every visible commerce action MUST have a real
working outcome connected to persisted application data; decorative or simulated
functionality MUST NOT be presented as operational. Prices and totals MUST use integer
minor units internally and display Peruvian soles (S/); the server MUST calculate and
validate payable totals.

### V. Verified Quality, Recovery, and Maintainable Simplicity
The implementation MUST use modular boundaries and the simplest architecture that meets
approved requirements, avoiding unnecessary dependencies. Automated tests MUST cover
critical customer and administrator flows, including authentication, stock changes,
checkout, and order persistence, with integration coverage across the client, API, and
database where applicable. Tests MUST use isolated data and MUST NOT mutate production or
demonstration databases. Setup, configuration, data model, migrations, backup, restore,
and operating instructions MUST be documented. Schema changes MUST be repeatable,
versioned, and tested before deployment. A backup MUST be verified as restorable before
any destructive migration or data conversion.

## Product Experience and Design Constraints

JM-STORE MUST keep its own visual identity and use the supplied JM-STORE image as the
primary layout and style reference: prominent header with search and navigation, category
shortcuts, banner areas, product cards, cart access, and clear purchase actions. The design
MUST use yellow, blue, and white as its core palette and provide responsive layouts,
keyboard-accessible interactions, semantic structure, visible focus, and sufficient
contrast. Light and dark modes MUST remain usable. Animations MUST be purposeful, brief,
and respect reduced-motion preferences. A deployment MUST preserve the approved visual
design and customer/admin capabilities unless a later approved specification changes
them.

Promotions, discounts, installment terms, delivery availability or timing, ratings, and
other commercial claims MUST be based on configured, verifiable data and MUST NOT be
invented or implied by demonstration content. The reference image guides composition and
color; it does not authorize unsupported commercial promises.

## Technical and Data Constraints

The existing local application MUST retain its React/Vite client, Node.js/Express API,
and persistent SQLite database. A Cloudflare deployment MUST be a separately configured
application with its own deployment entry point and Workers-compatible server runtime;
it MUST NOT require the local API or alter its runtime. Its persistent commerce data MUST
use Cloudflare D1 through an explicit binding. Shared business rules and user-visible
behavior MUST remain consistent across local SQLite and deployed D1 environments.

Schema ownership, constraints, authentication/session handling, and data lifecycle MUST
be explicit in the relevant Plan. SQLite and D1 schema changes MUST use tracked, ordered,
repeatable migrations with environment-specific execution. Migration tooling MUST refuse
an unexpected target environment and report the database identity before applying
changes. Backups and any SQLite-to-D1 transfer MUST preserve relationships, money values,
password hashes, inventory, carts where in scope, order snapshots, and payment simulation
records. A transfer MUST be checked for row counts, relational integrity, and representative
totals before the deployed application accepts writes. Source data MUST remain intact
until recovery has been verified; rollback or a documented restore path MUST exist.

Client-calculated values MUST NOT be trusted for prices, permissions, stock, or order
totals. Database constraints and transactional operations MUST enforce invariants in
addition to application checks. Customer data MUST be limited to the intended purpose,
protected in transit and at rest by the chosen platform, and omitted from logs and public
artifacts unless explicitly required and approved.

## Development Workflow and Compliance

Each feature MUST state user-visible behavior and acceptance criteria in Specify,
architecture and data decisions in Plan, and independently reviewable work in Tasks.
Implementation MUST include corresponding functional coverage and update affected
project documentation. A reviewer MUST verify SDD traceability, persistence in the target
database, authorization, validation, accessibility, responsive behavior, truthful
commercial content, migration safety, recovery readiness, and critical purchase flows
before the MVP is considered complete. Cloudflare deployment and data migration MUST be
planned and implemented as a separate feature; they MUST NOT be performed during a
Constitution-only amendment. Any exception MUST be recorded with its reason and impact in
the relevant SDD artifact.

## Cloudflare Deployment and Data Operations

The Cloudflare Workers + D1 deployment MUST be isolated from the existing JM-STORE local
project and the earlier JM-STORE GitHub repository. It MUST use a separately identified
repository or deployment target, explicit environment bindings, and independently
managed secrets. Deployment commands MUST target only the approved new application. No
deployment or migration command may infer a production target from a developer's default
account, project, or database.

Administrator credential changes MUST be available to the administrator after deployment
and operate on the deployed identity data. Initial administrator provisioning MUST use
a private setup path; there MUST be no public default credential. Session cookies and
tokens MUST use platform-appropriate secure attributes, CSRF/origin controls where
applicable, limited lifetime, and server-side revocation. Credential changes MUST not
expose password material in responses, telemetry, or backups outside the protected
database contents.

D1 migrations MUST be applied only after a verified backup or recoverable export and a
successful check against a non-production database. Backups MUST be protected from public
access and secrets MUST NOT be embedded in them or their filenames. After migration or
restore, automated checks MUST verify schema version, foreign keys, account access,
inventory, and representative order totals before writes are enabled. Operational
documentation MUST identify the target, backup location, restore procedure, and recovery
verification without publishing credentials.

## Governance

This constitution governs JM-STORE project decisions and is binding on specifications,
plans, tasks, implementation, and reviews. Amendments MUST use the Spec Kit constitution
workflow, include a Sync Impact Report, and update the version and amendment date.
Governance changes MUST be reviewed for impact on existing SDD artifacts; affected
artifacts MUST be reconciled before related implementation proceeds.

Constitution versions use semantic versioning: MAJOR for incompatible governance changes
or removal/redefinition of a principle; MINOR for new principles, sections, or materially
expanded requirements; PATCH for clarifications and non-semantic wording corrections.
Every change MUST receive a compliance review against these principles. The original
ratification date remains unknown and MUST be confirmed from project history; until
confirmed, the explicit TODO below remains.

**Version**: 1.1.0 | **Ratified**: TODO(RATIFICATION_DATE): confirm original adoption date | **Last Amended**: 2026-11-04
