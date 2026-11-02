# Transaction workspace and first-use guide — 0.15.1

Updated 31 October 2026. These screens extend the shared interface released in 0.15.0. The application still uses one ledger, USD only and the existing authorization, approval, idempotency and period controls. This update adds read-only presentation endpoints and guided forms; it adds no financial posting operation, dependency or schema migration.

## Start a transaction

Open **Overview → Dashboard**. Every action has a short description and appears only for the applicable existing role.

| Action | What to enter or choose | What happens next |
|---|---|---|
| Record money received | Amount/date, approved funding source, cash account and evidence | Review, submit, independent approval, then Finance posting. Project-only Finance uses the project receipt workflow and its existing controls. |
| Create supplier bill | Supplier/invoice, amount/due date, budget/category, funding and attachments | Review before submission. An organization bill needs independent approval and posting; a project bill must consume an approved purchase commitment. |
| Pay an approved bill | Choose a posted, unpaid bill, then amount/date/account and payment evidence | The payment has its own approval and posting. It reduces cash and the payable; it does not repeat the expense. |
| Request an advance | Responsible person/supplier, due date, amount, eligible budget/funding and evidence | Review and independent approval reserve budget. Disbursement reduces cash and creates an advance, not an expense. Project members use their assigned-project request workflow. |
| Settle an advance | Choose an issued advance, accept supported expenditure or return unused funds | Accepted expenditure reduces the advance and records cost without paying cash again. A return restores cash. The cash-return account appears only for a return. |
| Create project | Code/name, department, dates, activities and description | Review before creation. Existing server policy permits an authenticated creator to become its manager; this is not an administrator-only action. |
| Request leave | Your approved entitlement (where configured), dates and reason | Review before submission. A different authorized HR reviewer decides the request. No salary or cash is posted. |

Project-only Finance accounts receive project receipt, bill, payment and settlement shortcuts. General operating transactions use the organization workflows. These routes do not introduce a dummy project or grant new financial permission. A transaction that requires setup explains what is missing; it does not post an empty or placeholder record.

Bills/receipts/advances use the existing multi-step entry, attachment and review controls. Project requests, project receipts/bills/payments/advances, project creation and leave also include a review step. Validation failures keep the entered values and files. Preparation, independent approval and posting remain separate where the existing workflow requires them.

## Read the figures

The visible **Current scope** strip identifies the whole organization, general operations or authorized project selection, with dates and extra dimensions. It stays visible in supporting-record dialogs and full detail pages. A detail page retains the report context and separately states the actual source allocation, so a general-operation record is not mistaken for a project cost.

- **Cash balance** is money recorded in bank/cash/mobile accounts through the cutoff. A filtered project figure is an allocation of that money, not an extra bank balance.
- **Available budget** is approved authority less actual budget charges and all purchase, advance and payroll reservations. It is not cash. Parent envelopes are excluded from consolidated authority.
- **Commitments** are approved purchase/spending reservations not yet charged. Advance/payroll reservations appear separately in underlying budget values.
- **Expenses** are posted expense accounts in the period. Asset purchases can consume budget without being an immediate accounting expense.
- **Unpaid liabilities** are amounts still owed. Posting a bill creates an expense/liability; payment reduces cash/liability without repeating the cost.

Every card retains its own period/cutoff explanation and source link. Restricted funding remains distinguishable. Unrestricted general cash is before obligations and is not asserted to be freely spendable authority.

## Open a source record

Use **View details** on an organization document, project spending request, bill, receipt or issued advance. **Open full detail page** is also available from quick source views. A consistent page contains status, amount, allocation/purpose, attachments, an approval timeline and permitted next actions. **Refresh status** fetches another reviewer's latest decision. **Back to workspace** retains the in-app context; **Print record** uses the shared print layout.

Organization bills and advances show balances plus linked payments/settlements/returns. Accepted advance receipts remain accessible through their linked source documents. The page shows at most the latest 50 related preparations, while full history remains in authorized reports. Timeline event times come from audit/approval records; missing legacy event timestamps are labelled rather than replaced with an accounting date.

Unavailable actions explain the reason, including pending independent approval, self-approval restrictions, insufficient operating budget, a closed period, a reversed source or a cleared balance. These are advisory read checks. Submission rechecks current budget, funding/cash, permissions and locks in the existing backend transaction. A visible button is not a waiver or guarantee that concurrent changes will allow posting.

Posted records remain immutable. Financial correction still uses the existing authorized linked-reversal/correction workflow. Individual payroll source details remain in the private payroll workspace.

## First-use setup

Expand **First-use setup checklist** on an authorized Finance/administrator dashboard. It links to accounts, opening balances, expense categories, funding policies, independent approval roles, budgets and open accounting periods. “Configured — review” means a source record exists; it does not certify its accuracy or policy validity. A missing opening journal explicitly requires Finance to establish whether opening balances are zero or need an independently approved posting; zero is not assumed.

