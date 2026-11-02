# Stage 6 release-readiness report

Latest follow-up: [Stage7 readiness register](stage7-readiness.md), build0.10.0, records the completed specific human walkthrough, project-list scaling fix and selected Supabase PostgreSQL + separate Node-host architecture. PostgreSQL implementation and actual target verification remain incomplete. This Stage6 report retains its historical evidence.

Date: **2026-10-18**. Build: **0.9.0 / schema 12**, USD only, monthly/open/project pay. Recommendation: **NOT READY for a real financial pilot or production.** The local application is ready for isolated synthetic UAT. Software verification has passed, but genuine policy approval, human acceptance and target operational verification remain gates.

## Requirements and actual completion

[47 requirement groups](stage6-coverage.md) map Stages 1–5 to screens, backend source, persistence, tests and remaining configuration. [CSV](stage6-coverage.csv) and [JSON](stage6-coverage.json) provide machine-readable coverage. The generator verifies referenced evidence files exist; it does not fabricate requirement or human signoff.

Core financial, inventory, HR, payroll, accounting and employee-lifecycle workflows use the real backend/SQLite database and functional native screens. Browser checks cover project/budget/funding/spending/PO/partial bill/payment/reconciliation/close; advances, returns, transfers, credits/refunds; recruitment/onboarding/leave/payroll/payment/departure; assets/depreciation; period correction and authorized reopening; rehire/retention and privacy. Eight distinct role accounts additionally exercise managed payroll without combining HR, preparation, approval, Finance or project-management rights.

SMTP/webhook and OIDC have local protocol-server tests; SCIM/CalDAV contract tests use mock network responses. Their UI states distinguish absent credentials, verification, queued/failed work and confirmed receipts. Actual provider delivery is **not verified**. Attendance CSV and bank/mobile-money reconciliation/batch exports work; device sync and provider-specific payment submission are disconnected/not implemented. Specialized opening-stock and pre-depreciated legacy-asset imports, GRNI, serial/expiry/manufacturing and statutory filings remain unsupported. FX and hourly base pay are intentionally excluded by the user's decisions. Current-budget and workflow-state reporting is not a reconstruction of historical approval states.

## Commands and evidence

| Check / actual command | Result | Evidence |
| --- | --- | --- |
| `npm.cmd test` on global Node25.2.1 | 180 passed, 0 failed | `artifacts/stage6-final-tests.txt` |
| Portable Node24.22.0 full test runner | 180 passed, 0 failed | `artifacts/stage6-node24-tests.txt` |
| `npm.cmd run test:browser` | All ten suites passed | `artifacts/stage6-final-browser.txt` |
| Same ten browser scripts using portable Node24.22.0 | All ten passed | `artifacts/stage6-node24-browser.txt` |
| `npm.cmd run check` | JavaScript syntax passed | `artifacts/stage6-final-syntax.txt` |
| Final focused access/job/financial checks | 23 passed, overlapping full suite | `artifacts/stage6-final-access-tests.txt` |
| Final logout/reset/retry and registration browser checks | Passed, overlapping ten suites | `artifacts/stage6-final-browser-privacy.txt`, `artifacts/stage6-final-registration.txt` |
| Final Node24 input/authentication checks | 6 passed, overlapping full suite | `artifacts/stage6-final-input-security.txt` |
| Final recovery guards | 2 passed, overlapping full suite | `artifacts/stage6-final-recovery-tests.txt` |
| Final Node24 privileged-role/audit checks | 4 passed, overlapping full suite | `artifacts/stage6-node24-security-final.txt` |
| Signed local OIDC assurance/step-up test | Passed; real provider unverified | `artifacts/stage6-identity-assurance.txt` |
| `npm.cmd ci --prefix .cache/stage6-clean-install --ignore-scripts --no-audit --cache .cache/npm` | Clean locked install passed; original dependencies untouched | `artifacts/stage6-clean-install.txt` |
| Same isolated clean install using portable Node24 and offline cached lockfile | Passed with the supported engine range | `artifacts/stage6-clean-install-node24.txt` |
| `npm.cmd audit --json --cache .cache/npm` | No reported vulnerabilities, including dev dependencies | `artifacts/stage6-final-dependency-audit.json` |
| `ERP_BACKEND_ORIGIN=https://backend.staging.example.invalid` then `npm.cmd run build:vercel` | Local static/proxy artifact built, no DB or secrets embedded | `artifacts/stage6-build.txt` |
| `node scripts/verify-release-financials.js` | Three numerical examples independently agree with posted rows, reports and CSV | `artifacts/stage6-financial-reconciliation.json` |
| `node scripts/verify-release-recovery.js` | Actual encrypted restore and application verification passed | `artifacts/stage6-recovery.json` |
| `node scripts/release-performance.js` | Configurable synthetic workload passed | `artifacts/stage6-performance.json` |
| `node scripts/verify-release-upgrade.js` then reviewed `node scripts/apply-release-upgrade.js` | Copy rehearsal and saved migration passed | `artifacts/stage6-upgrade-preview.json`, `artifacts/migration-0.9.0.json` |
| Portable Node24 `scripts/verify-live-release.js` | Saved UI/API, HR registration and financial totals passed | `artifacts/stage6-live-node24.txt`, `artifacts/live-0.9.0-verification.json` |
| Portable Node24 `--env-file-if-exists=.env scripts/preflight.js` | Exit1 / ready:false, as expected for local demo | `artifacts/stage6-readiness-node24.txt` |
| `node scripts/uat.js prepare` | Four role worksheets generated; human acceptance pending | `artifacts/uat/*.json` |
| Docker build, Linux image execution, real staging/TLS/provider/alert/offsite-recovery checks | **Not verified:** Docker engine and actual target access/configuration unavailable | See external gates below |

