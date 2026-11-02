# Guided project-manager and Finance UAT result

Completed **2026-10-19**. Build **0.9.0 / schema 12**. Scope: **isolated synthetic financial scenario only**. Result: **PASSED**, based on the actual user's step-by-step observations and final confirmation of all five dashboard values, independently reconciled to posted records.

Project: **UAT-PMFIN-261018-01 - Synthetic UAT - Project and Finance**, project ID3. This was a fresh project created by the user, separate from the preloaded completed demonstration and saved main database.

| Final value | User-confirmed dashboard | Independent source records |
| --- | ---: | ---: |
| Actual budget charges | $6,000.00 | $6,000.00 |
| Outstanding purchase commitment | $4,000.00 | $4,000.00 |
| Remaining budget | $40,000.00 | $40,000.00 |
| Unpaid supplier bill | $2,000.00 | $2,000.00 |
| Project cash allocation | $36,000.00 | $36,000.00 |

Approved budget is $50,000; funding received $40,000; PO $10,000; bill $6,000; payment $4,000. Billing converted $6,000 of the reservation into actual cost. Payment reduced cash and the supplier liability without another budget charge. One payment was recorded.

The human tester used Manager to submit the budget, Finance to approve it, Requester to submit spending, Manager to approve spending and create the PO, and Finance to record the bill and partial payment. The assistant granted only the missing synthetic project memberships using the existing audited Administrator operation; it did not perform the financial postings or approvals for the user. These were separate application accounts operated by the same human tester, not independently identified organization signatories.

Source IDs: budget2, receipt journal4, spending request2, PO2, bill2 / journal5, payment2 / journal6. References: `UAT-PMFIN-RECEIPT-261018-01`, `UAT-PMFIN-PO-261019-01`, `UAT-PMFIN-INV-261019-01`, `UAT-PMFIN-PAY-261019-01`.

Evidence:

- [Recorded scenario result](../artifacts/uat/scenario-results/guided-project-finance-448c696f-a398-46c0-8a49-3b933115dfe3.json): actual final reply, scope, role accounts, source IDs, current source fingerprint and evidence hashes.
- [Step-by-step observations](../artifacts/uat/guided-project-finance-session.json): actual replies, backend checks and setup actions.
- [Independent reconciliation](../artifacts/uat/guided-project-finance-final-reconciliation.json): source amounts agree with the authenticated dashboard API. Its pending-human wording records its earlier capture time; the subsequent scenario result above records the final human confirmation.

One environment interruption occurred when the UAT process stopped between steps. The same database was restarted without reseeding, prior budget/funding totals were checked, and subsequent user steps succeeded. No application defect was confirmed in this scenario.

The session used its separate synthetic SQLite database, loopback port3003, persistent quarantine, disabled transports and disabled background jobs. No real external transaction was initiated and the saved main database was not opened by these guided operations. The completed session record should be preserved; use a separate scenario record for future tests.

Full Finance/project-manager worksheets, other role UAT, named organization authority/signoff, statutory/retention validation and real hosting/provider/recovery gates remain open. This scenario result does not authorize a real pilot or production.
