# Supabase private staging status

Actual 0.16.2 Chromium authentication checks passed on 7 November 2026: scoped password-only sign-in/dashboard, secure cookie, visitor rejection, sign-out and post-logout 401; jobs/transports disabled and zero JavaScript/API 5xx errors. Private receipt `.cache/vercel-browser-evidence-password-only-0.16.2.json`. No financial records submitted. User performance findings remain pending.

Performance release 0.16.2 is verified live on 7 November 2026: actual API health reports that version, PostgreSQL and synthetic-only mode. The same warm Chromium workload now measures Finance 9.1s and HR 13.7s, versus 76.4s and 64.1s before (API calls 17→3 and 15→6). Frontend-only intermediate measurements were 15.7s and 21.9s. Selected workspace reads, bounded PostgreSQL snapshot reuse and role batching are deployed. [Measured report and remaining limitations](navigation-performance.md). Initial health took 24.3s; idle-start availability is not established. No schema migration or financial-record change. User performance findings, target financial/attachment flows, persistence and recovery remain pending. Initial human sign-in acceptance is preserved separately; earlier dated updates below are historical.

Update 5 November2026: the published/local feature discrepancy was an incomplete capability profile, not different interface code. Both actual servers report0.16.1 and all26 public assets match after CSS line-ending normalization. The selected staging administrator now has the existing full organization capabilities through audited role assignments. Actual Chromium verified Finance/HR/payroll/lifecycle menus, Finance bill entry and HR employee registration with no JavaScript/API5xx errors. Existing project directory/membership/cash fingerprints remained unchanged. The cloud database still has zero projects; project-specific navigation requires a project and membership. [Comparison and correction](staging-feature-access.md) records limitations and next actions. Fresh human observation of these newly visible features remains pending.

Measured 3 November 2026 against the newly created synthetic Supabase project in Ireland (`eu-west-1`). Saved SQLite, the local PostgreSQL preview and paused guided UAT were not used as migration sources or changed. No real records or external financial transactions were entered.

