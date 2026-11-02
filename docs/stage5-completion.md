# Stage 5 completion ? 2026-10-15

Delivered locally as **0.7.0 / schema 10**, extending the established Node/native browser/SQLite stack. Main application: http://127.0.0.1:3000. Open **Employee lifecycle**; HR management also links to it.

## Delivered

- Finance-reviewed approved staffing forecasts, weighted recruitment assessments, vacancies/applications/interviews, range-controlled approved offers, acceptance/rejection/withdrawal and race-safe one-employee conversion.
- Versioned onboarding/departure templates, responsible owners/deadlines, encrypted evidence and independent verification, reviewed probation outcomes, equipment custody, independently approved effective local roles and explicit unconfigured external requests.
- Weighted performance cycles/goals, employee self-assessment, assigned supervisor evaluation, independent moderation/finalization, immutable linked versions, confidential feedback and acknowledgment with separate disagreement. No automatic pay or employment effects.
- Training requests/approvals, verified attendance/qualifications/expiry, and a link to existing purchasing with forecast/commitment/actual/payment drill-down. No expense from course attendance.
- Approved effective promotion/transfer/supervisor/renewal/compensation changes, preserved profile/allocation/payroll history, stale-run protection, and independently reviewed personal/bank/document self service.
- Approved departures, due authentication/session/password/SSO/action revocation despite unresolved equipment, preserved salary payable, validated/demo final-pay policy and existing controlled payroll/payment workflow. An approved already-posted final-salary review adds no expense. Clearance checks tasks, equipment, advances, linked reimbursements and unpaid payroll.
- Backend privacy/roles/files/exports, immutable encrypted evidence and redacted audits, scoped lifecycle reports/CSV/print, source dialogs, existing inbox reminders and manual retention/hold policy records.

## Verification and saved data

**154 distinct automated tests passed:** the complete 153-test regression run in artifacts/stage5-final-tests.txt, plus the final added task-verification regression within the 18-test lifecycle run in artifacts/stage5-acceptance-final.txt. These runs overlap; do not add their counts together. The final focused privacy check is artifacts/stage5-final-privacy.txt. All eight browser suites passed in artifacts/stage5-final-browser.txt; the new lifecycle suite was subsequently rerun after source-dialog/privacy polish in artifacts/stage5-browser.txt. Syntax checks passed in artifacts/stage5-final-syntax.txt.

Coverage includes the original financial example and prior advances/transfers/reconciliation/credits/refunds/closure/payroll/inventory/accounting controls, plus duplicate/concurrent conversion, staffing reapproval, review privacy/disagreement, independent task evidence, no duplicate training cost/reservation, approved effective compensation, stale payroll inputs, bank-detail review, locked final payroll, already-posted salary review, no implicit advance deduction, full clearance and revocation with equipment/unpaid salary outstanding.

Migration preview and actual upgrade preserved **306 existing rows across 188 business tables**. Main still has two projects and the one saved employee, with readable encrypted terms and unchanged local key. Integrity is ok; foreign-key errors zero. No lifecycle roles, test employees, lifecycle documents, payroll or artificial financial postings were added to main. Default lifecycle policies alone were appended by the migration.

Project #1 remains budget 50,000, funding received 40,000, actual charges 6,000, outstanding commitments 4,000, available budget 40,000, unpaid bill 2,000, paid 4,000 and cash allocation 36,000 USD.

Paired backup: data/backup-before-0.7.0-final.sqlite plus .key. Earlier backup-before-0.7.0.sqlite is also preserved. The preview-0.7.0-final.sqlite is a separate migrated copy. Proof: artifacts/stage5-migration-preview.json and artifacts/migration-0.7.0.json. Live read-only UI/API/HR registration evidence: artifacts/live-0.7.0-verification.json and live-0.7.0-lifecycle.png. Browser artifacts: stage5-lifecycle-desktop.png, stage5-lifecycle-mobile.png and stage5-lifecycle-statement.pdf.

A separate data/people-demo.sqlite and matching key provide accepted-offer/onboarding and approved payroll-allocation preparation with demo-only policy/roles and no new payroll/training charges. Existing accounting-demo.sqlite and stage3-demo.sqlite are preserved.

## Policies and remaining limits

Configure responsible hiring/moderator/access/HR/payroll/Finance roles, independent approval levels, compensation ranges/employer forecasts, templates/evidence/deadlines, review criteria, training authority, verified legacy advance/reimbursement responsibility, legal final-pay/leave/tax treatment, lawful recovery rules and retention/holds. Staffing/training estimates are forecast-only; actual payroll/purchasing approval reserves once. No hourly pay or FX.

Statutory validation, actual hosting/HTTPS/restore/security/capacity checks, live email/calendar/identity/bank/account-provisioning credentials and provider verification remain incomplete. External account requests are never reported as provisioned or revoked. Local access ends independently of clearance. Automated retention deletion and rehire/reactivation are not implemented; retention is manual review with no silent deletion. Lifecycle period filters select record dates/effective profiles; workflow states are current, not reconstructed historical approval timestamps. Prior specialized inventory/opening-asset import and statutory filing limits remain unchanged. See [operator setup and policies](stage5-runbook.md).
