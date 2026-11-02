# Employee registration permission fix - version 0.5.1

People & payroll now shows registration, attendance and leave-decision controls only to HR staff. The registration API returns an actionable 403 for payroll-only users and administrators lacking an explicit HR grant; an audited HR capability assignment enables registration. No live permissions, employee records or finances were changed. **55 relevant automated tests, the completion browser workflow and syntax checks passed** after the change. The browser regression verifies HR registration succeeds and manager/finance payroll accounts cannot see or invoke registration. New HTTP test: `tests/employee-permissions.test.js`.

# Verification evidence - version 0.5.0, 2026-10-14

Current verification: **115 automated tests passed, zero failures; all five browser suites passed; JavaScript syntax checks passed.** The existing 93-test regression suite passed before payroll was connected. Twenty-two Stage 3 tests add the required gross/recovery/net/project allocation example, daily effective salary changes, unpaid scheduled leave, holiday/cancellation entitlement treatment, approved time allocation, overlap/incomplete hours, partial salary payments/reversal/replacement, exact source controls and benefits, budget rollback/concurrency, capability separation and private downloads, stale attendance imports/compensation, provisional policy blocks, component restrictions, repayment duplicates, batch atomicity/idempotency/frozen bank details, contract/document reminders, accrual/carryover/expiry, overlapping period codes and locked-period authorization.

Evidence: `artifacts/test-stage3-final.txt`, `artifacts/browser-stage3-final.txt`, `tests/stage3.test.js`. The Stage 3 browser suite also exercises creation of an allocation plan by HR with viewer project membership, private document upload, salary advance approval/issue, payroll preview/approval/posting, voucher creation, project expense totals, employee payslips, restricted CSV, printing and mobile layout. Artifacts: `stage3-hr-desktop.png`, `stage3-hr-mobile.png`, `stage3-project-payroll.png`, `stage3-hr-report.pdf`.

The required payroll example passed: gross $1,000, advance recovery $100, net payable/payment $900; incremental A/B expense $600/$400; salary advance outstanding zero; no expense on salary payment. Source A net liability is $500 plus the $100 receivable recovery; B net is $400. Partial payment, reversed payments and payroll replacement preserve these controls.

Migration 008 preserved every pre-existing row across **117 business tables**, appending only new HR tables and the two new GL accounts. The original database and local key were backed up to `data/backup-before-0.5.0.sqlite[.key]`. Integrity is `ok`, foreign-key errors zero and original project balances are unchanged. Evidence: `artifacts/migration-0.5.0.json`. No employee or payroll transaction was fabricated in the original database. A completed sample is isolated in `data/stage3-demo.sqlite`.

The live saved application was restarted and checked through authenticated APIs and real Edge screens: `artifacts/live-0.5.0-verification.json`, `live-stage3-hr.png`, `live-stage3-project-costs.png`, `live-stage3-dashboard.png`. It serves v0.5.0 at http://127.0.0.1:3000; empty HR setup and project payroll reports work, background inbox scans retain external-delivery opt-out. The original example remains approved $50,000; funding received $40,000; actual $6,000; commitment $4,000; remaining $40,000; unpaid $2,000; allocated cash $36,000.

Local environment: Windows, Node 25.2.1, SQLite 3.50.4 and Microsoft Edge/Playwright. Production statutory rules, organization approvals/proration/fund eligibility, actual bank/mobile/device/identity/mail connections and target hosting/restore/capacity/security checks remain unverified. Demo rates are explicitly zero, not legal assertions. Implementation and passing tests do not establish production readiness. See [Stage 3 setup and policies](stage3-runbook.md).

## Prior verification (retained history)

# Verification evidence — version 0.4.0, 2026-10-13

Environment: Windows, Node.js **25.2.1**, SQLite **3.50.4**, local Microsoft Edge through Playwright. The installed Node SQLite API emits an experimental warning; runtime selection must be revisited for deployment.

## Current results

