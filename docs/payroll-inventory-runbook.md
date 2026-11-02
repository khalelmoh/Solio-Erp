# Compensation and warehouse setup, version 0.4.0

Use the existing application and database. USD is fixed at two decimal places. Inventory quantities support up to three decimal places. Do not reseed a populated database.

## Upgrade and roles

Back up first with `npm.cmd run backup -- data/backup-before-0.4.0.sqlite`, stop the local server, run `npm.cmd run migrate`, then `npm.cmd start`. Migration 007 adds encrypted employment agreement versions, independent approvals, paid/unpaid leave classification, project warehouses and immutable inventory documents/lines/movements. It adds GL 1400 (warehouse inventory) and 5300 (count variance); original accounting records remain intact.

HR can register employees and propose compensation terms. Payroll officers independently approve changes, prepare/approve/post runs and access private registers. Payroll approval also needs the configured approval role and membership on all cost projects; posting requires finance membership on every allocation. An approver cannot approve a run containing their own pay. Employee self-service continues to show only that employee's payslips, including component details. Organization administration alone grants no payroll access.

Project managers or finance can create warehouses. Finance submits and posts inventory documents. Independent inventory approval uses the existing journal approval thresholds and levels, with its own document approval records. Project viewers can inspect project inventory but cannot post. Cross-project warehouses cannot receive transfers of another project's stock.

## Compensation workflow

Open **Compensation & benefits**. HR chooses one of:

- Monthly: a fixed salary, optionally prorated by calendar days employed and excluding approved unpaid leave. Employment start/end dates are inclusive; weekends count as calendar days. Calendar proration is an explicit organization policy, not an asserted statutory rule.
- Open: gross base pay entered on each run and subjected to independent payroll approval.
- Project: gross project fees entered on allocation rows. The server allocates the complete employer cost across those project/source/category/activity rows in exact cents.

Hourly pay is disabled. All employees still have a department and employment start date. An optional ERP user link allows employee-only self-service. Existing monthly employees need no conversion.

Add fixed cash allowances with taxable/non-taxable classification, employee deductions, and employer benefits. Components may explicitly follow monthly calendar proration. Components otherwise remain fixed. Employer benefits increase cost; employee deductions reduce net pay and become remittances. Organization-verified tax brackets and employer rates come from the existing independently approved payroll rules. No jurisdiction or statutory rates are invented.

**Change terms** creates an encrypted proposal with a reason, prior-version link and effective month start. Independent payroll approval activates it. Posted runs and private payslips retain their original encrypted calculations. Earlier pay periods use their effective terms. Approved leave decisions classify leave as paid or unpaid; the default for a new `Unpaid` request is unpaid, while other types default to paid. Historic approved leave without a new classification retains its previous paid treatment.

**Prepare compensation run** selects the employee, approved rule, pay period and date. For monthly/open pay, entered allocation amounts serve as weights; **Preview calculation** distributes full calculated project cost. For project pay, entered amounts are gross project fees. Preview has no financial side effects. Submit, independently approve, then post. The backend supports multiple employees and project allocations in one run; the guided screen prepares one employee per run. One active approved/posted run per employee/pay period prevents duplicate pay across projects.

Approval reserves the full project cost. Posting charges budget once, consumes the reservation, and creates net/remittance liabilities. Net and tax/benefit payments use the existing approved vouchers. GL 2110 remains the remittance control for statutory withholding, employer contributions, employee deductions and employer benefits; the private register/payslip separates these components. Exact organization-specific remittance schedules and individual provider payouts require the organization's verified policy.

Changed compensation or unpaid leave evidence invalidates an unposted run. Cancel its reservation, then prepare a replacement. Reverse payments before reversing posted payroll, and preserve the original correction link when preparing its replacement. Ordinary payroll posting dates remain within their pay period; corrections to locked-period accruals require the established open-period accounting correction policy, not reopening a locked period.

Private register CSV exports are restricted to HR/payroll staff. Detailed payslips can be printed in the compensation screen. General project journals/reports aggregate payroll dimensions and omit employee identities and individual pay.

## Inventory workflow

Register items in the supplier/item directory, with unit and budget category. Create project warehouses in **Warehouse inventory**. Post the approved supplier bill as an **asset** before receiving stock. The receipt item category must match its billed budget category.

**Receive billed stock** selects the invoice allocation, item, warehouse, quantity, USD carrying value and evidence. Submit, approve and post. The receipt cannot exceed the bill's net unreceived value after credits/previous receipts. Receipt reclassifies the billed asset into GL 1400; it creates no new expense, liability, payment, budget charge or commitment.

**Issue stock** records the responsible recipient and consumes the proportional remaining lot value, recognizing expense. **Warehouse transfer** moves the same lot and value between warehouses owned by the same project; funding-source ownership remains fixed. Partial outflows round down to cents; final depletion consumes all remaining cents. Outflows that round below one cent must use a larger quantity.

**Record physical count** enters the actual observed quantity, including zero. The proposal freezes current quantity/value. Approved gains/losses post to GL 5300 and appear separately from acquisition budget charges; gains use the original receipt unit value. Changes to the lot after submission require cancellation and resubmission. Count variance treatment, evidence requirements and approval thresholds must be authorized by the organization.

**Return to supplier** removes stock and moves its value back to the original billed asset account. Then post the existing linked supplier credit. A paid invoice creates a supplier receivable; the refund raises cash and clears it. Received or consumed inventory cannot be credited unless it is returned or its receipt is reversed. No step deducts purchase budget or cash twice.

Corrections use **Linked reversal**. Reverse dependent issues, transfers, counts and returns before reversing a receipt; reverse supplier credits before reversing a credited return. Reverse inventory receipt evidence before reversing its bill. Locked-period inventory corrections require the existing independent named-poster authorization and an open correction date. Stock and financial evidence are append-only.

Stock quantity cannot become negative. Duplicate posting/receipts, concurrent consumption, stale approvals, backdated lot movements and cross-project warehouse transfers are blocked server-side. Financial closure checks residual inventory and pending stock documents; an authorized closeout exception must document their disposition. Closed projects cannot post new stock activity.

The screen provides source-record history, CSV and print. Project financial reports and dashboards show on-hand value and count variance. Receipts and reversals preserve invoice/budget history. Inventory source/category filters scope stock balances; accounting variance totals remain project/source ledger totals, consistent with the financial report's accounting dimensions.

## Verification and limits

Run `npm.cmd test`, `npm.cmd run test:browser` and `npm.cmd run check`. Tests use isolated databases. The new browser suite covers compensation setup/preview/approval/posting/payslips/register export and warehouse receipt/issue/transfer/count/return/CSV/print/mobile layout.

Jurisdiction-specific statutory filing generation/submission, receipts before invoice with GRNI accruals, PO quantity/unit-price matching, serial numbers/expiry/batches, inter-project ownership transfers, manufacturing and extended remittance-provider interfaces are not included. Target production hosting and real integrations remain unverified. Payroll brackets, allowance tax treatment, deductions, benefits, proration, count policy, approvals and fiscal periods must be configured and authorized before real use.
