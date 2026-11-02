# Visual identity and analytical dashboard — 0.16.0

Implemented and verified on 2 November 2026. This release replaces the earlier white-and-grey direction with the supplied navy, teal, blue, violet and gold palette. It retains the existing HTML/CSS/JavaScript application, Node API, USD ledger, role restrictions, approval separation, period locks and transaction operations. No dependency or schema migration is required.

Open the isolated synthetic PostgreSQL preview at **http://127.0.0.1:3005**, refresh the browser, and use the existing protected local login. Credentials have not been reset. The saved SQLite database and paused port3003 guided-UAT session were not used for development or testing. Preview verification performs authentication and read operations, with no financial or HR posting. Outbound integrations and jobs remain disabled.

The actual approved organization name and logo are still absent. The interface uses the existing Folio/product fallback; synthetic journey organization names are test fixtures. Set `ERP_ORGANIZATION_NAME` and, optionally, the existing validated `ERP_ORGANIZATION_LOGO_FILE` on the backend when approved identity is available. The supplied colors are implemented now.

## What changed

The sidebar is deep navy, with separated groups, a teal active indicator, retained role-aware feature search, profile/sign-out controls, a desktop collapse button and a mobile drawer. In collapsed mode, group summaries open a labelled flyout; keyboard navigation and Escape are supported. The top bar retains breadcrumbs, notifications and account controls.

The dashboard presents the reporting period and visible scope first, followed by Cash balance, Funds received, Actual expenses and Supplier payables for authorized Finance users. Project users receive only their assigned financial scope; HR and employee roles do not receive organization financial cards. One primary task is visible in the header; **More actions** exposes the other permitted workflows with their explanations. These still open the existing reviewed transaction forms.

The wider monthly cash panel includes currency axes, gridlines, received/payment legends, exact-value hover titles, keyboard month selection, a horizontally scrollable mobile plot and an underlying values table. Budget utilization distinguishes actual charges, all purchase/advance/payroll reservations and remaining authority. Operational panels show approvals, payment obligations, active project utilization and authorized recent activity. Smaller secondary cards retain advances, purchase commitments and available authority with explanations. Category analysis, overdue advances and optional review thresholds remain expandable below.

Shared tokens style page headers, forms, transaction review, tables, status badges, record details, login, reports, error pages and print output. Monetary table cells align right. White is retained for readable form and table content. Print verification includes a PDF rendered with background printing disabled. Specialist accounting, inventory, lifecycle and policy/setup tools retain their established dense table/form arrangements and some technical detail displays; their shared shell, headers, controls and surfaces use the new palette. Those specialist layouts have not all been converted to guided forms.

## Financial definitions and sources

| Figure | Basis and supporting records |
|---|---|
| Cash balance | Posted cash-account lines through the cutoff, within the selected scope. Project allocations share physical bank accounts. |
| Funds received | Positive external cash movements in the selected period, including funding, collections, refunds and returned advances. Excludes opening balances, internal transfers, allocation offsets and their linked reversals. This is not recognized income. |
| Actual expenses | Posted expense-account activity during the selected period. Asset budget charges can differ from accounting expenses. |
| Supplier payables | Unpaid supplier bills and reimbursements through the cutoff. |
| Available budget | Approved authority less actual budget charges and all reservations. Parent envelopes are excluded from consolidated authority. |
| Unrestricted general cash | Cash allocated to unrestricted income-on-receipt funds, before obligations. No freely spendable authority is asserted. |

The added `received` summary and its bounded, permission-scoped source endpoint use the same cash movement exclusions as the existing chart. Other financial readers and all posting routes are reused. Source dialogs retain scope, dates and payroll confidentiality. There are no invented trend comparisons. Empty, loading, restricted and failed-request states remain distinct; request failures do not appear as zero balances.

The original project example is verified separately in automated fixtures: budget50000, funding40000, PO10000, bill6000, payment4000; actual6000, commitment4000, available40000, unpaid2000, allocated cash36000. The retained preview contains additional synthetic activity and therefore has different organization totals: cash54600, received60000, period expense8000, payable2600, purchase commitments4000, available authority63000 and advances0. The preview report agrees, with consolidation difference0 and unchanged protected attachment bytes.

## Measured verification

