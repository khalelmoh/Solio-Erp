# PostgreSQL private-staging candidate — 0.12.0

Finalized2026-10-26. The selected Supabase PostgreSQL/Node architecture is implemented and verified locally against disposable PostgreSQL. No Supabase project, private Node host or public deployment has been configured. Saved SQLite and the paused guided-UAT session were not migrated.

## Implementation and evidence

The [gap inventory](../artifacts/postgres-gap-inventory.json) identified276 tables,496 original protection triggers and46 database-dependent source paths. The [integration design](postgres-integration.md) and [staging runbook](postgres-staging.md) explain the completed async driver, shared-source runtime, schema/dialect conversion, access controls, migrations and recovery.

- Four checksum-verified PostgreSQL migrations preserve application schema13 and install500 posting/immutability guards. The276 application/compatibility tables retain their source structure; two PostgreSQL metadata tables track migrations and the external record-key identity.
- Financial writes use a transaction-scoped advisory lock on one pg client before budget/cash/idempotency checks. Reads use consistent snapshots. Aborted/interrupted connections roll back; no SQLite fallback or second ledger is created.
- Runtime credentials cannot own/alter/truncate protected data. Private-schema grants, forced RLS, approval separation, period locks, immutable audit/receipts and project/general/funding dimensions are enforced. Existing ERP authentication/MFA and encrypted attachments remain authoritative.
- Synthetic import preserves IDs, relationships, integer cents, approvals, timestamps, encrypted attachments and audit. A separate PostgreSQL database restores the encrypted snapshot with quarantine, revoked sessions and the matching recovered record key.

**83 PostgreSQL regression tests passed, zero failures**, plus **all five selected PostgreSQL browser suites**. The complete SQLite regression separately passed212 tests. Focused identity/configuration/staging checks passed10 overlapping SQLite cases, and four local transport checks passed after the Nodemailer10.1.4 security patch. The runtime dependency audit reports zero findings. These automated results do not constitute human acceptance.

The83 PostgreSQL cases include finance/accounting, organization operations, employee permissions, payroll/leave/departure, inventory, OIDC/MFA and native separate-connection controls. The SQLite-specific VACUUM/key-copy test is intentionally omitted from the PostgreSQL run; the implemented PostgreSQL backup/restore has independent evidence. Test logs were captured2026-10-24 and reused without rerunning unchanged workflows; local persistence and recovery-key CLI verification were refreshed2026-10-26.

- [Complete PostgreSQL test log](../artifacts/postgres-final-tests.txt), [five browser suites](../artifacts/postgres-final-browsers.txt), [separate SQLite regression](../artifacts/postgres-sqlite-regression.txt).
- [Current local runtime and restart persistence](../artifacts/postgres-runtime-verification.json), [local staging screen](../artifacts/postgres-local-staging.png).
- [Encrypted migration/recovery](../artifacts/postgres-migration-recovery.json), [restore CLI without the original record-key file](../artifacts/postgres-restore-cli.json).
- [Syntax checks](../artifacts/postgres-syntax.txt), [public-only Vercel artifact](../artifacts/postgres-vercel-build.txt), [runtime dependency audit](../artifacts/postgres-dependency-audit.json). The Vercel artifact uses a reserved.invalid backend and is not a deployment.
- [Source staging package](../artifacts/private-staging-0.12.0.tar.gz), [package checksums/file inventory](../artifacts/postgres-staging-package.json), [verification index](../artifacts/postgres-release.json).

Open **http://127.0.0.1:3005** in a private browser. Use **Local demonstration accounts > Finance > Sign in** and the separate Manager account for approvals. The dedicated cookie preserves existing ERP/UAT sessions. This is a local synthetic PostgreSQL rehearsal, with jobs/transports disabled; it is not the actual hosted Supabase service.

## Numerical proof

| Required project case | PostgreSQL result |
| --- | ---: |
| Approved budget / received funding | $50,000 / $40,000 |
| Actual cost | $6,000 |
| Outstanding commitment | $4,000 |
| Remaining budget | $40,000 |
| Unpaid bill | $2,000 |
| Cash allocation | $36,000 |

[Posted rows/report proof](../artifacts/postgres-original-example.json) and [CSV](../artifacts/postgres-original-example.csv) agree, with balanced journals and unique source line IDs. The separate organization case posts a1000 bill/payment400, leaves payable600 and preserves project metrics. Its consolidated sample has8000 expenses and54600 cash, including prior project payroll. [Migration/recovery proof](../artifacts/postgres-migration-recovery.json) compares all276 tables by count and row hash, verifies financial and private HR attachments, audit/approvals/authentication, rejects wrong keys/corruption/overwrite, and excludes a post-backup transaction.

## Capacity finding and boundaries

Parallel rehearsal exposed PostgreSQL's default64 lock allocation as insufficient. The512 configuration passes and is now a startup requirement; actual Supabase settings must be reviewed and changed with a restart before migration. Local testing used PostgreSQL17.6 on Windows and Node24.22.0; the real target must use a supported, patched version and repeat verification. No hosted performance or resilience guarantee follows from local measurements.

The consistent logical encrypted backup has a64MiB default payload bound. Larger data requires the documented pg_dump/PITR route and separate recovery proof. The code package excludes databases, secrets, keys, cached credentials and reviewer declarations. Build on the real Node host before startup; no generated absolute Windows paths are promoted as a Linux deployment.

## Prioritized remaining target blockers

| Priority | Owner | Exact next action |
| --- | --- | --- |
| P0 | Supabase project owner | Supply the synthetic staging project reference and protected owner/runtime connection files; configure verified TLS, direct/session pooling and the512 lock allocation. |
| P0 | Administrator/security | Select the persistent Node24 host and private HTTPS domain; configure Vercel protection/gateway, proxy secrets and independent MFA accounts. |
| P0 | Database/security owner | Run actual migrations; inspect inherited grants, RLS/functions and exposed Data API schemas/Storage policies; prove browser roles cannot reach protected records. |
| P0 | Recovery owner/Finance | Run scheduled encrypted/offsite backups, deliver a controlled failure alert to an authorized sink, restore into a separate project and verify data/keys/attachments and cutoff. |
| P1 | Administrator/Finance | Measure actual startup, health, restart/redeploy persistence, secure sessions, background scheduling and financial/report/browser results on that target. |
| P1 | Finance/HR/reviewers | Complete remaining actual findings, policy/access/opening validation and explicit real-record pilot authorization. Synthetic technical evidence does not approve statutory policies or a pilot. |

[Current configuration inspection](../artifacts/postgres-target-configuration.json) found no configured staging database URL/project reference, private HTTPS origin or environment access token. Unavailable checks remain unverified. No live payment, email, external account provisioning or public deployment occurred.
