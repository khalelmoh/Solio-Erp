# Finance usability release — 0.13.0

Updated 2026-10-27. This release improves discovery and bill entry in the existing ERP. PostgreSQL migrations 001–004 and SQLite schema 13 remain unchanged. All operations use the existing ledger, authorization, approvals, period locks and idempotency controls.

## Finding features

Sign-in opens **Your workspace**, with actions appropriate to the signed-in account: Add a bill, Record money received, Request an organization advance, Review finance approvals, Add an employee and Open projects. These are shortcuts to existing authorized workflows. An account without the required capability does not receive the corresponding preparation shortcut; the server still enforces permissions.

The sidebar is organized into seven collapsible sections: Home, Projects, Finance, People & payroll, Inventory, Reports and Administration. **Find a feature** searches labels and common terms such as bills, employees and financial statements. Sections start expanded, preserving access to existing routes, and can be collapsed. Selecting a destination clears search and opens its section. On a narrow screen the navigation scrolls separately, and sign-out remains accessible.

Under **Finance**, choose **Finance home** for everyday work or **Accounting & period close** for account configuration, statements, manual journals and closing. Both views use the same financial records. Finance home puts everyday actions first. Six primary destinations cover the overview, bills, receipts, receivables, expenses/advances and reports; **More finance tools** contains cash accounts, operating budgets, payroll liabilities, assets and journals. Advanced reporting filters are collapsed until needed or until an advanced filter has been applied.

## Add a general operating bill

1. On Home choose **Add a bill**, or Finance home → **Add bill**.
2. **Bill details:** supplier name, invoice number, USD amount, bill/accounting date, due date and purpose. An internal reference is suggested and can be edited. Use a date in an open accounting period.
3. **Budget & funding:** select an approved independent operating budget, one of its approved categories and an eligible organization funding source. The form offers approved funds covering the bill date and selected category. Department and cost centre are optional unless required by the selected budget. A missing budget or fund is explained with a route to setup. Setup proposals still require independent approval.
4. **Documents:** select up to four PDF, PNG, JPG or text files, each nonempty and no larger than 512 KB. Filenames and sizes are shown before upload. Remove a file individually if needed. Going back retains fields and selected files. Files are uploaded on submission, not when selected.
5. **Review:** check the supplier, amount, dates, allocation and filenames. An empty attachment selection is explicitly identified. Submit for independent approval.

After submission, the Bills page identifies the new bill and explains that another authorized person must approve it. **View bill** keeps supplier details, invoice evidence, approval history, payment requests, paid amount and remaining balance together. Reversed bills are labelled as reversed instead of presenting the reversal as a payment.

An independent approver uses **Review approval**. Finance then uses **Review posting** to record the cost and payable. A posted, unpaid bill offers **Record payment** on its detail page. The existing payment form permits partial amounts and requires separate approval and posting. A payment reduces cash and payable without recording the expense again. Even a user with both preparer and approver capabilities cannot approve their own bill.

General bills do not require a project. A bill against a project purchase order continues through Project spending so it consumes the correct commitment.

## Verification and environment

Use the same isolated PostgreSQL preview at **http://127.0.0.1:3005**. The existing separately provisioned Super Administrator account remains usable. Refresh with Ctrl+F5 to load 0.13.0. Startup is `npm.cmd run demo:postgres` using Node24, without loading the saved `.env`. The preview retains its database, external record key, dedicated cookie, quarantine and disabled jobs/transports. Saved SQLite and paused guided UAT are not used by this change.

**Results:** 18/18 targeted tests passed on SQLite and 18/18 on disposable PostgreSQL. Five SQLite and four PostgreSQL browser suites passed; syntax, static build and current preview checks passed. These are targeted checks, not a new full foundation run.

Evidence is recorded separately from the historical 0.12.0 foundation verification:

- `artifacts/finance-ux-sqlite-tests.txt`: organization-finance and employee-permission regression checks.
- `artifacts/finance-ux-postgres-tests.txt`: the same checks on actual disposable PostgreSQL, reported separately.
- `artifacts/finance-ux-*-browser.txt`: financial lifecycle, usability, project navigation, accounting and employee-registration browser checks.
- `artifacts/finance-ux-local-preview.json`: read-only verification of the current preview, including unchanged totals and ledger IDs, successful Super Administrator sign-in and no financial posting.
- `artifacts/finance-ux-release.json`: final result counts and evidence hashes.
- `artifacts/finance-ux-home-desktop.png`, `finance-ux-dashboard-desktop.png`, `finance-ux-bill-desktop.png`, `finance-ux-home-mobile.png`: inspected preview screenshots.

Run `npm.cmd run test:browser:finance` for the two finance browser suites; `npm.cmd run test:browser` includes the wider SQLite browser checks. `npm.cmd run test:postgres:browser` includes these finance suites against disposable PostgreSQL, using the configured local test instance. No test requires the saved database. `npm.cmd run build:postgres` is required after source/public/package changes before restarting a PostgreSQL API.

## Scope and remaining work

This is the first usability increment: grouped navigation, task home, finance landing, simpler filters, guided operating-bill entry and bill/payment details. Other specialized entry forms retain their existing layouts. There is no server-side autosave of an unfinished wizard; Cancel discards unsent entries and files. The document preparation list and approval counts still describe the latest 200 records; complete matching posted history is available in reports/CSV. Review shortcuts open the document list rather than a new approval engine.

Automated verification is not human usability acceptance. The next reviewer action is to find **Add a bill** from Home, complete its first step with synthetic data, and report anything unclear before submitting. Actual Supabase hosting verification, business-policy validation and real-record pilot authorization remain separate outstanding gates. The archived 0.12.0 staging package and its evidence remain historical; they do not contain this interface update.