- SQLite: **31** dashboard, organization-finance, permission and record-detail tests passed.
- Native PostgreSQL: **31** corresponding tests passed; **8** final dashboard tests also passed and overlap that run.
- SQLite: **5** browser suites passed (dashboard, complete bill/payment journey, guided receipts/advances/employee registration, leave and Finance usability).
- Native PostgreSQL: **4** browser suites passed (dashboard, complete bill/payment journey, guided transactions/employee registration and leave).
- Provider/static export: **5** tests passed. JavaScript syntax checks passed.
- Desktop1440, tablet1024 and mobile390 inspected. No document horizontal overflow or browser errors in the selected runs. Collapse/flyout, mobile focus containment, Escape, task menus, error retry, empty periods and source records were exercised.
- Actual computed text/background pairs for navigation, metrics, buttons, badges, login labels and both header gradient endpoints meet the tested4.5:1 threshold. Chart data fills meet3:1 against their plot background. Exact selectors, colors and ratios are in [contrast evidence](../artifacts/identity-contrast.json); these sampled checks are not a full independent accessibility certification.

One native PostgreSQL leave submission exceeded the browser's15-second wait during parallel local testing. The unchanged scenario passed when rerun in isolation; the [first attempt log](../artifacts/identity-postgres-leave-first-attempt.txt) is retained. The local host/legacy read-model latency is not a production performance measurement. A failed test was not counted as a pass.

Evidence with source hashes and provider-specific logs: [release evidence](../artifacts/visual-identity-release.json). Historical228-test SQLite and37-test PostgreSQL release results are not claimed as fresh full-suite runs for this release. Automated browser activity is technical verification, not human acceptance or pilot authorization. Actual Supabase hosting, HTTPS, scheduled recovery/notifications, validated operational policies and real-record pilot authorization remain separate gates.

## Actual screenshots and journey

| Screen | Capture |
|---|---|
| Complete desktop dashboard | [Desktop](../artifacts/identity-desktop.png) |
| Tablet dashboard | [Tablet](../artifacts/identity-tablet.png) |
| Mobile dashboard | [Mobile](../artifacts/identity-mobile.png) |
| Finance bills workspace | [Finance](../artifacts/identity-finance.png) |
| Collapsed sidebar and Finance overview | [Collapsed navigation](../artifacts/identity-collapsed.png) |
| HR overview | [HR](../artifacts/identity-hr.png) |
| Login | [Login](../artifacts/identity-login.png) |
| Bill entry | [Entry](../artifacts/journey-03-bill-entry.png) |
| Complete bill review, allocations and attachment | [Review](../artifacts/journey-04-bill-review.png) |
| Independent approval | [Approval](../artifacts/journey-06-independent-approval.png) |
| Dashboard after posting and partial payment | [Result](../artifacts/journey-09-dashboard-after-payment.png) |
| Printable dashboard | [PDF without background printing](../artifacts/identity-dashboard-print.pdf) |
| Existing isolated PostgreSQL preview | [Preview capture](../artifacts/identity-preview.png) |

## Reproduce safely

Use Node24, without loading root `.env` or running demo/init/migrations against saved records. The selected scripts create and dispose of synthetic fixtures:

```powershell
node --test --test-concurrency=1 tests/dashboard.test.js tests/organization-finance.test.js tests/workspace-experience.test.js
node scripts/browser-dashboard.js
node scripts/browser-workspace-journeys.js
node scripts/browser-guided-workflows.js
node scripts/browser-leave-journey.js
node scripts/browser-finance-usability.js
node scripts/check.js
node --test tests/operations-providers.test.js
```

For configured local synthetic PostgreSQL, use the existing private test configuration and cluster with `max_locks_per_transaction=512`, then build with the selected tests/browser helpers:

```powershell
node scripts/prepare-postgres-tests.js tests/dashboard.test.js tests/organization-finance.test.js tests/workspace-experience.test.js scripts/browser-dashboard.js scripts/browser-workspace-journeys.js scripts/browser-guided-workflows.js scripts/browser-leave-journey.js scripts/browser-navigation.js
node --test --test-concurrency=1 .cache/postgres-runtime/tests/dashboard.test.js .cache/postgres-runtime/tests/organization-finance.test.js .cache/postgres-runtime/tests/workspace-experience.test.js
node .cache/postgres-runtime/scripts/browser-dashboard.js
node .cache/postgres-runtime/scripts/browser-workspace-journeys.js
node .cache/postgres-runtime/scripts/browser-guided-workflows.js
node .cache/postgres-runtime/scripts/browser-leave-journey.js
```

Run browser suites sequentially when measuring local responsiveness. To resume the existing isolated preview, use `node scripts/postgres-local-staging.js` without root `.env`; do not start another listener on its port. Verify with `node scripts/verify-experience-preview.js --identity`, then generate the evidence with `node scripts/visual-identity-release-evidence.js` after the required logs exist. Keep the preview's protected credentials/key files outside source control.
