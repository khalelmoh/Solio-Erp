# Human acceptance and controlled pilot proposal

Prepared 2026-10-18. **Human acceptance: pending until recorded by the actual reviewer.** Passing automated scripts does not constitute Finance, HR, employee, security or management signoff. Use `node scripts/uat.js status` for current declarations. No reviewer name, approval or signature has been invented. Start with the [policy review packet](policy-approval-packet.md).

Update 2026-10-19: the [first guided project-manager/Finance scenario](uat-project-finance-result.md) passed with actual user observations and final confirmation of all five numerical results. This scoped scenario result is separate from the full-role declarations shown by `uat status`, which remain pending. No named independent organization or production signoff is implied.

## Executable role scripts

Use isolated synthetic fixtures only. The driver never points at the saved database and never sends real notifications or initiates real payments.

```powershell
npm.cmd run uat -- prepare
npm.cmd run uat -- finance
npm.cmd run uat -- hr
npm.cmd run uat -- project_manager
npm.cmd run uat -- employee
npm.cmd run uat -- administrator_security
```

`prepare` creates missing worksheets under `artifacts/uat/` and preserves existing findings. A role command runs its listed existing browser scripts, preserves findings and writes separate automation logs/run records. It does not approve anything. The complete final browser suite already exercised these journeys. Actual reviewers must inspect screenshots, exports and source records, repeat relevant steps and enter their own findings. Store real acceptance evidence in restricted organization storage; the local artifacts are test evidence, not a personnel archive.

## Recording a real review

Run `node scripts/uat.js session` with the supported Node24 runtime. It creates a **new** synthetic database and opens `http://127.0.0.1:3003`, separate from the saved app on port3000. Keep that process running during the review. Use a private browser window to separate localhost sign-in cookies. Use only the visible demo accounts and synthetic details; do not enter real personal data or make real payments. The persistent quarantine blocks external services, SSO and automatic erasure; background jobs are disabled. This environment cannot validate actual provider delivery, production MFA setup or target recovery.

Review the role's worksheet, demonstrate the steps and retain screenshots/exports with stable filenames in `artifacts/` or `docs/`. A new session starts with the original project and a synthetic employee/lifecycle setup. It does not imply the reviewer performed the preloaded steps. Follow the worksheet to exercise further operations; record the actual source IDs and session ID.

```powershell
node scripts/uat.js template finance
# Edit the printed unsigned review JSON using the actual reviewer's decisions.
node scripts/uat.js record artifacts/uat/finance-review-<generated-id>.json
node scripts/uat.js status
```

Repeat for `hr`, `project_manager`, `employee` and `administrator_security`. Record the reviewer's actual name, organization role and authority, actual ISO review timestamp, exact declaration, per-scenario observed result and evidence paths, and unresolved defects. An accepted review requires all scenarios passed, supporting evidence and no unresolved defects. A reviewer can record `requires_changes` or `rejected`, including scenarios `not_run`. This is **synthetic UAT acceptance only**. Organization/legal validation and independent transaction approvals must still use their actual authorized processes.

Review files are written separately without overwriting earlier records. Status checks bind declarations to source/policy fingerprints and evidence-file hashes; changed code, policy text or evidence marks a review stale. Existing worksheet human fields are preserved for historical reference; `status` reads the separate review records. These are local operator-entered declarations, **not authenticated electronic signatures or tamper-proof records against the filesystem owner**. The CLI cannot establish a person's identity or confer authority. Retain actual signed evidence in the organization's restricted approval system. Personal review forms and declarations are ignored by Git.

| Role | Reviewer must demonstrate | Expected evidence |
| --- | --- | --- |
| Finance | Funding receipt, 2000 advance / 1500 expenditure / 500 return; partial bill/payment; statement duplicate rejection; credits/refunds; accounting/asset/period close | Advance zero, net cash reduction1500; original bill unpaid2000; source cash and controls reconcile; source IDs, CSV/print and approval trail |
| HR | Recruitment/offer/conversion, independent onboarding evidence, actual leave, approved payroll, private data, final pay, departure and rehire | One employee identity; approved effective terms; no unauthorized private data; stale entitlement blocked; access ends despite obligations; new rehire access reviewed |
| Project manager | Budget/transfer approval, source restrictions, spending/PO, partial bill/payment, aggregate payroll and project closeout | Budget50000, funding40000, actual6000, commitment4000, available40000, unpaid2000, cash36000; blocked underfunding and unresolved closure |
| Employee | Own profile/leave/timesheet/payslip, reviewed personal/bank request, review disagreement and departure access | Own permitted records only; no self-approval; 1000 gross /100 recovery /900 net where applicable; accurate status and no other employee salary/account data |
| Administrator/security | Account/MFA setup, privilege removal, password reset, audit, job/backup alerts and isolated restore | Strong sign-in, invalidated old sessions, one-use recovery, immutable evidence, blocked recovery-network calls and genuine recovery review |

