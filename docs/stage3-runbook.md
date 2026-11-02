# Stage 3 HR and project payroll, version 0.5.0

This milestone uses the existing Node/SQLite/browser stack, USD cents, approval engine, immutable evidence and project/source ledger. Pay is monthly, an agreed open amount, or an agreed project amount. Timesheet hours allocate costs; they do not create hourly wages. Overtime is a separately approved USD supplement.

## Upgrade and demonstration

Stop the server and back up the database and matching encryption key before upgrading. Run `npm.cmd run migrate`, then `npm.cmd start`. Migration 008 appends HR tables and GL accounts 1250 (salary advance receivable) and 2120 (deduction/benefit remittances). Existing employee, payroll and project records remain available. The saved database was backed up as `data/backup-before-0.5.0.sqlite` with its `.key`; preservation evidence is `artifacts/migration-0.5.0.json`.

The original database has no invented employee records. A separate **completed demonstration** exists at `data/stage3-demo.sqlite`. It includes the original financial example, an employee linked to requester@demo.erp, a work calendar, approved demo rules, a 60/40 allocation to two demonstration projects, $100 salary advance, $1,000 gross payroll and $900 salary payment. Its incremental salary expense is $600/$400. All statutory components are explicitly zero; these are test settings, not Somaliland law.

To generate another copy, choose a new filename; the command refuses any existing file:

```powershell
npm.cmd run demo:stage3 -- data\another-stage3-demo.sqlite
$env:ERP_DB = Join-Path $PWD 'data\stage3-demo.sqlite'
$env:PORT = '3001'
npm.cmd start
```

Use the existing local demo accounts and `Demo-only-2026!`. To return to the original database, remove these two environment overrides in that PowerShell window. Do not run demo/init against populated data.

## Authorization and privacy

Assign capabilities in **HR management → Employees & contracts → Assign HR capability**. Administrator status alone grants configuration permission, not HR/payroll access. Keep distinct users for preparation, approval and Finance posting.

| Capability | Authorized work |
| --- | --- |
| hr_staff | Employee profiles, contracts, documents, schedules, attendance, entitlements and private HR reports |
| supervisor | Review only assigned employees' attendance, timesheets, leave and overtime; no salary or bank access |
| payroll_preparer | Draft payroll and allocation plans; cannot approve or post with this capability alone |
| payroll_approver | Independently approve rules, compensation, allocations and configured payroll approvals |
| payroll_finance | Post payroll/advances and prepare salary vouchers, batches and bank instructions; project Finance membership is also required |
| Employee account link | Own leave/attendance work, approved payslips and explicitly shared documents |
| Project manager membership | Project salary totals and source journals; individual compensation requires a separate capability |

Legacy `org_roles.hr` maps to HR staff. Legacy `org_roles.payroll` retains preparer and approver capabilities; it allows Finance actions only with Finance project membership. The demo manager explicitly has this legacy payroll role. It is not inherited from being a project manager. Revoke legacy grants before assigning narrower capabilities.

Employee registration requires HR staff permission, including in **People & payroll**. Payroll-only accounts can view their authorized payroll records but cannot add employees or change attendance. For the local demo, sign in as `admin@demo.erp` to register employees. To authorize another account, an administrator uses **HR management → Employees & contracts → Assign HR capability**, chooses the account, grants `hr_staff`, and the account refreshes its workspace. An administrator without an HR grant also needs this explicit assignment. Version 0.5.1 corrects the legacy screen's misleading registration button and makes the server's denial explain the required permission.

HR profiles, salary/contract versions, payment details, documents, payroll inputs and imports are encrypted with the existing AES-GCM master key. Sensitive operation fingerprints are keyed and audit payloads are redacted. Document and payment-detail reads produce audit entries. File visibility is HR only, employee sharing or assigned-supervisor sharing. Project attachments must not be used for confidential HR files.

## Employee and work records

