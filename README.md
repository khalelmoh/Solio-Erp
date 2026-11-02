# Folio — Funded Projects ERP

A new ERP for organization operations and funded-project budgets, spending and accountability. It uses a browser interface, server-side financial rules, and PostgreSQL or the preserved local SQLite backend. Project and non-project activity share one double-entry ledger. All financial amounts use USD with two decimal places.

**Current build: 0.16.0.** The [visual identity release](docs/visual-identity-release.md) applies the supplied navy/teal palette, collapsed desktop navigation, four primary dashboard figures, cash and budget analysis, shared component styling and verified contrast. It includes actual desktop/mobile, Finance, HR and complete transaction-journey screenshots, setup instructions and provider-specific results. Current measured evidence: `artifacts/visual-identity-release.json`.

**Vercel setup:** If the build reports missing `ERP_BACKEND_ORIGIN`, a hosted Node API is required first. The [Render + Supabase staging guide](docs/render-staging.md) and `render.yaml` prepare that service without uploading a local database. Actual account/project configuration, migrations, private access and deployment verification remain required.

The [transaction workspace and first-use guide](docs/workspace-journeys.md) covers role-based entry, review steps, record details, setup guidance and branding configuration. Its earlier evidence is `artifacts/workspace-experience-release.json`. The [guided workflows update](docs/guided-workflows.md) covers receipts, supplier payments, advance issue/settlement/return and employee registration. The selected architecture remains **Vercel + persistent Node24 API + Supabase PostgreSQL**. Actual Supabase/private-host verification remains pending configuration; see the [PostgreSQL integration guide](docs/postgres-integration.md) and [PostgreSQL release report](docs/postgres-release.md). Saved SQLite and paused guided-UAT records remain untouched.

## PostgreSQL private-staging preparation

Use Node24. `npm.cmd run build:postgres` compiles the existing domain/API/worker into nonblocking PostgreSQL calls. Configure the backend using [deploy/supabase.env.example](deploy/supabase.env.example), with separate runtime/migrator credentials, the external record key, verified TLS and direct/session-mode connections. Set PostgreSQL `max_locks_per_transaction=512` before migration. No browser Data API or public Storage access is introduced.

Run migrations with the protected migrator environment, then start the API using the protected backend environment. `npm.cmd run test:postgres`, `test:postgres:browser` and `verify:postgres:recovery` use the explicitly disposable local test configuration; they never migrate the saved database. [Full setup and recovery procedure](docs/postgres-integration.md).

After the local rehearsal, `npm.cmd run demo:postgres` starts/resumes **http://127.0.0.1:3005** without loading the saved .env. Use a private window, **Local demonstration accounts ? Finance ? Sign in**, and a separate Manager account for approval. The dedicated cookie preserves ordinary ERP/UAT sessions. This is synthetic loopback HTTP, not an actual Supabase deployment or human acceptance.

## Try Organization Finance separately

```powershell
npm.cmd run demo:organization
# Resume the same demonstration after its sole listener is stopped:
npm.cmd run demo:organization:resume
```

Open **http://127.0.0.1:3004** in a private window. Under **Local demonstration accounts**, select **Finance** and sign in; open **Organization Finance & Accounting** in the sidebar. Use a separate **Manager** account for approval. This creates a separate quarantined synthetic database, uses its own session cookie and disables jobs/transports. It does not load `.env`, migrate saved data or alter the paused port3003 walkthrough. [Setup, workflows and upgrade procedure](docs/organization-finance.md).

Focused verification: `npm.cmd run test:organization`. Independent ledger/source proof: `node scripts/verify-organization-finance.js`. Actual local-demo checks: `node scripts/verify-organization-runtime.js` while port3004 is running.

## Open the application

The workspace already contains a clearly labelled demonstration database at `data/erp.sqlite`. From this directory, using Node.js 24 LTS:

```powershell
npm.cmd ci
npm.cmd run setup:env
npm.cmd start
```

Preserve all saved employee/financial records in that database; never reseed it. For the existing isolated guided UAT, use `npm.cmd run uat:resume` and open `http://127.0.0.1:3003` in a private browser window. This deliberately resumes the separate quarantined **local SQLite** synthetic session, not the selected future Supabase deployment. Do not run a second UAT listener on the same port. The completed scenario evidence is preserved; further human findings use separate records.

Stage7 setup: [target specification and procedures](docs/stage7-staging.md), [pilot package](docs/stage7-pilot.md), [Supabase environment design template](deploy/supabase.env.example). `npm.cmd run stage7:inventory` inventories remaining database-port work. `npm.cmd run test:stage7` runs the focused regressions. `node scripts/stage7-register.js` refreshes the owner/action register without inventing reviewer findings. Host/domain and actual Supabase project credentials are still required; never paste secrets into chat or commit them.

Open **http://127.0.0.1:3000**. Install the locked runtime and test dependencies with `npm.cmd ci` before first use. `npm.cmd` avoids PowerShell script execution-policy issues; `npm` works in other shells.

