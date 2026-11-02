# Transaction workspace additions — 0.15.1

Authenticated GET `/api/setup-checklist` returns configuration presence checks for authorized Finance/administrators. GET `/api/record-details/organization/:id` requires existing accounting permission. GET `/api/record-details/{request|bill|receipt|advance}/:id?project_id=:id` preserves project membership and payroll privacy. These routes return presentation models only; no new write or approval route is introduced. Availability explanations are advisory and all writes retain existing backend checks. Related organization movements are capped at50.

GET `/api/branding` and `/api/branding/logo` expose configured public organization identity only, without credential or local-path disclosure. The organization logo is limited to raster PNG/JPEG/WebP,2MiB. Unknown non-API pages return the shared404 screen. [Operator guide and evidence](workspace-journeys.md).

# JSON API reference

Backend0.12.0 supports the same authenticated routes on SQLite or asynchronous PostgreSQL. No direct Supabase Data API/Storage access is introduced. PostgreSQL health routes query the selected database; startup never falls back to SQLite. Migration, backup, key restoration, initialization and worker operations use the selected backend CLI with separate privileged credentials where required. [Configuration and controls](postgres-staging.md).

## Organization Finance & Accounting (0.11.0 / schema13)

Organization reads require explicit accountant, accounting approver or auditor capability. Posting requires accountant; approvals require independent accounting approvers. Existing project permissions still apply to specific project/source filters and shared allocations.

| Endpoint | Result |
| --- | --- |
| GET /api/organization-finance | Restricted setup, latest200 preparations, approvals/evidence, budgets, items, allocations, schedules and assets |
| GET /api/organization-finance/report | Consolidated totals, project/general components, source IDs, cash/funds, aging, obligations and budgets |
| GET /api/organization-finance/report.csv | Full matching posted history, independent of preparation display limits |
| GET /api/organization-finance/journals/:id | Complete posted journal/source lines, including entries outside the report period |

Report filters: ISO `from`/`to`, `scope=all/general/projects`, `project_id`, project `source_id`, `org_fund_id`, department name or `department_id`, `cost_centre_id`, and `account_id`. Conflicting scope/funding filters return400. Existing `/api/accounting/reports/:kind[.csv]` supports these scopes alongside comparative periods and standard financial statements.

Use existing authenticated `POST /api/actions`, `Idempotency-Key`, and `{action,data}`:

- `org.unit`: administrator creates department/cost_centre/category with code/name.
- `org.fund` / `org.fund.approve`: independently approved eligible dates, restriction/category array, income/deferred/refundable treatment, receivable-recognition and transfer permissions, and reason.
- `org.budget` / `org.budget.approve`: code/name, dates, independent/parent mode, optional dimensions, category/amount lines, child project IDs, previous version and reason. Approval retains configured budget threshold levels with distinct accounting approvers.
- `org.document`: kind, unique reference, date, reason, organization fund, optional dimensions, decimal-string amount and supporting documents. Kinds: bill, reimbursement, expense, advance, receipt, receivable, payment, collection, settlement, return, transfer, fund_allocation, recognition, refund, allocation, depreciation, disposal, reversal; promise is off-ledger evidence.
- Bill/reimbursement/advance add `budget_code`, category, party, external reference and due date. Bill optionally uses `cost_type=asset`. Receipt adds receipt type and cash account; receivable requires entitlement evidence and a permitting policy.
- Payment/collection/settlement/return identify `item_id` and amount; physical cash movement adds `account_id`. Settlement requires receipts and does not deduct cash again.
- Allocation identifies original `cost_id` and amount, then either destination general budget/fund/dimensions or approved project `request_line_id`. Internal physical-account transfer uses distinct `account_id`/`to_account_id` within the same fund.
- `fund_allocation` identifies `org_fund_id`, project `source_id`, one `account_id`, amount and `direction=to_project/from_project`. It requires both approved transfer policies and project access, changes allocation without physical cash movement, and automatically excludes its cash lines from statement matching. It creates no income, expense or budget charge.
- Recognition/refund adds existing deferred/refundable treatment and evidence; refund also cash account. Reversal identifies original journal and current date; a locked original period requires a specific independent `authorization_id`, consumed once by its named poster.
- Existing `acc.document.approve/post/cancel` govern organization documents. Existing `correction.authorize` governs independent locked-period authority.
- `org.schedule` saves a monthly bill template/dates; `org.schedule.generate` creates one unapproved draft for its schedule/date occurrence.
- `org.asset` links a posted acquisition cost and records code/name, residual, life, service date and custody. `org.asset.approve/cancel` govern registration; depreciation/disposal are approved organization documents linked to the asset.

