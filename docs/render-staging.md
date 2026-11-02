# Render Node API + Supabase + Vercel

Prepared 2 November 2026. The failed Vercel build is caused by a missing hosted API, reported as missing `ERP_BACKEND_ORIGIN`. No backend host exists yet. This guide and `render.yaml` prepare the separate Node service; they do not provision or verify a live service.

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
6. In the service's **Environment > Secret Files**, add `erp_postgres_runtime_url` containing the restricted runtime PostgreSQL URL, and `erp_record_key` containing the stable64-hex-character record key. They are read from `/etc/secrets/`. They must remain identical across releases and match the key identity registered during migration. If the provider requires its CA, add the CA secret file and `ERP_POSTGRES_CA_FILE` pointing to it. Never disable certificate verification.

The first startup fails clearly until the database, migrations and secret files are ready. Keep the deployment manual while preparing them; `autoDeployTrigger` is off. Do not replace these prerequisites with a local database or unprotected owner credentials just to make the health check green.

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

Five local checks pass: Vercel static export/proxy and staging configuration guards. The dedicated startup rejects missing provider/SQLite fallback, non-synthetic mode, enabled jobs/transports, unsafe cookies/TLS, missing secrets and incorrect host/origin. A subprocess check confirms missing configuration does not create a SQLite ledger. The existing async runtime is built from the same domain; financial operations are not changed.

Render account access, Blueprint validation by the actual Render service, Supabase target configuration, database migrations and live deployment are still unverified. Credentials are not present in this repository. The npm cache-dir warning is incidental to the missing API destination; the Vercel build intentionally continues to fail until the real `ERP_BACKEND_ORIGIN` is set.

References: [Render Blueprint fields](https://render.com/docs/blueprint-spec), [secret files](https://render.com/docs/configure-environment-variables#secret-files), [Node web services and port binding](https://render.com/docs/web-services#port-binding).
