# Organization workflows and setup — version 0.3.0

The default technical choices are USD base accounting, configurable independent project approvals, SMTP email, HMAC-signed webhooks, optional OpenID Connect organization sign-in, authenticator MFA, and Docker/Caddy HTTPS hosting. No statutory jurisdiction or real tax rates are guessed. Demo payroll rules are explicitly labelled and must not be used for live payroll.

## Local setup and upgrade

Use the existing database. `npm.cmd ci`, `npm.cmd run setup:env`, `npm.cmd run migrate`, and `npm.cmd start` install the locked dependencies, apply new migrations and run the application. Do not reseed an existing database. The saved workspace was upgraded from schema 4 to 5 after a consistent backup at `data/backup-before-0.3.0.sqlite`. Existing users, projects and financial records were preserved. Demo HR is assigned to the administrator; demo payroll is assigned to manager and finance. Change these assignments in **Account security → Assign HR/payroll role** for actual organizational roles.

`npm.cmd test`, `npm.cmd run check`, `npm.cmd run test:browser`, and `npm.cmd run test:load` verify isolated databases. Three browser suites write evidence under `artifacts/`; the load check creates 100 receipts and 100 identical retries with ten concurrent HTTP clients without changing the saved project.

## Vouchers, expenses and corrections

- **Payments & discussions → Request direct expense** submits an ordinary spending approval with an expense mode. Approve it under **Spending & approvals**, then post the receipt-supported expense under **Payments & discussions**. A posting releases that amount of reservation and incurs cost/liability once. A PO or advance cannot be created from an expense or payroll request.
- Prepare a bill, expense, net-payroll or statutory-payroll voucher, independently approve it, then let project finance post it. Submission preserves the allocation and approval policy. A different payment or credit can make a voucher stale; cancel and resubmit it rather than silently moving its approved allocation. References and duplicate posting controls remain enforced. Voucher printing includes actual approval and posting status.
- The migration preserves the old payment endpoint with `require_vouchers=false` so existing workflows do not break. Set **Account security → require_vouchers** to true to prohibit legacy payment posting. The existing Pay bill screen then prepares a voucher. Production preflight requires this control.
- A general adjustment identifies its original journal, rationale, open posting date, balanced accounting lines and matching budget charges. Another eligible approver must approve it before finance posts it. Adjustments must balance within each project/source. Liabilities, advances, funding and supplier receivables use their dedicated document correction workflows. Reverse a linked adjustment before reversing its original.
- Invoice reissue requires reversal of dependent payments/credits and the original bill. A replacement retains the canonical supplier invoice identity and links its correction reason. Only one child reissue is allowed; correcting a replacement requires another full linked reversal. Original records remain visible. Locked-period corrections still require unused, independent authority for the original journal and designated poster.
- Reversing a bill or expense after its request was cancelled removes its cost/liability without recreating cancelled spending authority. A replacement cost needs another approved request/PO. Correcting an active request can restore its still-authorized reservation.

## Comments, delegation and notifications

Comments include a project, document kind/ID, precise location, author and optional parent reply. Resolutions/reopenings append events; they do not edit the original comment. Project membership is checked on each read and write. Emails contain a notice and document reference, not the comment text or payroll data.

An administrator issues a project-specific, time-bounded manager/finance delegation to another project member. It cannot grant posting rights or HR access. Approvals preserve both actor and principal/delegation evidence. Creator/self approval through a proxy, repeated approvers/principals, expired or revoked delegations and re-delegation are rejected. Policies for budget, spending, payment, journal and payroll are configurable and snapshotted when submitted.

Notifications are stored in each recipient's inbox. New comments and spending requests generate notices. An overdue scan creates deduplicated daily bill/advance notices. Run it and the delivery queue on a schedule with:

```powershell
$env:ERP_WORKER_USER='1' # Existing authorized administrator user ID
npm.cmd run worker
```

Application commands load `.env`; process settings take precedence. `setup:env` never overwrites existing settings. It enables `ERP_JOBS_ENABLED=true` and the verified local demo administrator for this workspace. Otherwise background scanning defaults off until an administrator sets `ERP_WORKER_USER`. The app scans at startup and every `ERP_JOB_INTERVAL_SECONDS` (default 300), deduplicates notices and waits for active work during shutdown. Administrator-only status is visible under Integrations.

For a separate worker, schedule the command every five minutes through Task Scheduler or cron. External SMTP/webhook delivery additionally requires `ERP_TRANSPORTS_ENABLED=true`; it defaults false, including the generated local settings. Without this explicit opt-in, a worker only updates the ERP inbox and sends no external messages. Without SMTP configuration it sends no email. Failed delivery retries exponentially; a crashed attempt can be retried after its lease expires. SMTP delivery is at least once; stable Message-ID helps identify retries. Access is rechecked before email delivery. Delivery outcomes are visible under **Integrations**.

