# Architecture and database model

Current implementation: **0.12.0**, SQLite schema13 / PostgreSQL migrations001-004. [PostgreSQL design and setup](postgres-integration.md), [current release](postgres-release.md). [Organization finance runbook](organization-finance.md) and [release evidence](organization-finance-release.md).

Organization workflow/report mixins reuse `acc_documents`, `acc_evidence`, `work_approvals`, `acc_posts` and the existing `journals`/`journal_lines`. New organization item, budget and allocation tables are immutable supporting records, not another ledger or mutable balance cache. A line has either its existing project/source pair or an approved organization fund; department/cost-centre dimensions are optional.

Migration013 rebuilds the ledger-line table transactionally, preserving IDs, amounts, references, FK relationships and posting guards. FK enforcement is temporarily suspended outside the rebuild transaction, referring triggers are preserved/restored, all FKs are checked before commit, and enforcement is restored. Existing immediate write transactions, action idempotency, independent approval levels, encrypted evidence and one-use locked-period correction authorizations govern the new workflows.

Reservations are budget authority rather than accounting liabilities. Bill/expense posting replaces its reservation with a charge; advance settlement/return releases the corresponding reservation. Shared allocation moves expense through a source-linked journal, with fund-balance offsets and existing project reservations where relevant. Parent envelopes constrain children but are not counted twice. Reconciliation continues matching the same cash-line IDs without posting new transactions.

Organization overview/report loading occurs when opening that workspace, preserving bounded project-list loading. The isolated organization demo uses `erp_organization_session`; ordinary ERP/UAT sessions retain `erp_session`. Cookie names are validated and preserve existing HttpOnly/SameSite protections. The PostgreSQL runtime compiles these same service methods into awaited pg calls, with ordered async array callbacks and transaction-scoped clients. Existing SQLite stays available separately. PostgreSQL selection fails closed on missing connectivity/configuration, unsafe privileges, unverified TLS, insufficient lock capacity, stale build/schema or the wrong record key.

## Stack choice

