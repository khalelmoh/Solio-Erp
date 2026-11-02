# Staged implementation and acceptance

Design is recorded before implementation. All financial behavior must be demonstrated by executable tests, not screenshots alone.

| Stage | Deliverable | Acceptance |
| --- | --- | --- |
| 0 — specification | Requirements, architecture, staged plan, assumptions | Documents identify lifecycle, roles, accounting equations and unresolved policies |
| 1 — foundation | New database migrations, auth, permissions, audit, decimal validation | Unauthorized users cannot read or mutate another project; server rejects malformed amounts; migration reruns safely |
| 2 — budgets and funding | Projects, versioned budgets, configured approvals, sources, promises and receipts | Self-approval rejected; original budgets preserved; approval does not increase cash; sources enforce category/date restrictions |
| 3 — spending to payment | Split allocation requests, approvals, commitments, partial bills/payments | $50k budget / $40k receipt / $10k PO / $6k bill / $4k payment gives $6k actual, $4k commitment, $40k remaining, $2k payable, $36k cash |
| 4 — control verification | Cancellation, advances, retries, concurrent writers, reversals, reconciliation | One of two competing overspends fails; duplicate payment posts once; cancellation preserves actual; settlement converts advance to actual; all journals balance |
| 5 — usable delivery | Browser workflow, labelled demo, setup/runbook, evidence and gap list | A user can run the complete stage-3 lifecycle in the browser with role switching through real authentication |
| 6 — organizational rollout | Attachments/comments/notifications, delegation, vouchers, periods, refunds, HR, integrations | Organization approves business policy; tests and deployment checks pass before production designation |

Stages 0–5 were verified before extension. The financial lifecycle extension now implements budget amendments/transfers/evidence; advance request-to-liquidation; statement import/matching/review; credits/refunds and controlled corrections; reports/CSV/printing; operational completion/financial closeout/exceptions/reopening. Acceptance includes the original example and the $2,000/$1,500/$500 advance example, concurrency, duplicate matching and closure controls. Stage 6 local workflows and contract tests are implemented in version 0.3; target deployment and legally verified/provider-specific activation remain pending. See completion-runbook.md for supported boundaries and configuration.

Version 0.4 delivers the user-selected non-hourly compensation and project warehouse milestone. Verify original financial acceptance alongside effective terms/benefits/proration/open/project pay, inventory receipt-to-disposition, stale approvals, concurrent stock/receipt postings, locked-period corrections, role-protected exports, exact paired-key restore and stock closeout. Production/provider and jurisdiction-specific filing activation remain pending.
