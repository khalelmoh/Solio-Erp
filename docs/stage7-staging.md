# Private staging deployment specification

Updated2026-10-24 for **0.12.0**. Selected architecture: **Vercel frontend + Supabase PostgreSQL + persistent Node24 API**. The PostgreSQL implementation, synthetic migration rehearsal and local encrypted recovery are complete; the actual private target is **not configured or verified**.

Use the current [PostgreSQL staging runbook](postgres-staging.md), [integration/gap inventory](postgres-integration.md), [release/evidence](postgres-release.md) and [environment template](../deploy/supabase.env.example). The older Stage7 statement that the database port was unimplemented is superseded by this release. Historical SQLite performance and completed human observations remain separately scoped.

## Actual target requirements and unverified checks

- One staging-only Supabase project/private schema, constrained runtime login, separate migrator credentials, verified TLS and direct/session-mode connection. Set max_locks_per_transaction=512 and restart before migration. Never expose the private schema through browser/Data API grants or public Storage.
- Persistent supervised Node24 host; initial2vCPU/4GiB sizing requires measurement. Keep keys/config/status/backups outside releases. PostgreSQL owns data, attachments and jobs across releases; no SQLite copy is deployed.
- Private HTTPS domain/Vercel protection or gateway, proxy-secret configuration, secure cookies/origins and real individual MFA accounts. No host/domain or connection files have been supplied.
- Exactly one internal scheduling path with an authorized account, live transports disabled, actual execution receipt and no duplicate scans. Local worker tests are supporting evidence only.
- Scheduled encrypted/offsite backups, an authorized test-alert sink with delivered failure receipt, and restoration into a separate recovery project with the matching keys and quarantine. Local backup/recovery does not establish provider PITR/offsite durability.
- Actual startup and health, restart/redeployment persistence, financial totals/source IDs, protected attachments, authentication and browser checks. Use the [staging probe](../scripts/staging-probe.js) after target configuration; require a changed instance and preserved evidence.

The API rejects missing/unavailable PostgreSQL, unsafe roles, wrong keys, stale build/schema checksums, unsupported pooling, unverified remote TLS and insufficient lock capacity. It cannot silently fall back to saved SQLite. Saved and guided-UAT databases are outside this task; all migration sources are fresh labelled synthetic databases under the protected rehearsal path.

The [readiness register](stage7-readiness.md) identifies owners and exact actions. No real employee or financial records may enter a pilot until applicable policies, access/recovery requirements and explicit scope authorization are satisfied. No new human acceptance or production permission is implied.
