# Project list contract and scaling evidence

Build 0.10.0, schema12. `GET /api/projects` returns `{projects, pagination, filters}`. Only the actor's memberships are counted or returned. Query parameters: `page` positive integer (default1, maximum1000000), `page_size` integer1..50 (default20), `q` literal substring up to100 characters in code/name/department, `status` all/active/closed. Invalid bounds/types return400. Beyond the last page returns an empty array and the filtered total; an authenticated unassigned account sees total0. Detail/export routes still enforce their own project scope.

`pagination` contains page, page_size, total, total_pages, has_previous and has_next. Stable order is project ID; count, page and totals share one read snapshot. Concurrent changes across separate page requests can change the result set; this is not a frozen multi-request export. Financial report/CSV routes keep complete authorized results and existing filters independently of project-list pagination.

`src/project-list.js` calculates one bounded set of ledger aggregates: latest approved budget, actual charges, commitments, original/reversed receipt cash, promise adjustments, payable/advance/cash balances, supplier/expense/payroll payments and deferred/refundable fund liability exclusion. It preserves the existing detailed metrics semantics. Tests compare every summary metric to the established calculation through advance settlement/return, payment reversal and conditional funding. No mutable financial summary cache is introduced.

The native Projects screen has server search/status/page-size controls and Previous/Next. Sign-in fetches details/work/inventory/salary costs for one selected project instead of all memberships. Selecting another project fetches its details. Allocation rows can search authorized projects beyond the visible page and load their source/activity choices on selection; Enter performs lookup without submitting the financial form. Detail caches retain the selected project and actual allocation-row projects. `config.project_roles` contains only the actor's distinct project roles so global capability controls do not depend on the visible page.

## Repeatable measurement

`scripts/stage7-project-performance.js baseline|after` creates isolated synthetic fixtures, never saved data. Workload60 projects,600 receipts,40 HTTP list requests, concurrency5, requested page20. Baseline was captured before changing the implementation; the command now runs the current source, so do not overwrite the historical baseline to manufacture a comparison. Existing artifacts use exclusive creation.

| Measurement | Before | After |
| --- | ---: | ---: |
| List prepared SQL statements, excluding transaction-control exec | 1,191 | 4 |
| HTTP prepared statements including authentication | 1,195 | 8 |
| Returned projects | 60 | 20 |
| Payload bytes | 31,509 | 10,726 |
| List service time | 63.9ms | 2.7ms |
| HTTP p50 | 311.2ms | 11.1ms |
| HTTP p95 | 346.0ms | 17.2ms |

[Baseline](../artifacts/stage7-project-baseline.json), [after](../artifacts/stage7-project-after.json), [browser evidence](../artifacts/stage7-project-browser.json), [financial/scope tests](../tests/stage7-projects.test.js). Same Windows host, supported Node24.22.0, documented synthetic fixtures. These are observed local timings, not host capacity or production guarantees; compare again on PostgreSQL and the actual host.

Selected-project history/detail and other HR/accounting overview APIs remain separate scaling work. This change does not claim all ERP responses are bounded or that client table paging limits database payloads.
