# Interface and dashboard release 0.15.0

Implemented 29 October 2026. USD remains the only currency. This update reuses the established HTML/CSS/JavaScript frontend, authenticated Node API and existing ledger. There is no new financial posting route, ledger, dependency or database migration.

## Using the workspace

After signing in, **Overview → Dashboard** shows the records authorized for your role. Finance sees organization totals; project users see assigned projects; HR sees permitted staffing/workflow counts; employees see their own work. Missing permission hides a component rather than presenting a misleading zero.

Choose the financial scope and dates, then **Apply**. Open **Advanced filters & budget alerts** for a project, funding source, department, cost centre or review threshold. Thresholds are optional percentages chosen by the operator; no invented risk rating is assigned. Use the refresh button to reload. Returning to Dashboard after financial work also fetches current values.

Each card states its period or cutoff. **View source records** opens a searchable, paged list; **View journal** opens the authorized posted lines. Payroll source detail stays in the private payroll workspace. Charts have **View underlying values** tables. Click or press Enter on a cash month to narrow the overview to that month. Financial reports retain full authorized CSV/print exports.

Expand the sidebar groups to find a workflow. **Find a feature** searches only your permitted destinations, not employee records or confidential data. Finance sections are inside **Finance & Accounting**. Notifications and account/security/sign-out controls are in the top bar. On phones, use **Open navigation**; Escape closes the drawer and restores focus.

The existing guided bill, receipt, payment, collection, advance and employee forms retain their validation, attachment review and entered values after errors. Request, independent approval and posting remain separate actions. Specialist Finance, Project and HR pages share the new typography, controls, cards, table styling and focus treatment.

## Financial definitions

- **Cash balance:** posted cash/bank/mobile account lines through the cutoff. A filtered project/fund value is an allocation, not an additional bank balance.
- **Actual expenditure:** posted expense accounts in the selected period. Capital acquisition may charge a project budget without being an accounting expense.
- **Outstanding commitments:** purchase/spending reservations still unconsumed at the cutoff. Advance and payroll reservations appear separately in the budget values and are included once in utilization.
- **Supplier payables / advances:** authoritative unpaid obligations and outstanding advances through the cutoff. Settlement does not pay cash twice.
- **Unrestricted general cash:** general-operation allocation in approved unrestricted, income-on-receipt funds, before obligations. It is explicitly not asserted to be freely spendable funding. Restricted, refundable and deferred funding do not enter this card. A reliable unrestricted spending-authority calculation remains unconfigured.
- **Cash movement chart:** external receipts/payments during the period; openings, account transfers and internal project allocations are excluded. This is not recognized income/expenditure.
- **Budget chart:** current approved project/general authority, actual budget charges and reservations through the cutoff. Parent budget envelopes are excluded from consolidated authority. Funding-source filters retain whole project budget authority because budgets are not apportioned by source.

## Implementation and bounds

`src/dashboard.js` composes existing accounting, aging, advance, HR and general-budget readers within a consistent read transaction. Request-local memoization is isolated by service instance and actor. Project budget charges/reservations use batched SQL rather than queries per category. The existing project-detail method and its authorization remain separate from `workspaceDashboard`.

Dashboard bootstrap does not include the user directory, cash ledger, memberships or attachments. The overview returns aggregates, permitted choices and at most five rows per operational panel. Ledger source pages use SQL count and LIMIT/OFFSET (8 default, 25 maximum); the browser never fetches the whole ledger for a card. Budget/obligation/approval pages are bounded in their response but still use the existing server-side report models before slicing. Those models and some legacy specialist screens can grow with the ledger; further SQL aggregation/pagination there is future scaling work.

Budget and utilization charts display up to 12 groups, categories show 11 plus a net Other bucket when necessary, and full reports remain authoritative. Project/source selectors show up to 100/200 authorized choices; very large organizations will need searchable selector endpoints. Dashboard charts support at most ten years. Individual salary journal drill-down is deliberately unavailable in this overview. The dashboard is a summary, not a replacement for protected supporting-document workspaces.

## Verification and evidence

See `artifacts/dashboard-release.json` for final provider-specific results, source hashes and preview status. Financial/permission tests cover the original project example, the non-project bill/payment example, cash transfers, shared cost movement, parent budgets, threshold configuration, source paging and payroll privacy. Browser checks exercise the actual shell and existing approval/posting/HR workflows in disposable synthetic fixtures.

Screenshots: [Dashboard desktop](../artifacts/dashboard-desktop.png), [tablet](../artifacts/dashboard-tablet.png), [mobile](../artifacts/dashboard-mobile.png), [Finance](../artifacts/dashboard-finance.png), [Project](../artifacts/dashboard-projects.png), [HR](../artifacts/dashboard-hr.png). These are implemented screens, not design mockups.

The performance comparison in `artifacts/dashboard-performance.json` measures the current full Finance load (configuration + overview + full report) against compact dashboard bootstrap + overview on one isolated workload of 61 budgeted projects and 120 extra receipts. It is not a historical replay or production load test. Timings vary with machine load. Totals must agree; payload/query reductions are the useful comparison.

## Run and review

Use Node 24 and the existing installation. `npm.cmd run test:dashboard`, `test:browser:dashboard` and `test:performance:dashboard` use synthetic fixtures. `npm.cmd run check` validates JavaScript syntax. Rebuild the PostgreSQL runtime after source changes with the established build procedure before startup. There is no schema upgrade for this release.

The isolated PostgreSQL preview is **http://127.0.0.1:3005**. Use the existing protected local login file or its synthetic demo accounts; do not copy credentials into reports. `npm.cmd run demo:postgres` resumes its saved isolated database without loading root `.env`. Current listener/build metadata is in `artifacts/postgres-local-staging-session.json`. Do not start a second listener or select the saved SQLite/UAT database.

Human usability review is pending. Actual Supabase/HTTPS/private-host checks, live integrations, validated statutory policies and real-record pilot authorization remain separate unresolved gates. Neither screenshots nor automated passes record human acceptance.