- **93 automated tests passed, zero failures.** Original budget/funding/commitment/bill/payment controls and all requested lifecycle acceptance cases still pass. Additional tests cover independent vouchers, direct expenses and accessible receipts, stale allocations, delegation and proxy self-approval, grant ceilings, journal approval/reversal dependencies, canonical invoice reissue, cancelled bill/expense reversals without revived authority, HR attendance/leave, payroll reservation/posting/net/statutory payments, cancelled-reservation duplicate prevention, salary aggregation/privacy, MFA/recovery/session revocation, encrypted retry records and keyed sensitive-payload fingerprints. USD-only tests additionally cover rejected foreign accounts/rates/invoices/nested allocations, database enforcement, explicit USD account adjustments, signed provider currency validation with safe retry, HTTP enforcement and removed UI controls. Seventeen compensation/inventory tests cover proration, unpaid leave, open/project-based pay, encrypted effective terms, benefits/deductions, private previews/registers, own-pay approval denial, unchanged accrual/settlement semantics, receipts/issues/transfers/counts/returns/refunds, stale approvals, reversed receipt provenance, exact quantity/value rounding, duplicate/concurrent receipts and issues, period-lock authority, isolated inventory closure, protected exports and paired-key restore. Four background/configuration tests additionally verify deduplication and unchanged finances, no external delivery without opt-in, nonoverlapping jobs with transport outside transactions, protected job status and preservation of existing environment files.
- **All four browser suites passed.** The foundation and advanced lifecycle suites retain their full workflow coverage. The completion suite verifies voucher preparation/independent approval/posting, comments/resolution, notification navigation, employee and effective-rule setup, payroll approval/reservation/posting/private payslips, account security, fixed USD integration settings and mobile layout. The new suite verifies open compensation with employer benefits, preview, approval/posting/payslip/register CSV, warehouse setup, billed receipt, issue, transfer, approved count, supplier return, closeout block, CSV, printable PDF and mobile layout. New artifacts: `compensation-desktop.png`, `inventory-desktop.png`, `inventory-mobile.png` and `inventory-statement.pdf`.
- **Syntax checks passed** for all JavaScript under src/public/scripts/tests.
- **Local SMTP and HTTP webhook transport passed** against actual loopback servers. Durable failed delivery retries reuse the event identity without creating another journal. Incoming signed funding events reject invalid signatures and conflicting external-ID reuse and replay duplicate receipts once.
- **OpenID Connect fixture passed**: real discovery/token/JWKS exchanges, PKCE/state/nonce/signature checks, preprovisioned account restriction, replay rejection and local MFA enforcement. No live identity tenant was contacted.
- **Encrypted-data backup/restore passed** on an isolated SQLite copy with its matching key: exact balances, employee decryption, referential integrity and balanced journals survived. Backup refuses an existing destination.
- **Local load check passed**: 100 receipt postings plus 100 identical retries, ten concurrent HTTP clients, zero duplicate postings. The recorded run took 337 ms with p95 combined posting/retry latency of 44 ms; this is developer-machine evidence, not production capacity. See `artifacts/load-check.json`.
- **Saved database upgrade passed**: consistent `data/backup-before-0.4.0.sqlite`, schema 6 to 7, every existing row preserved across all 108 existing business tables, with only the two new GL accounts appended. Integrity `ok`, no foreign-key errors and original balances unchanged. See `artifacts/migration-0.4.0.json`.
- **Live saved application verified after restart** through authenticated dashboard/config/inventory/HR APIs and real Edge compensation/inventory screens. Empty setup states behave correctly; no employees or stock transactions were fabricated in the saved database. Original balances remain exact. See `artifacts/live-0.4.0-verification.json`, `live-compensation.png` and `live-inventory.png`.
- **Live environment and scheduled inbox scan verified**: `.env` is loaded, the known demo administrator scans every 300 seconds, the startup scan completed without error, external transport remains disabled, `.env` is excluded from Git, and all original financial balances remain exact. See `artifacts/live-jobs-verification.json`.

The required example remains: approved $50,000; received $40,000; actual $6,000; outstanding commitment $4,000; remaining $40,000; unpaid bill $2,000; cash $36,000. The advance acceptance still yields zero outstanding after issuing $2,000, accepting $1,500 and returning $500, with $1,500 actual cost and net cash reduction.

Production preflight deliberately remains **not ready** for the saved demo: unsupported development runtime, local HTTP/session settings, local/demo keys and credentials, unenrolled MFA, legacy payment bypass and absent organization/hosting attestations. Docker is unavailable here, so container build, persistent-volume ownership, real certificates, live mail/identity/provider contracts and target capacity/restore were not verified. The user-selected scope is USD only; foreign currency expansion is excluded. Non-hourly compensation and project inventory are implemented. Jurisdiction-specific statutory filings, GRNI, PO quantity/unit-price matching, serial/expiry tracking and manufacturing remain outside this milestone. See [setup and supported policies](completion-runbook.md).