| Local demonstration account | Purpose |
| --- | --- |
| `manager@demo.erp` | Submit budgets, approve someone else's requests, create POs |
| `finance@demo.erp` | Independently approve manager budgets, receive funds, bill, pay, settle advances |
| `requester@demo.erp` | Submit spending requests |
| `admin@demo.erp` | Configure policies, periods, users, memberships and reconciliation |
| `outsider@demo.erp` | Test a user without project access |

All demonstration accounts use **`Demo-only-2026!`**. The sign-in page has account-fill shortcuts. These credentials are only for local demonstration.

## Create a fresh demonstration database

On a fresh checkout with no seeded data:

```powershell
npm.cmd run migrate
npm.cmd run demo
npm.cmd start
```

Migration runs automatically at server startup as well. Demo seeding **refuses a populated database**; it never resets records. To create an independent database instead of replacing any existing file:

```powershell
$env:ERP_DB = Join-Path $PWD 'data\separate-demo.sqlite'
npm.cmd run demo
npm.cmd start
```

Choose an unused path. `ERP_DB` persists for this PowerShell session. Test fixtures always use separate temporary files. Do not put a live deployment database in OneDrive.

## Start without demonstration records

Choose an unused database path and initialize one administrator:

```powershell
$env:ERP_DB = Join-Path $PWD 'data\organization-pilot.sqlite'
$env:ERP_ADMIN_EMAIL = 'administrator@example.org'
$env:ERP_ADMIN_NAME = 'Organization Administrator'
$env:ERP_ADMIN_PASSWORD = Read-Host 'Initial administrator password (12+ characters)'
npm.cmd run init
Remove-Item Env:ERP_ADMIN_PASSWORD
npm.cmd start
```

Initialization refuses existing users. Before posting, configure budget and spending policies and accounting periods under **Settings & controls**. Create organization users, create projects, then assign the required finance/requester memberships. Policies are deliberately absent from a non-demo initialization until explicitly configured.

## Complete the first workflow in the browser

1. Sign in as a manager. Create a project with activities and dates. Submit a budget and add a donor or organization funding source.
2. An administrator assigns project finance/requester users in Settings. Finance approves the manager's budget. Users cannot approve their own submissions.
3. Finance records a funding receipt into a shared bank/cash/mobile account. Promises can be recorded separately and do not increase cash.
4. A requester submits spending, identifying project, category, activity and source for each allocation. Allocate across multiple accessible projects if needed.
5. A manager approves the request. Final approval reserves budget. Create a PO against the approved request.
6. Finance records a partial supplier bill against selected PO allocations. The bill releases that part of the commitment and records one actual budget charge.
7. Finance records a partial bill payment. The payment clears payable and reduces cash; actual charges do not increase.
8. Open Overview or Transaction ledger to inspect all balances and journal entries. Switch demonstration roles by signing out and signing back in.

For an advance, use **Advances → Advance request** to record the beneficiary, due date and allocations before approval. Finance disburses and uses **Settle / return** with receipts. Settlement releases its reservation and unused returns release the rest automatically. Managers can cancel unbilled PO commitments while existing bills remain payable.

## Financial lifecycle and upgrade

Use Budgets for approved increases/reductions and transfers with supporting files; Spending for supplier credit notes/refunds; Reconciliation for manual or CSV statements, partial matching and review; Financial reports for dimension/period drill-down, CSV and printing; Project closeout for operational completion, financial closure, exceptional treatments and audited reopening. See the [operator runbook](docs/lifecycle-runbook.md) for exact steps and posting effects.

The preceding lifecycle release was backed up to `data/backup-before-0.2.0.sqlite` and migrated from schema 3 to 4. Version 0.3 was then backed up to `data/backup-before-0.3.0.sqlite` and migrated from schema 4 to 5, preserving existing users, projects and financial records. For another existing database, stop its server and run:

```powershell
npm.cmd run backup -- data\unused-backup-name.sqlite
npm.cmd run migrate
npm.cmd start
```

Backup refuses an existing destination and uses a consistent SQLite snapshot. Do not run demo/init on an existing database. Legacy balance-only reconciliation records remain visible but do not satisfy transaction-matching closeout.

## Verification

```powershell
npm.cmd test
npm.cmd run check
```

For real browser testing, install the locked dependencies and use an installed Edge/Chrome:

```powershell
npm.cmd ci
npm.cmd run test:browser
```

If no system Chromium browser is present, install Playwright Chromium with `npx.cmd playwright install chromium`, or set `ERP_BROWSER` to the executable path. All eight browser suites use isolated databases. They save screenshots, CSV exports and printable financial statements under `artifacts/`.

See [test results](docs/test-results.md), [requirements](docs/requirements.md), [architecture and model](docs/architecture.md), [staged plan](docs/plan.md), [provisional and unresolved policies](docs/policies.md), and [API reference](docs/api.md).

## Controls and delivery limits

Implemented: authentication/project permissions; projects/overheads; approved budget increases/reductions/transfers/evidence; configurable independent approvals; reapproval on replacements; source restrictions; promises/receipts/returns/promise cancellation; split costs; commitments/POs; partial bills/payments; advance requests/terms/approval/disbursement/receipt-supported settlements/returns/overdue register; immutable files; supplier credits/refunds; linked reversals/locked-period authorization; shared cash; statement entry/CSV import/partial matching/unmatching/review; reports/CSV/printing; operational completion/closeout exceptions/reopening; audit, idempotency, concurrency, exact amounts and balanced journals.

