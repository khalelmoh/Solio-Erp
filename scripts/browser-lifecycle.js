import {navigationClick,navigate,signOut,prepareReviewedSubmission} from './browser-navigation.js';
import { chromium } from '@playwright/test';
import { existsSync,mkdirSync,readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { fixture } from '../tests/helpers.js';
import { createApp } from '../src/server.js';
import { decimal } from '../src/money.js';
import { exportCSV } from '../src/csv.js';

const executable=process.env.ERP_BROWSER||['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find(existsSync);
const f=fixture(),server=createApp(f.db);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
  browser=await chromium.launch({...(executable?{executablePath:executable}:{}),headless:true,timeout:15000});
  const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  const click=selector=>page.locator(selector).first().click();
  const fill=async values=>{for(const [selector,value]of Object.entries(values)){const el=page.locator(selector).first();if(await el.evaluate(e=>e.tagName==='SELECT'))await el.selectOption(value);else await el.fill(value);}};
  const upload=()=>page.locator('[name=supporting_files]').setInputFiles({name:'supporting-receipt.txt',mimeType:'text/plain',buffer:Buffer.from('Accepted supporting receipt TEST-001')});
  async function login(role){if(await page.locator('#workspace').isVisible()){await signOut(page);await page.locator('#login-view').waitFor({state:'visible'});}if(!await page.locator('.demo-help').evaluate(e=>e.open))await click('.demo-help summary');await click(`[data-demo="${role}"]`);await click('#login-form button[type=submit]');await page.locator('#workspace').waitFor({state:'visible'});await navigate(page,'overview');await fill({'#project-select':String(f.demo.project)});}
  async function submit({failure}={}){await prepareReviewedSubmission(page);assert.equal(await page.locator('#action-form').evaluate(e=>e.reportValidity()),true);await click('#submit-action');await page.waitForFunction(()=>!document.querySelector('#modal').open||!!document.querySelector('#form-error').textContent);if(failure){assert.match(await page.locator('#form-error').innerText(),failure);await click('#cancel-modal');return;}if(await page.locator('#modal').evaluate(e=>e.open))throw new Error(await page.locator('#form-error').innerText());await page.waitForFunction(()=>!document.querySelector('#submit-action').disabled);}
  mkdirSync('artifacts',{recursive:true});await page.goto(`http://127.0.0.1:${server.address().port}`);
  await login('requester');await navigate(page,'advances');await click('[data-op=advance-request]');
  await fill({'[name=title]':'Browser advance test','[name=date]':'2026-04-01','[name=beneficiary]':'Demo field coordinator','[name=due_date]':'2026-05-01','[name=category]':'Equipment','[name=amount]':'2000.00'});await submit();
  const request=f.erp.get("SELECT id FROM requests WHERE title='Browser advance test'").id;
  await login('manager');await navigate(page,'advances');await click(`[data-op=approve-request][data-id="${request}"]`);await submit();
  await login('finance');await navigate(page,'advances');await click(`[data-op=advance][data-id="${request}"]`);await fill({'[name=date]':'2026-04-02','[name=reference]':'UI-ADVANCE'});await submit();
  const advance=f.erp.get('SELECT id FROM advances WHERE request_id=?',request).id;
  assert.equal(f.erp.metrics(f.demo.project).cash,3400000);assert.equal(f.erp.metrics(f.demo.project).actual,600000);
  await login('manager');await navigate(page,'closeout');await click('[data-op=project-complete]');await fill({'[name=reason]':'Field work complete; liquidation still outstanding'});await submit();
  await click('[data-op=close-project]');await submit({failure:/Financial close requires.*advances/});
  await login('finance');await navigate(page,'advances');await click(`[data-op=settle][data-id="${advance}"]`);await fill({'[name=amount]':'1500.00','[name=date]':'2026-04-03','[name=reference]':'UI-SETTLEMENT','[name=evidence]':'Supported equipment expense accepted'});await upload();await submit();
  assert.equal(f.erp.metrics(f.demo.project).cash,3400000);
  await click(`[data-op=settle][data-id="${advance}"]`);await fill({'[name=kind]':'return','[name=amount]':'500.00','[name=date]':'2026-04-04','[name=reference]':'UI-ADVANCE-RETURN','[name=evidence]':'Unused advance returned'});await submit();
  const ad=f.erp.dashboard(f.demo.users.finance,f.demo.project).advances.find(a=>a.id===advance);assert.equal(ad.outstanding,'0.00');assert.equal(ad.settled,'1500.00');assert.equal(ad.returned,'500.00');assert.equal(f.erp.metrics(f.demo.project).cash,3450000);assert.equal(f.erp.metrics(f.demo.project).commitment,400000);
  await page.locator('#toast').waitFor({state:'hidden'});await page.screenshot({path:'artifacts/advances-desktop.png',fullPage:true});
  console.log('PASS: advance request, approval, issue, receipt-supported settlement, return, and closure block in UI.');
  await login('manager');await navigate(page,'budgets');await click('[data-op=budget]');await fill({'[name=reason]':'Approved award increase for travel'});await click('#add-line');await fill({'#allocation-lines .line-editor:nth-child(2) [name=category]':'Travel','#allocation-lines .line-editor:nth-child(2) [name=amount]':'10000.00'});await upload();await submit();
  const amendment=f.erp.get('SELECT MAX(id) AS id FROM budget_versions WHERE project_id=?',f.demo.project).id;
  await login('finance');await navigate(page,'budgets');await click(`[data-op=approve-budget][data-id="${amendment}"]`);await submit();
  await login('manager');await navigate(page,'budgets');await click('[data-op=budget-transfer]');await fill({'[name=amount]':'1000.00','[name=reason]':'Transfer from equipment to travel'});await upload();await submit();
  const transfer=f.erp.get('SELECT MAX(id) AS id FROM budget_versions WHERE project_id=?',f.demo.project).id;assert.equal(f.erp.currentBudget(f.demo.project).id,amendment);
  await login('finance');await navigate(page,'budgets');await click(`[data-op=approve-budget][data-id="${transfer}"]`);await submit();assert.equal(f.erp.currentBudget(f.demo.project).id,transfer);
  await navigate(page,'spending');await click('[data-op=credit-note]');await fill({'[name=date]':'2026-04-10','[name=reference]':'UI-CREDIT','[name=reason]':'Part of supplier delivery returned','input[name^=credit-]':'2500.00'});await upload();await submit();
  const credit=f.erp.get("SELECT id FROM credit_notes WHERE reference='UI-CREDIT'").id;await click(`[data-op=supplier-refund][data-id="${credit}"]`);await fill({'[name=date]':'2026-04-11','[name=reference]':'UI-SUPPLIER-REFUND'});await submit();assert.equal(f.erp.metrics(f.demo.project).cash,3500000);assert.equal(f.erp.metrics(f.demo.project).actual,500000);assert.equal(f.erp.metrics(f.demo.project).liability,0);
  await login('manager');await navigate(page,'spending');await click(`[data-op=cancel-request][data-id="${f.demo.request}"]`);await fill({'[name=reason]':'No further delivery; release unbilled order'});await submit();assert.equal(f.erp.metrics(f.demo.project).commitment,0);
  console.log('PASS: budget increase, approved transfer, credit note, refund and unbilled cancellation in UI.');
  await login('finance');await navigate(page,'funding');await click('[data-op=funding-return]');await fill({'[name=amount]':'35000.00','[name=date]':'2026-04-12','[name=reference]':'UI-DONOR-RETURN','[name=reason]':'Unused restricted cash returned to donor'});await submit();
  await click('[data-op=promise-cancel]');await fill({'[name=amount]':'10000.00','[name=date]':'2026-04-12','[name=reference]':'UI-PROMISE-CANCEL','[name=reason]':'Donor cancelled the unreceived final installment'});await submit();
  const cashLines=f.erp.all("SELECT l.id,l.amount,j.date,j.reference FROM journal_lines l JOIN journals j ON j.id=l.journal_id WHERE l.account_id=1 ORDER BY j.date,l.id");
  const csv=exportCSV([['external_id','date','description','amount'],...cashLines.map(l=>[`UI-BANK-${l.id}`,l.date,l.reference,decimal(l.amount)])]);
  await login('admin');await navigate(page,'reconciliation');await click('[data-op=statement-import]');await fill({'[name=reference]':'UI-STATEMENT','[name=start_date]':'2026-01-01','[name=end_date]':'2026-12-31','[name=closing_balance]':'0.00','[name=csv]':csv});await submit();
  const statement=f.erp.get("SELECT id FROM statements WHERE reference='UI-STATEMENT'").id;
  for(const book of cashLines){const line=f.erp.get('SELECT id FROM statement_lines WHERE external_id=?',`UI-BANK-${book.id}`).id;await click(`[data-op=statement-match][data-id="${line}"]`);await fill({'[name=journal_line_id]':String(book.id),'[name=reference]':`UI-MATCH-${book.id}`});await submit();}
  await click('[data-op=statement-finalize]');await submit();assert.equal(f.erp.statementState(statement),'finalized');await page.locator('#toast').waitFor({state:'hidden'});await page.screenshot({path:'artifacts/reconciliation-desktop.png',fullPage:true});
  console.log('PASS: CSV statement import, each bank/book match and final reconciliation in UI.');
  await login('manager');await navigate(page,'reports');await page.locator('.report-totals').waitFor();
  const downloadPromise=page.waitForEvent('download');await page.locator('a.download-button').click();const download=await downloadPromise;await download.saveAs('artifacts/financial-statement.csv');assert.match(readFileSync('artifacts/financial-statement.csv','utf8'),/"5000.00"/);
  await page.emulateMedia({media:'print'});await page.pdf({path:'artifacts/financial-statement.pdf',format:'A4',printBackground:true});await page.emulateMedia({media:'screen'});
  await navigate(page,'closeout');assert.equal(f.erp.closeout(f.demo.project).blockers.length,0);await click('[data-op=close-project]');await fill({'[name=reason]':'All obligations liquidated, donor funds returned and cash fully matched'});await submit();assert.equal(f.erp.get('SELECT status FROM projects WHERE id=?',f.demo.project).status,'closed');await page.locator('#toast').waitFor({state:'hidden'});await page.screenshot({path:'artifacts/closeout-desktop.png',fullPage:true});
  await login('admin');await navigate(page,'closeout');await click('[data-op=project-reopen]');await fill({'[name=reason]':'Independent authority for follow-up accounting review'});await submit();assert.equal(f.erp.get('SELECT status FROM projects WHERE id=?',f.demo.project).status,'active');assert.ok(f.erp.get("SELECT id FROM audit WHERE action='project.reopen'"));
  assert.deepEqual(errors,[]);console.log('PASS: financial statement, CSV download, printable PDF, financial closure and authorized reopening in UI.');
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));f.cleanup();}
