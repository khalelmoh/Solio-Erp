# Stage 5 employee lifecycle — 0.7.0 / schema 10

Open **Employee lifecycle** in the navigation, or use its link in **HR management**. The eight tabs cover recruitment, onboarding/probation, performance, training/skills, employment/self service, departure/final pay, reports and policies/access. Existing **Add employee**, attendance, leave, allocations, payroll, vouchers and accounting screens remain available. All money is USD. Monthly, open agreed and project pay are supported; hours allocate costs, never determine base wages.

## Safe setup and upgrade

Use Node 24+ and the existing locked dependencies. Back up the database **and its matching encryption key** before migration. Do not seed or initialize a populated database.

```powershell
npm.cmd run backup -- data\your-unused-backup.sqlite
npm.cmd run migrate
npm.cmd start
```

Migration 010 only appends lifecycle tables and policies. Existing employees, encrypted terms, documents, project allocations, journals, budgets and payroll snapshots remain intact. `scripts/verify-people-upgrade.js` creates a non-overwriting paired backup and upgrades a second copy; its table hashes prove preservation before applying the migration to the original. `.env` and master keys are not replaced.

For a separate sample at an **unused** path:

```powershell
npm.cmd run demo:people -- data\new-people-demo.sqlite
$env:ERP_DB = Join-Path $PWD 'data\new-people-demo.sqlite'
$env:PORT = '3001'
$env:ERP_JOBS_ENABLED = 'false'
npm.cmd start
```

The sample includes an approved staffing request, interview/decision, accepted offer, one converted employee, onboarding tasks, work calendar, demo payroll rule and approved project allocation. It posts no additional salary or training expense. Demo user permissions are assigned **only in that sample**. All demo passwords are `Demo-only-2026!`. Set `ERP_DB` and `PORT` only in the intended PowerShell session; remove those environment overrides when returning to the main app.

## Permissions and approval policy

An administrator uses **Assign lifecycle capability** for explicit `hiring_approver`, `review_moderator` and `access_officer` roles. HR staff, assigned supervisors and payroll preparer/approver/Finance roles continue to use the existing HR capability setup. Administrator status does not silently grant HR or hiring permission. No lifecycle permissions are automatically assigned during migration.

The default lifecycle policy requires one independent hiring approver. Staffing also requires a separate Finance affordability review. Configure additional independent approval levels before organizational rollout: eligible role labels are `hiring`, `hr`, `manager`, `finance`, `payroll`, `admin`; the acting approver also needs the explicit hiring capability. Every level requires a different actor/principal, creators cannot approve their own document, and employees cannot approve their own employment actions. Project membership is still required for project-scoped approvals; Finance review/posting also requires project Finance membership. Final-policy approval additionally requires payroll approver capability. The performance moderator must differ from the employee and assigned supervisor. Account-role application requires an independent administrator approval.

## Recruitment and onboarding

1. HR requests staffing with department, position, authorized supervisor, location, employment type, intended start, compensation range, selection criteria and **full employer-cost forecast** allocated to projects/sources/categories/activities. Criteria weights must total exactly 100%.
2. Finance reviews currently available budget and source eligibility. Hiring approves that reviewed version. A changed budget invalidates the affordability snapshot and requires a fresh Finance review. Only approved staffing can publish a vacancy.
3. HR registers a candidate and application. Candidate email hashes and vacancy/candidate uniqueness prevent duplicates. Optional supporting files are encrypted and recruitment-restricted.
4. HR schedules panel interviews with explicit timezone offsets. Overlapping interviews for the same panel member are rejected. Each interview freezes its criteria. The assigned panel member records weighted scores and confidential feedback; candidates cannot assess themselves. A selection decision requires completed panel evidence.
5. HR prepares the offer; hiring independently approves it. Pay outside the approved range requires a new Finance-reviewed approved staffing version and a new offer. A staffing revision also invalidates an older unaccepted offer. Candidate self service or HR with manually verified evidence records acceptance/rejection. HR can withdraw an unconverted offer with a reason.
6. HR converts the accepted offer to one employee, selects the existing work calendar and optional onboarding template. Retries and simultaneous conversion requests return the existing employee. Conversion freezes the accepted staffing/offer version; it never silently changes an approved contract or provisions an external account.
7. Templates define task type, responsible employee/supervisor/HR/user, deadline offsets and whether independent evidence verification is required. Tasks preserve submissions, verifications and reasoned reopen events. Use contract/document/verification/policy/equipment/access/orientation/check-in tasks for the required onboarding evidence. Attach PDF, PNG, JPEG or text evidence: four files per supported operation, 512 KiB each. Existing HR documents remain available for the employee's verified file/contract register.
8. HR may start probation for an existing managed employee. The assigned supervisor or HR records confirmation, extension or follow-up findings; independent hiring approval makes the outcome effective. Extensions require a later deadline. Neither probation outcome nor performance rating changes pay or employment automatically.