Supporting records use existing filename/MIME/base64 contracts, at most four512KiB files, signature validation and encrypted storage. `/api/accounting/evidence/:id` remains protected. Exports retain no-store/auditing; amounts remain integer cents internally and non-USD input is rejected. [Operator guide](organization-finance.md).

All routes are same-origin. Monetary values are USD decimal **strings**, e.g. `"6000.00"`, never binary floating-point inputs. Dates are ISO `YYYY-MM-DD`. IDs are numeric. Request bodies are limited to 3 MiB, with supporting-file limits below.

| Route | Behavior |
| --- | --- |
| GET `/api/health` | Public health/version |
| POST `/api/login` | `{email,password}`; returns user and HttpOnly session cookie |
| POST `/api/logout` | Revokes current session |
| GET `/api/config` | Accounts, snapshotted policy configuration, periods; administrators also see users, project directory, memberships, cash lines and reconciliations |
| GET `/api/projects` | Bounded membership-scoped project page; `page`, `page_size`, `q`, `status`; includes filtered pagination metadata |
| GET `/api/projects/:id` | Dashboard, budget history, sources, requests, bills and posted journals; allocation amounts are restricted to this project |
| POST `/api/actions` | `{action,data}` and required `Idempotency-Key` header |
| GET `/api/projects/:id/report` | Project financial statement; query `from`, `to`, `source_id`, `category` |
| GET `/api/projects/:id/report.csv` | Protected CSV export with the same filters |
| GET `/api/documents/:id` | Protected attachment download; all document projects require membership |
| GET `/api/reconciliation` | Administrator-only statements, cash lines, matches and reviews |

Example action:

```json
{
  "action": "payment.post",
  "data": {
    "bill_id": 1,
    "amount": "4000.00",
    "account_id": 1,
    "reference": "BANK-TRANSFER-001",
    "date": "2026-04-05"
  }
}
```

A key must be 8–120 characters. Retries by the same actor with identical canonical data return the original result. Reusing a key for different data returns 409. Authentication failures return 401; unauthorized access or self-approval 403; invalid financial data 400; insufficient budget/cash and duplicate references 409. No mutation uses GET.

## Actions

| Action | Required data |
| --- | --- |
| `project.create` | code, name, description, department, start_date, end_date, activities[]; optional manager_id |
| `project.close` | id |
| `user.create` | name, email, password; optional admin; administrator only |
| `membership.set` | project_id, user_id, role; administrator only |
| `policy.set` | kind (`budget`/`spending`), rules[]; administrator only |
| `period.set` | start_date, end_date, state; optional id to change state; administrator only |
| `account.create` | code, name, type (`bank`/`cash`/`mobile`); administrator only |
| `budget.submit` | project_id, reason, lines[{category,activity,start_date,end_date,amount}] |
| `budget.approve` | id |
| `source.create` | project_id, name, type (`donor`/`organization`), categories[], start_date, end_date |
| `funding.promise` | source_id, amount, reference, date |
| `funding.receive` | source_id, account_id, amount, reference, date |
| `request.submit` | title, date, lines[{project_id,source_id,category,activity,amount}] |
| `request.edit` | id, title, date, lines[]; returns a new request ID linked to the old request |
| `request.approve` | id |
| `request.cancel` | id, reason |
| `po.create` | request_id, supplier, reference, date |
| `bill.post` | po_id, invoice, date, lines[{request_line_id,amount}]; optional cost_type (`expense`/`asset`) |
| `payment.post` | bill_id, account_id, amount, reference, date |
| `advance.issue` | request_id, beneficiary, account_id, reference, date |
| `advance.settle` | advance_id, request_line_id, amount, reference, date, evidence; optional cost_type |
| `advance.return` | advance_id, request_line_id, account_id, amount, reference, date, evidence |
| `exception.authorize` | project_id, amount (maximum overrun), expiry, reason; project finance only |
| `journal.reverse` | id, reference, date, reason; supports receipts, bills, payments, internal transfers with dependency checks |
| `cash.transfer` | source_id, from_account_id, to_account_id, amount, reference, date |
| `reconcile` | account_id, date, statement_balance, outstanding_line_ids[]; administrator only |

