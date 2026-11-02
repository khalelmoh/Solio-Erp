# Private PostgreSQL staging runbook — 0.12.0

The selected target is Vercel for the static frontend, an independent persistent Node24 API host, and one Supabase PostgreSQL database/private schema. Local verification uses disposable PostgreSQL17.6; it does not establish actual Supabase readiness. Use a currently supported, patched database on the real target and rerun acceptance there.

## Vercel build requires the hosted API address

If `npm run build:vercel` exits with `ERP_BACKEND_ORIGIN` missing or invalid, the frontend has no configured API destination. In the Vercel **Solio-Erp** project, open **Settings > Environment Variables** and set `ERP_BACKEND_ORIGIN` to the actual hosted Node API's HTTPS origin, without `/api` or another path. Enable it for each deployment environment you use, then redeploy; changing a local `.env` does not configure Vercel. The build intentionally fails until a destination is configured.

The Supabase project/database endpoint is not this API address. Provision and verify the persistent Node24 API host connected to the single Supabase PostgreSQL database first if no API host exists. Do not substitute a made-up address, a local `127.0.0.1` URL, or disable the build guard to obtain a successful but nonfunctional frontend deployment.

Configure a matching private `ERP_PROXY_SECRET` on Vercel and the backend, and set backend `ERP_PUBLIC_ORIGIN` to the actual frontend HTTPS origin with secure cookies enabled. Keep PostgreSQL credentials, record keys and migration credentials on the backend. Verify `/api/health`, authentication, authorization and financial/report behavior on the actual staging target before treating deployment as complete.

The npm `Unknown env config "cache-dir"` warning does not explain this missing-origin failure. A manually configured npm cache setting should use `NPM_CONFIG_CACHE`; retain the actual final error and exit code when diagnosing builds.

## Backend and database configuration

Use [supabase.env.example](../deploy/supabase.env.example). Keep the actual backend file, record key, independent backup key, database URLs and proxy secret outside source/releases. Configure real HTTPS and private ingress; disable live transports and automatic deletion. Application identities/MFA and HR/project permissions remain in the ERP. Supabase Auth, Edge Functions and Storage are not substituted for them.

Use a direct or **session-mode** connection. Transaction-mode pooling/port6543 is rejected because this runtime owns transaction-scoped clients and session settings. Remote connections require `ERP_POSTGRES_TLS=true`, certificate verification and `ERP_POSTGRES_CONNECTION_MODE=direct` or `session`. Supply the provider CA through `ERP_POSTGRES_CA_FILE` when required; URL SSL overrides and disabled certificate verification are rejected.

Set **max_locks_per_transaction=512** before migration and restart the database. Concurrent migration/recovery/report rehearsals exhausted the disposable server's default64 allocation; the512 configuration passes verification. Startup checks this requirement. This is a measured initial staging profile, not a capacity guarantee. Supabase documents the [configuration setting and restart requirement](https://supabase.com/docs/guides/database/custom-postgres-config); actual provider configuration is unverified.

Use a fixed `ERP_POSTGRES_SCHEMA=erp_private` across releases. Never derive the authoritative schema/database from a release ID or run independent writable replicas. API startup never creates a schema/database or falls back to `ERP_DB`. Recovery and test copies must be explicitly separate, fenced destinations.

## Roles and exposed access

Keep privileged migration credentials in a separate protected migration environment file. Migrations create the `erp_backend` NOLOGIN role, private tables, forced RLS and policies for that backend role. Create a separate non-owner LOGIN with no superuser, CREATEDB, CREATEROLE, replication or BYPASSRLS privileges, grant it `erp_backend`, and set its password through an approved private provider/psql flow. Put only this constrained login's URL in the backend secret file. API startup rejects unsafe runtime privileges.

The application schema is not intended for Supabase Data API exposure. Migrations revoke schema/table/function access from PUBLIC and any existing `anon`, `authenticated` and `service_role` roles. No browser receives a database URL or service-role key. RLS grants the trusted backend access; employee/project authorization is enforced by the existing authenticated Node routes. Migration/key metadata is backend SELECT-only. Audit and operation receipts cannot be rewritten by the backend role.

Review the actual project's exposed schemas, effective/inherited grants, function privileges, extensions and any existing public Storage buckets before access is opened. These cannot be confirmed without project access. Attachments remain private PostgreSQL bytea/encrypted records; this release creates no Storage bucket or public attachment link. [Supabase access model](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Build, initialize and release

Install Node24 on the persistent API host; initial sizing is a2vCPU/4GiB proposal requiring target measurement. Keep configuration/keys and backup status under protected persistent paths outside release directories. PostgreSQL contains application data, attachments and job queues. The compiled runtime lives inside the release and can be rebuilt; it is not a database copy.

```sh
npm ci
npm run check
npm run build:postgres
node --env-file=/etc/erp-staging/migration.env scripts/postgres-migrate.js
node --env-file=/etc/erp-staging/backend.env scripts/postgres-tools.js preflight
node --env-file=/etc/erp-staging/backend.env src/server.js
```