Version 0.3 also implements document discussions, inbox/queued SMTP notices, time-limited delegation, independent vouchers, direct expenses, approved linked adjustments, invoice reissue, HR/attendance/leave/monthly payroll and private payslips, donor award ceilings, supplier/item reference catalogs, signed integration contracts/outbox, password/session controls, authenticator MFA and optional OpenID Connect sign-in. Printable POs/vouchers show preserved approval status. Setup, policies and boundaries are documented in [organization workflow runbook](docs/completion-runbook.md).

Live statutory payroll needs verified jurisdiction/rates/pay basis. Live email/identity/bank/mobile-money integration needs credentials and provider contract verification. The organization uses USD only at two decimal places; foreign currencies, rates and converted invoices are disabled. Version 0.4 implements warehouse receipts/issues/transfers/counts/returns and non-hourly monthly/open/project-based compensation with proration, allowances, deductions, employer benefits and private payroll register exports. See [payroll and inventory setup](docs/payroll-inventory-runbook.md). Statutory filing submission, GRNI/PO quantity matching, serial/expiry tracking and manufacturing remain outside this release. Container files and preflight are supplied; Docker/HTTPS/provider verification on actual hosting is still required. Do not describe this local demonstration as production-ready.

Application commands load `.env` if present; exported process settings take precedence. `setup:env` preserves an existing file and enables only local demo inbox scanning, with external transport disabled. The application binds to loopback. `PORT`, `HOST`, `ERP_DB`, `ERP_SECURE_COOKIES` and `ERP_TIMEZONE` are supported settings. Business timezone defaults to Africa/Mogadishu; audit timestamps remain UTC. Do not expose it publicly until deployment checks in the architecture document have passed.

## Stage 3 HR and project payroll

Use **HR management** for employee profiles, contracts/documents, work calendars, reviewed attendance imports, approved project timesheets, leave entitlements, salary advances and approved project payroll. **Project salary costs** shows source totals and unposted forecasts without individual salary access. Monthly/open/project pay remains USD only; overtime is an approved amount. See [Stage 3 setup and policies](docs/stage3-runbook.md).

A separate completed sample is saved in `data/stage3-demo.sqlite`; the original database remains unchanged financially. `npm.cmd run demo:stage3 -- data\new-demo.sqlite` creates another sample only at a new path. Statutory components are explicitly zero in this demonstration. Somaliland rules remain provisional until organization validation.

## Stage 4 organization accounting (0.6.0)

Open **Organization accounting** for controlled journals/openings, fund policies, financial statements, reconciliations/period close and fixed assets. USD only. Administrators assign explicit accountant/approver/auditor roles in Setup; project Finance membership still governs posting. Historical funding remains unclassified until reviewed and independently approved; no saved receipt is silently converted to income. Back up the database and matching key before automatic migration 009. See [accounting setup and policies](docs/stage4-runbook.md). Generate an isolated sample with `npm.cmd run demo:accounting`; never reseed the populated main database.

## Stage 5 employee lifecycle (0.7.0)

Open **Employee lifecycle** for approved staffing/recruitment, onboarding/probation, weighted performance reviews, training/qualifications, effective employment changes, independent employee-detail review, departure/access revocation and final payroll. HR management also links to this workspace. Administrators assign explicit lifecycle capabilities in its header; no roles are automatically granted to saved accounts. Staffing/training estimates are forecasts, purchasing and payroll reserve actual costs once. Departure never erases unpaid salary or waits for equipment to revoke local access.

Migration 010 preserves existing data and encrypted history. See [setup, workflows and policies](docs/stage5-runbook.md). Create a separate sample at an unused path with `npm.cmd run demo:people -- data\new-people-demo.sqlite`; never reseed the main database. Run `npm.cmd run test:people` for focused acceptance tests. Final-pay entitlements need validated organization policy; external calendar/account provisioning and live provider delivery are unconfigured. Retention supports audited policy/hold records and manual review, with no automatic deletion.

## Stage 6 release verification

See the [release-readiness report](docs/stage6-readiness.md), [Stages 1?5 coverage matrix](docs/stage6-coverage.md), [release/recovery procedures](docs/stage6-operations.md) and [human UAT/pilot plan](docs/stage6-uat-pilot.md). The saved app preserves existing data and financial balances. Real financial pilot/production readiness remains blocked by actual policy, service, hosting, recovery and human acceptance gates. Use a supported Node24 environment; the global Node25 installation was preserved.

For actual reviewer decisions, start with the [policy approval packet](docs/policy-approval-packet.md). `node scripts/uat.js session` starts a separate quarantined synthetic environment on port3003; use a private browser window. `node scripts/uat.js template <role>`, `record <completed-file>` and `status` support declared human findings with evidence and preserved review history. Preparing/rerunning worksheets preserves entered findings. Automated success never records human approval or validates statutory policy.
