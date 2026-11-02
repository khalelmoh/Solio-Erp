# Operational completion, version 0.8.0 / schema 11

This release adds approval setup, Somaliland final-pay calculations, approved rehire, automated private-data retention and provider adapters. It preserves USD-only monthly/open/project compensation, existing payroll/accounting controls and saved records. Live delivery and hosting need actual services and credentials; a successful adapter test is not a production delivery receipt.

## Approval responsibilities

Open **Employee lifecycle > Policies & controls > Configure approval responsibilities** as Administrator. Choose named existing users for HR, independent hiring approval, payroll preparation/approval, payroll Finance, review moderation, access and privacy. HR and hiring, preparer and approver, and hiring and moderator must be separate. The wizard grants only the selected capabilities, retains existing grants, records its configuration and versions the approval policies. Previous documents retain their frozen approval levels. It does not grant accounting or project Finance access.

The saved local demonstration uses Administrator for HR/moderation/access, Manager for hiring/payroll approval/privacy, and Finance for payroll preparation/payment. These are demonstration accounts, not production staffing. Existing Manager HR capability is preserved. Creators and employee subjects cannot approve their own actions. Final-pay policy approval also requires payroll-approver capability. Rehire has two distinct levels: hiring, then payroll approval. Project-scoped spending and posting still require all relevant project permissions.

## Somaliland agreement and final pay

