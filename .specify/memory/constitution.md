<!--
Sync Impact Report
Version change: 0.0.0 → 1.0.0 (first ratification; establishes binding project principles)
Modified principles: none (initial constitution)
Added sections: Core Principles, Product and Architecture Constraints, Delivery and Governance Workflow
Removed sections: none
Follow-up TODOs: confirm original ratification date; establish by replacing TODO(RATIFICATION_DATE)
-->
# JM-STORE Constitution

## Core Principles

### I. Spec-Driven Development (SDD)
All product work MUST follow the GitHub Spec Kit sequence: Specify, clarify when needed,
Plan, Tasks, then Implement. Each phase MUST produce and review its required artifact
before the next phase begins. Implementation MUST trace to approved specification and
tasks; unrecorded scope changes MUST return to the relevant SDD artifact first. This keeps
the examination deliverable demonstrable and its decisions auditable.

### II. Real, Consistent Commerce Data
Products, prices, customers, inventory, carts as applicable, and orders MUST use a real,
persistent database. The initial architecture proposal is SQLite with a Node.js/Express
API and React/Vite client; any change MUST be justified in the Plan. All writes MUST be
validated server-side and preserve data integrity. Stock checks and order creation MUST
be handled as one consistent operation so concurrent or repeated requests cannot create
orders for unavailable stock or corrupt inventory. UI success states MUST reflect
persisted results.

### III. Secure Access and Protected Information
Customer and administrator authentication MUST be distinct in authorization, with
server-side role checks for every privileged operation. Passwords MUST be stored using a
purpose-built password hashing algorithm; secrets and credentials MUST be supplied
through environment or deployment secrets and MUST NOT be committed to GitHub. Inputs
MUST be validated at trust boundaries, and error responses MUST NOT expose credentials,
sensitive data, or implementation details. Security controls are required because the
application handles accounts, customer data, and purchase records.

### IV. Complete, Usable Shopping Journey
The customer experience MUST support product search and categories, product details,
a functional cart, customer profile, purchase checkout, order registration, and purchase
history. Administrators MUST be able to manage products, prices, customers, inventory,
and orders through authorized workflows. Every visible commerce action MUST have a real
working outcome connected to persisted application data; decorative or simulated
functionality MUST NOT be presented as operational. Prices and monetary totals MUST be
handled and displayed in Peruvian soles (S/), with consistent rounding and server-side
calculation.

### V. Verified Quality and Maintainable Simplicity
The implementation MUST use modular boundaries and the simplest architecture that meets
the approved requirements, avoiding unnecessary dependencies. Functional tests MUST
cover critical customer and administrator flows, including authentication, stock changes,
checkout, and order persistence; validation MUST include relevant integration behavior
across the client, API, and database. Setup, configuration, data model, and operating
instructions MUST be documented in the SDD artifacts and project documentation. Tests
and documentation make the MVP reproducible and demonstrable.

## Product Experience and Design Constraints

JM-STORE MUST have its own visual identity while using the supplied JM-STORE image as the
primary layout and style reference: a prominent header with search and navigation,
category shortcuts, promotional/banner areas, product cards, cart access, and clear
purchase actions. The design MUST use yellow, blue, and white as its core palette and
provide responsive layouts, keyboard-accessible interactions, semantic structure,
visible focus, and sufficient contrast. Light and dark modes MUST both remain usable.
Animations MUST be purposeful, brief, and respect reduced-motion preferences.

Promotions, discounts, installment terms, delivery availability or timing, ratings, and
other commercial claims MUST be based on configured, verifiable data and MUST NOT be
invented or implied by mock content. The reference image guides composition and color;
it does not authorize unsupported commercial promises.

## Technical and Data Constraints

The initial stack proposal is React and Vite for the client, Node.js and Express for the
API, and SQLite for persistence. The Plan MUST define schema ownership, migrations or
repeatable initialization, validation rules, authentication/session handling, and backup
or reset behavior suitable for the examination environment. Client-calculated values
MUST NOT be trusted for prices, permissions, stock, or order totals. Database constraints
and transactional operations MUST enforce invariants in addition to application checks.

## Development Workflow and Compliance

Each feature MUST state its user-visible behavior and acceptance criteria in Specify,
architecture and data decisions in Plan, and independently reviewable work in Tasks.
Implementation MUST include corresponding functional coverage and update affected
project documentation. A reviewer MUST verify SDD traceability, data persistence,
authorization, validation, accessibility and responsive behavior, truthful commercial
content, and critical purchase flows before the MVP is considered complete. Any exception
MUST be recorded with its reason and impact in the relevant SDD artifact.

## Governance

This constitution governs JM-STORE project decisions and is binding on specifications,
plans, tasks, implementation, and reviews. Amendments MUST be made through the Spec Kit
constitution workflow, include a Sync Impact Report, and update the version and amendment
date. Governance changes MUST be reviewed for impact on existing SDD artifacts; affected
artifacts MUST be reconciled before related implementation proceeds.

Constitution versions use semantic versioning: MAJOR for incompatible governance changes
or removal/redefinition of a principle; MINOR for new principles, sections, or materially
expanded requirements; PATCH for clarifications and non-semantic wording corrections.
Every change MUST receive a compliance review against these principles. The original
ratification date is currently unknown and MUST be confirmed in project history; until
confirmed, the explicit TODO below remains.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE): confirm original adoption date | **Last Amended**: 2026-11-03