**Budget policy:** approved staffing and training estimates are forecasts, not spending reservations. Finance checks their affordability, but approval does not guarantee budget remains available later. Actual purchasing reserves through its existing spending approval; payroll reserves complete employer cost only on final payroll approval. Posting replaces that reservation with one budget charge. This avoids reserving both a headcount estimate and the same salary. Use the existing approved allocation-plan workflow for actual payroll source ownership.

## Performance, training and employment changes

HR configures review-cycle dates/deadline, integer rating scale and weighted criteria. HR or the assigned supervisor starts a review with measurable goals. Employee self-assessment precedes supervisor evaluation; non-participation requires an explicit supervisor waiver. Supervisors can store shared findings and separate confidential feedback. An independent authorized moderator can moderate and finalize the rating. Finalized assessments are immutable; revised reviews link the latest completed version. Employee acknowledgment records receipt and a separate agree/disagree flag. Follow-up actions remain evidence, not automatic salary, promotion or termination commands. Employee downloads/exports cannot reveal confidential supervisor feedback or private attachments.

Employees request their own training; HR can request group training. Approved course estimates link to **one existing approved purchasing/direct-expense request**. Reusing that request for another course is rejected. Use the existing procurement or direct-expense/voucher workflow to record cost and cash. Attendance/certificates/skills create no financial postings. The course shows forecast, outstanding commitment, actual charge and payments with request/line IDs for drill-down. HR verifies participation before course-linked qualifications and tracks award/expiry dates and protected certificates. Split multiple invoices under that approved purchasing request; a materially changed course/cost requires a newly approved request/course scope.

HR proposes effective promotion, department transfer, supervisor change, renewal or compensation action. Approval appends profiles/terms and preserves earlier history and allocation plans. Linked compensation also requires the existing independent payroll approver capability. A newer profile invalidates a stale employment proposal. Direct legacy profile/status/terms changes are blocked for lifecycle-managed employees. Approved changes invalidate affected unposted payroll fingerprints; posted payroll needs the existing reversal/correction process before changing overlapping evidence. A new effective allocation plan is prepared/approved separately in HR management; do not rewrite earlier project costs.

Employees submit personal/contact/emergency, payment-account or document requests. Changes remain pending until independent verification. Bank changes require HR or payroll Finance review and the existing approved payment-detail version; employee-supplied details never become immediately payable. Verified documents enter the existing employee document register. Review actions and protected downloads/CSV exports are audited; raw sensitive payloads are excluded from the general audit log.

## Departure and final payroll

Departure types are organization-defined text, not statutory assumptions. Employee or HR requests departure with first excluded employment day, access-revocation date on/before that day, notice/evidence and departure checklist. Independent approval appends the employment boundary and checklist. Contract expiry is a reminder until an explicit departure is approved; it does not silently terminate employment.

