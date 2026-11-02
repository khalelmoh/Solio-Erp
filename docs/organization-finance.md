# Organization Finance & Accounting — 0.11.0 / schema 13

Open **Organization Finance & Accounting** in the sidebar. Project Finance remains available through Overview, Budgets, Funding, Spending & approvals and the project ledger. Both workspaces use the **same posted journals and journal lines**.

## What was reused and completed

Stage 4 already supplied effective chart-of-account profiles, account mappings, USD books, fiscal periods, supporting accounting documents, independent approvals, immutable posting, encrypted attachments, linked reversals, reconciliation, trial balance, general ledger, position, income/expenditure, cash flow, payroll liabilities, fixed assets and CSV/printing. These features remain authoritative.

This extension removes the requirement for a project on general journal lines. General entries carry an approved organization funding source instead. Department and cost-centre dimensions are optional. Existing project/source IDs, journal-line IDs and reconciliation references are preserved. Organization workflow metadata and budget support are not another financial ledger.

Completed screens cover the organization dashboard; bank/cash/mobile accounts; funding and receipts; supplier bills and partial payments; receivables and collections; operating budgets; expenses, reimbursements and advances; payroll liabilities; assets; journals/reconciliation; and reports. Organization reports include project activity plus general operations once. Filters cover all/general/project activity, individual project, project or organization funding source, department, cost centre and reporting period. Advanced Stage 4 statements retain comparative periods and account filters. Conflicting general/project filters are rejected.

## Local synthetic demonstration

Use Node24. Do not load `.env` for this separate demonstration:

```powershell
npm.cmd run demo:organization
# http://127.0.0.1:3004 — creates a new separate synthetic database
# To restart that same demonstration after stopping its sole listener:
npm.cmd run demo:organization:resume
```

Use a fresh private window. Expand **Local demonstration accounts**, choose **Finance**, and **Sign in**. The account is `finance@demo.erp`; its local-only password is `Demo-only-2026!`. Use **Manager** / `manager@demo.erp` for independent accounting approval and **Administrator** / `admin@demo.erp` for setup. Never reuse these credentials on a deployment. This account set belongs to the new organization demonstration, not the paused port3003 walkthrough.

The demo creates `data/organization-demo-<uuid>.sqlite` with its matching key, persistent quarantine, disabled jobs/transports, loopback binding and synthetic data. Its session record is `artifacts/organization-finance-session.json`. It does not open or migrate `data/erp.sqlite` or the guided UAT database. The earlier advance walkthrough remains at **approved request / $2,000 reservation**, awaiting actual Finance sign-in confirmation.

Select **General operations** under Financial scope and apply filters. The included rent example shows a **$1,000 expense, $400 payment, $600 payable and $19,600 cash** after a separate $20,000 synthetic donation. Switch to All activity to include the existing Stage 4 demonstration: total expenses **$8,000**, cash **$54,600**, payables **$2,600**. The project remains at $7,000 expenses, $35,000 cash and $2,000 payable. This is automated demo evidence, not human acceptance.

## Roles, approval and posting

An administrator assigns **accountant**, **approver** and **auditor** in **Organization accounting → Setup**. Administrative status alone does not grant financial posting. An accountant prepares, a different accounting approver reviews, and an accountant posts. Organization documents use existing `acc_documents`, `acc_evidence`, `work_approvals`, `acc_posts` and action idempotency. Journal approval threshold levels are retained; each level requires a distinct accounting approver for general documents. Existing project membership is still required when moving a shared cost into a project.

Funding policies and operating budgets need independent accounting approval before use. Approving a bill, reimbursement, direct expense or advance reserves operating budget. Posting a cost converts its reservation into an actual budget charge. An advance retains its reservation until accepted expenditure or unused-money return. Cancelling an approved, unposted document releases its reservation. Posting and competing approvals run in the existing immediate transaction, with budget and cash checks repeated against current state. Supplier invoice references prevent a duplicate posted obligation; recurring occurrence references and action keys prevent duplicate drafts and retries.

## General operations