1. Add an employee with a unique number, employment start and monthly/open/project terms. Allowances, deductions, employer benefits, contract end and probation end are entered through compensation forms.
2. Create a work schedule and its holidays. Record a dated employee profile with department, position, location, supervisor, private contact/emergency details and joining/active/transferred/departed state. Each change creates a version.
3. Submit compensation changes, including mid-period salary changes for managed employees. An independent payroll approver approves them. Completed payroll keeps its inputs; changes affecting posted periods require reversal first.
4. Upload protected PDF/PNG/JPEG/text files, maximum 512 KiB, with optional expiry. The confidential reminder scan covers document, contract and probation dates through the next 30 days. The existing background worker includes this scan if its user has HR authority; notifications are deduplicated daily and contain no salary, account or document content.
5. Submit payment details; HR or Finance independently reviews the actual details before approval. Bank CSV uses the approved version captured when the batch was created, even if a newer destination is later approved.

Manual attendance records presence in minutes. A change to an existing managed record becomes a correction proposal and needs independent HR/supervisor approval. CSV imports are encrypted proposals with header `employee_code,date,start_time,end_time`, maximum 1,000 unique employee/day rows. Use a worked interval excluding breaks. The reviewer sees proposed and previous minutes before accepting the entire import atomically. The device interface is this reviewed import contract; **no device is connected**.

Project timesheets are separate date/time intervals with project, source, category and activity. The employee and reviewer need relevant project access. Intervals must lie within the assigned schedule, not overlap other uncancelled entries, and not exceed recorded presence or work time after approved leave. An approved timesheet payroll must account for 100% of recorded attendance, including organization overhead. Unsupported cross-source assignments fail explicitly.

## Leave and policy validation

Leave policy versions configure paid/unpaid treatment, eligibility days, opening minutes, monthly accrual, annual carryover cap, credit expiry and effective dates. Independent policy approval precedes enrollment. Entitlements are in scheduled work minutes, respecting holidays and rest days.

Pending requests and future approved days reserve entitlement. They are distinct from completed approved usage. Credits are consumed oldest first; expiry and carryover loss are reported separately. Overlapping requests and attendance conflicts are rejected. Approved cancellation requires HR or the assigned supervisor; it releases entitlement without changing posted payroll. Linked payroll must be reversed before cancelling its accepted leave inputs.

Policy status is **provisional**, **validated** with an authoritative review reference, or **demo**. Provisional leave rules cannot approve requests; provisional payroll rules cannot finalize any payroll, including the legacy path. Validation requires a new approved version; no immutable policy can be relabelled in place. Demo payroll can allocate only to demonstration projects. No statutory entitlement or withholding rate is asserted by this release.

## Payroll and allocation

Create a pay period with earned start/end and an open posting date on/after the end. Choose an approved payroll rule that covers the full period. For managed employees, use **Prepare project payroll**. Legacy employees retain their previous monthly workflow until a managed profile is added.

Monthly managed salary is calculated from daily effective terms using each month's calendar-day denominator. Joining, contract end/departure and approved unpaid scheduled days affect the daily amount. Rest days remain paid calendar days. Managed allowance/deduction/benefit amounts follow the same daily fractions. Changing the pay basis inside one period requires separate non-overlapping periods. Open/project pay uses an agreed amount on the draft; no hourly computation is used. Salary, components, overtime, work evidence, rule version and rounding method are saved with the calculation.

Approve either a fixed percentage plan totalling exactly 100% or project timesheets. Fixed lines specify project/source/category/activity and eligible component names; `*` expressly means all configured components. Source dates must cover the period and source/category restrictions remain enforced. Costs excluded by a funding line block payroll; Finance must obtain an approved revised plan. The system never silently drops liabilities or moves costs to another project.

Daily component fractions use exact BigInt arithmetic, rounded half up once to USD cents. Cost allocations are split deterministically; residual cents follow line order. Net and other controls exhaust each source's cost exactly. Draft previews and unposted payroll forecasts are separate from actual expenses. Approved runs reserve full employer cost in commitments. Posting atomically rechecks current evidence, source eligibility, budget and grant limits, charges the budget once and consumes the reservation.