Create the agreement at **Departure & final pay > Create Somaliland final-pay policy**. [ILO NATLEX](https://natlex.ilo.org/dyn/natlex2/r/natlex/fe/details?p3_isn=112608) identifies Law 31/2020 as replacing Law 31/2004. The formula template references the [government English publication, Articles 16, 23 and 25](https://govsomaliland.org/uploads/files/2026/01/2026-01-21-07-44-12-976-1768981452.pdf). The government PDF is intermittently unavailable. Retain the organization's reviewed source copy and signed agreement with the policy evidence.

The calculation implements monthly basic salary per service year after more than one year's service; actual unused paid-leave minutes valued with an explicitly agreed monthly divisor; and separately evidenced notice pay. Calendar service is confined to the departure's employment episode. No advance is recovered automatically. Open/project compensation requires an evidenced monthly equivalent. All amounts use exact USD cents.

Partial-year treatment, salary basis, cash-out agreement, notice entitlement, taxation and the leave valuation divisor require actual organization review. `26` is an editable contractual example, not a declared statutory divisor. `manual_review` blocks unresolved partial years. The 30-day annual-leave reference does not silently create employee balances; configure and independently approve the actual leave policy/enrollment and work calendar. A no-leave-balance attestation cannot bypass a recorded positive paid balance.

The standard [agreement worksheet](somaliland-agreement-template.md) is provisional. No universal signed or officially approved contract has been fabricated. A draft may be approved in the workflow but remains **provisional** and cannot finalize payroll. Create a validated version with an authoritative review reference and obtain genuine independent approval before real payroll. Demonstration policies only charge demonstration projects. Existing tax brackets remain separately configured and approved.

Use **Calculate statutory entitlements** to inspect source values, issues, agreement and formula. Prepare final payroll using those inputs; the server recalculates rather than accepting replacement amounts. The final period must cover the last employed day. Changes to leave or other evidence invalidate unposted approvals. Calculation snapshots, approvals and postings remain auditable. Already-posted salary can receive a final review only if it already contains all calculated entitlements; otherwise use the controlled correction/replacement workflow. Salary expense, liability, budget and cash retain their existing separate posting rules.

## Rehire

Use **Employment changes > Rehire former employee** after an approved departure. Supply a later start, new compensation agreement, calendar, supervisor, reason and optional onboarding template. Hiring and payroll approvers independently approve the frozen proposal. It appends a new employment episode to the same employee identity; old gaps, final liabilities, payroll and payslips remain unchanged.

An approved rehire clears old sessions, administrator status, organization roles and project memberships. Review and independently approve new access rather than inheriting former privileges. Future rehire cannot restore login before its start, and access can explicitly remain disabled. New project allocation approval is required for the new episode. Leave from the old enrollment stops at its departure. Another departure revokes access again. Clearance for an earlier departure does not mistakenly include salary from a later episode.

## Retention and legal holds

In **Policies & controls**, Administrator proposes a class, retention days, effective date, automation flag and actual legal/organization deletion authority. A different HR or privacy officer approves it. Classes are rejected candidates, finalized reviews, employee documents and private employment profile data. No guessed statutory retention period is activated automatically.

Review the queue, apply/release documented record holds and preview due deletion. Automatic deletion runs through the existing authorized background scan when both the policy and worker are enabled. A manual run needs the exact confirmation phrase. Active employment, live applications/offers, conversion to employment, unresolved current departure clearance, unknown dates, future due dates and legal holds block erasure. Published calendar copies require a confirmed remote cancellation, including attempted deliveries whose success receipt was lost. Rules use the server's actual date. Each transaction processes at most 100 records and records immutable deletion receipts.

Approved erasure replaces private encrypted payloads, feedback and supporting file contents with tombstones. File downloads return 410 only after normal authorization; unrelated users receive 403. Stable identities/links, approvals, journals, compensation, payroll, financial payment details and audit evidence remain under separate financial retention requirements. The trigger permit is transaction-local and permits only named private columns; it never authorizes financial edits or deletes. Rehire creates a new employment retention generation.

This is application-level erasure, not a forensic disk-wipe promise. Backups, WAL/filesystem snapshots, notification history, financial identity evidence and independent provider archives require their own access, retention and disposal policy. Keep paired database/key backups restricted; manage expiry on the actual backup service. Do not erase financial history or remove a legal hold to make a privacy queue appear empty.

## Email, identity and calendar services

Vercel is the selected frontend hosting target. It does not supply SMTP, an employee identity directory, a calendar or bank/mobile-money API by itself. Existing SMTP, OIDC and signed webhook workflows remain supported. This release adds SCIM 2.0 identity provisioning/revocation and CalDAV interview publication/cancellation.

Configure providers with real HTTPS base URLs and backend environment variable names. Only `ERP_SCIM_TOKEN[_SUFFIX]` and `ERP_CALDAV_TOKEN[_SUFFIX]` are accepted; secret values are never entered into forms, exported or audited. Use a dedicated least-privilege provider credential. Use **Verify connection**: SCIM checks capabilities and authenticated user read permission; CalDAV checks the calendar collection. Credential or endpoint changes invalidate previous verification. **Verify configured SMTP** checks connection/authentication without sending email.

An independently approved external access request can then be queued for a verified SCIM connection. Calendar publication is an explicit HR/Administrator action. The durable worker uses leases, stable event identities, duplicate-safe remote lookups and retry backoff. Provider outcomes are confirmed before displaying provisioned or revoked. Departure revocation is queued independently of equipment or unpaid salary. Failed work retains a visible redacted error. Configure and authorize a real test account/recipient before performing an external delivery test.

Enable `ERP_JOBS_ENABLED=true`, an authorized `ERP_WORKER_USER`, and explicitly `ERP_TRANSPORTS_ENABLED=true` only after provider setup. SMTP settings and OIDC settings are listed in `.env.example`. The local saved `.env` remains unchanged, with transports disabled. Bank/mobile-money settlement remains statement import, reconciliation and approved voucher/batch export; provider-specific payment submission requires its actual API contract and credentials.

## Vercel frontend and persistent backend

[Vercel documents that local SQLite does not persist in Functions](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel). Run this existing Node/SQLite backend and worker on a host with a persistent volume and one authoritative database writer. Use Vercel for public static assets and an uncached same-origin API proxy. Moving to serverless database storage is a separate data migration, not a build setting.

1. Deploy the Node backend with persistent `ERP_DB`, protected existing database key, HTTPS and backup/restore monitoring. Configure its `ERP_PUBLIC_ORIGIN` to the actual public frontend origin and `ERP_SECURE_COOKIES=true`.
2. Generate a strong random `ERP_PROXY_SECRET` and configure the same secret on backend and Vercel runtime. The backend rejects direct API requests without it; the frontend never embeds it. Verify the request-header transform on the actual deployment.
3. Set Vercel build `ERP_BACKEND_ORIGIN` to that backend's actual HTTPS origin without a path. The supplied `vercel.json` invokes `npm run build:vercel`, which produces Build Output API static assets and an external API route. No data, key or environment files are included. Runtime startup intentionally rejects `VERCEL=1` for the SQLite backend.
4. Verify login/cookies, OIDC redirect, writes, downloads, CSRF rejection, cache exclusion, provider receipts, restart persistence, paired restore and capacity on the real domain. Use `npm.cmd run preflight`; keep the production signoff flags false until genuinely verified. A build artifact alone does not establish deployment readiness.

No Vercel project credentials, persistent backend URL, SMTP/SCIM/CalDAV credentials or authorized live test recipient were supplied. The code and local tests are complete for the described adapters; live services have not been connected or deployed.

## Verification and upgrades

Run `npm.cmd run check`, `npm.cmd test`, `npm.cmd run test:browser` and focused `npm.cmd run test:operations`. Fixtures use isolated databases; browser scripts do not populate the saved database. `scripts/verify-operations-upgrade.js` creates non-overwriting paired backup and preview files, compares every old row, permits only the appended default rehire policy, verifies key readability/integrity/FKs and proves project totals unchanged. Never reseed a populated database.

The saved rollout and latest evidence are recorded in [resume checkpoint](resume-checkpoint.md). Preserve the original `.env`, keys, user grants and employee records. Production release remains dependent on actual policy validation, services, secure deployment and operational signoff.