Build on the actual host: generated imports are bound to that release's canonical source paths. The API checks source/asset hashes and applied migration checksums before use. `npm prune --omit=dev` is permitted after building; the running API does not need TypeScript. All business rules remain in the existing canonical service, not a separately maintained accounting implementation.

For an empty user database, use `scripts/init.js` with the protected backend environment and actual synthetic staging administrator configuration. Production requires a private MFA enrollment destination and prohibits demonstration credentials. Do not print passwords, enrollment seeds or recovery codes. Assign distinct preparers, approvers and auditors through existing controls; configure periods, funding policies and budgets. No legal/payroll policy or real opening balance is approved by this setup.

For upgrades, stop posting, retain a successful encrypted backup receipt, rehearse restore/migration on a separate database, stop the old API and worker timer, apply migrations with separate migrator credentials, and start exactly one new API. The [release script](../deploy/staging-release.sh) and systemd templates prepare these operations; Linux/systemd execution is unverified locally. No automatic destructive database rollback is supplied.

## Jobs, health and private access

Keep `ERP_TRANSPORTS_ENABLED=false`. Configure one authorized worker account and one scheduling path, either the API scheduler or the systemd worker timer, never both. `scripts/worker.js` dispatches to the selected backend. Normal internal scans are verified locally; a restored/quarantined database skips jobs. Actual scheduled execution remains a target check.

`/healthz` and `/api/health` query PostgreSQL and report failure when unavailable. The latter identifies build/provider/instance and synthetic enforcement. Configure the private gateway/Vercel deployment protection, reviewed HTTPS reverse proxy, `ERP_PUBLIC_ORIGIN`, secure cookies and matching proxy secrets. Exercise login, MFA, unauthenticated rejection, CSRF/origin controls and protected downloads on that actual origin.

Use the [staging probe](../scripts/staging-probe.js) with an approved authenticated header file: capture financial IDs/totals/attachments, restart/redeploy, then verify a changed instance and preserved data. Local restart evidence is not actual-host persistence or HTTPS evidence.

## Consistent backup and isolated recovery

```sh
node --env-file=/etc/erp-staging/backend.env scripts/postgres-tools.js backup /restricted/unused.erpbackup
node --env-file=/etc/erp-staging/recovery-migrator.env scripts/postgres-tools.js restore /restricted/unused.erpbackup /restricted/unused-record-key.key
```

The Node backup holds a repeatable-read, read-only PostgreSQL snapshot across every application table, including attachments, audit, approvals and encrypted HR data. Its AES-256-GCM archive contains the record key under an independent32-byte backup key. Credentials are excluded. Archive and recovered-key files receive restrictive permissions. The default logical payload bound is64MiB; larger databases require the reviewed pg_dump/PITR procedure and separate verification rather than an unbounded in-memory backup.

Restore only into an **unused schema in a separate recovery database/project**, using recovery-only migrator credentials. The tool recreates reviewed constraints/guards, imports before immutable posting guards become active inside the migration transaction, verifies every count/row hash, binds the recovered record key, revokes sessions/reset/SSO attempts and persists quarantine. The record-key destination must be unused. Wrong keys, modified archives and overwrite attempts are rejected. Restart using the recovered protected key, with all outbound services and automatic deletion disabled.

Finance/security must verify authentication, private HR/financial attachments, audit/approval history, payroll/advance liabilities, trial balance and source totals. Record the recoverable snapshot cutoff and any later transactions absent from it. The local measured restore is not an offsite/PITR/RTO/RPO claim. A restore is not a production promotion.

The [pg_dump/age backup procedure](../deploy/staging-postgres-backup.sh) remains an additional host-level option. Configure scheduled encrypted backups, offsite copy and a specifically authorized failure-test sink; retain a delivered alert receipt and restore evidence. Actual scheduler, offsite durability and failure-notification delivery are unverified. No alert or real external transaction was sent during this task.

## Disposable local verification

Use an isolated local cluster, configured with the lock setting above. Its server/roles are separate from saved SQLite and UAT. This workspace's portable cluster binds only127.0.0.1:55432. The test setup refuses remote hosts:

```powershell
$env:ERP_PG_DISPOSABLE='true'
npm.cmd run setup:postgres:tests
npm.cmd run test:postgres
npm.cmd run test:postgres:browser
npm.cmd run verify:postgres:recovery
npm.cmd run demo:postgres
```

An alternative disposable owner URL can be supplied through `ERP_PG_TEST_OWNER_URL_FILE`; do not put secrets on the command line or in source. Config/keys stay in ignored `.cache/postgres`. Tests create UUID schemas and remove only their own fixtures. The recovery verifier creates a fresh labelled `.cache/postgres-synthetic-UUID.sqlite` and a distinct PostgreSQL recovery database. Its source guard rejects the saved/guided database paths. The SQLite-specific VACUUM/key-copy test is omitted from the PostgreSQL suite; actual PostgreSQL encrypted recovery is verified separately.

The local demonstration starts/resumes port3005 without reading the saved `.env`. Use a private browser and **Local demonstration accounts → Finance → Sign in**, with a separate Manager for approval. Its cookie is `erp_postgres_staging_session`, preserving ordinary ERP/UAT cookies. Local demonstration credentials are never suitable for a deployment. Human findings and real-record pilot authorization remain separate gates.