Policy rules are inclusive ranges, with exact one-cent adjacency and a final unbounded maximum:

```json
[
  {"min":"0.00","max":"999.99","levels":[["manager"]]},
  {"min":"1000.00","max":null,"levels":[["manager"],["finance"]]}
]
```

This is an illustration, not an organization recommendation. Every level requires a different approver; a mixed-project request requires the configured role on all participating projects. Self-approval remains prohibited regardless of administrative status. Time-limited delegations are supported with preserved original principals and proxy self-approval prevention; see the version 0.3 operations below.

## Version 0.2.0 actions and evidence

| Action | Data |
| --- | --- |
| `budget.amend` | project_id, change_kind (`increase`/`reduction`/`reallocation`), reason, complete lines[], optional documents[] |
| `budget.transfer` | project_id, from_line_id, to_line_id, amount, reason, optional documents[] |
| `document.add` | kind (`budget`/`request`), id, documents[]; only before any approval |
| `request.submit` for advance | Existing request data plus kind=`advance`, beneficiary, beneficiary_type (`employee`/`supplier`), due_date |
| `advance.issue` | Approved request data; approved advance terms are preserved; legacy generic requests can supply due_date and beneficiary_type |
| `advance.settle` | Existing data plus documents[] receipts, required for new advance requests |
| `bill.post` | Existing data plus due_date and optional documents[] |
| `credit.post` | bill_id, reference, date, reason, lines[{bill_line_id,amount}], optional restore_commitment boolean, documents[], authorization_id when original is locked |
| `supplier.refund` | credit_id, account_id, reference, date, amount, optional documents[] |
| `funding.return` | source_id, account_id, reference, date, amount, reason, optional documents[] |
| `promise.cancel` | id (original promise), amount, reference, date, reason |
| `correction.authorize` | journal_id, poster_id, expiry, reason; independent administrator |
| `journal.reverse` | Existing data plus authorization_id for locked originals, optional documents[] |
| `statement.create` | account_id, reference, start_date, end_date, opening_balance, closing_balance, lines[{external_id,date,description,amount}] |
| `statement.import` | Same header data, csv text instead of lines[] |
| `statement.match` | statement_line_id, journal_line_id, positive amount, unique reference |
| `statement.unmatch` | id (match), reason; reverse a match after reopening if finalized |
| `statement.finalize` | id, reason, reviews[{journal_line_id,reason}] for every unmatched book entry |
| `statement.reopen` | id, reason |
| `reconciliation.offset` | line_ids[original,linked_reversal], reason; administrator review of an unbanked exact opposite pair |
| `project.complete` | id, reason; project manager |
| `closure.authorize` | project_id, closer_id, expiry, reason, treatments[{key,amount,owner_id,treatment}], optional documents[]; independent administrator |
| `project.close` | id, reason, optional authorization_id; requires operational completion and current closeout |
| `project.reopen` | id, reason; administrator |

Supporting file format: `{filename,mime,content}` where content is canonical base64. Allowed MIME types are PDF/PNG/JPEG/plain text; four files per operation, 512 KiB each. File records preserve byte size and SHA-256. Downloads use attachment disposition. File contents and passwords are excluded from audit payloads; idempotency still hashes the exact canonical request.