## Earlier verification, version 0.2.0

- `npm.cmd test`: **47 passed, 0 failed**, using isolated real SQLite databases. All 30 original tests passed before extension; their financial controls remain covered, with intentional closeout/migration expectations updated for schema 4.
- `npm.cmd run test:browser`: **both suites passed**. The original suite verifies the complete first milestone and desktop/mobile rendering. The lifecycle suite verifies advance request/approval/disbursement, supporting-file upload, $1,500 settlement/$500 return, closure block with outstanding advance, budget increase and approved transfer, credit/refund, cancellation, restricted funding return and promise cancellation, statement CSV import and individual matches/finalization, CSV download, PDF printing, financial closure and authorized reopening.
- `npm.cmd run check`: server, domain service and browser JavaScript syntax checks passed.
- Versioned migrations were reapplied safely without changing existing records. Demonstration seeding refused an already populated database.
- The actual existing database was backed up using SQLite VACUUM INTO, then migrated from schema 3 to 4. User/project counts and all original financial balances were verified unchanged. The restored running application reports version 0.2.0.

## Required financial scenario

Approved budget **$50,000**; received funding **$40,000**; approved purchase commitment **$10,000**; supplier bill **$6,000**; payment **$4,000**.

| Balance | Expected | Verified |
| --- | --- | --- |
| Actual budget charges | $6,000.00 | $6,000.00 |
| Outstanding commitment | $4,000.00 | $4,000.00 |
| Remaining budget | $40,000.00 | $40,000.00 |
| Unpaid bill / liability | $2,000.00 | $2,000.00 |
| Project cash allocation | $36,000.00 | $36,000.00 |

This scenario is verified at domain/database level, through authenticated HTTP routes, and through actual browser controls. The persisted labelled demonstration database contains the same balances.

## Verified control cases

Unauthorized project reads/writes; self-approval of requests and budgets; concurrent overspending using two separate database connections in workers; durable idempotency and conflicting keys; concurrent duplicate payment with different keys; duplicate supplier invoices; overbilling; cancellation preserving billed cost and liability; advance issue/settlement/unused return; reapproval after material edits; immutable original budgets and financial evidence; category/date/project source restrictions; no cash increase on budget approval; insufficient cash and concurrent cash spending; distinct multiple approval levels; snapshotted policies; partial payment cents across projects; project-scoped split-bill privacy; linked payment and bill reversals; asset budget charges differing from expenses; internal transfers not affecting funding/actual; organization cash equalling project allocations; reconciliation differences; backdated cash invalidating reconciliation; project closure gates; closed periods; explicit overrun authority; exact decimal validation; password hashing and redacted audit; expired sessions; HTTP cross-origin rejection; migration reruns and non-destructive demo seeding.

Added coverage: exact $2,000 issue/$1,500 accepted/$500 return; automatic reservation release; advance receipts/due/overdue/PO exclusion; approved amendment/transfer evidence and uncovered reductions; credit payable-versus-receivable/refund effects and reversal dependencies; replacement-goods commitment restoration; many-to-many partial matches; duplicate/concurrent matching and duplicate imports; finalized statement reopening/unmatching; independently authorized locked-period corrections; operational completion and closed-project posting blocks; closeout exceptions with exact treatments and owner; authorized reopening audit; report period/source/category drill-down and exact cents; formula-safe CSV and BOM/quoted-field import; protected evidence downloads; and recovery of rejected expenditure after an advance was cancelled without negative/recreated reservations.

## Advance acceptance scenario

| Event / final balance | Verified |
| --- | --- |
| Issued | $2,000.00 |
| Accepted expenditure | $1,500.00 |
| Unused cash returned | $500.00 |
| Outstanding advance | $0.00 |
| Outstanding advance reservation | $0.00 |
| Actual expenditure increase | $1,500.00 |
| Net cash reduction | $1,500.00 |

Domain tests accept expenditure in two partial settlements ($700 + $800); browser tests upload supporting evidence and liquidate the advance through visible controls. Settlement leaves cash unchanged; only issuance and unused return move cash.

## Visual artifacts and limits

[Desktop demonstration dashboard](../artifacts/overview-desktop.png) and [mobile browser workflow dashboard](../artifacts/overview-mobile.png).