**Access revocation is independent of clearance.** On the approved date, authentication/password sign-in/SSO/direct actions deny the departed user and invalidate local sessions; the notification worker also records due revocations. Outstanding laptops, advances and salary cannot postpone it. Local role history remains for audit. External systems still need the organization's manual revocation/provider process; the app never labels an unconnected external account as disabled or created.

Final-pay policy versions define dates, provisional/demo/validated state, validation authority, allowed manual earning/deduction components and whether explicitly scheduled advance recovery is allowed. There are **no assumed severance rates, leave-payout formulas or automatic advance deductions**. Provisional policy cannot finalize. Demo policy only applies to demo projects. Actual legal entitlements, tax treatment, leave valuation and lawful deductions require authorized validation.

Payroll preparers select an approved departure/policy, earned pay period, existing approved payroll rule/allocation, and any explicit policy-backed fixed adjustments with calculation evidence. Existing daily monthly proration stops on the day before departure; open/project final earnings are explicitly agreed inputs. Final payroll then follows ordinary independent payroll approval, atomic budget check/reservation, period lock, posting and partial voucher/batch payment controls. Settlement does not deduct cash again. Duplicate/overlapping approved salary periods are rejected. Ordinary future payroll excludes departed employees, while Finance can still pay their earned liabilities and make authorized corrections.

If the last earned payroll is already posted, use **Review already-posted final payroll**: identify the active posted run covering the last employed day, review leave/all configured entitlements and document that no additional earnings are due. An independent hiring/payroll approver accepts this review. It creates **zero additional expense** and leaves any unpaid salary payable. If additional amounts are due, follow the existing linked payroll reversal/replacement process; a review cannot rewrite a posted run.

Clearance tracks checklist tasks, equipment, employee-linked salary advances, explicitly verified spending-advance responsibility, employee reimbursement liabilities, final payroll review and all unpaid salary/control amounts. Spending advances and reimbursements have legacy free-text beneficiaries, so Finance explicitly links their verified source IDs to the departure; the application does not guess identity from a name. Complete the financial review checklist to confirm all such obligations are linked. Closing clearance requires zero unresolved blockers. Equipment returns, advance returns and salary/reimbursement payments use their existing supported workflows. Closure never erases financial records.

## Reporting, notifications and limits

Lifecycle reports/CSV/printing provide scoped pipeline, task completion/overdue status, probation history, contract expiry, performance completion/acknowledgment, course costs, qualification expiry and departure clearance. Source record IDs connect these to detailed tabs and existing payroll/procurement ledgers. Filters select project, employee and record-date period; profiles use the period's effective version (current view caps at today). Workflow states are **current reviewed states**, not a reconstruction of approval status at an earlier timestamp. Earlier posted payroll and project financial reports retain their original source journals/snapshots.

Use **Scan due reminders**, or the existing authorized notification worker, for task/probation/review/qualification reminders and due local access revocation. Existing contract/document reminders remain available. Notices use the protected inbox and existing configured delivery queue. Actual email/calendar/identity/account provisioning providers and live delivery have **not** been connected or verified. Scheduling records are local; external calendar invitations are not sent.

Retention policies preserve authority, review days and legal-hold flags. Retention is manual authorized review only: no scheduled deletion/anonymization is implemented. Configure the organization's actual retention law, document access policy, approval separation and provider revocation process before rollout. Rehire/reactivation after an approved departure requires a future explicit rehire workflow; historical employment is deliberately not silently reopened. Specialized bank/provider payroll filing and prior inventory/accounting import limits remain as documented in earlier runbooks.

## Verification

```powershell
npm.cmd run test:people
npm.cmd test
npm.cmd run check
npm.cmd run test:browser
```

All automated and browser fixtures use separate temporary databases. Browser outputs include `artifacts/stage5-lifecycle-desktop.png`, `stage5-lifecycle-mobile.png` and `stage5-lifecycle-statement.pdf`. See the completion/checkpoint documents for the final run counts and saved-data migration evidence.