Changed approved inputs cause a stale-run error. Cancel its reservation, prepare a replacement and obtain new approval. A budget failure rolls back approval and all reservations. The existing independently authorized budget-exception workflow can permit an expressly approved overrun; it does not bypass source restrictions. Posted corrections require linked reversal, payment dependency checks and reapproval of a replacement. Locked-period corrections require a named-poster authorization and an open correction date.

## Salary advances, payments and accounting

Salary advances have independent approval, a responsible employee, project/source cash, and an explicit repayment schedule whose installments total the issued amount. They are employee receivables, separate from project expenditure advances. They do not create an expense or a project spending reservation; the full employer payroll cost is reserved when payroll is approved. Closure blocks outstanding salary receivables.

| Operation | Effect |
| --- | --- |
| Issue salary advance | Debit 1250, credit allocated cash; no expense or budget charge |
| Post payroll | Debit 5100 for gross and employer costs; credit 2100 net salary, 2110 statutory remittances, 2120 deductions/benefits, and 1250 advance recovery |
| Recover advance | Reduce receivable in its original project/source; gross expense remains unchanged |
| Receive unused advance return | Debit cash, credit 1250; no salary expense |
| Pay net salary | Debit 2100, credit cash; no second expense |
| Pay statutory/benefit liabilities | Debit the matching 2110/2120 controls, credit cash |

Recovery cannot exceed issued outstanding balance, cumulative approved installments due or net salary in the original funding source. For the required $1,000/$100 example, A expense is $600 with $500 net payable plus $100 recovery; B expense/net payable is $400. Thus the $900 salary cash payment preserves source ownership. A different original advance source requires a corrected allocation or advance treatment, never an automatic transfer.

Payroll vouchers support partial payments and independent approval. Group approved vouchers into a batch; all post inside one transaction or all roll back. Retry keys prevent duplicate posting. Bank CSV exports are private manual instructions for net salary, not a bank connection. Statutory/benefit payee instructions and provider-specific file formats still need configuration. A failed batch can be retried after resolving its issue; if approved allocations become invalid, cancel the vouchers and prepare replacements.

## Reports and remaining configuration

HR reports provide a scoped employee register, contract/probation dates, attendance/missing entries, leave balances, private payroll registers and unpaid salaries. Reports allow date selection, CSV and browser printing. **Project salary costs** exposes aggregate posted journal/source costs and unposted forecasts with source-record IDs; it does not expose employee IDs, names, salary components or bank details. The main project reports continue to show salary charges, liabilities and payments in the financial lifecycle.

Configure and validate Somaliland withholding, employer contributions, leave entitlements/eligibility/accrual/carryover/expiry, unpaid-leave proration, allowance taxability, deduction/benefit treatments, overtime approval, repayment limits, fund eligibility, supervisors, approval thresholds, holiday calendars and accounting dates. The chosen managed calendar-proration convention is an implementation policy, not a statement of employment law.

Still unverified or outside this milestone: live attendance devices, actual bank/mobile-money disbursement, jurisdiction-specific statutory filing, production hosting/HTTPS/identity/mail credentials, target backup/restore and capacity/security review. Existing inventory limits remain unchanged. Node/SQLite local checks and passing tests do not establish production readiness.

Version 0.5.2: page/scripts/styles now use no-store headers and versioned module URLs to avoid stale registration controls. The build number is shown in the top bar. Direct registration: http://127.0.0.1:3000/?v=0.5.2#register-employee. This opens the HR registration form after login for an authorized HR account and gives a permission message with the actual signed-in email for others. The form does not reopen after saving. Eight relevant HTTP/permission/asset regressions, syntax checks, the direct-registration browser suite and the Stage 3 browser suite passed. Live admin direct-form verification is in artifacts/live-registration-direct-form.json/.png; no real employees or permissions were changed.