Configure `ERP_SMTP_HOST`, `ERP_SMTP_PORT` (default 587), `ERP_SMTP_FROM`, optional `ERP_SMTP_USER`/`ERP_SMTP_PASSWORD`, and `ERP_SMTP_SECURE=true` for implicit TLS (normally port 465). Production requires TLS. Supply passwords via protected environment/secret files; never commit them. Real mailbox delivery is not verified by the local SMTP fixture.

## Employee and payroll privacy

HR and payroll are explicit organization roles; administrator status alone does not confer those roles. Employees have USD monthly, open or project-based compensation terms. Effective changes and benefits are described in the [compensation runbook](payroll-inventory-runbook.md). Attendance corrections append versions and leave decisions require independent HR approval. Attendance and leave never post salary expense or forecast charges. Employees linked to an ERP user can see their own leave/payslips through **People & payroll**; they cannot list other employees.

Payroll rules specify jurisdiction/policy reference, effective dates, fixed withholding, marginal percentage brackets and employer contribution rate. Amounts are decimal text, percentages have at most eight places, and calculations use exact integer/rational rounding. Rates can be zero. An independent payroll officer must approve each rule version. The organization must verify lawful rates, benefits, exemptions, pay basis and statutory remittances before use.

Prepare a monthly run against an approved effective rule, allocating each employee's salary plus employer cost to eligible project/source/category/activity lines. Independent approval reserves budget. Posting debits payroll cost and separately credits net and statutory payables, releases the reservation, and charges budget once. Net and statutory payments use approved vouchers. Duplicate employee/pay-period reservations/postings are blocked. A posted correction links a fully reversed run; dependent payroll payments must be reversed first. Cancellation of an unposted reservation releases authority without incurring cost.

Salary terms and calculated payslip results are encrypted with AES-256-GCM, including contextual authenticated data. Financial allocation records and employee reference fields are not whole-database encrypted; protect the database and backups with filesystem/storage encryption and restricted OS access. Project APIs show aggregated payroll financial dimensions without employee identities or payslip details. Payroll/HR action audits exclude sensitive input. MFA enrollment/recovery results in retry storage are encrypted.

Version 0.4 adds optional calendar proration, approved unpaid leave classification, allowances, employee deductions, employer benefits, effective terms and protected registers. Hourly pay and other currencies are excluded by user instruction. Jurisdiction-specific statutory filing formats/submission remain outside this release.

## Awards, catalog and currency boundary

Donor award ceilings have submitted versions, reasons, evidence and independent approvals. Activation rechecks existing actuals plus all reservations; subsequent spending approval/corrections cannot exceed the ceiling. Cash receipts and funding promises remain separate from this authority. An absent ceiling preserves the existing source-eligibility policy; configure actual grant ceilings before rollout.

The supplier/item directory holds shared reference records. Suppliers may be archived; archived registered identities are blocked for new POs. Purchase orders can select a registered supplier or retain a legacy manually entered supplier. Items are the reference identities used by the project warehouse stock ledger added in version 0.4. Printable POs and vouchers include preserved approvals; they do not claim a digital signature.

The organization uses USD only at two decimal places, as requested on 2026-10-13. Budgets, funding, bills, payments, advances, statements and payroll all use USD; there is no currency or exchange-rate configuration. Version 0.3.1 removes foreign invoice/rate tools and rejects foreign declarations through API operations, signed provider events and database insert guards. Migration 006 preserves saved records; it does not convert or reseed them. Back up an existing database with `npm.cmd run backup -- data/backup-before-0.3.1.sqlite`, then run `npm.cmd run migrate`. Preflight checks that no historical foreign records are present.

## Integration contract

Configure a disabled HTTPS webhook, encrypted secret (at least 32 characters), and explicit incoming funding route under **Integrations**. Enable only after verifying the real provider contract and configured project finance poster. No bank/mobile-money vendor API is assumed. The generic contract is:

- Incoming: `POST /api/integrations/{id}/events`, raw JSON `{event:"funding.received",external_id,external_source,amount,date}`. `amount` is USD decimal text. Optional `currency` must be exactly `USD`; other values are rejected before posting and do not consume the provider event ID. Map `external_source` to an internal source/account/finance poster. Headers `X-ERP-Timestamp` (Unix seconds) and `X-ERP-Signature` (lowercase hex HMAC-SHA256 over `timestamp + "." + raw_body`) authenticate it. Timestamp tolerance is five minutes. Duplicate external IDs replay the stored result; changed payloads return 409. Payments cannot bypass vouchers through this route.
- Outgoing: the worker sends `journal.posted` events with journal identity and non-personal accounting lines. It sends the same signature headers and `Idempotency-Key: journal:{id}`. A durable outbox records attempts and retries outside the financial transaction. Receivers must deduplicate the key; at-least-once delivery is expected. External delivery never creates another expense.