Configure departments, cost centres and expense categories under Operating budgets. Initial categories are RENT, UTILITIES, COMMS, ADMIN, PROFESSIONAL, PURCHASES and OTHER; additional categories are allowed. Create an independent operating budget for an annual or shorter fixed period. General bill, expense, reimbursement and advance screens do not require project fields.

Prepare operating bills under Suppliers, bills & payments, attaching supporting records. Approve and post separately. Prepare a partial payment from the unpaid item, approve with another account, then post. Payment debits the supplier payable and credits the selected bank/cash/mobile allocation; it creates no expense. Reimbursements follow the same payable/payment pattern with an employee as responsible party. Direct expenses post cost and cash together after approval. The existing supplier directory and physical cash-account setup remain available through the linked workspaces.

A recurring schedule stores a monthly bill template with an eligible period and day01–28. **Generate draft** creates one unapproved preparation per selected occurrence. It posts no cost, liability or cash, and the same occurrence cannot be generated twice, including after cancellation. Correct a cancelled draft with a fresh reviewed document and explicit reason/reference; cancellation never edits posted history. Designate a Finance owner to generate/review due drafts. This release does not silently install a host scheduler.

## Funding, income and receivables

Before use, propose and independently approve a named fund with an eligible period, restrictions, permitted category codes, income/deferred/refundable receipt treatment, receivable-recognition permission and transfer permission. Policies are immutable; changed agreements require a newly reviewed funding configuration rather than rewriting historical classifications.

Receipts support organization funding, donations, reimbursements received and miscellaneous income. Receipt classification follows the approved fund: debit cash, credit income or the appropriate funding liability. A receipt is not automatically income. Deferred/refundable recognition requires documented authority and a separate approved recognition document; refund reduces the funding liability and cash. Recognition/refunds cannot exceed the supported liability, and a dependent receipt reversal is blocked.

Funding promises are approved **off-ledger** evidence. They create neither income, cash nor a recognized receivable. A receivable requires an approved recognition policy, debtor, due date, external reference and entitlement evidence; debit the receivable and credit the fund's configured income/liability. Collection debits cash and credits the receivable, including partial collections. It does not recognize income again. Aging is not-due,1–30,31–60,61–90 and90+ days.

Funding reports distinguish promised, cash received, returned, unreceived, recognized income and remaining deferred/refundable balances. Promised-versus-received is a **fund-level aggregate**, not an automatic invoice-to-promise conversion or an assertion that every donation fulfills a particular pledge. Retain agreement evidence for that attribution. Restricted cash remains separate; an unrestricted cash balance is not, by itself, spending approval or permission to ignore unpaid obligations.

## Operating budgets and shared costs

**Bank, cash & mobile → Allocate cash to/from project** changes cash ownership between an organization fund and an existing project funding allocation in the same physical account. Both approved fund policies must expressly permit it, and the posting accountant needs project Finance access. Preparation, independent approval and posting remain separate. The journal changes cash allocation and accumulated-fund offsets, without new income, expense, physical cash movement or budget charge. Automatic reconciliation offsets prevent those internal cash lines from being matched as bank transactions; linked reversals preserve that treatment. This differs from allocating an already incurred shared expense below.

An **independent** budget is spendable general authority. A **parent** budget is a planning envelope for approved child project budgets and is not directly spendable. Consolidated approved authority counts independent operating budgets plus the child project budgets, **excluding parent envelopes**. Unallocated parent planning capacity is not another spending authorization. Parent approval and later child-budget approval check that child periods/amounts fit the envelope; overlapping parent ownership is rejected.

Revisions retain the previous approved version, reason, creator and independent approver. Pending revisions do not change authority. Reductions cannot leave existing actuals and reservations uncovered; this release does not provide an implicit organization-budget overrun exception. Reports use the current approved version rather than reconstructing historical approval timestamps. Source-filtered budgets retain the complete approved authority because budgets are not apportioned to funds.

**Allocate shared cost** selects a posted general expense and either a destination general department/cost centre/budget, or an existing approved project spending allocation. The original expense and journal remain intact. A new approved journal credits the original expense and debits the destination expense, with fund-balance offsets where allocations differ. Overall expenses and cash do not increase. General budget history records negative source and positive destination charges. A project destination consumes its existing reservation, adds the project budget charge once, and rechecks project access, budget, fund restrictions and both transfer permissions. Allocated value cannot exceed the unreallocated original cost. Reversal restores the cost and reservations through linked entries.