Empty bill/advance/receivable screens explain the first record and approval/posting prerequisites. The login, shell, forms, record pages, reports, printable views and missing-page screen share the same design tokens. Synthetic environments and synthetic project records carry explicit labels; no demonstration figures were added to operational records.

## Organization identity

The actual organization name and approved logo have not been supplied. Product fallback branding remains in place. To apply approved branding, the backend operator sets:

```dotenv
ERP_ORGANIZATION_NAME=Your approved organization name
ERP_ORGANIZATION_LOGO_FILE=/private/config/approved-logo.png
```

The logo must be PNG, JPEG or WebP and at most 2 MiB. The local source path is never returned to the browser. Only approved public identity/image bytes are exposed by `/api/branding` and `/api/branding/logo`; database credentials and keys remain private. Identity is applied to login, navigation, document title and printable page footer. Supplied brand assets/colors still require actual organization input; the existing navy/teal palette is retained meanwhile. Screenshot names such as “Synthetic Journey Organization” are test-only configuration, not an invented organization identity.

## Implemented journey screenshots

These are actual synthetic browser captures, not mockups or human acceptance:

| Journey | Entry/review | Independent approval | Result |
|---|---|---|---|
| Bill $1,000 → payment $400 | [Bill entry](../artifacts/journey-03-bill-entry.png), [bill review](../artifacts/journey-04-bill-review.png), [payment review](../artifacts/journey-08-payment-review.png) | [Manager confirmation](../artifacts/journey-06-independent-approval.png) | [Posted bill detail](../artifacts/journey-07-posted-bill.png), [dashboard after payment](../artifacts/journey-09-dashboard-after-payment.png), [mobile record](../artifacts/journey-10-mobile-record.png) |
| Organization receipt | [Receipt review](../artifacts/journey-receipt-review.png) | [Receipt approval](../artifacts/journey-receipt-approval.png) | [Cash dashboard](../artifacts/journey-receipt-dashboard.png) |
| Advance $2,000 → accepted expenditure $1,500 → unused return $500 | [Advance review](../artifacts/journey-advance-review.png), [settlement review](../artifacts/journey-settlement-review.png) | [Advance approval](../artifacts/journey-advance-approval.png), [settlement approval](../artifacts/journey-settlement-approval.png), [return approval](../artifacts/journey-return-approval.png) | [After issue](../artifacts/journey-advance-dashboard.png), [after accepted receipts](../artifacts/journey-settlement-dashboard.png), [after unused return](../artifacts/journey-return-dashboard.png) |
| Employee leave | [Entry](../artifacts/journey-leave-entry.png), [review](../artifacts/journey-leave-review.png) | [Separate HR review](../artifacts/journey-leave-approval.png) | [Pending request](../artifacts/journey-leave-pending-dashboard.png), [after approval](../artifacts/journey-leave-approved-dashboard.png) |
| Project creation | [Project review](../artifacts/journey-11-project-review.png) | Existing project-creation authorization applies | Creation and unchanged financial balances checked automatically |

Also see [login](../artifacts/journey-01-login.png), [setup checklist](../artifacts/journey-02-setup.png) and the [printable record](../artifacts/journey-record.pdf).

## Verification and remaining limits

Current measured results and source hashes are in `artifacts/workspace-experience-release.json`. The complete SQLite run, final focused checks, native PostgreSQL accounting/permission tests and both providers' journey/browser evidence are reported separately; overlapping checks are not additive. All financial/HR testing uses disposable synthetic databases.

| Check | Passed |
|---|---:|
| Complete SQLite regression | 228 |
| Applicable native PostgreSQL accounting/permission regression | 37 |
| Final focused dashboard/detail checks | 14 per provider |
| Selected browser suites | 10 SQLite / 5 PostgreSQL |
| Static Vercel export and provider checks | 5 |

The static export includes the SVG favicon and shared404 page, with no unresolved branding placeholders. Its public name can be mirrored through the approved `ERP_ORGANIZATION_NAME` build setting. This packaging check is local; the actual Vercel/Supabase/private-host target remains unverified.

New read routes: authenticated `/api/setup-checklist` and `/api/record-details/{organization|request|bill|receipt|advance}/:id`; project records also require `project_id`. Public `/api/branding` exposes approved public identity only. Existing action, report/export and protected-document endpoints remain authoritative.

No migration is needed. Use Node24, the existing build procedure and `npm.cmd run test:experience` / `npm.cmd run test:browser:experience`. The PostgreSQL test runner includes these fixtures/journeys. The isolated preview remains **http://127.0.0.1:3005**; Ctrl+F5 and use the existing protected local login. It resumes its existing isolated database without root `.env`; jobs/transports remain disabled. Saved SQLite and paused port3003 UAT remain untouched.

Actual branding is pending the exact organization name/approved assets. Human usability acceptance remains pending actual reviewer observations. Large legacy project/obligation read models still materialize records server-side; specialist setup forms are not all guided wizards, and stateful detail pages currently use in-app navigation rather than shareable deep links. Full authorized exports remain available. Actual Supabase/private-host deployment and real-record policy/pilot authorization remain separate gates.
