# Interface release report — 0.15.0

29 October 2026. Implemented and technically verified locally. Human usability acceptance and actual Supabase/private-host deployment remain pending.

## Delivered

The application now opens on a role-aware dashboard. A shared grey/white/navy/teal design, expandable sidebar, authorized feature search, compact top bar, notifications, user menu and mobile drawer apply across Finance, Projects and HR. The drawer supports keyboard trapping, Escape, focus restoration and an inert closed menu/background.

Authorized cards and charts use existing financial reporting readers and the single double-entry ledger. Cards state their period/cutoff and open paged source records and posted journals. Cash movements exclude openings/internal transfers; budget authority excludes parent envelopes; purchase, advance and payroll reservations remain distinguishable. Unrestricted general cash is explicitly before obligations, not freely spendable authority. HR/employee summaries omit unauthorized financial and confidential information. Payroll references, source search and linked-reversal detail are protected in the new routes.

Guided bills, receipts, payments, collections, advances and employee registration remain functional, with retained validation/attachments and independent approval/posting. Finance actions/filters and shared Project/HR controls/tables use the new styling. No new ledger, posting workflow, dependency or schema migration was introduced. The existing project-detail API is preserved.

## Measured verification

| Evidence | Result |
|---|---|
| Complete SQLite regression run | 221 passed, zero failures |
| Applicable PostgreSQL accounting/organization/HR/payroll/permission regression run | 71 passed, zero failures |
| Final dashboard read-model/security checks, after final changes | 8 passed on SQLite and 8 on PostgreSQL |
| Browser suites run individually with the expandable navigation | 15 SQLite and 8 PostgreSQL suites passed |
| Desktop/tablet/mobile, keyboard, empty/error states and role restrictions | Passed in the dashboard browser suite |
| JavaScript syntax and PostgreSQL runtime build | Passed |
| Preserved preview login, reports, CSV, protected attachment and cookie isolation | Passed; no financial/HR posting |

The broad runs included seven dashboard cases. Final eight-case runs overlap those cases and add a payroll privacy check; these counts must not be added as independent tests. PostgreSQL results come from actual local PostgreSQL 17.6 fixtures, not SQLite emulation. Write-concurrency/recovery controls were not changed; this release does not claim a new remote recovery rehearsal or production load test.

The original project example still reports actual charges $6,000, commitments $4,000, remaining authority $40,000 and project cash allocation $36,000. The organization bill/payment workflow still reports expense $1,000, payment $400 and supplier payable $600 without changing project balances. Guided advance issue $2,000 / settlement $1,500 / return $500 finishes at zero outstanding and net cash use $1,500.

On 61 budgeted projects and 120 additional receipts, the full Finance configuration/overview/report path measured 2,718 reads, 264,049 bytes and 114.18 ms. Compact dashboard bootstrap + overview measured 124 reads, 12,636 bytes and 24.66 ms. An eight-row cash source page measured seven reads including authorization. Financial totals agreed. This compares two current read paths on one machine, not a replay of the previous release or production capacity. See the machine-readable [performance evidence](../artifacts/dashboard-performance.json).

## Preview and screenshots

**http://127.0.0.1:3005** serves version 0.15.0 from the existing isolated synthetic PostgreSQL database. Refresh with Ctrl+F5 and use the existing protected local login. Current PID/build metadata is in `artifacts/postgres-local-staging-session.json`; do not rely on a hard-coded PID for shutdown.

The read-only preview verification retained cash **$54,600**, expense **$8,000**, supplier payables **$2,600**, purchase commitments **$4,000** and unrestricted general cash **$19,600**, with zero consolidation difference. The saved SQLite database, paused port3003 UAT and preview financial records were not used as test fixtures. Jobs and outbound transports remain disabled.

Actual implemented screenshots: [Dashboard](../artifacts/dashboard-desktop.png), [tablet](../artifacts/dashboard-tablet.png), [mobile](../artifacts/dashboard-mobile.png), [Finance](../artifacts/dashboard-finance.png), [Projects](../artifacts/dashboard-projects.png), [HR](../artifacts/dashboard-hr.png), [running preview](../artifacts/dashboard-preview.png). [Complete evidence and source hashes](../artifacts/dashboard-release.json).

## Remaining limits and next owners

- **User/reviewer:** review Dashboard, source drill-down, navigation and daily forms on your device; record actual observations before human acceptance.
- **Engineering:** some legacy specialist views/reports still materialize server-side records or use client-side table paging. Dashboard ledger pages use SQL pagination, while obligation/budget/approval panels page their response after existing server-side report calculation. Large selectors are capped at 100 projects/200 project sources and need searchable endpoints at greater scale. Budget/utilization charts show 12 groups; full reports retain complete authorized exports.
- **Finance:** freely spendable funding authority has not been asserted; obligations, restrictions and approved budgets still govern spending. Configure validated business/statutory policies separately.
- **Hosting/administration:** provide the actual Supabase and persistent Node target/domain/access for HTTPS, production sessions, scheduled backups/alerts and remote restoration checks. Local PostgreSQL passes do not validate the remote service. Real-record pilot use still needs explicit scope/policy/access/recovery approval.

See the [operator guide, API definitions and setup](interface-redesign.md). No unrelated human acceptance or production authorization is inferred.