## Advances, payroll and assets

General advances have a responsible person/supplier, due date, issued amount and outstanding balance. Issuance debits the advance asset and credits cash; it is not expense. Accepted expenditure requires receipts, credits the advance and debits cost, without deducting cash again. Unused return debits cash and credits the advance. Settlement/return releases the corresponding original reservation. The $2,000/$1,500/$500 test ends with advance zero and cost/net cash reduction $1,500.

The payroll section reuses existing approved payroll runs, salary payments and payroll-liability support; it does not calculate a second payroll or introduce an alternative statutory posting route. Payroll preparation and employee allocations continue in the existing payroll workspace. New statutory rules and real banking submission remain outside this configuration.

General capital acquisitions use an approved asset bill, then registration with custody, service date, useful life/residual and independent approval. Registration does not post another acquisition. Straight-line depreciation and disposal are separately approved accounting documents. Depreciation is noncash and does not charge the acquisition budget again. Supplier payments for capital acquisitions are classified as investing cash flows. Active asset dependencies block acquisition reversal; resolve movements and cancel registration before reversal. Existing project assets/custody policies remain in Stage 4.

## Reports, reconciliation and corrections

Dashboard totals link to their source records. Journals show complete source lines even if the current period filter excludes earlier entries. Organization CSV contains full matching posted history; the latest-document preparation panel is capped at200 and is not the full transaction export. Financial reports/CSV and Print organization statement use the selected scope. Assets, budget charges, obligations and funding have source-document/journal identifiers.

Bank/cash/mobile statements and partial matching use the existing reconciliation tables and controls. General cash lines appear beside project cash lines. Neither statement nor book amounts may be matched twice. Matching existing payments creates no journal, expense or additional cash movement. Internal physical-account transfers create no income or expense; shared cost allocation creates no physical cash flow.

Period close now reconciles general supplier items, advances, receivables, funding liabilities and registered assets alongside project support. General entries with a valid organization fund are allocated activity, not missing-project discrepancies. Pending monetary preparations remain close blockers; approved off-ledger promises are not unposted journals. Original period locks, independent reopening, locked-period correction and audit controls remain. Corrections use an independently approved **Linked reversal**, not edits or deletion; dependencies and available cash/budget are checked again.

## Migration and deployment boundaries

Migration013 rebuilds `journal_lines` inside a transaction to make project/source optional only for approved organization-fund allocations. It preserves all existing line IDs/values and referring foreign keys, suspends FKs outside the transaction for the supported rebuild, restores referring triggers, checks every FK before commit, then reenables enforcement. Posted-line and balanced-journal guards remain in force. Failure rolls back the migration.

Before upgrading a saved database: stop its sole writer, make the established encrypted backup with its separate backup key and retain the matching database key, preview the migration on an isolated copy, verify exact ledger/source/attachment balances, then run `npm.cmd run migrate` and restart the one Node24 API. Do not seed over saved records, run concurrent old/new writers, or use a second writable copy as the authoritative database. This delivery did **not** apply migration013 to the saved or guided-UAT databases.

Runtime remains SQLite. The selected future Supabase PostgreSQL port, actual private API host/domain, HTTPS, scheduler, offsite backup/failure delivery and target restoration remain unverified/incomplete from Stage7. This local extension is not a claim of Supabase deployment or production authorization.

## Checks and policy configuration

Run `npm.cmd run test:organization`, `npm.cmd test`, `npm.cmd run test:browser`, `npm.cmd run check`, and `node scripts/verify-organization-finance.js`. Evidence is indexed in [release report](organization-finance-release.md).

Before real use, configure named accounting preparers/independent approvers/auditors, approval thresholds, fiscal periods, actual funding agreements/restrictions/recognition criteria, operating budget relationships and dimensions, supporting-document requirements, recurring draft ownership, asset policy and opening balances. Somaliland statutory payroll/legal/retention decisions and external banking integrations are not validated by synthetic tests. Human acceptance is still required; neither this demo nor the paused walkthrough authorizes real records or production.
