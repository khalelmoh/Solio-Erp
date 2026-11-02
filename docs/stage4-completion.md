# Stage 4 completion — 2026-10-15

Organization Accounting and Financial Reporting is implemented locally in version **0.6.0 / schema 9**. USD-only is retained by explicit user choice. Setup and policy details are in the [accounting runbook](stage4-runbook.md).

Delivered native accounting screens, authenticated operations and migration for effective chart/mappings/books/fiscal setup; supported approved opening balances; immutable balanced manual preparation/approval/posting/replacement/reversal; explicit source receipt treatment and approved recognition/reclassification/refund; shared-bank allocation transfers; financial/management reports with dates/comparatives/drill-down/CSV/print; supporting and bank reconciliations; controlled period close/reopen/year-end snapshots; and basic fixed assets with custody, straight-line depreciation, disposal and linked corrections. Payroll allocation remains in the same ledger, with no hourly base pay. Advance and purchase reservations remain distinct from accounting expenses/liabilities.

## Verified evidence

- **136 automated tests passed**, including all prior finance, lifecycle, security, HR, payroll, inventory and USD-only tests and 19 Stage 4 tests: `artifacts/stage4-final-tests.txt`.
- **Seven browser suites passed**: original project example; advances/budgets/credits/refunds/reconciliation/closure; compensation and vouchers; inventory; Stage 3 HR; employee registration; Stage 4 accounting. `artifacts/stage4-final-browser.txt`.
- Syntax checks passed: `artifacts/stage4-final-syntax.txt`.
- Stage 4 browser exercise covers financial reports/export/print/mobile; period close and independent reopening; evidenced manual journal preparation/approval/posting; asset registration/approval/depreciation; accountant statement workspace; administrator role setup and denied ordinary-user access. Sample figures and supporting-control/bank reconciliation are verified directly from the separate persisted sample: `artifacts/stage4-demo-verification.json`.
- Additional accounting tests cover approved opening cash against statement opening balances without invented bank movements, supported openings/partial payment/reversals, malformed support and atomic rollback, liability recognition and refunds, income refunds and stale policies, internal allocation transfers, competing refunds, private HTTP downloads/exports, account lifecycle/mapping freeze, asset disposal/reversal and explicit additional depreciation budget policy. The year-end stale-snapshot failure and migration-count assertion from the paused checkpoint are fixed. Existing regression rejection messages/closure behavior remain compatible before fiscal setup is enabled.

| Isolated required example | Verified USD |
| --- | ---: |
| Cash | 35,000.00 |
| Supplier payable | 2,000.00 |
| Payroll payable | 0.00 |
| Recognized funding income | 40,000.00 |
| Accounting expenditure | 7,000.00 |
| Surplus / net assets | 33,000.00 |
| Purchase commitment | 4,000.00 |
| Available project budget | 39,000.00 |
| Trial balance debit / credit | 42,000.00 / 42,000.00 |

Every supporting control difference is zero, bank evidence matches and allocation/unallocated differences are zero in this isolated scenario. Its policy explicitly recognizes unrestricted receipts as income and uses zero statutory payroll components only for demonstration.

## Saved data and live verification

Migration was first tested on a paired-key copy. Main upgrade preserved all previous rows across **155 business tables**, appended six chart accounts, reported integrity `ok` and zero foreign-key errors. It preserved the existing **one employee** and two projects. Evidence: `artifacts/stage4-migration-preview.json`, `artifacts/migration-0.6.0.json`. Final backup: `data/backup-before-0.6.0-final.sqlite` and matching `.key`; an earlier preview backup also exists. Preserve both keys with their respective databases.

The live app at http://127.0.0.1:3000 reports v0.6.0. Browser verification confirms Accounting Setup/Assign accounting role and HR Add employee are visible, with no browser errors: `artifacts/live-0.6.0-verification.json`, `artifacts/live-0.6.0-accounting-setup.png`. No live employee, role grant, financial preparation, income reclassification or payroll was added for testing. `.env`, encryption key and external-delivery configuration were preserved.

The original project remains $50,000 approved budget, $40,000 funding received, $6,000 actual, $4,000 commitment, $40,000 remaining, $2,000 unpaid supplier bill and $36,000 allocated cash. The $1,000 Stage 4 example payroll belongs only to the separate `data/accounting-demo.sqlite`, never to that original project.

Historical live funding remains a $40,000 unclassified liability for accounting statements pending approved treatment. This intentionally differs from an explicitly unrestricted income-on-receipt sample; cash and project budget totals are unchanged. The live close checklist will require real statement evidence, pending-document review and funding treatment rather than showing the sample's reconciled status.

## Remaining policies and limits

The administrator must grant separate accountant/approver/auditor capabilities through Accounting → Setup. No accounting access was silently granted by migration. Configure actual fiscal periods/books, approval thresholds, source restrictions/recognition/transfer agreements, opening support, asset lives/residuals/disposal accounts and permitted close exceptions. Existing statutory HR/payroll/leave validation and live provider/hosting/restore/capacity/security configuration remain unresolved; no compliance or production-readiness claim is made.

Specialized opening imports for warehouse lots and previously depreciated legacy assets are **not implemented**; generic openings reject those unsupported controls. Current-cost capital opening support, supplier/payroll liabilities and advances/receivables are supported. Management budget reports use the current approved budget, clearly labelled, rather than reconstructing a historical organization budget version. Currency conversion/revaluation is excluded by user request. Other previously documented inventory and external-integration scope limits remain in effect.

Visual artifacts: `artifacts/stage4-accounting-desktop.png`, `artifacts/stage4-accounting-mobile.png`, `artifacts/stage4-project-statement.pdf`. Sample generation and API instructions are in the runbook and API documentation.