Lifecycle artifacts: [advance register](../artifacts/advances-desktop.png), [statement reconciliation](../artifacts/reconciliation-desktop.png), [financial closeout](../artifacts/closeout-desktop.png), [printable PDF statement](../artifacts/financial-statement.pdf), [CSV statement](../artifacts/financial-statement.csv). They come from isolated labelled demonstration fixtures, not mutations of the persistent baseline example.

These tests do not constitute a security audit, statutory accounting/payroll validation, accessibility certification, disaster-recovery drill, load test or production deployment verification. Comments, delegation, notification delivery, voucher authorization, generic adjustments/invoice reissue, direct expenses, payroll, FX and integrations remain future work. Complete scope and policies are recorded in the README, requirements and lifecycle runbook.

HR registration visibility follow-up: Add employee and Assign HR capability now stay in the HR management page header on every tab. The administrator already has HR permission; a selected Attendance/Payroll/Reports tab previously hid registration. Non-HR accounts see a clear permission explanation. Syntax checks and the Stage 3 browser suite passed, including registration from Reports and visibility on all six tabs. Live admin header/form/mobile verification passed without creating employees: artifacts/live-hr-registration-header.json and .png. Refresh the browser after loading this update.

Version 0.5.2: page/scripts/styles now use no-store headers and versioned module URLs to avoid stale registration controls. The build number is shown in the top bar. Direct registration: http://127.0.0.1:3000/?v=0.5.2#register-employee. This opens the HR registration form after login for an authorized HR account and gives a permission message with the actual signed-in email for others. The form does not reopen after saving. Eight relevant HTTP/permission/asset regressions, syntax checks, the direct-registration browser suite and the Stage 3 browser suite passed. Live admin direct-form verification is in artifacts/live-registration-direct-form.json/.png; no real employees or permissions were changed.

## Stage 4 ? 2026-10-15, version 0.6.0

136 automated tests, all seven browser suites and JavaScript syntax checks passed. This includes the complete prior 117-test baseline and 19 new accounting tests. Original project finance, approvals/duplicates/concurrency, advances, budget transfers, credits/refunds, reconciliation, closure, HR permissions/registration, payroll and inventory remain covered. New coverage proves the required zero-opening accounting example, approved openings and opening-bank reconciliation, manual approvals/replacements/reversals, funding treatments/refunds/transfers and competing posts, period locks/reopening/year-end, mapped controls and assets/depreciation/disposal. USD rejection tests replace the excluded foreign-currency acceptance case.

Evidence: `artifacts/stage4-final-tests.txt`, `stage4-final-browser.txt`, `stage4-final-syntax.txt`, `stage4-demo-verification.json`, `migration-0.6.0.json`, `live-0.6.0-verification.json`. Migration preserved all original rows across 155 tables, including the saved employee; six new accounts were appended. Integrity ok, foreign-key errors zero. The persisted isolated example reconciles cash 35,000, payable 2,000, payroll payable zero, expense 7,000, surplus/net assets 33,000, purchase commitment 4,000, budget available 39,000 and trial debit/credit 42,000. Main records retain the original 36,000 cash and 6,000 actual cost. See [completion and limits](stage4-completion.md).

## Stage 5 employee lifecycle, 0.7.0 / schema 10

154 distinct automated tests passed (153 in the complete final regression run, then 18 focused lifecycle tests including one added regression; runs overlap), all eight browser suites and JavaScript syntax checks passed. Final privacy and source-dialog/browser checks passed after polish. Lifecycle coverage includes the required recruitment-to-final-pay flow, concurrent/duplicate conversion, approved salary changes, forecast-only budgets, course accounting without duplication, role/file privacy, independent bank/task review, historical salary preservation, locked final payroll, access revocation with outstanding equipment, unpaid salary and full clearance. Logs and preserved-data proof are listed in [Stage 5 completion](stage5-completion.md).

## Operational completion, 0.8.0 / schema 11 — 2026-10-16

170 distinct automated tests, nine browser suites, syntax and live saved-app UI/API checks passed. Migration preserves 332 prior rows in 235 existing business tables, original key/employee and financial totals. Focused provider/readiness reruns overlap the 170. Real providers and production readiness remain unverified; preflight intentionally reports false. See [operational completion evidence](operations-completion.md) and artifacts/operations-*.txt.

## Stage 6 ? 2026-10-18, v0.9.0 / schema 12

