# Supabase PostgreSQL implementation and verification

Current build **0.12.0**, application schema13 / PostgreSQL migrations001?004. [Current release and test evidence](postgres-release.md), [setup/deployment/recovery runbook](postgres-staging.md).

The selected architecture keeps the existing Node API, browser authorization and one financial ledger. Saved SQLite and guided-UAT data are outside this migration task. All rehearsals use isolated synthetic instances.

## Concrete gap inventory

The schema inventory of an empty in-memory database finds 276 tables, 496 protection triggers and 19 explicit indexes across thirteen migrations. 46 source files contain database-dependent code. [Machine inventory](../artifacts/postgres-gap-inventory.json) lists every path and count; [schema inventory](../artifacts/postgres-schema-inventory.json) records columns, constraints, seeds and guards.

1. Async transaction-scoped PostgreSQL driver and all domain/API/worker call paths
2. PostgreSQL schema, exact cents, identities, foreign keys, checks and all immutable/retention triggers
3. Dialect queries and native error normalization
4. Global financial writer lock plus consistent read snapshots, separate concurrent connections and failed-transaction recovery
5. Private-schema least-privilege grants, forced RLS and no browser/Data API or Storage credentials
6. Checksum-verified initialization/upgrades and synthetic import preserving encrypted records and audit
7. Consistent encrypted PostgreSQL backup and isolated restore with session/outbound fences
8. PostgreSQL financial/HR/security/browser acceptance distinct from SQLite evidence
9. Actual Supabase TLS/grants/exposed schemas and private host checks require target access

## Implemented behavior

The async runtime is compiled from the existing canonical domain/API/worker code; it does not maintain a separate set of financial rules. Actual pg I/O is asynchronous and transaction-scoped. Async array callbacks execute in order. Build manifests identify every source hash. SQLite remains supported separately; choosing PostgreSQL must never call the SQLite opener.

Each domain invocation owns a pooled connection through AsyncLocalStorage. BEGIN IMMEDIATE is implemented as READ COMMITTED plus a transaction-scoped advisory writer lock shared by all ERP connections. It serializes initial single-organization financial writes across API/worker instances, before any budget/payment/idempotency read in the transaction. Reads use repeatable-read read-only snapshots. Errors roll back before releasing the connection; interrupted connections roll back in PostgreSQL. This favors correct existing behavior over write parallelism. Actual separate-connection PostgreSQL tests cover concurrent budgets, partial payments/collections, payroll/inventory approvals and duplicate retries; a terminated connection rolls back its published-but-uncommitted journal.

The baseline preserves integer USD cents, IDs, date/JSON/timestamp text and encrypted bytea. All foreign keys/checks/unique references and immutable/retention guard predicates are carried forward. PostgreSQL also rejects inserting an already-posted journal header. Applied migrations have immutable SHA256 checksums.

A dedicated private schema uses forced RLS and a backend-only role, without public/anon/authenticated/service-role grants. Attachments remain private database data; no Supabase Storage bucket or public URL is created. Privileged migration credentials belong only to release tooling, never API runtime or Vercel assets.

## Verification status

Exact completed test counts and artifact links are in the current release report. Historical SQLite results are not PostgreSQL evidence. Actual Supabase project, exposed-schema/Data API/Storage review, remote TLS, private Node host/domain, HTTPS/proxy, scheduled jobs/backups, delivered alerts and service restoration remain unverified until target access exists. Human acceptance and real-record pilot authorization remain separate.

## Remaining gap status

Async runtime, all schema/guard/dialect ports, constrained backend access, synthetic import, native concurrency and encrypted recovery are implemented. The source remains the existing service; generated files are disposable build artifacts checked against canonical source/asset hashes. No synchronous network shim, dual writing or separately maintained ledger was added. PostgreSQL500 guards preserve the original496 and add draft insertion, period, dimension and operation-receipt defenses.

Target work remains: actual Supabase project/TLS/configuration/grants/Data API/Storage verification, a persistent private Node host, scheduled/offsite backup and delivered alert, separate project recovery, and target browser/persistence/job measurements. The configured lock allocation must be at least512; default64 exhausted under parallel rehearsals. Small logical archives are bounded to64MiB; larger backup/PITR requires separate host verification. Human findings, policies and real-record pilot authorization remain outside technical completion.
