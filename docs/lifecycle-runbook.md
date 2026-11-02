# Project financial lifecycle — operator runbook

## Roles and setup

Use manager/requester/finance accounts on each project and a separate administrator for shared statements, correction authority and exceptional closeout. No user may approve their own request or budget. Set actual thresholds and accounting periods in Settings. New deadlines are entered explicitly; `ERP_TIMEZONE` defaults to Africa/Mogadishu. All money is USD decimal text with two places; statutory payroll is still unconfigured.

## Budget increases, reductions and transfers

Open Budgets. Submit a complete amended version, select increase/reduction/reallocation and record a reason and supporting files. Another authorized user approves it. Transfers use **Transfer between categories** and two existing approved category/period lines; submit an amendment first to add a category. The total remains unchanged. Approval rejects changes that leave charges/reservations uncovered unless a valid explicit finance overrun exception covers the exact deficit. History retains every version, rationale, file hash and approver.

## Advances

Open Advances → Advance request. Specify employee/supplier, responsible party, due date, category/activity/source allocation and purpose. A different manager approves; finance disburses from a cash account. The reservation was already made on final approval; disbursement adds no cost or second reservation.

Use Settle / return. Accept expenditure with receipt files, or return unused funds with a bank/cash reference. Partial amounts are supported. Settlement does not deduct cash again. Returns release their unused reservation immediately. The register shows issued/settled/returned/outstanding, evidence, due date and overdue status. Overdue status is visible; version 0.3 supplies inbox scanning and queued SMTP delivery; see completion-runbook.md.

Acceptance example: issue $2,000, settle $1,500, return $500. Outstanding becomes zero, actual costs increase $1,500 and cash falls a net $1,500. Supporting files support PDF/PNG/JPEG/text, four per operation, 512 KiB each, stored with hashes in the database and downloaded only by authorized project members.

## Credits, refunds and corrections

Open Spending → Create credit note. Select a supplier bill, invoice allocation amounts, reason and date. Credit unpaid payable first; any credited paid amount becomes a supplier-refund receivable. The cost and budget charge fall. Select replacement goods only if the credited value should become a commitment again; otherwise commitment stays unchanged. Receive refunds against the credit note to increase cash and clear that receivable, without reducing cost a second time.

In Transaction ledger, open a journal → Linked reversal. Reverse dependent refunds/credits/settlements first. Posted originals remain intact. When the original period is locked, a separate administrator uses Settings → Authorize correction, naming original journal ID, finance poster, reason and expiry. Finance selects that authority and an open-period posting date. Locked periods cannot be reopened through normal period updates.

Reversal of accepted expenditure on a cancelled advance restores the advance asset without restoring cancelled spending authority. Recover that balance with an unused/recovery return; further accepted expenditure needs new approved authority. Same supplier invoice/payment identifiers remain unique after reversal; version 0.3 supplies independently approved general adjustments and canonical linked invoice reissue; see completion-runbook.md.

## Statement entry/import and matching

Sign in as administrator → Reconciliation. Enter movement rows or import/paste CSV:

```csv
external_id,date,description,amount
BANK-001,2026-02-02,Funding received,40000.00
BANK-002,2026-02-06,Supplier payment,-4000.00
```

Enter cash account, unique statement reference, date range, opening and closing balances. The example has opening $0 and closing $36,000. The system rejects overlapping date ranges, reused bank IDs and invalid totals. Enter a complete statement for the shared account across all projects, not just one project's cash allocation.

Match movements to posted cash lines, using positive matching amounts even when the bank movement is negative. One movement may match multiple book lines and one book line multiple movements. The server checks both remaining amounts under its write lock. Matching posts no accounting transaction. Finalize only after all statement amounts are matched, difference is zero and outstanding book entries have review reasons. Those outstanding entries still block project closeout until actually cleared. Reopen with a reason before unmatching finalized records.

If a book error and its linked cash reversal never reached the bank, Review book-only corrections can offset the exact opposite pair. This requires administrator rationale and no prior matches; never use it to hide real bank movements. Legacy balance-only reconciliations are preserved but no longer establish transaction closeout.

## Reporting

Financial reports provides project/category/source/from/to filters, closing balances, period movements, budget categories, source funding, actual charges, reservation entries, advances, unpaid/overdue bills, promises and complete journal lines. Click each summary total to reach source records. CSV export preserves exact decimals and protects spreadsheet text against formulas. Print statement uses the browser print dialog; PDF output is possible through the browser's printer.

Category/source budgets are shared authority: source-filtered available category budget accounts for all funding sources' consumption. Category cash/funding are labelled project/source totals because bank cash has no category. Liabilities, payment allocations and advance assets use their request allocations. Approval timestamps control historical budget versions; demo transactions were intentionally backdated before their real seed timestamp.

## Completion, closure and reopening

Record operational completion in Project closeout. This stops new spending requests, approvals, POs and disbursements; existing bills, settlements, credit notes, returns and corrections remain available.

Resolve checklist items: unbilled commitments, unpaid bills, supplier receivables, advances, unmatched cash, open statements, residual source cash and unreceived promises. Return unused source funds under the donor/organization policy and explicitly cancel withdrawn promises. Financial close then blocks further activity.

If policy permits exceptional closeout, an independent administrator authorizes the named manager, each unresolved balance/treatment/owner, reason, evidence and expiry. The system hashes the snapshot and rejects stale or reused authority. The ledger is not cleared by this administrative decision. The responsible owner remains documented. Administrator reopening requires a reason and adds immutable audit/history before further postings.

## Upgrade, backup and recovery

Version 0.2.0 migrates the existing database; do not reseed it. Stop the running server before upgrade, then:

```powershell
npm.cmd run backup -- data\backup-before-upgrade.sqlite
npm.cmd run migrate
npm.cmd start
```

Backup uses SQLite VACUUM INTO for a consistent snapshot and refuses existing destination files. This workspace's verified pre-upgrade backup is `data/backup-before-0.2.0.sqlite`; it retains schema version 3. Current schema version is 4 and original records/balances were preserved.

For inspection/recovery, copy a backup to an unused filename and set `ERP_DB` to that copy, then migrate/start it. Preserve the current database; do not silently overwrite it. Runtime does not require development dependencies. Install locked dev dependencies with `npm.cmd ci` for both browser tests. Confirm the organization has a tested backup restore, security review and deployment plan before production use.
