# Organization accounting — Stage 4

Version 0.6.0, migration 009. Use Node 24+ and the existing `npm install`, `.env` and startup instructions. Local verification uses Node 25's experimental SQLite driver. This release is USD only, as requested; no currency conversion or revaluation is enabled. Payroll remains monthly/open/project based.

## Existing database upgrade

Back up the database **and its matching encryption key** before starting this version: startup applies pending migrations. Never run demo/init against a populated database. Migration 009 preserves every old financial/HR record, adds account metadata and new accounts, and labels historical funding control as an unclassified liability. It does not post income, alter budgets or invent opening cash. Full existing calendar-year periods receive fiscal-year links; other periods need explicit fiscal setup.

Historical source receipts need an approved policy and an approved reclassification before they can be reported as recognized income or a classified funding liability. Until reviewed, organization statements show the unclassified liability and the close checklist blocks unresolved treatment. Existing project budget/cash totals continue to work.

## Setup in the interface

1. Sign in as Administrator and open **Organization accounting → Setup → Assign accounting role**. Grant **accountant** to Finance, **approver** to an independent authorized reviewer, and **auditor** to read-only reviewers as appropriate. An administrator can configure setup without receiving posting permission. Project Finance membership remains necessary to prepare/post each project allocation; approvers must also meet the configured journal approval policy. Configure multi-level journal approvals in existing Settings & controls.
2. Review fiscal years, periods, journal books, chart and mappings. Fiscal setup appears under Accounting Setup. Source eligibility dates/categories and project budgets remain in Funding/Budgets. Accounts classify accounting entries; budget categories authorize costs. An overhead project/source must own organization-wide entries: no unallocated ledger balances are allowed.
3. Configure any replacement posting account before first use of its role. Its reporting type and control role must match. Mappings freeze after posting to prevent historical payments/reversals using different controls. Used account types/roles and historical reports cannot be silently rewritten. New effective account versions require a reason; accounts with unresolved asset/liability balances cannot be deactivated. Setup changes inside locked periods require reopening.
4. Under **Fund accounting**, prepare the source's restrictions, receipt treatment, recognition basis, transfer permission and agreement reason; an independent approver approves it. Finance explicitly selects that approved treatment when recording a cash receipt. Promises remain separate information records. A source grant ceiling is configured separately and is not automatically inferred from promises.

## Journals and openings

Open **Journals & openings → Prepare manual journal**. Specify a date, reference, journal book, rationale and entries. Advanced entry fields use JSON arrays with decimal **strings**; consult the chart and source identifiers on Setup/Fund accounting. Example cash transfer:

```json
[
  {"project_id":1,"source_id":1,"account_id":1,"amount":"-100.00"},
  {"project_id":1,"source_id":1,"account_id":2,"amount":"100.00"}
]
```

Debits are positive, credits negative. Balance each project/source as well as the whole document. Expense/ordinary asset entries require equal explicit budget charges, e.g. `[{"request_line_id":3,"amount":"100.00"}]`, against an approved available spending reservation. A net-zero expense reclassification can have no new budget charge. Protected supplier, payroll, advance, fund, stock and depreciation controls require their supporting workflows. Accounting has no bypass around those controls.

An independent approver reviews the preparation and supporting files, approves under the snapshotted journal policy, and Finance posts. Preparation/approval changes no ledger. Posting rechecks open periods, permissions, supporting balances, cash, budget and source limits in one transaction. A retry returns the same result. Replacing a pending manual/opening document cancels its old version and requires fresh approval. Posted corrections use linked reversals; locked-period originals require the existing independent correction authorization and a correction date in an open period.

Opening balances require balanced entries, attached evidence and a supporting record for every noncash asset/control allocation. Each support record identifies `account_id`, `project_id`, `source_id`, positive USD `amount`, `party` and `due_date`; optional employee/supplier IDs must be authorized and valid. Combine repeated account/dimension lines. Liability openings are credits and asset openings debits. Opening date cannot follow existing activity for that allocation, and only one unreversed opening document can be active. Prior accumulated funds balance the entry; an opening is not a funding receipt or a current budget expense. Historical introductions appear separately in cash flow. Approved opening cash is marked as a historical balance, so it reconciles against the statement opening balance without consuming or inventing a statement transaction. The statement balance must still agree with the ledger.

Opening supplier/payroll liabilities support partial approved cash settlements. Opening advance/receivable returns increase cash and reduce support; accepted spending-advance expenditure requires receipts and an approved matching budget reservation, and does not deduct cash again. Settle/return from the opening support row. Asset or funding controls use their own workflows. Supporting files are encrypted, hashed and private to accounting readers (PDF/PNG/JPEG/text, up to four, 512 KiB each).

Specialized imports of opening warehouse lots and already-depreciated legacy assets are not supplied. Generic openings reject inventory and accumulated-depreciation entries rather than creating unsupported balances. Opening fixed assets at acquisition cost can be registered against capital opening support. This is a migration limitation to resolve before onboarding those balances.

## Fund treatment and transfers

| Event | Ledger effect | Cash/budget effect |
| --- | --- | --- |
| Promise/agreement | No journal | No cash or actual cost |
| Approved income-on-receipt cash receipt | Dr cash, Cr recognized income | Cash increases; no budget charge |
| Deferred/refundable cash receipt | Dr cash, Cr funding liability | Cash increases; no income or budget charge |
| Approved recognition | Dr funding liability, Cr income | No cash or budget charge |
| Approved reclassification | Dr existing funding treatment, Cr approved destination | No cash or budget charge |
| Funding refund | Dr funding liability, or reverse income, Cr cash | Returned-funding total increases; no expenditure charge |
| Shared-bank allocation transfer | Move cash allocation with opposing accumulated-fund allocations | Organization cash/income unchanged; no physical statement movement |