Statement amounts are signed cash movements; matching amounts are positive. CSV columns must be `external_id,date,description,amount`. UTF-8 BOM, quoted commas/quotes/newlines are supported. Closing equals opening plus movements. Overlap, external-ID reuse and amount overmatching return 409. Finalized matches create no expenses or cash movements.

## Version 0.3.0 operations

Authenticated mutations below use `POST /api/actions` and actor/payload-bound `Idempotency-Key`. See [workflow examples and configuration](completion-runbook.md).

| Action | Data / control |
| --- | --- |
| `control.set` | name (`require_vouchers`, `notifications_enabled`, `mfa_required`), boolean value; administrator |
| `org.role` | user_id, role (`hr`, `payroll`, `auditor`, `integration`), boolean enabled; administrator |
| `password.change` / `sessions.revoke` | current_password, new_password / empty object; revoke own sessions |
| `mfa.enroll` / `mfa.confirm` | password / code; secret and recovery-code retry responses are encrypted |
| `policy.set` | Also accepts payment/journal/payroll thresholds with project or organization-role approval levels |
| `delegation.create` / `delegation.revoke` | project_id, principal_id, delegate_id, role, start_date, end_date, reason / id, reason |
| `comment.add` / `comment.resolve` | project_id, kind, entity_id, location, body, optional parent_id / id, kind (`resolve`/`reopen`), reason |
| `request.submit` for expense | Existing fields plus mode=`expense`; original kind remains purchase |
| `expense.post` | request_id, reference, payee, date, due_date, lines[{request_line_id,amount}], required receipt documents[] |
| `voucher.submit` | target_kind (`bill`, `expense`, `payroll_net`, `payroll_tax`), target_id, account_id, amount, reference, date, optional documents[] |
| `voucher.approve` / `voucher.post` / `voucher.cancel` | id / id / id, reason |
| `adjustment.submit` | original_id, reference, date, reason, lines[{project_id,source_id,account_id,signed amount}], charges[{request_line_id,signed amount}], optional authorization_id/documents[] |
| `adjustment.approve` / `adjustment.post` | id; distinct approval then eligible finance posting |
| `bill.reissue` | original_bill_id, correction reference/reason, date, optional po_id, standard bill lines; fully reversed original |
| `grant.submit` / `grant.approve` | source_id, amount, reason, optional documents[] / id |
| `employee.create` / `employee.state` | code, name, department, start_date, monthly_salary, optional user_id / id, kind (`active`/`inactive`), reason |
| `attendance.record` | employee_id, date, integer minutes 0–1440, reason; correction versions |
| `leave.request` / `leave.decide` | employee_id, start_date, end_date, type, reason / id, decision (`approved`/`rejected`), reason |
| `payroll.rule` / `payroll.rule.approve` | jurisdiction, start_date/end_date, reason, explicit demo flag, rules{fixed_withholding,brackets[{up_to,rate}],employer_rate} / id |
| `payroll.submit` | reference, YYYY-MM period, date, rule_id, employees[{employee_id,allocations[{project_id,source_id,category,activity,amount}]}], optional replaces_id |
| `payroll.approve` / `payroll.post` | id; approval reserves, posting incurs actual cost and net/statutory liabilities |
| `notifications.scan` / `notification.read` | empty object (administrator) / id (own accessible notice) |
| `integration.configure` | name, HTTPS endpoint, secret, enabled; optional existing id for rotation; administrator |
| `integration.route` | integration_id, external_source, source_id, account_id, poster_id; administrator |
| `currency.define` / `currency.rate` | Disabled: USD-only organization policy; returns 400 |
| `bill.foreign` | Disabled: use `bill.post` with USD amounts; returns 400 |
| `supplier.create` / `supplier.state` | code, name, contact / id, kind (`active`/`inactive`), reason; administrator |
| `item.create` | code, name, unit, category; administrator |
| `po.create` | Also accepts supplier_id; canonical name and active identity are checked |