180 distinct automated tests and ten browser suites passed on both Node25.2.1 and supported portable Node24.22.0. Final scoped input/authentication, access, restore and logout/registration reruns overlap those totals. Independent Stage1/3/4 source/report/CSV checks agree, encrypted restore starts and authenticates under quarantine, and the saved migration preserves 378 old rows in 252 tables and the original key. Clean lockfile install, dependency audit (zero reported findings), native syntax and static Vercel build passed. Real deployment/provider/human policy and acceptance gates remain unverified; recommendation is not ready for a real financial pilot/production. [Detailed report](stage6-readiness.md).

## Policy/UAT review follow-up - 2026-10-18

On supported Node24.22.0, all five role automation runs passed: Finance, HR, project manager, employee and Administrator/security. These runs overlap existing browser suites and do not count as new independent tests or human acceptance. Separate logs and current source fingerprints are indexed in `artifacts/policy-uat-review-status.json`. Four new review-record regression tests passed (`artifacts/policy-uat-record-tests.txt`): preserving findings/history; rejecting incomplete declarations/acceptance; invalidating changed evidence/policies/scenarios; and rejecting missing/escaping/secret evidence references. Syntax passed. A separate synthetic human-review environment on port3003 passed actual browser sign-in plus API checks for quarantine, disabled jobs/transports and the original financial totals. Human and policy approvals remain pending actual reviewer decisions. No full 184-test run is claimed.


## Stage 7 local verification, v0.10.0 / schema12

191 distinct automated tests and11 browser suites passed on portable Node24.22.0. Final13 focused tests and project/security browser reruns overlap those counts. The60-project/600-receipt workload reduced service list statements1191 to4, HTTP statements1195 to8, response31509 to10726 bytes (60 projects to a page of20), and local HTTP p95346.0 to17.2ms. Financial parity, membership scope, filters, cross-page allocations and full exports passed. See [readiness evidence](stage7-readiness.md) and [performance contract](stage7-project-pagination.md).

On2026-10-20 the actual reviewer reported invalid credentials before the advance scenario. Read-only synthetic-account checks found the documented passwords correct; the UAT process was stopped. After restarting the same quarantined database/key, fresh-browser Requester sign-in passed as Samira Osman with zero browser errors. The earlier message was not reproduced and its cause remains unconfirmed. Actual reviewer retry is pending, so this is not human acceptance. No business operations were posted. Evidence: artifacts/uat/stage7-access-diagnosis.json and stage7-browser-access.json.

Supabase adapter/schema/recovery implementation and actual-host startup, persistence, HTTPS, scheduler, encrypted backups, delivered alerts and isolated PostgreSQL restoration remain unverified/incomplete. Local syntax/build/mocks do not establish those results.

## Organization Finance & Accounting, 0.11.0 / schema13 - 2026-10-22

**212 automated tests and all12 browser suites passed** on portable Node24.22.0. This includes the prior191 tests and21 organization cases. The40 focused accounting/organization checks overlap that count. JavaScript syntax and the public-only Vercel artifact build passed; the reserved `.invalid` backend is artifact configuration, not an actual deployment.

The required non-project bill1000/payment400 case increases expense1000, decreases cash400 and leaves payable600 while preserving all project metrics. Consolidated expense8000 equals project7000 plus general1000; cash54600 equals35000 plus19600; payable2600 equals2000 plus600. Trial-balance sides62600 agree and signed ledger/consolidation differences are zero. Zero-project operation, shared cost allocation, independent/parent budgets, restricted/deferred/refundable funding, partial collections, advances, recurring draft uniqueness, internal bank/general/project allocations and reversals, duplicate reconciliation, concurrent budget checks, unauthorized access, locked corrections, migration reference preservation and encrypted recovery are covered.

Final browser verification also fixed an optional correction-authorization input that remained mandatory and confirmation messages hidden by older notification timers. The organization browser uses separate Finance/Manager contexts, verifies the cash allocation and reversal restore original project balances, and checks CSV, print, mobile and denied requester access. Actual port3004 restart verifies database integrity, schema13/276 tables, exact balances, dedicated session-cookie isolation and protected attachments. Saved/main and guided-UAT databases were not migrated.

