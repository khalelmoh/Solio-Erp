# Published versus local feature access — 5 November 2026

The user reported that most features visible at `http://127.0.0.1:3000` were missing from the published site. Actual local and cloud health both reported0.16.1. All26 deployed public assets matched the current local production build:24 byte-for-byte, with only Windows/Linux line-ending differences in the two stylesheets. This was not a stale interface release.

The cloud account had only the base administrator flag, with no organization, accounting, HR or lifecycle capabilities and no project memberships. Navigation correctly used those capabilities to hide Finance overview and People/HR features. The local protected Super Admin credential was not accepted by the separate localhost3000 database during comparison, so its exact local role profile was not asserted or reset.

Following the user's existing request for full administrator access, the selected synthetic staging administrator was assigned the existing organization capabilities through16 authenticated, individually audited application role operations:

| Area | Capabilities |
| --- | --- |
| Organization | HR, payroll, auditor, integration |
| HR/payroll | HR staff, supervisor, payroll preparer, payroll approver, payroll finance |
| Accounting | Accountant, approver, auditor |
| Employee lifecycle | Hiring approver, review moderator, access officer |
| Retention review | Privacy officer |

No authentication bypass, ledger/schema change, source-code patch or redeployment was required. Existing project memberships, project directory and cash records had identical fingerprints before and after the grants. No financial action or local data import was submitted. Independent approval/period/budget controls remain the existing application rules; granting capabilities does not remove them. Outbound providers and automatic retention deletion remain blocked by synthetic staging.

Actual Chromium verification passed password-only sign-in, the whole-organization dashboard, Finance/HR/payroll/lifecycle navigation, the Finance & Accounting workspace with supplier-bill entry, and HR management with employee registration. No uncaught JavaScript errors or API5xx responses occurred; the test signed out. These are technical checks, with the user's observation after the change still pending.

The cloud database currently has zero projects. Project overview, budgets, funding, commitments, warehouse inventory and project reports require an actual project and authorized membership; local project records and balances were intentionally not copied into the isolated staging database. The next business setup is a synthetic project and separate Finance/HR/project-manager reviewer accounts, with their own responsibilities and approval separation.

To refresh the existing browser, sign out, press Ctrl+Shift+R, then sign back in with the existing protected staging credentials. Confirm Finance & Accounting and People & HR are present. No credential reset is needed.

Private evidence remains ignored: `.cache/deployment-comparison-evidence.json`, `.cache/workspace-role-comparison-evidence.json`, `.cache/staging-admin-capability-evidence.json`, `.cache/staging-features-browser-evidence.json`, and `.cache/staging-features-*.png`. No keys, passwords, session exports, private records or protected screenshots are published with this report.
