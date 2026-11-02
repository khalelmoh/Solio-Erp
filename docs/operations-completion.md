# Operational completion evidence — 2026-10-16

Delivered locally: **0.8.0 / schema 11**, using the established Node, native browser and SQLite stack. USD only, with monthly/open/project compensation and no hourly base pay. See [setup and activation](operations-runbook.md).

Implemented screens and operations: explicit approval-role setup; Somaliland agreement/formula editor and entitlement preview; controlled final-pay calculations; approved rehire with episode history, new allocations and access review; independently approved automatic retention, holds and erasure receipts; SMTP authentication verification; SCIM/CalDAV configuration and durable provisioning/revocation/publication/cancellation queues; and Vercel public build/protected API proxy configuration.

## Verification

- **170 automated tests passed**, including 16 operational tests and all previous financial, inventory, payroll, accounting, lifecycle, authorization, duplicate and concurrency acceptance tests. Full log: `artifacts/operations-regression.txt`. Later focused provider/readiness reruns overlap the 170; they are not additional unique tests.
- **Nine browser suites passed**, including native approval setup, privacy/holds, two-level rehire, formula policy/preview, truthful missing credentials, CSV/print and mobile screens. `artifacts/operations-browser-final.txt`; updated operational UI rerun: `operations-browser-latest.txt`.
- Syntax checks passed, `artifacts/operations-final-syntax.txt`.
- Actual saved-app UI/API check passed, `artifacts/live-0.8.0-verification.json`: current version, eight lifecycle tabs, operational setup, new module loading, Add employee in all six HR tabs, zero browser errors, unchanged employee/document counts during read verification and unchanged financial totals. Screenshot `artifacts/live-0.8.0-lifecycle.png`.
- Migration rehearsal preserved **332 old rows across 235 existing business tables**, allowing only the default rehire-policy append. Paired backup: `data/backup-before-0.8.0.sqlite` and `.key`; migrated separate preview: `data/preview-0.8.0.sqlite` and `.key`. Proof: `artifacts/operations-migration-preview.json`. Main proof: `artifacts/migration-0.8.0.json`. Integrity ok, zero FK errors, original key and saved employee preserved. No test employees, payrolls or financial postings were inserted into main.

| Project #1 measure | Saved result USD |
| --- | ---: |
| Approved budget | 50,000.00 |
| Funding received | 40,000.00 |
| Actual budget charges | 6,000.00 |
| Outstanding commitments | 4,000.00 |
| Available budget | 40,000.00 |
| Unpaid bill | 2,000.00 |
| Payments | 4,000.00 |
| Project cash allocation | 36,000.00 |

Project #2 remains zero. Main still contains one employee and two projects. Existing HR grants were preserved; local setup grants are audited. One provisional Somaliland policy draft was added. No approval by another person was fabricated, no retention rule was activated and no external message was sent.

## Activation and remaining limitations

**Real external delivery and production deployment are incomplete** because actual SMTP/SCIM/CalDAV/OIDC credentials, persistent backend HTTPS URL, Vercel project access and an authorized live test identity/recipient were not provided. Adapter tests use mock provider contracts and a local authenticated proxy; they do not prove actual provider acceptance. Bank/mobile-money remains statement import, reconciliation and approved exports; provider-specific payment submission needs its actual API contract and implementation.

**Statutory/organization activation remains pending:** signed employment agreement, authoritative legal review, salary basis, partial service years, leave valuation/cash-out, notice and tax rules. A cited provisional worksheet is available and cannot finalize real payroll. Actual retention days, authority, legal holds and separate financial/backup disposal policy need genuine independent approval before deletion is scheduled. No guessed legal retention period is enabled.

Readiness correctly reports `ready:false` in `artifacts/operations-readiness.txt`, including existing demo credentials/data, local HTTP, runtime/key/MFA controls and missing production signoff. Older specialized inventory/opening/asset-import and statutory filing limitations remain outside this completion. This local pilot is not production-ready.
