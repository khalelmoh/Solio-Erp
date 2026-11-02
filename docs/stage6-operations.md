# Release, recovery and operator procedures

Version 0.9.0 / schema 12. Local verification is recorded in [readiness report](stage6-readiness.md); requirements coverage is [mapped separately](stage6-coverage.md). No public deployment, hosting purchase, real payment submission or human signoff is authorized by this work.

## Configuration and clean installation

Use Node 24 LTS for the supplied container target. The global developer runtime is Node 25.2.1 and was preserved. Stage 6 additionally downloaded/checksum-verified portable Node 24.22.0 and passed all180 tests and ten browser suites on Windows. The local app now uses it. The Linux container/hosting target remains unverified. Example files separate development, staging and production under `deploy/`. Replace reserved `.invalid` domains and example paths with reviewed configuration. Never point staging or UAT at the production database, key, mailbox, identity directory or payment account.

Install the lockfile with `npm.cmd ci`. Run `npm.cmd run check`, `npm.cmd test` and `npm.cmd run test:browser`. Native browser/server JavaScript needs no transpilation. `npm.cmd run build:vercel` requires `ERP_BACKEND_ORIGIN`; Stage 6 used `https://backend.staging.example.invalid` solely to validate the local build artifact, not to claim a connected backend. Generated static assets exclude demonstration login shortcuts and default passwords. `.vercelignore` excludes database/key/environment/evidence files.

For Vercel, keep the Node service, database, worker and keys on persistent storage. Configure the actual public frontend origin, secure cookies and identical strong `ERP_PROXY_SECRET` on backend and Vercel runtime. Verify the secret request-header transform, authenticated same-origin requests and cache exclusion on the actual target. This remains unverified. Direct HTTPS/Caddy deployment is also prepared in `Dockerfile` and `compose.yaml`; Docker was unavailable here. Do not use the local SQLite file as ephemeral Function storage.

## First administrator and authentication

Create a fresh production database with `npm.cmd run migrate`; never seed demonstration data in production. Before `npm.cmd run init`, provide `ERP_ADMIN_EMAIL`, a unique password from your secret store, the external database master key and an unused protected `ERP_ADMIN_MFA_SEED_FILE` in a private directory. Production bootstrap refuses missing MFA material, an existing user database or the known demonstration password. It writes authenticator enrollment and single-use recovery codes to the protected file, never console/audit. Import the secret privately, test an MFA login, store recovery codes separately and dispose of the temporary enrollment file under the security policy. The operator must restrict access to the parent directory as well as the file.

Production requires strong authentication for privileged accounts. Local TOTP and one-use recovery codes are supported. Organization OIDC validates issuer, signature, state, nonce, PKCE and existing-account mapping. Configure `ERP_OIDC_MFA_ACR` only to an assurance value actually supported and approved by the identity provider. Provider MFA is accepted only when signed `acr` matches and signed `amr` includes `mfa`; otherwise local MFA is required. The signed local-IdP contract test passed; actual provider challenge/claims and recovery remain unverified. Existing local demo accounts were not forcibly enrolled or locked out.

Login/account and OIDC throttles persist in SQLite for 15 minutes. Account failures survive application restarts; the socket rate limit does not blindly trust forwarded client-IP headers. Behind Vercel/shared proxies, tune and verify gateway rate limiting and trusted client identity on the actual target. Existing sessions expire after eight hours. Password changes, reset, session revocation, role removal, membership changes and departure invalidate sessions; changed permissions are checked on the server. Disabling an account also blocks direct actions, worker actions and financial journals; re-enabling it does not bypass departure or MFA.

In **Account security**, an administrator can issue another account a 15-minute one-use password-reset token after confirming their current password. Transfer it only through the approved private channel. The recipient uses the login reset form. This invalidates old sessions and preserves MFA; it does not send an unauthorized email or disable authenticators. Passwords, reset tokens, authenticator seeds and recovery codes must not be put in tickets, screenshots or shared logs. Privileged-role enrollment and real identity recovery must be rehearsed by the security owner.