`ERP_ALLOW_LOCAL_TRANSPORT=true` enables loopback-only HTTP contract fixtures in development. It must remain absent in production. Real provider credentials, contract adapters and live bank/mobile-money verification remain organization-specific deployment work.

## Authentication and OpenID Connect

**Account security** supports password changes (revoke existing sessions), explicit session revocation, authenticator enrollment/confirmation and one-use recovery codes. Save recovery codes privately. Enabling `mfa_required` revokes all prior sessions and prevents sign-in to unenrolled accounts, so enroll every user before enabling it. Recovery codes do not bypass project/organization permissions. Sensitive retry fingerprints use keyed HMAC, and enrollment/recovery retry results are encrypted.

Optional organization sign-in uses the maintained [openid-client](https://github.com/panva/openid-client) library. Configure `ERP_OIDC_ISSUER`, `ERP_OIDC_CLIENT_ID`, `ERP_OIDC_CLIENT_SECRET`, and `ERP_OIDC_REDIRECT_URI=https://your-domain/api/oidc/callback`. Register that exact URI with the provider. The sign-in button appears only when configuration is present. It verifies PKCE, state, nonce, issuer/audience/expiry and ID-token signatures. A verified email must correspond to an already provisioned ERP user; no role or project membership is granted from provider claims. Issuer/subject associations are preserved. Local authenticator/recovery verification still applies when MFA is enabled. The temporary callback cookie uses HttpOnly/SameSite=Lax; the ERP session remains HttpOnly/SameSite=Strict. Local fake-provider tests verify both rejection and successful login; live identity-provider configuration is not verified.

## Keys, backup, restore and deployment

For local development, encrypted workflows create `ERP_DB + ".key"`; protect it with Windows ACLs. Losing this key loses access to encrypted data. `npm.cmd run backup -- data/unique-backup.sqlite` takes a consistent SQLite snapshot and includes the matching local key when used. Existing destinations are refused. Store backup/key copies in protected storage; do not place secrets in source control. Production uses an external 64-hex-character `ERP_MASTER_KEY` or `ERP_MASTER_KEY_FILE`; protect and restore that secret separately from the database.

Restore into an unused path with its matching local `.key`, or provide the matching external key. Point `ERP_DB` to the restored copy and run `npm.cmd run preflight` plus financial/payslip verification before switching traffic. Never restore over the active database. The automated restore drill verifies decryption, balances, referential integrity and balanced journals on an isolated copy.

The Dockerfile selects Node 24, a non-root runtime and locked production dependencies. Compose adds Caddy HTTPS, a persistent database volume and a mounted master-key secret. Configure `ERP_DOMAIN` and `ERP_MASTER_KEY_PATH` before `docker compose up --build`. Initialize a fresh production database with `ERP_ADMIN_EMAIL`/`ERP_ADMIN_PASSWORD` through `scripts/init.js`, not demo seeding. Store volumes outside OneDrive. Configure worker scheduling and SMTP/OIDC/integration secrets explicitly on the target host. Caddy needs actual DNS/network access for public certificates. Docker was not installed here, so image build, volume ownership, target HTTPS and service supervision remain unverified.

`npm.cmd run preflight` reports integrity, linked records, balanced journals, encrypted-data access, runtime, HTTPS session configuration, external key, voucher/MFA enforcement, demo credentials/projects, posted demo payroll and operator policy/hosting attestations. Set `ERP_POLICY_SIGNOFF=true` and `ERP_DEPLOYMENT_VERIFIED=true` only after the organization has performed those checks. These attestations are not a substitute for evidence. The saved local demo correctly fails production readiness; it remains a demonstration application.

## Expanded compensation and inventory (0.4.0)

The newer [compensation and warehouse runbook](payroll-inventory-runbook.md) supersedes the former monthly-only and reference-item-only limits. The user selected non-hourly pay: monthly, open per-run amounts or project-based pay. Calendar proration, approved unpaid leave, allowances, deductions and employer benefits are configurable. Warehouse receipts/issues/transfers/counts/returns, linked reversals, source ownership, CSV/print and closeout controls are implemented. Statutory filing submission, GRNI, quantity matching, serial/expiry tracking and manufacturing remain excluded.

## Stage 3 HR and project payroll (0.5.0)

[The Stage 3 runbook](stage3-runbook.md) adds effective employee profiles/contracts, secure documents, supervised attendance/timesheets, provisional configurable leave, non-hourly project payroll, salary-advance receivables and atomic payment batches. It supersedes the former month-start-only compensation change policy for managed employees. Explicit capabilities separate HR, supervisor, preparation, approval and Finance. The original financial database is preserved, and the completed zero-statutory sample has a separate path. Somaliland statutory and organization policy validation remains outstanding; devices/bank submission and production services are not connected.