Node.js 24+ using ES modules, the built-in HTTP server, crypto, test runner and SQLite driver; browser-native HTML/CSS/JavaScript. Financial logic stays in one testable domain service. Version 0.3 uses Nodemailer for SMTP and openid-client for maintained OpenID Connect validation; Playwright is development-only. Stage 6 passed the full suite on portable Node 24.22.0 on Windows and runs the local app on that runtime; the existing global Node 25.2.1 installation was preserved. The Linux image and actual hosting target remain unverified. See [Node SQLite documentation](https://nodejs.org/docs/latest-v24.x/api/sqlite.html) and [Node crypto documentation](https://nodejs.org/docs/latest-v24.x/api/crypto.html).

Recommended next deployment stack: supported Node LTS, TypeScript, an established HTTP framework, PostgreSQL, migration tooling and managed identity. SQLite is appropriate for a local pilot, not an unverified multi-server rollout. PostgreSQL migration must preserve row locking/serializable budget checks and exact NUMERIC currency values.

## Boundaries

Browser → authenticated JSON API → domain service → transactional SQLite.

`src/db.js` owns versioned migration execution. `src/service.js` owns authorization, lifecycle, accounting and policy. `src/server.js` owns sessions, HTTP validation and static assets. UI renders returned data and cannot change financial policy by client-side checks. Bind to loopback by default. Local SQLite uses its configured file; PostgreSQL uses only its explicit URL/private schema and external key. The PostgreSQL opener never initializes SQLite. Test fixtures use isolated databases/UUID schemas; demo seeding refuses populated records.

Writes run in BEGIN IMMEDIATE, taking the SQLite write lock before testing remaining budget, source eligibility or cash. A separate durable operation table returns the previous result for retries. Each mutation creates audit evidence in the same transaction. Read dashboards use a read transaction for a consistent snapshot. SQL triggers disallow changes to posted financial ledgers and approved budgets.

## Data model

| Entity | Main fields and relationships |
| --- | --- |
| users, sessions | unique email, hash/salt, admin flag; hashed expiring session token |
| projects, memberships | code, description, manager FK, department, dates, status, activities; user/project/role unique |
| approval_rules | document kind, minimum/maximum amount, ordered role levels; provisional demonstration settings |
| budget_versions, budget_lines | project, version, superseded version, submitter, state; category/activity/from/to/exact amount |
| approvals | kind, document, level, approver, timestamp; immutable evidence |
| funding_sources, promises | project, category whitelist, eligible dates; promised amount |
| requests, request_lines | creator, state, eligible date, title; allocation project/category/activity/source/amount |
| purchase_orders, bills, bill_lines | one purchase mode per request; supplier invoice reference; allocation FK and exact billed amount |
| advances, settlements | request allocation, beneficiary, journal; accepted settlement or unused return |
| accounts, periods | bank/cash/mobile and GL codes; open/closed accounting periods |
| journals, journal_lines | unique business event, date, kind, linked reversal, posted state; account/project/source and signed minor units |
| budget_charges, commitments | immutable allocation/project/category/activity/source/date/exact signed value; financial journal link for charges |
| payments | bill, account, unique payment reference, amount, journal |
| exceptions | project, authorized amount, expiry, finance issuer, justification |
| reconciliations | account, period end, statement balance, outstanding line IDs, difference, creator |
| operations, audit | actor/idempotency key/payload hash/result; append-only action/actor/entity/time |

Cash allocations are derived from journal lines with a cash account and either project/source dimensions or an approved organization fund. The sum of project and general allocations equals organization cash. Record general funding under its approved organization fund without an overhead project. Existing project opening workflows retain their controls; opening general cash requires documented treatment and independent approval. Shared-bank balances never imply a private bank account per project.

## Posting recipes

| Event | Debit | Credit | Budget / commitment |
| --- | --- | --- | --- |
| receipt | Cash | Funding control | neither |
| bill | Expense / asset | Payable | charge / release billed portion |
| bill payment | Payable | Cash | neither |
| advance issue | Advances | Cash | reserve retained |
| accepted advance | Expense / asset | Advances | charge / release settled portion |
| unused advance return | Cash | Advances | no actual; release unused reservation automatically |
| internal transfer | Destination cash | Origin cash | neither |
| reversal | Opposite original lines | Opposite original lines | exact linked opposite charges/releases |

## HR boundary

Employee, attendance, leave, payroll-run and salary-allocation records use separate HR/payroll organization roles, restricted payslip access and encrypted salary terms/calculations. Payroll-run IDs must be unique posting sources. Timesheets feed allocation drafts; payroll journal allocations alone feed actual budget charges. Statutory tax/benefit rules have effective-dated configuration with no guessed jurisdiction defaults.

## Lifecycle extension, version 0.2.0

Migration `004_financial_lifecycle.sql` preserves prior data and adds budget-change metadata, advance terms, immutable evidence blobs, credit notes and allocations, refund receipts, promise adjustments, correction authorizations/uses, statements/lines, partial matches and reversals, finalization/reopening/review events, reviewed cash offsets, project transitions and closure authority/use records. Existing financial ledgers remain append-only.

`src/lifecycle.js`, `src/reconciliation.js` and `src/reports.js` extend the same ERP domain service using its authorization, money, transaction and posting helpers. `public/lifecycle-ui.js` supplies the browser screens. Read snapshots cover dashboards, reports, shared reconciliation and project lists; writes remain under BEGIN IMMEDIATE. Evidence is stored with hash and bounded MIME/byte validation and downloaded as a protected attachment. CSV imports validate identities and account/date overlap; matching consumes both statement and book remainders atomically and creates no journal.

See [posting, closeout and reporting design](lifecycle-design.md). Configurable business timezone defaults to Africa/Mogadishu; audit timestamps remain UTC. The prior balance-only reconciliation route remains for historical compatibility but does not satisfy new transaction-matching closeout requirements.

## Organization completion, version 0.3.0

Migration 005 adds independent work approvals/vouchers, direct expenses, comments/events, delegation/principal evidence, inbox/delivery queues, grant versions, reference catalogs, exact currency-rate provenance, restricted employee/attendance/leave/payroll evidence, integration mappings/events/outbox and authenticator/OpenID identities. Existing records remain intact. New financial/evidence tables are append-only; only delivery leases/configuration/session state are mutable.

`completion.js`, `payroll.js`, `workflow.js`, `foreign.js`, `security.js` and `identity.js` reuse the established ERP transactions, money and project permissions. Read APIs use consistent snapshots. Salary dimensions are aggregated in ordinary project views; terms/results and sensitive retry payloads are context-bound AES-GCM ciphertext. Sensitive operation fingerprints use keyed HMAC rather than offline-guessable raw hashes. `transport.js` sends queued SMTP/signed events outside accounting transactions with leases, retries and stable identities. Whole-database/OS access remains a separate protection boundary.

The application is USD only at scale 2. Migration 006 preserves existing financial records and disables new FX definitions/rates/documents/cash evidence. API operations reject non-USD declarations, including nested allocations and signed provider events; currency administration was removed from the interface. The container selects Node 24; `preflight.js` checks selected controls and explicitly records missing production attestations. See [organization runbook](completion-runbook.md).

## Target deployment checks still required

Version 0.3 supplies SSO/MFA/password controls, encrypted-data restore and local load/migration tests, container/proxy assets and a preflight command. Remaining target checks include actual HTTPS/cookies, provider and identity configuration, jurisdiction/payroll policy, security review, external audit retention, production backup/restore/capacity, accessibility coverage, monitoring/supervision and storage outside OneDrive. Local host-admin database access remains outside application RBAC. The local demonstration is not production-ready.

## Non-hourly compensation and warehouse inventory, version 0.4.0

Migration 007 adds employee_terms/approvals, leave pay classifications, warehouses, stock documents/lines/posts/cancellations/movements, and GL 1400/5300. Existing rows are preserved. New evidence tables are append-only. expanded-payroll.js extends effective salary/benefit calculation and private registers; inventory.js extends stock/accounting, correction dependencies, closeout and reports. Both reuse BEGIN IMMEDIATE, fixed-cent amounts, project permissions and independent policies. Inventory quantities use scale 3 and BigInt cost proportions. Payroll terms/calculations remain AES-GCM protected and salary operations use HMAC/redacted audits. extensions-ui.js supplies dedicated screens without modifying the established styles.

## Stage 3 extension, version 0.5.0

Migration 008 appends immutable HR evidence tables and 1250/2120 controls. `hr-core.js`, `hr-leave.js` and `hr-payroll.js` compose over captured established service methods. Managed custom-period payroll uses the original payroll runs/allocations/reservations/posts/payment tables, with encrypted input context, controlled component liabilities and per-source salary recovery records. Read snapshots and BEGIN IMMEDIATE mutation transactions retain cross-request consistency. Payroll control allocation exhausts each project/source expense to the cent. Bank batches retain approved payment-detail IDs. HR documents have separate encrypted storage and backend download policy.

`hr-ui.js` adds native browser HR and project-cost screens using existing modal/table helpers. No framework or deployment stack changed. The legacy APIs remain for unmanaged employees, while managed employees must use the versioned calendar/allocation workflow. See [Stage 3 design](stage3-design.md) and [operator runbook](stage3-runbook.md).

## Stage 4 accounting, version 0.6.0

Migration 009 appends account profiles/mappings, journal metadata, fiscal setup, supported opening controls, immutable accounting preparations/approvals/posts, encrypted evidence, fund-treatment policies, close/reopen/year-end snapshots and fixed-asset records. Existing source journals remain unchanged. `accounting-core.js` extends captured HR/financial methods; `accounting-reports.js` and `fixed-assets.js` extend that captured accounting core. All monetary paths reuse `ERP.journal`, which records USD/rate-1 metadata and immutable posting roles; account mappings are fixed after first posting. Reversals retain original account IDs. Reports group posted lines by effective profiles; budgets/reservations remain separate. Financial reads require explicit accounting roles and consistent transactions. `accounting-ui.js` reuses native browser helpers. See [setup, account mappings and posting policies](stage4-runbook.md).

## Stage 5 employee lifecycle, version 0.7.0

Migration 010 appends el_* evidence tables, immutable versioned payload/event records and explicit lifecycle role assignments. people-core/recruitment/cases/development/employment/payroll/reports compose over captured Stage 4 methods, before read snapshot wrappers. The existing transaction dispatcher uses BEGIN IMMEDIATE, HMAC for sensitive lifecycle inputs, redacted audits and durable idempotency. Role checks protect every operation/file/report; candidate/profile/review/document payloads use context-bound AES-GCM. Lifecycle evidence is append-only except explicit role assignments. Read responses omit encrypted storage fields and private supervisor feedback for employees.

Recruitment forecasts do not change commitments. Training links existing request lines and reads their ledger/commitment/payment evidence. Final payroll reuses encrypted managed-payroll input fingerprints, existing approval/reservation/posting and voucher controls, with a module-private Symbol to pass trusted immutable settlement context into salary calculation. Approved effective employment/departure profiles invalidate unposted evidence without rewriting posted source snapshots. Already-posted final payroll review records no financial entry. Local access checks include session authentication, password login, SSO completion and the atomic mutation boundary, independent of clearance; the existing authorized notification worker also processes due revocations.

people-ui.js uses the existing native modal/table/form helpers and same versioned static-asset delivery. No stack/dependency/provider change. Reports preserve confidential scopes and source IDs; CSV escaping reuses the shared exporter. Upgrade preview compares all preexisting business rows via canonical row digests and checks SQLite integrity/FKs. See [Stage 5 setup/policy details](stage5-runbook.md).

## Operational completion, schema 11

Migration 011 appends employment episode proposals/approvals, statutory formula/calculation evidence, setup records, retention authorities/holds/runs/tombstones and provider connections/checks/outbox/identity mappings. Old rows and financial tables are preserved; the only legacy-table migration append is the default two-level rehire policy. Domain mixins in operations-employment/retention/policy/integrations extend the Stage 5 methods in that order. Native operations-ui adds panels to the existing eight lifecycle tabs.

Retention guards replace UPDATE triggers only for explicitly permitted private columns. A permit exists only inside the audited erasure transaction; deletes and financial updates remain blocked. Provider outbox payload erasure has an UPDATE OF payload_encrypted guard, permitting normal leased delivery-state updates. SQLite secure_delete is enabled; this does not erase historical backups/snapshots. Provider jobs use encrypted payloads, HMAC-bound credential checks, bounded HTTPS calls, identity lookup/deterministic calendar identifiers and retry leases. Calendar precondition failures require fetching and verifying the existing content.

Vercel Build Output contains only public native assets and API proxy configuration. The authoritative database, key, worker and Node service stay on persistent storage. Proxy secret checks precede API handling; public-origin checks preserve browser CSRF controls. No secrets/data are embedded in static assets. Live Vercel routing and provider delivery remain target-verification tasks. See [operations runbook](operations-runbook.md).

## Release hardening, schema 12

Migration 012 adds session/SSO assurance, durable throttles/reset tokens, immutable account-access and final-review evidence, and a persistent recovery quarantine. A late service mixin enforces account state, current MFA strength, immutable review revalidation and source-journal controls; old financial rows remain unchanged. Sensitive exports and role changes are auditable. SQLite snapshots include DB-backed uploads; independent-key AES-GCM archives include authenticated manifests and safe configuration, never live credentials or the database key. Restore verifies keys/counts/checksum, clears old authentication attempts and starts loopback with a persistent outbound/deletion fence. Native table paging preserves matching print rows; API payloads remain unbounded. Measured local performance, supported-runtime tests and actual target limitations are in [Stage 6](stage6-readiness.md).


## Stage 7 project listing and selected staging architecture

The final project-list service mixin filters membership before snapshot count/page selection, returns bounded summaries and batches financial metrics for the selected IDs in one SQL query. Project details load on selection; allocation lookup can search beyond the visible page. Actor-wide project-role capability is independent of the current page. Full authorized exports retain their existing scope. Other project history and HR/accounting overview endpoints are not claimed fully paginated. See [API and measurements](stage7-project-pagination.md).

Runtime remains SQLite/schema12. Supabase PostgreSQL plus the existing Node API on a separate host is the selected future target; an asynchronous transaction-scoped adapter, all constraints/triggers/migrations and PostgreSQL recovery require implementation and validation. The provider guard rejects Supabase configuration before creating or opening SQLite. Synthetic staging disables external transports, SSO and automatic erasure; authorized internal scans remain possible. Health reports process instance, database provider and synthetic profile so target persistence checks can distinguish a restart.

Deployment/worker/backup templates and authenticated persistence probes are prepared, not installed or verified on a target. PostgreSQL native encrypted-backup templates do not enable PostgreSQL application support. See [staging specification](stage7-staging.md).


## Transaction experience 0.15.1

`workspace-experience.js` provides read-only setup and source-record models over the existing accounting/project services. The frontend module renders a consistent full detail view, keeps report context and launches existing authorized actions; guided-form supplies retained values, conditional fields and review. No new ledger or posting operation exists. Source records reuse canonical obligation/advance calculations; linked payment/settlement evidence is bounded to50 related preparations. Legacy read models can still materialize project/obligation history server-side. `branding.js` validates backend-configured public identity/raster assets independently of private financial/HR files and secrets. The same service methods are compiled into the PostgreSQL runtime and tested on actual local PostgreSQL.
