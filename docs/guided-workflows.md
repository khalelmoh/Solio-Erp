# Guided receipts, payments, advances and employee registration — 0.14.0

This increment extends the 0.13.0 bill-entry approach to daily Organization Finance and employee registration. The application remains Node24 with the existing browser modules, SQLite schema13 and PostgreSQL migrations001–004. No database migration or new posting route is introduced. Authoritative financial entries still go through the existing approval, posting, locking and idempotency controls.

## Receipts

Choose **Home → Record money received**, or **Finance home → Money received → Prepare receipt**.

1. Enter the amount, accounting date, sender/purpose and reference. A suggested internal reference can be changed.
2. Select the approved organization funding source, receiving bank/cash/mobile account and receipt type. The policy explanation identifies income, deferred funding or refundable funding. Users cannot change the approved accounting treatment from the receipt form.
3. Attach supporting files. The form lists filenames and sizes, supports removal and retains selected files when going back.
4. Review and submit for independent approval. Finance posts the approved document separately.

A funding promise does not become cash or income through this screen. To collect an existing recognized receivable, open **Money owed to us → Prepare collection**. That guided movement stays linked to its receivable and reduces the amount due without recognizing income again.

## Payments

Open a posted unpaid bill, then **Record payment**, or use **Finance home → Pay a supplier** and select the obligation’s **Prepare payment** action.

The three-step form shows the responsible supplier, original reference and current outstanding amount. Enter a full or partial payment, date, explanation and paying account; attach evidence; then review the expected remaining balance before submitting. The funding allocation comes from the original obligation. Independent approval and posting are still required. Posting reduces cash and the supplier liability; it does not record a second expense.

The browser stops empty/zero or excessive payment amounts, while the server rechecks the authoritative balance. Another payment posted while the form is open may make the request stale; server checks remain decisive. An unsuccessful submission preserves the form so the user can correct it.

## Organization advances

Choose **Home → Request an organization advance**, or **Finance home → Expenses & advances → Prepare advance**.

1. Identify the responsible employee/supplier, request reference, amount, issue/accounting date, settlement due date and purpose.
2. Select an approved independent operating budget, an authorized category, eligible funding and the disbursing account. Optional department/cost-centre allocation is retained.
3. Attach request evidence and review the proposed advance.
4. Submit for independent approval. Approval reserves budget; posting disburses cash and creates an outstanding advance instead of an expense.

From a posted advance, choose **Settle / return** or **Settle or return advance** in its detail view. Choose either:

- **Accept expenditure supported by receipts:** supporting files are required. Posting reduces the advance and records cost. The cash-account field is hidden/disabled because cash must not be deducted again.
- **Receive unused money back:** select the receiving cash account. Posting restores cash and reduces the advance, without creating income.

Both movements support partial amounts, retain their original advance/funding link, require independent approval/posting and release the corresponding reservation. The advance detail shows issued, accepted expenditure, returned and outstanding values. These totals come from posted, non-reversed movements rather than summing the capped document list. Reports respect the selected reporting date, including later reversals of returns.

Project-finance advances and HR salary advances remain their existing separate workflows; this increment changes the Organization Finance advance screen. Salary advances follow payroll recovery policies and are not interchangeable with expenditure advances.

## Employee registration

Choose **Home → Add an employee**, or **HR management → Add employee**. Only HR staff can register employees; administrator status alone does not substitute for that capability.

1. **Employee details:** name, code, department and start date. An employee code is suggested. Administrators can choose a linked ERP account by name/email from their existing authorized directory. HR accounts without that directory can expand the optional account-link section and enter an administrator-confirmed existing ERP account ID, or leave the employee unlinked. The account directory is not exposed to them.
2. **Pay agreement:** open pay is the default; project-based pay and monthly salary remain supported. Hourly pay is not offered. Optional agreed allowances, deductions and employer benefits keep the existing compensation rules and calendar proration behavior.
3. **Review & register:** check identity, linked account, dates, pay basis and separate allowance/deduction/benefit summaries. Registration creates the employee and initial agreement, not a payroll run, payment or application-access grant. Subsequent compensation changes require independent approval.

After registration, the confirmation provides **Set up work profile** and **Upload employment documents**, both targeting the employee just registered. Work schedules, supervisors and private contact profiles use the existing HR profile operation. Documents use the existing protected HR upload with explicit visibility. They are not attached to an unrelated employee or copied into public finance evidence. If registration fails because an account is already linked, go back and correct the link; entered agreement components remain available.

## Common behavior

Each form has progress indicators, Back/Continue, per-step validation, plain-language financial effects and a final review. No financial movement or employee is created by advancing between steps. Final submission uses the existing API and idempotency mechanism. Submission messages identify the pending document and its next independent action. Cancel discards unsent work. Unfinished forms are not saved on the server.

Finance evidence supports up to four PDF, PNG, JPG or text files, each 1 byte to512KB; files upload only on submission. Protected HR document upload remains its separate operation after successful registration. The wizard lifecycle restores normal validation when closed so other ERP forms are unaffected.

The existing limits remain: source-document lists and approval counts cover the latest200 preparations; complete posted history remains available in scoped reports/CSV. User permission checks, budget/funding eligibility, period locks, available cash, immutable records and separate approvals remain enforced by the backend. Statutory rules and live bank/email integrations are not activated by this interface update.

## Verification and review

Finalized2026-10-28: **214/214 SQLite tests and57/57 applicable PostgreSQL tests passed**, plus six browser suites on each provider. Focused employee/account-link and payroll browser checks passed after the final display corrections. Monthly salary and base-proration controls are hidden for open/project pay. The SQLite file-backup case was excluded from PostgreSQL; native PostgreSQL recovery remains covered by the earlier foundation evidence and was not rerun for this interface increment. Syntax,19-asset public-only Vercel build and current local preview checks passed. No Supabase deployment or human acceptance is implied.


Use Node24. `npm.cmd run test:browser:guided` runs the guided financial/HR scenario and the dedicated registration suite on temporary SQLite fixtures. `npm.cmd run test:postgres:browser` includes the guided suite and existing finance/HR/payroll browser regressions on disposable PostgreSQL. `npm.cmd run build:postgres` must run after source/public/package changes before restarting a PostgreSQL API. See `artifacts/guided-workflows-release.json` for final provider-specific counts, logs, hashes and screenshots.

The local preview remains **http://127.0.0.1:3005** with its existing Super Administrator login, isolated PostgreSQL database/key, dedicated cookie, recovery quarantine and disabled outbound jobs/transports. `npm.cmd run demo:postgres` resumes that same preview without loading the saved `.env`. Refresh with Ctrl+F5 to load0.14.0. Saved SQLite and the paused guided-UAT session are not used by this work.

Next human review: open **Record money received** from Home and verify that the purpose, funding/account choice and approval explanation are clear before submitting any synthetic record. Automation is not human acceptance. Actual Supabase hosting verification, applicable business-policy validation and explicit real-record pilot authorization remain separate gates. Earlier0.12.0/0.13.0 reports and the archived0.12.0 package are historical.