Latest authentication change: the owner requested password-only access for the one online staging administrator and deployed release0.16.1. Actual HTTPS health confirmed that release, PostgreSQL and synthetic-only mode. The authenticated `mfa.staging.disable` operation succeeded, previous-session access returned401, and fresh password-only sign-in with a secure cookie plus logout passed. The enrollment is removed; old recovery codes are invalidated. Private receipt: `.cache/staging-admin-mfa-removal-evidence.json`.26 selected SQLite/configuration checks and one compiled native PostgreSQL regression passed before release. The exception is rejected outside synthetic-only mode with explicitly disabled transports and does not override explicit organization MFA controls. See [procedure](render-staging.md#optional-password-only-synthetic-administrator-0161).

The follow-up actual Chromium check also passed with the authenticator input blank: dashboard rendering, secure frontend cookie, isolated unauthenticated visitor401 and sign-out. Jobs/transports remain disabled, with zero browser JavaScript errors and zero API5xx responses. Private receipt: `.cache/vercel-browser-evidence-password-only.json`; screenshots use the `-password-only` suffix so earlier MFA evidence is preserved.

Human observation, 3 November2026: after receiving the password-only staging login instructions and being asked whether the dashboard opened successfully, the conversation user replied **“yes it did.”** Record this as user-reported passage of the staging sign-in/dashboard-access check only. Technical removal and this specific human check are complete. Remaining financial/role/attachment workflows, recovery, policies and pilot authorization require their own evidence.

## Passed on the actual Supabase database

- Session pooler connection on5432, with CA and hostname verification enabled. The database password was verified after the user corrected the protected local setup file.
- Effective `max_locks_per_transaction=512` verified by SQL.
- Existing canonical migrations001-004 applied in the migrator transaction; all recorded checksums matched. No new ledger or duplicate schema implementation was introduced.
- All276 application tables have enabled and forced row-level security. `anon`, `authenticated` and `service_role` have no ERP schema usage. Migration/key metadata remains separately protected.
- Separate restricted API login connects successfully; startup checks reject ownership/CREATE and privileged role flags. Record-key fingerprint matches the stable external key. The database owner credential is excluded from the runtime URL.
- A new staging administrator was bootstrapped through the existing application, with encrypted MFA enrollment and a bootstrap audit entry. Password-only login was rejected; password plus authenticator code succeeded and the test session was logged out. Credentials and enrollment/recovery material remain in ignored protected files.
- Existing application preflight reports balanced journals and validated foreign keys. There is one administrator, zero projects and zero financial journals. This checks an initialized empty ledger; it does not establish financial scenario acceptance.
- An isolated compilation produced55 runtime files and984 asynchronous functions from the canonical application source. The local preview runtime was not replaced or restarted.
- After correcting the staging cookie configuration, the rebuilt HTTP API started locally against the actual constrained Supabase connection. Health, proxy-secret rejection, unauthenticated rejection, MFA login, secure cookie flags, cookie isolation and logout passed. Financial journals and projects remained zero. The private receipt is `.cache/supabase-http-evidence.json`; this is not a Render-hosted HTTPS test.

Private measurement receipts are in ignored `.cache/supabase-target-preflight.json`, `.cache/supabase-initialization-evidence.json` and `.cache/supabase-bootstrap-evidence.json`. Secret files and receipts are not release artifacts or source-control inputs.

## Actual Render HTTPS verification

On 3 November2026 the user supplied `https://solio-erp-staging-api.onrender.com` after reporting a successful deployment. Measured checks passed: `/healthz`200; direct API health without the proxy secret403; project access with proxy trust but no user session401; trusted API health200, build0.16.0, PostgreSQL and synthetic-only; cross-origin login403; administrator MFA login200; secure HttpOnly/SameSite=Strict session cookie; authenticated configuration/jobs access200; jobs/transports disabled; logout200. No financial transaction was submitted. Private timings and instance identity are in `.cache/render-target-evidence.json`. These are actual Render HTTPS results, separate from the preceding local HTTP checks.

Before the frontend redeployment, the Vercel homepage and `/api/health` both returned404. The user then configured the actual Node origin and reported successful deployment. Fresh checks returned200 for both, with the same backend instance identity as the Render measurement, PostgreSQL provider and synthetic-only mode.

## Actual Vercel browser verification

An isolated Chromium session on `https://solio-erp-ochre.vercel.app` verified the deployed login page, absence of local demonstration controls, administrator MFA sign-in, dashboard rendering, a frontend-domain HttpOnly/Secure/SameSite=Strict cookie, authenticated configuration and disabled jobs/transports. A separate unauthenticated browser context received401. Browser sign-out returned200 and subsequent authenticated access received401. There were zero uncaught JavaScript errors and zero API responses with5xx status. No financial record was submitted. The administrator dashboard correctly limits financial scope until separate Finance/project capabilities are assigned; it is not preloaded with local demonstration balances.

Private receipts are `.cache/vercel-public-evidence.json` and `.cache/vercel-browser-evidence.json`; login/dashboard screenshots are `.cache/vercel-staging-login.png` and `.cache/vercel-staging-dashboard.png`. No traces, session exports, passwords or enrollment seeds are published. These are automated checks, not human acceptance or a complete financial/recovery release signoff.

## Exact next actions

| Owner | Action | Evidence still required |
| --- | --- | --- |
| Hosting administrator | Preserve the verified Render configuration and stable secret files across releases. | Initial HTTPS health, proxy/origin rejection, MFA and disabled jobs/transports passed. Restart/redeployment persistence and full transaction/attachment flows remain pending. |
| Staging administrator / reviewers | Configure separate approved Finance, HR and project-management responsibilities, then resume the remaining synthetic review scenarios one at a time. | Initial staging login/dashboard access passed by user report. Release0.16.1, audited removal and API/browser session checks passed. Other human findings, protected attachment journeys and frontend deployment-protection review remain pending. |
| Engineering/security | Review actual Data API exposed schemas, inherited grants and existing Storage policies/buckets. | Provider configuration receipt; current schema grants alone do not establish the full provider review. |
| Engineering/Finance | Run target financial, concurrency, export and attachment scenarios with separate synthetic role accounts, then restart/redeploy. | Target-specific source totals and persisted IDs/attachments; local tests are historical evidence only. |
| Hosting/recovery owner | Configure scheduled encrypted backups, independent key custody and an authorized failure-alert destination; restore into a separate isolated environment. | Delivered failure alert, restored authentication/attachments/audit/balances and measured recovery results. |
| Business reviewers | Resume outstanding guided acceptance scenarios and record actual observations. | Human findings, separate from automated technical checks. |
| Policy/pilot owner | Validate applicable policies and explicitly authorize any real-record pilot. | No real-record or production authorization exists from this setup. |

Jobs and outbound transports remain disabled for initial staging. Render Free availability/scheduling limits remain unresolved for any always-on or real-record use. Human acceptance, financial/attachment journeys, restart persistence and Supabase recovery remain unverified.