For every finding record scenario ID, build/schema, test database, account/role, date, source transaction IDs, expected/actual amounts, browser evidence, exception/error, defect reference and reviewer decision. An unexplained difference, unauthorized access, duplicate posting or failed recovery is a **release blocker**. Never adjust expected accounting numbers or weaken approval/period/source controls to produce a pass.

## Before introducing real data

| Check | Owner role | Required evidence / gate | Current status |
| --- | --- | --- | --- |
| Separate development/staging/production and actual durable hosting | Administrator | Reviewed domains, persistent storage, TLS, runtime, secret store and service mappings | Pending target configuration |
| Initial administrator and individual accounts | Security / HR | MFA verified; no demo accounts/default passwords; employee-to-user mapping independently checked | Pending production onboarding |
| Effective authority and separation | Administrator / Finance / HR | Distinct preparation/approval/payment duties, threshold matrix, delegated authority, least privilege and effective legacy-role review | Pending organization approval |
| Chart, fiscal period and source-account mapping | Finance | Approved control accounts, fund recognition and opening/closing dates | Pending actual organization chart |
| Opening balances | Finance and independent approver | Approved supported opening journal or validated import, source records, trial balance and subledger agreement | No real opening import performed |
| Supplier/employee liabilities and advances | Finance / HR | Named ownership, individual unpaid/outstanding balances and cutoffs, reconciled control accounts | Pending real source reconciliation |
| Cash/bank/mobile-money accounts | Finance | Actual statement opening balances, project/source cash allocation, unallocated cash review | Pending real statements |
| Funding restrictions | Project manager / Finance | Signed source agreements, eligible categories/dates, ceilings, residual/refund and recognition treatments | Pending actual agreements |
| Budgets and commitments | Project manager / approver | Approved budget versions, remaining PO/reservation balances and liabilities, no double-counted import | Pending validated openings |
| Compensation and payroll | HR / payroll approver | Somaliland legal/contract validation, monthly/open/project pay, tax/leave/final-pay basis and approved source allocation | Saved worksheet remains provisional |
| Currency | Finance | USD only, two decimals; reject foreign amounts; no hourly base pay | Confirmed application scope; real input validation required |
| Privacy and retention | HR / privacy officer | Actual lawful periods, legal holds, financial/backup exceptions and independent approval | No automatic retention rule activated on saved database |
| Provider integration | Security / service owners | Actual endpoints/credentials, limited test recipients/accounts, verified MFA/provision/revoke/calendar/notification receipts | Live providers unverified |
| Recovery and alerting | Administrator / Finance | Offsite archive and separate-key access, restore on actual host, settlement reconciliation, tested backup/job failure alert | Local synthetic restore passed; target pending |
| UAT and pilot approval | All owners | Completed real reviewer decisions, resolved blockers, change authorization and rollback/recovery owner | Pending human acceptance |

Opening warehouse lots and pre-depreciated legacy-asset imports are unsupported. Do not force them through generic journal imports or assume they create correct inventory/asset subledgers. Implement and validate any required migration separately. Freeze legacy cutoffs, import only approved supported records, compare totals before posting and independently reconcile every imported control/source balance before users transact.

## Proposed pilot

Scope: one explicitly approved project, one USD funding source and five employees, with separately named employee, supervisor, project-manager, HR, preparer, approver, Finance and administrator responsibilities. Existing Stage 6 tests use eight separate role accounts for the managed payroll flow. Nominate actual people before the pilot; these role names are not signoff.

Proposed duration: ten working days covering ordinary procurement/advance settlement and an approved payroll/period exercise as the real calendar permits. Use either synthetic UAT or a formally authorized real pilot; do not mix test and real financial records. Production-connected payments/notifications require a separate explicit service activation approval, which this Stage 6 request does not grant.

Finance owns the daily journal/source/bank/subledger reconciliation and unresolved-item register. HR owns employee/user/contract/leave and salary evidence. The project manager owns approved budget/eligibility/commitment review. Security owns access/MFA/service credentials. The administrator owns health/jobs/backups and recovery. A change owner freezes scope, tracks issues and authorizes the decision after independent reviews.

Success criteria: zero unexplained financial/control differences, unauthorized access, duplicate postings or unreviewed approval overrides; complete source drill-down/export/print evidence; successful recovery using the actual recovery credentials and target environment; accurate outstanding advances/liabilities; tested disabled/departed access; completed human UAT; and response times accepted by the pilot users under measured target load. No provisional statutory policy may finalize real payroll.

Stop new posting and outbound work if a release blocker appears. Preserve logs, databases, receipts and approvals. Use the [recovery/rollback procedure](stage6-operations.md); never overwrite newer financial records with an older backup. At pilot close, Finance reconciles every pilot transaction to actual bank/provider evidence, HR validates payroll/leave, and the designated reviewers record whether the scope may expand. **Pilot authorization and production consideration remain pending.**