Evidence: [release report](organization-finance-release.md), [full test log](../artifacts/organization-finance-full-tests.txt), [browser log](../artifacts/organization-finance-all-browsers.txt), [source-ledger proof](../artifacts/organization-finance-reconciliation.json) and [actual runtime verification](../artifacts/organization-finance-runtime-verification.json). The earlier pending requester retry is historical: the user subsequently confirmed successful Samira sign-in and an approved2000 advance reservation. Full advance acceptance still awaits actual Finance issue/settlement/return observations. Organization automation is not human acceptance, legal-policy approval, Supabase deployment or real-pilot authorization; remaining gates are in the [readiness register](stage7-readiness.md).

## PostgreSQL staging candidate, 0.12.0 - finalized2026-10-26

83 tests passed against actual disposable PostgreSQL17.6 with zero failures, independently of the212-test SQLite compatibility run. All five selected PostgreSQL browser suites passed: organization finance, accounting, Stage3 HR, employee lifecycle, and payroll/inventory. One SQLite-specific VACUUM/key-copy scenario is omitted from the PostgreSQL selection; native encrypted PostgreSQL recovery is verified separately. Final10 focused identity/configuration/staging checks and four patched Nodemailer transport checks overlap earlier SQLite coverage. The runtime audit reports zero findings.

Native PostgreSQL evidence covers separate connections/workers competing for budget, payments and collections; duplicate retries; interrupted publication rollback; role/DDL/immutable/audit/receipt restrictions; upgrades/checksum drift; and atomic administrator bootstrap. Original50000/40000/10000/6000/4000 values reconcile to posted rows/reports/CSV. The general1000 bill/400 payment leaves600 payable without altering projects. All276 synthetic migration tables preserve exact hashes/counts. Separate-database recovery verifies protected financial/HR attachments, audit/approvals/authentication, cutoff, quarantine, wrong keys/corruption/overwrite, and CLI key restoration without the original key file.

PostgreSQL default64 lock capacity exhausted during parallel rehearsals; the512 configuration is now required and verified. Runtime restart/persistence, source IDs, protected attachments and cookie isolation passed again on2026-10-26 at loopback3005. Tests were captured Oct24 and reused for unchanged workflows. Evidence, source package and target blockers: [PostgreSQL release](postgres-release.md). Actual Supabase/host/HTTPS/grants/jobs/offsite backups/delivered alerts/recovery and real human acceptance remain unverified. Saved/main and guided-UAT databases were not migrated.


## Finance usability 0.13.0 — 2026-10-27

Targeted organization-finance and employee-permission regressions passed **18/18 on SQLite and 18/18 on actual disposable PostgreSQL**, separately. Five SQLite browser suites passed (organization finance, usability, project-finance smoke, accounting and employee registration); four PostgreSQL suites passed (organization finance, usability, accounting and employee registration). Final guided bill submission feedback was checked on both providers.

The browser lifecycle verified a1000 bill with supporting invoice, independent approval, posting and400 partial payment, leaving600 unpaid and project balances unchanged. Invalid amounts/dates, file limits/removal, back navigation, missing setup, cancellation, validation cleanup, mobile overflow and unauthorized access were checked. Syntax, public-only Vercel build and current compiled-runtime hashes passed. Preview0.13.0 login and stable financial totals/ledger IDs passed without financial posting. Source/evidence hashes: artifacts/finance-ux-release.json.

This is targeted usability verification, not a fresh full foundation run, deployed Supabase verification or human acceptance. Saved SQLite and paused guided-UAT records were not used.


## Guided workflows0.14.0 — finalized2026-10-28

The full SQLite run passed214/214 tests. Applicable PostgreSQL financial, HR, permission and payroll/inventory regressions passed57/57; the SQLite-only paired-key file-backup test was excluded. Initial fixture/selection errors are retained in separate diagnostic logs; corrected checks were rerun. Earlier native PostgreSQL recovery evidence is historical, not a new recovery test in this increment.

Six browser suites passed per provider: guided workflows, employee registration, organization finance, Stage3 HR, payroll/inventory and finance usability. Final focused HR account-link and payroll checks also passed. The financial browser scenario verified receipt3000, bill1000, payment400/payable600, advance2000/settlement1500/return500/outstanding0, partial receivable collection and unchanged project balances. Accepted advance expenditure did not deduct cash again.

Current preview0.14.0 verifies Super Administrator login, receipt/advance/employee screens, open-pay controls, actual mobile dialogs and unchanged existing totals/ledger IDs, with no financial or HR submission. Syntax and the19-asset public-only Vercel artifact passed; actual hosting was not deployed. Human acceptance remains pending. Evidence and source hashes: artifacts/guided-workflows-release.json.