Protected reads: `/api/projects/{id}/work` (expenses, vouchers, discussions, grants and adjustment proposals), `/api/inbox`, `/api/catalog`, `/api/currencies`, `/api/my-work` (own employee/leave/payslip references), `/api/hr` (HR/payroll role), `/api/payslips/{run}/{employee}` (own employee or HR/payroll), `/api/integrations` (administrator), `/api/procurement/{po|voucher}/{id}` (all participating memberships; payroll vouchers also require HR/payroll). Reports and CSV include expense/payroll liabilities and payments, aggregating salary dimensions without employee identities.

Organization sign-in: public `GET /api/auth/options`; `POST /api/oidc/start` sets a protected temporary cookie and returns authorization URL; `GET /api/oidc/callback` validates the bound code; `POST /api/oidc/finish` verifies local MFA/recovery when needed. Identity must map to an already provisioned ERP user; claims never confer ERP roles. `/api/login` also accepts optional `otp`.

The signed funding-event endpoint/outbox protocol is in the runbook. Secrets, passwords, authenticator codes and HR/payroll inputs are excluded from audit details. Restricted business evidence is retained separately.

Administrator-only `GET /api/jobs` reports background scan status, interval and explicit transport enablement without disclosing provider secrets. Scheduler ticks do not overlap, financial balances are unchanged by scans, and shutdown awaits active work.

USD-only policy: `/api/config` includes `currency: "USD"` and `currency_scale: 2`. Optional currency declarations on actions, including nested allocations, must be `USD`. Signed funding events also reject non-USD currency before posting. `/api/currencies` is a compatibility read returning the fixed USD definition, with no rate or foreign document tools.

## Compensation and inventory operations (0.4.0)

- employee.create accepts pay_basis (monthly/open/project), optional end_date/prorate, allowances[{name,amount,taxable,prorate}], deductions[{name,amount,prorate}], employer_benefits[{name,amount,prorate}]. Monthly pay requires monthly_salary; hourly is rejected.
- employee.terms.submit takes employee_id, effective_date (month start for legacy employees; any effective day for managed Stage 3 employees), complete terms and reason; employee.terms.approve takes id. HR submits; an independent payroll officer approves.
- payroll.submit employees accept gross_pay for open pay or project_pay[{project_id,source_id,category,activity,amount}] for project pay. Existing monthly allocations remain supported. POST /api/payroll/preview provides protected, side-effect-free exact cost/allocations. GET /api/payroll/{id}/register[.csv] is HR/payroll restricted. leave.decide accepts optional paid boolean.
- warehouse.create takes project_id, code, name.
- inventory.submit takes project_id, kind (receipt/issue/transfer/count/return), reference, date, reason, optional documents and lines. Receipt lines: warehouse_id,item_id,bill_line_id,quantity,amount. Other lines: warehouse_id,lot_id,quantity and transfer to_warehouse_id. Count quantity is the actual observed count; other quantities are positive amounts moved. Issue requires recipient.
- inventory.approve/post/cancel take id (cancel also reason). inventory.reverse takes id,date,reference,reason and optional authorization_id. journal.reverse routes stock journals to the same controlled reversal.
- GET /api/projects/{id}/inventory[.csv] takes optional to/source_id/category filters; project membership is required. Financial reports/dashboard include inventory and inventory_variance with source journals. Inventory approvals use the existing journal policy with separate stock approval records.

## Stage 3 HR APIs (0.5.0)

Read endpoints: `GET /api/hr/stage3`, `/api/hr/reports[.csv]?from=YYYY-MM-DD&to=YYYY-MM-DD`, `/api/hr/documents/:id`, `/api/hr/attendance-imports/:id`, `/api/hr/payment-details/:id`, `/api/hr/batches/:id.csv`, `/api/projects/:id/salary-costs[.csv]?from=YYYY-MM-DD&to=YYYY-MM-DD`. Private payroll register and payslip endpoints remain unchanged. `POST /api/hr/payroll/preview` accepts the managed payroll input below. All require authenticated sessions; every response/download/export enforces capability, employee and project scope.

