# Render Node API + Supabase + Vercel

Updated 3 November 2026. The synthetic Supabase database, restricted runtime connection and MFA administrator authentication are initialized and verified. The corrected Render service passed HTTPS health/access controls; Vercel frontend/API health plus automated Chromium MFA login, dashboard, secure session and sign-out passed. Human findings, complete financial/attachment flows, restart persistence and recovery remain pending. See [measured target status](supabase-staging-status.md) for current evidence and owner actions. Setup steps below remain the configuration reference, not additional service-creation instructions.

The selected architecture has three parts:

- Vercel serves the interface and proxies `/api`.
- Render runs the existing Node24 API, using the existing generated asynchronous PostgreSQL runtime.
- One isolated synthetic Supabase PostgreSQL database holds financial/HR records, encrypted attachments, sessions and audit history.

No SQLite database is created or copied to Render. Files on the Node service are build artifacts and disposable local state. Record keys and connection credentials remain in service-managed secret files and separate recovery storage, so restarting/releasing the service does not create another ledger or regenerate keys. No live payments, external integrations or background jobs are enabled by this preparation.

## Start here

1. Sign in at [Render](https://dashboard.render.com) and connect the GitHub account that owns `khalelmoh/Solio-Erp`.
2. Confirm an isolated synthetic Supabase project is available. Do not use the saved local database or the paused guided-UAT database. Follow [Supabase staging setup](postgres-staging.md) for the dedicated private schema, restricted runtime login, separate migrator, verified TLS and required database settings.
3. In Render choose **New > Blueprint**, select `khalelmoh/Solio-Erp`, branch `main`, and use root `render.yaml`. The user selected **Free** for initial synthetic testing; the prepared API now uses `plan: free`. Confirm the service preview shows Free before creating it, and choose its region near the Supabase database. No Render PostgreSQL database is included. If the old paid-plan billing screen remains, return to the repository selection and reconnect to load the updated Blueprint. Any remaining account-verification request is separate from this source configuration; no payment method or upgrade has been authorized here.
4. The native runtime must be **Node**, not Docker. The existing root Dockerfile is a separate SQLite deployment option. Build command: `npm ci --include=dev && npm run build:postgres && npm prune --omit=dev`. Start command: `node scripts/start-private-staging.js`. Health path: `/healthz`. The Blueprint already sets these values, port10000 and host0.0.0.0.
5. Set `ERP_PUBLIC_ORIGIN` to the actual Vercel/custom frontend HTTPS origin, without `/api` or another path. Set `ERP_PROXY_SECRET` privately to a strong random value of at least32 characters; Vercel must receive the identical value. Do not use an example value or send it in chat.
6. In the service's **Environment > Secret Files**, add `erp_postgres_runtime_url` containing the restricted runtime PostgreSQL URL, `erp_record_key` containing the stable64-hex-character record key, and `erp_postgres_ca` containing the downloaded Supabase CA certificate. They are read from `/etc/secrets/`. The Blueprint sets `ERP_POSTGRES_CA_FILE=/etc/secrets/erp_postgres_ca`; add that variable manually to an already-created service if it is absent. The URL and record key must remain identical across releases and match the migrated database. The actual Supabase pooler required this CA during verified connection testing; never disable certificate verification. Add all required files before saving, because saving secret files can trigger a deployment.

The first startup fails clearly until the database, migrations and secret files are ready. Keep the deployment manual while preparing them; `autoDeployTrigger` is off. Do not replace these prerequisites with a local database or unprotected owner credentials just to make the health check green.

### Session-cookie startup correction

The user-supplied Render log for commit57680bc showed a successful build followed by `Invalid application session cookie name`. The Blueprint incorrectly supplied `solio_staging_session`; the existing application requires the `erp_` prefix. Set **ERP_SESSION_COOKIE=erp_solio_staging_session** on the already-created Render service and redeploy the latest commit. The corrected Blueprint and shared preflight validation preserve the existing cookie policy and prevent this failure before opening a database connection. Do not assume a source change has replaced an existing dashboard environment override.

The regression uses the actual Blueprint cookie to start an isolated API, sign in and verify HttpOnly/Secure/SameSite settings and separation from the ordinary ERP cookie. Invalid cookie values are also rejected by private-staging preflight. No database migration or financial correction is required for this defect.

### Optional password-only synthetic administrator (0.16.1)

The account owner requested removal of the authenticator requirement for the online synthetic staging administrator. This is an account-specific exception, disabled by default. On the existing Render service, set `ERP_STAGING_PASSWORD_ONLY_ADMIN_EMAIL` to the exact staging administrator email, retain `ERP_STAGING_SYNTHETIC_ONLY=true` and `ERP_TRANSPORTS_ENABLED=false`, and deploy0.16.1. Do not set this backend-only variable on Vercel. Startup rejects the option outside synthetic-only mode or without explicitly disabled transports. Other privileged accounts retain production MFA enforcement; explicit organization-wide MFA policies still take precedence.

Configuration alone does not remove an existing MFA enrollment. After deployment, sign in through the normal existing MFA flow and invoke the authenticated `mfa.staging.disable` operation for that account with its current password and a reason. The operation cannot target another user. It removes the enrollment, invalidates recovery codes and remembered OTP counters, revokes that user's sessions, and records the normal immutable audit/operation receipt. Verify a fresh password-only login, secure cookie and logout afterward. Do not clear organization MFA controls, weaken cookie/TLS/proxy protections or edit the database directly. The authenticator field remains optional for accounts without enrollment. Enrolling MFA again restores the challenge even while the exception setting exists.

Verification:26 selected SQLite/configuration checks passed, plus the compiled native PostgreSQL regression on a disposable local schema. It covers wrong-password/non-designated-user rejection, non-synthetic and outbound-enabled refusal, explicit MFA-policy precedence, session/recovery revocation, audit redaction and password-only authentication. After the user deployed0.16.1, actual online enrollment removal, prior-session401, password-only sign-in, secure cookie and logout passed through Vercel. The private receipt is `.cache/staging-admin-mfa-removal-evidence.json`. No schema migration or financial transaction was involved. Keep the retired MFA enrollment/recovery file private; its credentials are no longer active.

Actual Chromium password-only login with a blank code field, dashboard, secure cookie, visitor401 and sign-out also passed with no JavaScript/API5xx errors. See `.cache/vercel-browser-evidence-password-only.json`. This is technical account verification, separate from human acceptance and real-record authorization.

## Free test-host limitations

Free is selected only for the initial synthetic walkthrough. Render sleeps an idle Free web service after15 minutes and waking it can take about a minute. Usage limits and external database traffic can also affect availability. It offers no persistent disk, shell access or one-off jobs, so migration/bootstrap remain protected administrative tasks outside the service. The single Supabase database and service-managed secret files hold durable state; local service files are disposable. Always-on staging, scheduled backup delivery and any pilot require separately reviewed hosting and target checks. See [Render Free limits](https://render.com/docs/free).

## Database preparation

Use the existing [PostgreSQL staging runbook](postgres-staging.md). The prepared API requires `max_locks_per_transaction>=512`, a direct/session connection (not transaction pooling on6543), all four checksum-verified migrations, forced RLS, the constrained backend role and the matching record key. Verify that the chosen Supabase project supports these requirements before provisioning dependent services. If the setting or role restrictions cannot be satisfied, leave staging unverified and resolve the provider configuration first.

Run migrations from a protected administrative environment with **separate migrator credentials**, using `node scripts/postgres-migrate.js`; do not put owner credentials into the API service. Then use the runtime credentials with `node scripts/postgres-tools.js preflight`. No automatic migration, restore or seed operation is part of the Render build/start commands. The existing synthetic migration/recovery rehearsal remains separate from this new target.

For an empty migrated target, create the first administrator deliberately using `node scripts/postgres-tools.js init` in the protected administration environment. Supply the approved account details and an unused private `ERP_ADMIN_MFA_SEED_FILE`; retain enrollment/recovery information securely. Never commit credentials or reuse the local demonstration/super-admin password. Remove temporary bootstrap credentials after enrollment. Configure separate roles and synthetic setup before testing transactions.

## Connect Vercel after the API is healthy

1. Verify Render `/healthz` succeeds and protected `/api` requests without the proxy secret are rejected. The actual assigned Render/custom HTTPS URL is the backend origin; do not assume a name or copy the Supabase project URL.
2. In **Vercel > Solio-Erp > Settings > Environment Variables**, set `ERP_BACKEND_ORIGIN` to that backend HTTPS origin. Enable it for the deployment environments being used. Set matching `ERP_PROXY_SECRET` privately on Vercel. PostgreSQL credentials and record keys stay on the backend.
3. Redeploy Vercel. Verify same-origin `/api/health`, HTTPS, authentication/MFA, cookies and protected attachments. Enable approved private frontend access/deployment protection. Direct API requests remain protected by the shared proxy secret and normal user authorization.
4. Confirm financial reports, exports and source references, restart/redeploy persistence, attachment retrieval, and restoration to a separate synthetic environment. Test scheduled encrypted offsite backups and delivered failure alerts before any real-record pilot. The Blueprint adds no backup scheduler, offsite storage or alert service; these remain explicit target checks and configuration.

Live payroll/banking, jobs, real employee/financial records, human acceptance and pilot authorization remain separate gates. A successful frontend build alone establishes none of them.

## Current verification

Seven focused local checks pass: Vercel static export/proxy, staging configuration guards and the Blueprint cookie startup/login regression. The dedicated startup rejects missing provider/SQLite fallback, non-synthetic mode, enabled jobs/transports, invalid session-cookie names, unsafe cookies/TLS, missing secrets and incorrect host/origin. A subprocess check confirms missing configuration does not create a SQLite ledger. The existing async runtime is built from the same domain; financial operations are not changed. The rebuilt API also passed local HTTP startup, proxy rejection, MFA login, secure cookie isolation and logout against the actual Supabase connection. This does not establish Render HTTPS success.

Supabase target lock configuration, migrations001-004, forced RLS on276 application tables, restricted runtime login, matching record key, initial administrator/MFA authentication and empty-ledger preflight passed on 3 November2026. These are database/application checks from the protected administration environment; they do not prove Render startup, frontend routing, restart persistence, full target financial scenarios, scheduled recovery or human acceptance. Those checks remain pending. Credentials are not present in this repository. The npm cache-dir warning is incidental to the missing API destination; the Vercel build intentionally continues to fail until the real `ERP_BACKEND_ORIGIN` is set.

References: [Render Blueprint fields](https://render.com/docs/blueprint-spec), [secret files](https://render.com/docs/configure-environment-variables#secret-files), [Node web services and port binding](https://render.com/docs/web-services#port-binding).