Use **Recognition / classification / refund** with agreement/milestone evidence, then independent approval and posting. Eligible-expenditure recognition cannot exceed accepted posted costs less recognized source income; promises/commitments/advances do not qualify. Policies and balances are rechecked at approval/posting. Milestone recognition requires the independent documented review; there is no automatic grant-event recognition. A historical reclassification must identify the chosen treatment; it never changes the old receipt journal.

Both approved source policies must expressly permit allocation transfers. Finance needs both project permissions and enough source cash in the chosen shared account. Automatic reviewed allocation offsets prevent those internal allocation lines being matched as physical bank movements. Ordinary transfers between separate bank/cash accounts remain in the existing transaction workflow. Reverse dependent funding recognition/refunds before their receipts; linked reversals restore returned totals and cannot leave invalid funding liabilities.

## Reports and reconciliations

**Reports** provides trial balance, account activity, financial position, income/expenditure, direct cash flow, supplier aging, payroll liabilities, advances, funds, project financial statements and organization budget-versus-actual. Use dates, comparative dates and project/source/account filters, account activity drill-down, source journal/line IDs, CSV and Print statement. Opening signed balances and period debit/credit movements are distinct. Filtered allocation/account statements are clearly labelled; they are not complete organization accounts.

Accounting totals come only from the posted ledger. Management budgets use the current approved version and eligible budget periods, with charges/commitments through the cutoff; they are not historical budget-version restatements. Source-filtered management reports retain the whole project budget because source-level budgets are not defined. Purchase commitments, advance reservations and payroll reservations reduce available budget separately from accounting liabilities. An issued advance remains an asset until accepted expenditure or return.

Cash flow classifies ordinary funding, payroll and operating payments as operating; capital purchase payments/disposal as investing; accumulated-fund cash movements as financing. Account classifications can be configured before use. Recognition/depreciation have no cash flow. Shared-bank allocation changes and opening-balance introductions are disclosed separately and do not masquerade as organization cash flows.

Accountants can also use **Reconciliation** to enter/import and partially match bank/cash/mobile statements. Matching existing payments posts no journal or expense, and neither statement nor book amounts can be reused. **Reconciliation & close → Review checklist** compares supplier, payroll, advances, refunds, inventory, fixed-asset and funding controls against their support; bank ledger against finalized statements with documented outstanding items; and project allocations against organization totals. The statement must cover the closing date, and later backdated cash entries invalidate its final review. Display zero and nonzero differences explicitly.

The close checklist includes unposted accounting documents, payment vouchers, payroll, inventory, adjusting journals, pending fund policies, unclassified historical funding and budget exceptions. Resolve discrepancies before closing. An independent administrator may authorize a named accountant to close with documented non-integrity exceptions, responsible owners and expiry against the current blocker snapshot. Such authority never clears balances and cannot waive ledger/control discrepancies. Closing locks all monetary posting paths. Reopening requires a reason and a separate accounting approver, tied to the current close event. History is immutable.

Close every fiscal-year date before preparing the year-end snapshot. A separate approver confirms the current immutable trial balance. Carry-forward uses existing continuous ledger balances, with no duplicate cash or opening journal. Reopening marks previous finalized snapshots as superseded and requires a new reviewed snapshot on finalization; previous snapshots remain inspectable.

## Fixed assets

Use **Fixed assets → Register asset** with an unregistered capital acquisition bill allocation or supported opening item. Record code, name, cost, residual, service date, useful life in months, custodian, location and policy reason. Obtain independent approval. Registering an asset does not charge budget or post cash again. The same acquisition value cannot be consumed by inventory and fixed-asset registration.

Prepare straight-line depreciation through a completed month; independently approve/post its accounting preparation under Journals. Cumulative depreciation is rounded deterministically to cents and cannot duplicate previously posted months or over-depreciate. Later asset accounting must be resolved before a backdated entry. Default budget policy charges acquisition only. An explicit independent policy can additionally charge depreciation, requiring a matching approved reservation.

Record custody changes and disposals with reason. Disposal removes cost/accumulated depreciation, records proceeds and an ordinary gain/loss account, and does not charge the acquisition budget again. Reverse disposal before related depreciation, and resolve asset/inventory registrations before supplier credits or acquisition reversals. Unregistered capital and unresolved asset custody/disposition block project financial closure.

## Isolated demonstration and verification

```powershell
npm.cmd run demo:accounting
# Refuses an existing data/accounting-demo.sqlite or key.
# To inspect the sample separately, in a separate PowerShell process:
$env:ERP_DB='data/accounting-demo.sqlite'
$env:PORT='3001'
$env:ERP_JOBS_ENABLED='false'
npm.cmd start
```

The sample explicitly configures unrestricted funding recognized on receipt, zero opening balances, USD, and zero statutory payroll components. It proves $35,000 cash, $2,000 supplier payable, zero payroll payable, $7,000 expense, $33,000 surplus/net assets, $4,000 purchase commitment and $39,000 available budget, with equal trial-balance sides and matched supporting/bank controls. It does not reclassify live funding or create live employees. Use demonstration accounts only locally.

Run `npm.cmd test`, `npm.cmd run test:browser`, `npm.cmd run check`; accounting-only tests are `npm.cmd run test:accounting`. Browser evidence and migration proof are under `artifacts/`. Configure actual roles, approval thresholds, fiscal dates, donor recognition/restrictions and asset policies before organizational rollout. Statutory payroll, external providers, production deployment and target restore/capacity/security validation remain unresolved from earlier milestones; this release makes no statutory-compliance or production-readiness claim.
