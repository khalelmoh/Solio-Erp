# Navigation performance — 0.16.2

The user reported minute-long selections on the published staging ERP. The warm-service baseline on5 November2026 reproduced this: Finance took76.4 seconds and17 API requests; HR took64.1 seconds and15 requests. The workload used the existing synthetic administrator with all configured organization capabilities and zero projects, moving Dashboard → Finance → Dashboard → HR, without submitting records. These measurements exclude idle-host cold starts and do not establish capacity for a populated production database.

## Implemented changes

Navigation loads the selected workspace and its real form dependencies. Finance fetches configuration, organization overview and the selected report; it no longer fetches HR, payroll, lifecycle, project inventory, integrations, statements and reconciliation together. Account security fetches configuration only. Project work, inventory and salary allocation details load only in their respective views. HR and lifecycle still receive the periods, pay rules and project allocation data their forms need. Independent reads run concurrently. Navigation generations stop late responses from restoring a previous workspace or private state after logout. Each selection and post-action refresh still obtains current server-authorized data.

PostgreSQL reuses bounded metadata reads inside the existing repeatable-read, read-only transaction only. Role checks share one query across the existing role tables. There is no cross-request or cross-user permission cache, and writable financial transactions bypass reuse entirely. Cached results are copied, including nested objects, dates and buffers, so read models cannot mutate a later caller's records. Each snapshot is limited to128 entries/256KiB; oversized results, volatile functions and non-metadata queries are excluded. Session configuration changes clear the metadata cache; commit/rollback discard it. The existing writer advisory lock, balanced posting, idempotency, period checks and approval separation are unchanged.

## Read-only database workload

The same five ERP reads were run against the existing synthetic Supabase database from the same administration host. Counts include driver query round trips, session setup and transaction boundaries. Single-run elapsed times are illustrative; query-count reductions are the stronger evidence. Payload sizes were unchanged in all five reads.

| Read | Before round trips | After | Before time | After time |
| --- | ---: | ---: | ---: | ---: |
| Dashboard bootstrap | 36 | 10 | 4.85s | 1.27s |
| Configuration | 53 | 25 | 7.13s | 3.18s |
| Dashboard | 58 | 42 | 10.28s | 5.37s |
| HR register | 41 | 22 | 5.51s | 2.79s |
| Organization overview | 27 | 17 | 3.63s | 2.15s |

These are actual Supabase reads through the locally compiled application, not Render request timings. Private receipts: `.cache/staging-read-performance-before.json` and `.cache/staging-read-performance-after.json`.

## Verification

- 36 selected SQLite/configuration tests passed, covering authorization, dashboard totals, source records, cookie/hosting controls, request plans, stale-response rejection and metadata-copy/bounds behavior.
- Native PostgreSQL verification included a40-case financial/report/access run; after role batching,17 contracts/dashboard/employee-access cases and3 focused MFA/snapshot cases passed (overlapping sets, not additive). Separate connections verified budget/payment/collection races, rollback, immutable audit/posting guards, original financial totals, snapshot consistency and permission freshness after commit/revocation.
- Nine isolated browser suites passed: original project workflow; advances/reconciliation/closure; guided organization finance; employee registration; payroll/inventory; Stage3 HR; employee lifecycle/final pay; workspace entry/approval/details/print; and bounded navigation with delayed-response races. The original financial example retained actual6000, commitment4000, remaining40000, liability2000 and cash36000.
- The navigation regression observed exactly3 Finance API requests and1 Account security request, while an earlier delayed Finance response could not replace a newer HR screen. The old project smoke assertion was updated to open the existing More actions menu before checking its shortcuts. A lifecycle final-pay dependency discovered during testing was restored and the complete lifecycle browser suite rerun successfully.
- JavaScript syntax checks passed. All write scenarios used disposable fixtures. The saved SQLite, paused local UAT and actual cloud financial records were not migration/test inputs or altered by the performance work. The local test PostgreSQL cluster was returned to its prior stopped state.

## Deployment and remaining measurement

The frontend and API remain compatible during deployment. Vercel builds the new static interface from GitHub; Render must deploy the latest0.16.2 commit to activate query reuse and authorization batching. No database migration, new credential or environment variable is required. Preserve the existing key, proxy and password-only synthetic-administrator settings. Local Node development servers also need an ordinary restart to serve a newly added module; this does not require resetting a database.

The source commit3d398cc was published and Vercel reported a successful deployment. The new workspace loader returned200 on the actual public domain. A second run of the same warm-service browser workload measured the frontend change while Render still reported0.16.1:

| Selection | Before | After frontend rollout | API requests before → after |
| --- | ---: | ---: | ---: |
| Finance | 76.4s | 15.7s | 17 → 3 |
| HR management | 64.1s | 21.9s | 15 → 6 |

Private receipt: `.cache/navigation-performance-after-frontend.json`. These are actual live browser measurements, not estimates. The backend query optimization is not yet active on Render: deployment0.16.2 and final timing/behavior verification remain pending. Hosting owner: open solio-erp-staging-api → Manual Deploy → Deploy latest commit, then report Live. No environment/key changes or migration are required. Role-separated human acceptance, real-record policies and scheduled recovery checks retain their existing pending statuses.