There are **180 distinct tests**; focused/runtime reruns overlap and are not added to that count. Historical artifacts remain available. An initial in-progress 170-test run passed156/failed14 because a new migration index referenced a nonexistent column. That defect was corrected, redundant indexes removed, and the final complete suite passed before the saved database upgrade. The original financial expected results were never relaxed.

The official portable Node24.22.0 Windows archive was downloaded from nodejs.org and SHA-256 checked against its official checksum file; its hash/path are in `artifacts/stage6-node24-runtime.json`. The global runtime was not changed. [Node's release guidance](https://nodejs.org/en/about/previous-releases) identifies Node24 as LTS and Node25 as EOL; this is why supported-runtime verification and an explicit Node24 local launch were added. Windows verification does not establish the Linux Docker or actual hosting target.

## Independent financial reconciliation

All figures below are USD; raw evidence records integer cents. The verifier queries posted source rows independently of dashboard totals and compares report/CSV output.

| Scenario | Independently verified result |
| --- | --- |
| Original project | Budget50,000; funding40,000; actual6,000; commitment4,000; available40,000; unpaid2,000; paid4,000; cash36,000 |
| Spending advance | Issue2,000; accepted expenditure1,500; returned500; outstanding0; actual1,500; net cash reduction1,500; no second settlement payment |
| Stage3 payroll | Gross1,000; recovery100; net900; project costs600/400; salary-advance control0; net salary cash900 |
| Stage4 accounting | Cash35,000; supplier liability2,000; expenditure7,000; net assets33,000; trial debit=credit42,000; supporting control differences0 |

No unexplained financial discrepancy or duplicate posting remains in the verified scenarios. Concurrency tests exercise real separate database connections for budget, cash, payments, reconciliation, inventory and candidate conversion. A killed process after journal creation but before COMMIT left no journal/operation receipt; retry posted once. Competing1500 payments against2000 unpaid allowed one payment and left500 unpaid. Role/session changes, approved-evidence edits, locked periods and closed projects remain enforced. The lost-response browser test commits a receipt, drops its response, reloads and retries the same form; it produces one journal and unchanged totals after retry. This is retry recovery, not offline financial posting.

## Security findings and fixes

| Finding | Delivered control / verification | Remaining boundary |
| --- | --- | --- |
| Restart-local authentication throttles | Persistent bounded account/socket and OIDC limits; restart test passes | Actual proxy/gateway client identity and rate policy need target review |
| Missing reset workflow | Admin reauthentication, one-use15-minute token, encrypted durable receipt, hashed token storage, session revocation, no MFA removal; UI test passes | Real recipient identity verification/private token delivery is an organization procedure |
| Weak privileged sessions / access changes | Privileged production MFA, verified OIDC `acr`+`amr` or local TOTP, bootstrap MFA material, recovery replay rejection, disabled actors/journals/jobs and invalidated sessions | Real identity step-up/recovery and effective legacy grants need signoff |
| Malformed/forged requests, logout privacy and sensitive logs | Invalid Origin rejected403, invalid/prototype operation names rejected, logout clears rendered private content, existing CSRF/session/CSP checks, bounded bodies/timeouts, sanitized internal errors and successful sensitive-export audit | External TLS/proxy/caching and centralized restricted log retention unverified |
| Privileged-change audit completeness | Explicit HR/accounting/lifecycle/privacy role and control evidence; immutable access-event and audit triggers | Operator/root/database-owner actions require infrastructure audit controls |
| Final-pay review could become stale after new leave evidence | Immutable encrypted review snapshot checked at approval and clearance; regression passes | Real legal/contract/tax validation still required |
| Uncertain browser submission after reload | Actor-scoped pending idempotency key retained without storing request payload; critical lost-response test passes | Clearing browser storage/using another device requires source-history review before resubmission |
| Legacy whole-backup protection | New AES-GCM archive, independent key, protected files, checksum/counts, restore quarantine and retention | Old local migration copies remain legacy; offsite/vault/large-volume verification pending |
| Upload/rendering risks | Existing MIME/signature/size/name/scope checks, private DB storage, attachment downloads, escaped UI and CSV formula protection reviewed and tested | No malware-scanner integration or external penetration test was performed |
| Dependency findings | Registry audit reported zero vulnerabilities | A clean audit is not proof of absence of vulnerabilities; rescan on releases |

## Recovery capability

The actual rehearsal restores a roughly2.55MB synthetic archive into a new database and starts the application. It verifies original table hashes/counts, authentication, attachments, approvals, audit, payroll and accounting/project reports. Network-capable functions, SSO and automatic retention are fenced by persistent quarantine; network calls observed0. Corruption, wrong independent keys, overwrite and retention tests pass. A later posted transaction is deliberately absent from the captured restore, making the recovery cutoff explicit.

Latest measured capture: **2026-10-18 15:45:52.101 UTC**. Restore phase **164ms**; restore plus application verification **289ms**. Exact latest measurements are authoritative in `artifacts/stage6-recovery.json`. These are local synthetic measurements, not a production RTO/RPO. Offsite retrieval, vault recovery, operator response, provider settlement, DNS/TLS and human authorization were not measured. Production backup keys/schedule/alert channel and an actual-host restore remain unconfigured/unverified.

## Performance and usability

The configurable workload uses20 projects,50 registered legacy employees without work calendars,500 new receipts,100 approved request lines and100 HTTP report/list requests at concurrency10. Detailed managed payroll/calendar behavior is verified in separate functional tests; this load run is not evidence for50 managed calendars or payroll-heavy production volume.

On the same Node25 developer runtime, the unnecessary no-calendar daily-check loop was removed: HR report808ms→50ms; mixed-request p95 approximately2967ms→462ms;100 HTTP requests24501ms→4037ms. Raw before/after files are `stage6-performance-before.json` and `stage6-performance-node25.json`. A further Node24.22.0 run of the same workload passed: p95 426ms,100 requests3704ms, project report4.35ms, accounting report80.03ms, HR report32.31ms and background scan27.31ms; see `stage6-performance.json`. These are local observations, not target-host guarantees. An index experiment did not establish a timing benefit at this small scale; redundant indexes were removed instead of claiming an improvement.

The project list still performs411 SQL statements for20 projects, and API overviews are not server-paginated. Generic table paging/filtering reduces visible rows and preserves printable matching rows, but does not bound API payload or DOM memory. Treat larger-volume reporting and high concurrency as a scaling limit requiring measurement and further optimization. No production throughput, failover or Linux capacity claim is made.

Browser verification includes native validation, print/CSV, private record denial, keyboard focus, narrow screens, loading/error states and interrupted submission recovery. It is not a full WCAG certification or an external penetration/performance assessment.

## Saved data and release gates

Migration rehearsal and local rollout preserved **378 existing rows across252 existing business tables**, original key/readability, one employee and both projects. Only additive assurance fields and one disabled MFA-control row were permitted in existing tables. Integrity is ok, FK errors0. Project1 retains the original balances; project2 remains zero. No synthetic employee, salary, bill, approval or financial posting was inserted into the saved database. `.env`, existing grants, provisional policy and disabled transports were preserved. The live check creates only authentication/audit/session activity; background inbox scans may append their ordinary deduplicated notices.

**Remaining gates:** actual durable hosting/domain/TLS/proxy and Linux image verification; real provider credentials/permissions and authorized delivery evidence; offsite encrypted backup/key recovery, scheduler/failure-alert delivery and actual-target restore; approved openings/source restrictions/role thresholds; genuinely validated Somaliland payroll/final-pay/leave/tax and retention policy; real human UAT and pilot authorization. Existing default/demo data and credentials must be excluded from production. Docker/real hosting credentials and legal/human authority were not supplied. No hosting purchase, real payment or public deployment occurred.

Do not promote this local demonstration by setting readiness signoff flags. Follow [release/recovery procedures](stage6-operations.md) and [human UAT/pilot gates](stage6-uat-pilot.md). Rollback must preserve newer transactions; restoring an older file over current financial data is prohibited without explicit reconciliation and recovery authorization.

## Policy and human review follow-up, 2026-10-18

The [revision-1 policy packet](policy-approval-packet.md) now supplies concrete procedure proposals and identifies the actual authority still required. It does not approve a policy. A separate quarantined synthetic UAT session on port3003 permits actual reviewer interaction without altering the saved port3000 database. Its browser login and original financial totals were verified; see `artifacts/uat-session-verification.json` and `artifacts/uat-session-screen.png`.

`scripts/uat.js` now preserves worksheet findings, stores each automated run separately, provides an Administrator/security worksheet and supports explicit reviewer-declared acceptance/change/rejection records. Code, policy, scenario and evidence hashes make changed reviews stale. These operator-entered local declarations do not authenticate identity or replace independent approvals/signatures. Four new focused review-record tests passed (`artifacts/policy-uat-record-tests.txt`); the earlier 180-test release evidence remains historical, rather than claiming a new complete 184-test run. Current JavaScript syntax passed (`artifacts/policy-uat-syntax.txt`). Role-run logs are under `artifacts/uat/runs/`; current human declarations are shown by `node scripts/uat.js status`.

No real legal/retention validation, named policy approval, human acceptance, production promotion or live service activation was invented. The recommendation remains unchanged until genuine decisions and target gates are completed. Supplemental current source fingerprints are recorded separately from the historical Stage6 release manifest.

Subsequent user decision: **procedures P01-P10 approved for synthetic-data UAT only**. See the [decision record](policy-approval-decisions.md). This closes the user procedure/scope decision; reviewer name/organization authority, all human scenario findings, Somaliland legal/tax/agreement and lawful retention validation remain pending. No real pilot or production authorization was given. The exact reviewed policy packet and source fingerprint were verified unchanged when recording the decision; no software change or financial posting was needed.

## First guided human scenario passed - 2026-10-19

The actual user completed the fresh project-manager/Finance financial lifecycle through the interface with separate Manager, Requester and Finance accounts, and explicitly confirmed all five final dashboard amounts. Source records and the authenticated dashboard agree: **actual6,000; commitment4,000; remaining40,000; unpaid2,000; project cash36,000 USD**. Budget50,000, funding40,000, PO10,000, bill6,000 and payment4,000 were recorded on the separate synthetic project UAT-PMFIN-261018-01. See the [human scenario result and evidence](uat-project-finance-result.md).

This is one actual observed human scenario pass, not another automated test or completion of all role worksheets. The same human tester used separate application accounts; named independent organization signoff is not claimed. One UAT process interruption was resolved by restarting the same quarantined database and verifying preserved totals. No application defect was confirmed in this flow. Saved main data and external transactions remained outside the session. Remaining UAT scenarios, formal role/organization acceptance, legal/retention validation and target infrastructure gates remain open; the real-pilot/production recommendation is unchanged.
