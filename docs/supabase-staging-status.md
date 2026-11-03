# Supabase private staging status

Measured 3 November 2026 against the newly created synthetic Supabase project in Ireland (`eu-west-1`). Saved SQLite, the local PostgreSQL preview and paused guided UAT were not used as migration sources or changed. No real records or external financial transactions were entered.

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

## Exact next actions

| Owner | Action | Evidence still required |
| --- | --- | --- |
| Hosting administrator | User reports all three secret files added. Correct the existing service's `ERP_SESSION_COOKIE` to `erp_solio_staging_session`, retain the CA path, and deploy the latest commit. | The supplied Render log confirms build success and the diagnosed cookie startup failure. Actual HTTPS API origin and successful `/healthz` remain pending; no privileged owner credential belongs in the API. |
| Hosting administrator | Set the actual API origin and matching proxy secret on Vercel; redeploy. | Same-origin API health, private access, secure cookies, MFA and protected downloads. |
| Engineering/security | Review actual Data API exposed schemas, inherited grants and existing Storage policies/buckets. | Provider configuration receipt; current schema grants alone do not establish the full provider review. |
| Engineering/Finance | Run target financial, concurrency, export and attachment scenarios with separate synthetic role accounts, then restart/redeploy. | Target-specific source totals and persisted IDs/attachments; local tests are historical evidence only. |
| Hosting/recovery owner | Configure scheduled encrypted backups, independent key custody and an authorized failure-alert destination; restore into a separate isolated environment. | Delivered failure alert, restored authentication/attachments/audit/balances and measured recovery results. |
| Business reviewers | Resume outstanding guided acceptance scenarios and record actual observations. | Human findings, separate from automated technical checks. |
| Policy/pilot owner | Validate applicable policies and explicitly authorize any real-record pilot. | No real-record or production authorization exists from this setup. |

Jobs and outbound transports remain disabled for initial staging. Render Free availability/scheduling limits remain unresolved for any always-on or real-record use. Actual Render/Vercel success, restart persistence and Supabase recovery are unverified.