## Backup, keys and retention

All uploaded project, accounting and HR documents are stored inside SQLite, so the consistent database snapshot includes them. `npm.cmd run backup` remains a legacy paired local migration-copy command; it does **not** encrypt the whole database and is not the production backup procedure. Existing local copies were preserved.

For production, provide a protected 64-hex-character `ERP_BACKUP_KEY_FILE` different from the database master key, `ERP_BACKUP_DIR`, an explicit `ERP_BACKUP_RETENTION_DAYS`, and optionally `ERP_BACKUP_CONFIG_FILE` and `ERP_BACKUP_STATUS_FILE`. Then schedule:

```powershell
npm.cmd run backup:encrypted
```

The command takes a SQLite-consistent snapshot, verifies integrity/FKs, packages table counts/checksum and safe configuration, and encrypts the entire archive with AES-256-GCM. The database master key and live service secrets are not included. The authenticated manifest checks the separately supplied recovery database key. Protect recovery credentials and both keys, their version-to-archive inventory and recovery codes in independently managed recovery storage; a backup without either required key is not recoverable. Snapshot temporary files, archive files and bootstrap material are restricted to the current OS/service identity using Windows ACLs or POSIX modes. Parent-directory ACLs, volume encryption, offsite replication, retention immutability and secret-vault recovery still need target verification.

Retention accepts 1–36500 explicit days, authenticates each matching `folio-backup-*.erpbackup` archive before removal, rejects symlinks and always retains at least two matching archives. It never removes unrelated files or legacy backup pairs. The actual days are an organizational choice, not a statutory minimum. Large archives currently require memory proportional to snapshot size; the tested archive was only a few MB. Measure memory and restore duration at real production volume before adoption.

Backup success/failure writes a restricted status file; failure exits nonzero. **Account security** and administrator `/api/jobs` show missing, stale or failed backup status. Set `ERP_BACKUP_MAX_AGE_HOURS` to the approved maximum. A current status proves a job completed, not recoverability. Integrate nonzero exits/stale status with the actual organization's scheduler and alert system; no live alert destination was supplied or contacted. The operator must monitor both application and backup hosts.

## Restore rehearsal and recovery

Run `npm.cmd run verify:recovery` to reproduce the synthetic encrypted-backup/application-restore proof. It verifies authentication, exact source-table hashes, attachments, approvals/audit, payroll/project/accounting reports and blocked outbound calls. It deliberately posts a transaction after the backup and proves it is outside that snapshot. See `artifacts/stage6-recovery.json` for actual capture time and measured recovery duration, rather than a proposed RTO/RPO.

To restore a real archive, stop and review the incident first, supply `ERP_BACKUP_KEY_FILE` and separately the original `ERP_RESTORE_MASTER_KEY_FILE`, and choose a completely unused **isolated** path:

```powershell
npm.cmd run restore:encrypted -- path/to/archive.erpbackup path/to/isolated-recovery.sqlite
```

The destination is never overwritten. Authenticated archive, checksum, master-key check, counts and integrity must pass. This restore command requires a schema-12 snapshot with persistent quarantine support; older paired snapshots need a separately reviewed migration-and-quarantine process before any application startup. Restored sessions/SSO attempts/reset tokens cannot be reused. Generated recovery configuration binds loopback on port 3002 with jobs/transports off. Persistent quarantine additionally blocks email, provider verification/provisioning, external transactions, SSO and automatic retention even if live credentials/transport flags accidentally remain in the process environment.

Start a restored copy using its explicit `.recovery.env`, never the production `.env`. Independently reconcile trial balance, source cash, supplier/payroll liabilities, advances, commitments, restricted balances, attachments and approval history to the captured timestamp. Record transactions/events after that point from the original system, bank and provider receipts. An operator and Finance owner must review missing/duplicate/external events before promotion. Keep the copy quarantined until that review is signed; do not silently clear the fence to make a test green. Promotion/quarantine release requires an approved recovery/change procedure and audit entry on the actual target; no restored copy was promoted during Stage 6.

