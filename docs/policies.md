# Assumptions and unresolved policies

## Explicit provisional settings

- One organization; USD only, fixed scale 2. Monetary input must already be rounded to cents. USD is the user-selected permanent organization currency for this scope. Foreign definitions, rates, converted invoices and cash accounts are disabled.
- Demonstration approval rule: one manager approval for budgets and spending, minimum USD 0, no maximum. This is a local demonstration rule, not an invented organization authorization policy. Administrators can replace ordered levels/threshold ranges through configuration API/UI. Rules are snapshotted onto submissions, so later policy edits do not silently change an in-flight approval.
- Demonstration accounting period: calendar year 2026, open. Real administrators must configure actual fiscal periods through the administrative API.
- Source eligible dates and category restrictions are explicit input; empty whitelist means all project budget categories. Sources are restricted to one project.
- Reservations start on final request approval, preventing two approvals from consuming the same remaining budget before PO creation.
- Revisions are full replacement budgets. Transfers are represented by new versions with a mandatory explanation. Overlapping budget lines for the same category/activity are rejected. Existing charges and commitments must fit any new version unless a valid authorized overrun exists.
- Fiscal charge date and eligibility date are the same for each submitted request in this milestone. Bills/settlements must occur within the selected budget period and source eligibility.
- Each supplier invoice references one PO but can partially bill multiple allocations. Payments distribute pro rata by exact integer arithmetic, assigning residual cents deterministically.
- Shared cash is derived from project/source journal dimensions; no unallocated bank balance and no overdraft by default.
- Project managers are assigned by project creators; only administrators may grant finance/other project membership afterward. Financial close requires zero residual balances, complete cash matching and no unreceived promises unless independent authority specifies exact treatments and owners. Exceptions do not clear balances.

## Lifecycle settings

- New advance requests require explicit beneficiary/type/due date. No statutory or organization deadline is invented. Legacy generic disbursements without a due date retain a labelled project-end default. New request settlements require supporting receipts; a plain reference alone is insufficient.
- Returns release unused advance reservations immediately. Reversing expenditure on a cancelled advance restores the advance asset but does not recreate cancelled spending authority; recovery returns release only existing reservations. Accepting further expenditure requires new spending authority rather than a negative commitment.
- Existing bills without an explicit due date use invoice date for overdue reporting; new bill screens collect due date explicitly.
- Matching shared-account statements requires an explicit accountant capability or the existing administrator permission because those records span project permissions. Review-only matching/offsets create no journal and may operate on locked-period records. Actual corrections must use an open posting period and independent authority when the original period is locked.
- Budget approval timestamps determine which version was approved by a report cutoff. Original demonstration documents contain backdated hypothetical transactions; historical cutoffs before their actual approval timestamp correctly show no approved version.
- Budget reservations use the request's eligible date; subsequent nonjournal releases use their recorded business day. Monetary posting movements use journal date, with corrections attributed to the original budget period and shown as movements on the correction posting date.
- Cash and funding cannot be assigned to budget categories. Category-filtered reports label these as project/source totals. Invoice payment allocations, liabilities and advance assets can be filtered by their request categories. Funding receipts and returns are separate totals.
- `ERP_TIMEZONE` defaults to Africa/Mogadishu. Configure approval rules, fiscal periods, advance dates, overrun authority, correction/closure authority, donor return/cancellation treatment, evidence/retention and outstanding-item review policy before organizational rollout.

## Policies requiring organization decisions

Approval thresholds/levels, explicit delegation validity and conflicts, exception maxima, minimum documentation, grant ceilings and match requirements, asset capitalization/depreciation, tax withholding, fiscal calendar, budget carry-forward, funding revocation, donor refunds and residual cash on closure, beneficiary eligibility, petty cash limits, account reconciliation cutoff and outstanding-item review, payroll jurisdiction/statutory calculations, retention periods and integrations.

No statutory payroll defaults or external credentials are invented. Integrations remain disabled. Demo passwords are only for local demo data and must never be deployed.

## Compensation and stock policies

Use monthly salary, open per-run gross amounts or explicit project-based pay; hourly pay is excluded by user instruction. Authorize calendar-day proration, paid/unpaid leave classification, taxable/non-taxable cash allowances, deductions and employer benefits, along with real statutory brackets and remittance schedules. One active payroll per employee/pay period prevents duplicate compensation across projects.

Inventory follows billed asset acquisition value and fixed project/source ownership. Approve receipt and custody evidence, count variance treatment outside purchase-budget charges, journal approval thresholds and final disposition on project closure. Quantity uses three decimals and proportional lot value uses USD cents. Native cross-project ownership transfers, GRNI, serial/expiry tracking and statutory filing interfaces require separate scope.

## Stage 4 accounting policy configuration

Configure independent accountant/approver/auditor roles, journal approval thresholds, fiscal years/periods, chart groups/mappings, source recognition/restrictions/transfer authority, opening support and evidence, straight-line asset lives/residuals and disposal gain/loss accounts. Default depreciation does not charge acquisition budget twice. Imported historical funding is an unclassified liability until an approved accounting treatment is posted. Specialized opening inventory and previously accumulated depreciation imports remain unsupported. See [accounting policies/runbook](stage4-runbook.md). These policies are configurable organization assumptions, not statutory compliance.

## Stage 5 employee lifecycle policy configuration

Assign explicit hiring approvers, independent performance moderators, HR/payroll capabilities, project Finance and access officers. Configure hiring/offer/training/employment/departure approval levels, compensation range units and full employer forecasts, selection/review weights/scales, onboarding/departure tasks/owners/evidence, probation/extension deadlines, training authorization and certificate expiry, reviewed account/payment changes, verified advance/reimbursement ownership and external account revocation responsibility. Forecast approvals reserve no budget; actual purchasing/payroll approval reserves complete cost once.

Final-pay policy needs dates, authoritative validation, lawful fixed entitlement/deduction components, leave valuation/evidence and explicit advance-recovery permission; no severance or automatic deduction is assumed. Manual final deductions are post-tax. Provisional policies cannot finalize, and demo policies only charge demo projects. Retention/holds are recorded for manual review; no automatic deletion occurs. Contract expiry sends reminders until an explicit departure is approved. Revocation proceeds despite unresolved equipment/payables. Configure and verify real providers before claiming external email/calendar/account provisioning. [Full Stage 5 runbook](stage5-runbook.md).

## Operational completion (supersedes Stage 5 retention/rehire exclusions)

Rehire and approved automatic private-data erasure are now implemented. Configure actual authorities and legal holds before activating deletion; no guessed retention minimum is enabled in the saved database. New employment episodes preserve old financial liabilities and clear old access. The local approval-role setup is recorded, and the cited Somaliland agreement is provisional pending genuine independent legal/organization review. Monthly leave divisor, partial-year treatment, salary basis, notice and tax require explicit reviewed policy. Live provider credentials, authorized test identities/recipients and real hosting verification remain operator inputs. [Detailed policy and service setup](operations-runbook.md).

## Stage 6 operating gates

Strong privileged production sign-in, actual identity-provider assurance/recovery, distinct effective roles, genuine Somaliland payroll/final-pay/retention validation, approved openings/restrictions and human acceptance are release gates. Secure backup keys must be separate from database keys, with reviewed retention, offsite storage, failure alerting and actual-host restore. Passing local tests/builds is not deployment or legal signoff. Never restore an old database over newer financial records without explicit reconciliation/authorization. See docs/stage6-readiness.md and docs/stage6-operations.md.
