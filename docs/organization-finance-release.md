# Organization Finance & Accounting release report

Build **0.11.0 / schema13**, USD only. Updated **2026-10-22**. The organization workspace is implemented and working in isolated local synthetic data. Saved and guided-UAT databases were not migrated by this work. Supabase staging, a real-record pilot and production remain unverified/not authorized.

## Open the working demonstration

**http://127.0.0.1:3004** — use a private browser window. Expand **Local demonstration accounts**, choose **Finance**, then **Sign in**. Open **Organization Finance & Accounting**. Use the separate **Manager** account for approvals. Local demo credentials and restart instructions are in the [runbook](organization-finance.md).

This demonstration has its own database/key and session cookie, persistent quarantine, disabled jobs/transports and loopback-only access. It preserves the saved database and the paused port3003 advance walkthrough. [Actual runtime verification](../artifacts/organization-finance-runtime-verification.json).

## Reused and completed

Reused Stage4's chart, ledger, accounting source documents, encrypted evidence, approval records, period/correction controls, immutable audit, reconciliation, payroll liabilities, assets and financial statements. There is one authoritative ledger; supporting organization tables do not duplicate accounting transactions.

Completed general funding/receipts, operating bills/partial payments, receivables/partial collections/aging, expenses/reimbursements/advances, recurring draft generation, operating budget revisions and parent envelopes, department/cost-centre allocations, shared expense reallocation and general/project internal cash allocation. Screens provide organization totals, source drill-down, full CSV and printable statements. Reports include project plus general activity once. New monetary documents require independent approval and normal posting.

Migration013 preserves existing journal-line IDs, values and reconciliation references while adding valid general-fund dimensions. [Migration](../migrations/013_organization_finance.sql); [operator and upgrade guide](organization-finance.md).

## Financial acceptance example

The non-project operating bill is **$1,000**, paid **$400**, leaving **$600 payable**. Expense increases by **$1,000**, cash decreases by **$400**, and existing project metrics remain unchanged.

| Measure | Project sample | General operations | Consolidated |
| --- | ---: | ---: | ---: |
| Expenses | $7,000 | $1,000 | $8,000 |
| Cash allocation | $35,000 | $19,600 | $54,600 |
| Supplier payable | $2,000 | $600 | $2,600 |

The general example begins with a separate $20,000 donation. The project sample includes its previously posted payroll cost. Consolidated trial-balance sides are **$62,600** each, signed ledger difference **zero**, and consolidation difference **zero**. [Independent ledger/source proof](../artifacts/organization-finance-reconciliation.json).

## Automated verification

The complete regression run passes **212 automated tests, zero failures/skips**, and **all 12 browser suites pass** on Node24.22.0. The total comprises the prior 191 tests plus 21 organization cases. The focused accounting/organization run passes 40 overlapping tests, including the added general/project allocation path. Browser verification uses separate role contexts and checks financial results, permissions, CSV, printing and mobile rendering. The [evidence index](../artifacts/organization-finance-release.json) records source and artifact hashes.

- [Complete regression log](../artifacts/organization-finance-full-tests.txt).
- [Focused accounting/organization log](../artifacts/organization-finance-final-focused.txt).
- [All-browser log](../artifacts/organization-finance-all-browsers.txt) and [current organization browser evidence](../artifacts/organization-finance-browser.json).
- [Runtime/attachment/drill-down proof](../artifacts/organization-finance-runtime-verification.json).
- [JavaScript syntax](../artifacts/organization-finance-syntax.txt) and [static Vercel artifact build](../artifacts/organization-finance-vercel-build.txt). The build uses a reserved `.invalid` backend for artifact checking only; it is not a deployment.
- [Printable statement](../artifacts/organization-finance-statement.pdf), [desktop screen](../artifacts/organization-finance-desktop.png) and [mobile screen](../artifacts/organization-finance-mobile.png).

Regressions cover zero-project operation, exact bill/payment totals, partial advance settlement/return, shared allocation, internal bank/general/project transfers, duplicate recurring drafts and matching, collections/aging, funding restrictions/treatments, current budget reservations/revisions, distinct approval thresholds, unauthorized access, simultaneous database connections competing for budget, asset registrar independence, locked-period corrections, migration reference/trigger preservation and encrypted restoration with private attachments.

The resumed verification also fixed two confirmed interface defects: an optional correction-authorization input accidentally remained mandatory when its label contained the word "required", and an earlier notification timer could hide a newer confirmation. The browser flow now prepares an open-period linked reversal without special authorization, retains the explanatory label and verifies the restored project balances. Server authorization for corrections to locked periods remains mandatory.

## Remaining configuration and limits

Finance/administration must name real preparers/independent approvers/auditors and approve thresholds, fiscal periods, opening balances, funding restrictions/recognition evidence, budget relationships/dimensions, recurring draft responsibility and asset policy. HR/legal validation of Somaliland statutory payroll and retention, actual banking/provider integration and human acceptance remain separate requirements.

The selected Supabase PostgreSQL adapter/schema/recovery port is still incomplete. A separate persistent Node host/domain and actual HTTPS, scheduled jobs, offsite backup, delivered failure notifications and target restoration have not been verified. This release does not enable live banking or production deployment.

Funding promises are off-ledger evidence; received-versus-promised figures are fund-level aggregates, not automatic pledge-to-invoice matching. Recurring schedules generate reviewed drafts on request; this work does not install a target scheduler. Budget reports use current approved versions and disclose parent envelopes separately. Preparation panels show the latest200 documents; full posted history remains available in exports. General payroll liabilities reuse the existing payroll workflow; no duplicate payroll/statutory calculation route was introduced.

The previous project-finance human result remains scoped to that scenario. The advance walkthrough is paused after approval/$2,000 reservation, awaiting actual Finance sign-in confirmation; no advance issue/settlement/return or unrelated human acceptance was inferred.
