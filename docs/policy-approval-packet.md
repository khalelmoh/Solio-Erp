# Policy review packet - revision 1

Prepared 2026-10-18 for build 0.9.0 / schema 12. **Proposed, awaiting named reviewers.** This packet approves no payment, payroll entitlement, deletion, provider activation or deployment by itself. Organization approval and legal validation are separate decisions. The saved database is unchanged.

## Decisions ready for organization review

| ID | Proposed policy | Required reviewer / decision |
| --- | --- | --- |
| P01 | USD only, cents precision; monthly, open or project compensation. Work time allocates salary costs; no hourly base pay. | Finance and HR confirm the previously selected scope. |
| P02 | Separate request preparation, independent approval, payroll preparation, payroll approval and Finance payment responsibilities. No self-approval. Review effective legacy grants as well as explicit HR roles before assigning real accounts. | Administrator names actual people; Finance/HR approve their authority. Demo accounts are test identities. |
| P03 | For synthetic UAT only, retain the existing one-manager budget/spending approval rule at every amount. Real authority thresholds, delegation dates and exceptions require the organization's actual authorization schedule. No new overruns or closure waivers are approved by this packet. | Finance and project owner accept the test rule or supply real thresholds and approvers. |
| P04 | Budget availability = approved budget minus actual charges, outstanding purchase commitments and separate advance reservations. Reserve approved advances once; acceptance records cost without paying again; returns restore cash and release unused reservations. | Finance and project owner review the numerical examples below. |
| P05 | Bills, credit notes, refunds and corrections retain linked source evidence. Matching statements creates no expense. Reconcile cash, liabilities, advances and source restrictions daily during a future pilot. Locked-period corrections need controlled authorization and an open posting date. | Finance confirms the procedure and names reconciliation/correction owners. |
| P06 | Financial closure requires resolved commitments, liabilities, advances, statement differences and restricted funding, or an independently authorized treatment with named owners. Operational completion alone gives no new spending authority. | Finance and project owner identify closure/reopening authority. No blanket exception. |
| P07 | Keep Somaliland final-pay and leave configuration provisional until actual agreement, salary basis, partial-year treatment, leave divisor, notice, tax treatment and current legal applicability are validated. No automatic advance recovery. The saved divisor 26 and taxable flags are examples, not validated entitlements. | HR/payroll supplies the genuine agreement and qualified validation reference. Do not relabel a draft as validated to pass UAT. |
| P08 | Automatic private-data erasure remains inactive until actual retention periods, legal authority, legal holds, financial/backup exceptions and independent approval are recorded. Use synthetic previews meanwhile. | Privacy/HR proposes actual periods and authority; a different eligible reviewer approves in the ERP. No guessed retention period. |
| P09 | Require individual accounts and privileged MFA for real operation. Verify identity before reset, invalidate removed access, preserve audit and keep backup and database keys separate. Proposed future-pilot backup objectives: daily capture, maximum age 24 hours, restore objective four hours; these are targets, not achieved infrastructure performance. | Security and recovery owners confirm target procedures and verify them on the actual host. |
| P10 | Begin with isolated synthetic UAT. Proposed later pilot: one project, one source, five employees, ten working days; only after actual openings, policies, security, recovery and human acceptance gates are met. No public deployment or live service activation is authorized here. | Named change owner chooses scope and records the decision after role reviews. |

These are procedure proposals. They do not invent an employment agreement, tax rate, donor restriction, asset threshold, fiscal calendar, approval limit or lawful retention period. Real openings, funding agreements, accounting recognition, asset lives and payroll/tax rules still require actual source evidence.

## Acceptance evidence to inspect

| Review | Expected result | Local evidence |
| --- | --- | --- |
| Original project | Budget 50,000; funding 40,000; actual 6,000; commitments 4,000; available 40,000; unpaid 2,000; cash 36,000 USD | [Independent source reconciliation](../artifacts/stage6-financial-reconciliation.json), [saved app check](../artifacts/live-0.9.0-verification.json) |
| Advance | Issue 2,000; accept 1,500; return 500; advance zero, cost 1,500, net cash reduction 1,500 | [Independent source reconciliation](../artifacts/stage6-financial-reconciliation.json), [advance screen](../artifacts/advances-desktop.png) |
| Payroll allocation | Gross 1,000; recovery 100; net 900; project costs 600/400; advance control zero | [Independent source reconciliation](../artifacts/stage6-financial-reconciliation.json), [HR screen](../artifacts/stage3-hr-desktop.png) |
| Accounting | Cash 35,000; supplier liability 2,000; expense 7,000; net assets 33,000; trial debit/credit 42,000; controls zero | [Independent source reconciliation](../artifacts/stage6-financial-reconciliation.json), [accounting screen](../artifacts/stage4-accounting-desktop.png) |
| Recovery | Synthetic encrypted restore and app verification passed; no network calls; actual host/offsite keys not tested | [Recovery measurements](../artifacts/stage6-recovery.json) |
| Security and usability | Automated checks passed; actual reviewers must inspect and demonstrate their own role journeys | [Release report](stage6-readiness.md), [role acceptance plan](stage6-uat-pilot.md) |

Screenshots and automated results support review; they do not attest that a human performed the steps. Each reviewer must record observed results, evidence and unresolved defects for their own role. If one person reviews multiple areas, record their actual authority for each; this does not satisfy any separate-person transaction approval or employer/employee signature requirement.

## Recording decisions

For each policy item record: reviewer name, organization role, authority, decision (approve for synthetic UAT / request changes / awaiting external validation), effective scope, reason, date and supporting reference. Keep P07/P08 external validation open until the actual evidence exists. A conversational request to complete approval is not approval of these proposed terms.

For role UAT, use `node scripts/uat.js template <role>` to produce an unsigned review form and `node scripts/uat.js record <path-to-completed-form>` only after the named reviewer has made the declaration. See [review recording instructions](stage6-uat-pilot.md#recording-a-real-review). These local records are declarations entered by the operator, not authenticated electronic signatures or a replacement for the ERP's independent policy approval controls.