New audited/idempotent `/api/actions` names: `hr.role`, `hr.schedule`, `hr.holiday`, `hr.profile`, `hr.payment.submit/approve`, `hr.document`, `hr.attendance.correct/approve/import/import.approve`, `hr.timesheet.submit/approve/cancel`, `hr.leave.policy/policy.approve/enroll/cancel`, `hr.period`, `hr.allocation.submit/approve`, `hr.overtime/overtime.approve`, `hr.salary-advance.submit/approve/post/return`, `hr.payroll.submit`, `hr.batch/batch.post`, `hr.reminders`.

Managed payroll data: `{reference,period_id,rule_id,employees:[{employee_id,basis:"fixed",allocation_plan_id,advance_recoveries:[{advance_id,amount:"100.00"}]}]}`. For project time allocation use `basis:"timesheet"`; approved sheets are resolved by employee/period. For open/project compensation supply `gross_pay` as decimal USD text. `replaces_id` must refer to fully reversed payroll for the same pay period. Existing `payroll.approve/post`, voucher actions and `journal.reverse` continue the lifecycle. Salary advance input includes employee, project/source/category/activity, cash account, decimal amount, date/reference/reason and `repayment_schedule:[{period_id,amount}]`.

Allocation plan lines use decimal-text `percent` (up to four places), valid funding dimensions and `components:["*"]` or explicit component names; total is 100. Leave policy minutes and eligibility/expiry integers, effective dates, paid boolean and provisional/demo/validated status are explicit. A validated policy needs `validation_reference`. Amounts are never floating-point API numbers. No device/bank integration is implied by these local interfaces.

## Organization accounting (0.6.0)

Authenticated GET routes: `/api/accounting` (scoped role/setup overview), `/api/accounting/reports/:kind` and `.csv` (`from`, `to`, `compare_from`, `compare_to`, `project_id`, `source_id`, `account_id`), `/api/accounting/reconciliation?to=YYYY-MM-DD`, `/api/accounting/periods/:id`, `/api/accounting/assets` and `.csv` (`to`), `/api/accounting/evidence/:id` (private download and audit). Report kinds: `trial_balance`, `general_ledger`, `position`, `income_expenditure`, `cash_flow`, `payables`, `payroll`, `advances`, `funds`, `project_statement`, `budget`. Financial routes require accountant/approver/auditor; administrator-only setup grants no implicit posting right.

Use the existing CSRF/session-protected `/api/actions` and required Idempotency-Key: `acc.role`, `acc.account`, `acc.mapping`, `acc.book`, `acc.year`, `acc.period`; `acc.fund.policy` and `.approve`; `acc.manual`, `acc.opening`, `acc.funding.submit`, `acc.transfer`, `acc.opening.settle`; `acc.document.approve`, `.post`, `.cancel`; `acc.close.authorize`, `acc.period.close`, `.reopen`, `.reopen.approve`, `acc.year.end`, `.end.approve`; `acc.asset.register`, `.approve`, `.cancel`, `.custody`, `.policy`, `.policy.approve`, `.depreciate`, `.dispose`. Corrections use existing `journal.reverse` and locked-period authorization. Money is decimal USD text, input details are in the [runbook](stage4-runbook.md); normal funding receipt additionally requires explicit `treatment` matching an approved source policy when fiscal accounting is enabled. No non-USD boundary is enabled.

## Employee lifecycle (0.7.0)

GET /api/people accepts from/to/employee_id/project_id and returns a backend-scoped snapshot; GET /api/people/report.csv exports the same permitted lifecycle report; GET /api/people/files/:id downloads authorized encrypted evidence and audits access. Monetary payload fields are decimal strings in USD. Protected record IDs never grant permission by themselves.