Suggested planning targets for the one-project pilot are daily backups, a 24-hour maximum backup age and a four-hour restoration objective. These are **proposals**, not achieved infrastructure RPO/RTO. The measured local synthetic restore excludes operator diagnosis, offsite retrieval, vault recovery, DNS, TLS, provider reconciliation and human approval.

## Upgrade and rollback

Before release, pause writes and outbound jobs, record the latest journal/audit/operation IDs and bank/provider settlement positions, take an authenticated encrypted backup and verify its timestamp/keys. Rehearse `npm.cmd run verify:upgrade` against a restricted separate copy. Stage 6 proved old rows/financial balances/key readability before upgrading the saved local database. Use fresh unused paths when repeating the rehearsal. `npm.cmd run migrate` applies ordered transactions; startup also migrates. Never run multiple application versions writing the same SQLite file.

Roll out the code and compatible schema together, verify `/healthz`, authenticated `/api/health`, login/MFA, permissions, reports and `/api/jobs`, then permit approved users. `/healthz` proves database responsiveness only; it intentionally does not claim legal, provider or financial readiness. `npm.cmd run preflight` must be reviewed rather than bypassed by setting signoff flags. Application failures log a correlation ID/class without raw request data; retain logs in the approved restricted sink and alert on job failures, backup staleness, integrity problems and repeated authorization failures.

If rollback is needed, first stop writes and external execution and capture a **new current backup**. Prefer a forward fix. Schema 12 is additive, but older code does not enforce the new MFA, reset and recovery controls, so backward code compatibility is not a security approval. Rehearse any candidate old code on a current isolated copy; document its accepted control differences before use.

Never restore the pre-release database over newer financial records. For database recovery, preserve the newer file and separately compare all original journal, operation, approval, reversal, attachment and bank/provider records with the candidate restore. Identify every post-snapshot transaction, its dependencies, actual external settlement and reconciliation treatment; obtain Finance approval and reintroduce only validated source records through the supported controlled operations/imports. Reconcile all totals and duplicate identities before switching service. This is a reviewed recovery project, not an automatic replay or deletion of inconvenient balances. No destructive rollback was performed here.

## Role operating guides

**Finance:** verify source eligibility, independently approved invoices/payroll/vouchers and period status before posting. Disburse advances as receivables, accept evidenced costs without paying twice, and return unused cash. Match statements without posting another expense. Reconcile liabilities, controls, source cash, budgets and bank evidence daily; use linked credits/refunds/reversals and authorized open-period corrections. Never waive unexplained differences to close a project/period.

**HR:** verify employee/user ownership, calendar/contract/leave evidence and independent hiring/payroll authority. Keep private documents scoped. Record effective changes rather than overwriting history. Review actual Somaliland entitlements and genuine validation before final pay. Departure revokes access even while salary/equipment remain unresolved. Rehire requires new approvals, allocations and access. Preview due retention and legal holds before approving deletion policy.

**Administrator/security:** map distinct responsibilities and review effective legacy roles, require approved MFA, maintain password/session recovery, provision access only after approval, monitor health/jobs/backups and preserve keys. Approvals, audit and posted financial evidence cannot be ordinarily edited. Validate real provider receipts and TLS/restore behavior before enabling transports; default/demo data and credentials belong only in isolated test environments.

For actual human acceptance and pilot preparation, use [UAT and pilot plan](stage6-uat-pilot.md).

Local workspace launch without changing the global installation: read the executable path from artifacts/stage6-node24-runtime.json and run that Node24 executable with --env-file-if-exists=.env src/server.js. Activate a reviewed supported Node24 installation before using ordinary npm start in another shell. The Docker base is pinned to the tested patch version, but its Linux build/digest must still be verified on an actual container host.