POST /api/actions retains authentication, same-origin checks and Idempotency-Key. Lifecycle actions: el.role/policy/retention; el.staffing.submit/review/approve, el.vacancy, el.candidate, el.application, el.interview/cancel/score, el.hiring.decision, el.offer.submit/approve/response, el.candidate.convert, el.withdraw; el.template, el.case.start, el.task, el.probation.start/review/approve, el.equipment/return, el.access.request/approve/apply; el.review.cycle/create/step; el.training.submit/approve/purchase/attendance, el.qualification; el.change.submit/approve, el.self.request/review; el.departure.submit/approve/advance/liability/close; el.final.policy, el.final.policy.approve, el.final.payroll, el.final.review, el.final.review.approve; el.reminders. Use the native forms and src/people-*.js for field schemas; no external provisioning endpoints are claimed. Final payroll approval/posting/payment uses existing payroll/voucher actions.

## Operational completion (0.8.0)

Authenticated POST /api/operations/entitlements calculates a scoped preview from departure_id, policy_id, optional leave_enrollment_id, leave_cashout_agreed, leave_reviewed_no_balance, monthly_equivalent/equivalent_evidence and notice_amount/notice_evidence. POST /api/providers/:id/verify and /api/providers/smtp/verify are Administrator-only protocol/authentication probes; neither sends invitations nor email.

The audited idempotent action dispatcher adds ops.setup, ops.role, ops.rehire.submit/approve, ops.policy.somaliland, ops.retention.submit/approve/hold/run, ops.provider.configure/provision/calendar. Request schemas are the native forms and src/operations-*.js. Retention defaults to dry_run:true; execution needs dry_run:false and administrator authority. Approvals, due dates, financial clearance and legal holds are checked on the server. New el.final.payroll fields select statutory evidence; formula policies reject caller-supplied adjustment replacements. Provider inputs contain credential variable names, never secret values. GET /api/people adds scoped episode, policy, retention and provider states/receipts. Files removed by approved retention return 410 after authorization. See [runbook](operations-runbook.md).

## Release controls (0.9.0 / schema 12)

Unauthenticated GET /healthz checks database responsiveness only. Existing /api/health retains proxy protection. Administrator /api/jobs adds restricted backup-age/status and quarantine indicators. Authenticated idempotent actions add user.access (another user_id, explicit enabled boolean, reason) and password.reset.issue (another user_id and current_password); the returned one-use token has a 15-minute lifetime and encrypted operation receipt. Public same-origin POST /api/password/reset takes token/new_password, is throttled and transactionally invalidates tokens/sessions without changing MFA. Privileged production sign-in requires session assurance from validated local MFA or configured signed OIDC assurance. Invalid/prototype operation names cannot resolve handlers. Restored quarantine blocks external integrations, provider probes/jobs, SSO and automatic retention even with live process credentials. [Operating guide](stage6-operations.md).


## Guided workflows0.14.0

Guided receipt/payment/collection/advance/settlement/return screens submit existing org.document operations; employee registration uses employee.create. Approval and posting remain separate existing actions. No new write endpoint or database migration is introduced. Organization overview advance items and financial-report advance rows include settled and returned USD decimal strings derived from posted, non-reversed movements at the reporting date. Internal orgItems calculations retain integer cents. Protected HR documents continue through hr.document after successful registration.
# Dashboard overview (0.15.0)

Authenticated GET `/api/dashboard/bootstrap` returns compact role capabilities only; `/api/dashboard` returns authorized aggregate cards, charts and bounded panels. `/api/dashboard/records` returns source pages; `/api/dashboard/journals/:id` returns scoped posted lines, excluding private payroll source details. These are read-only routes; all writes retain the existing action/idempotency/approval controls. The existing `/api/projects/:id` project-detail contract is preserved.

Filters: ISO `from`/`to`, `scope=all/general/projects`, `project_id`, `source_id`, `org_fund_id`, department name, `cost_centre_id` and optional `budget_threshold` (0–100). Omit absent/null query values. Non-accounting actors are restricted to assigned project scope; organization/funding dimensions require accounting permission. Source kinds: `cash`, `unrestricted_cash`, `expenses`, `commitments`, `payables`, `advances`, `approvals`, `limits`, `activity`. Pages accept `page`, `page_size` (1–25, default 8), and literal reference search `q` (100 characters maximum). Salary references cannot be searched through this route. Full exports remain in the existing authorized reports.

See [interface guide and bounds](interface-redesign.md).

