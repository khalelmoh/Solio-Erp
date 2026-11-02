import {workspaceTask} from './browser-navigation.js';
import {navigationClick,navigate,signOut,prepareReviewedSubmission} from './browser-navigation.js';
import {chromium} from '@playwright/test';
import {existsSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {accountingFixture} from '../tests/accounting-helpers.js';
import {createApp} from '../src/server.js';
const f=accountingFixture(),server=createApp(f.db);let browser;
try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync)});
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
  async function login(role){await page.goto(origin);await page.locator('#login-form [name=email]').fill(role+'@demo.erp');await page.locator('#login-form [name=password]').fill('Demo-only-2026!');await page.locator('#login-form button[type=submit]').click();await page.locator('#workspace').waitFor({state:'visible'});}
  await login('finance');
  await workspaceTask(page,'bill');await page.getByText('No approved operating budget is available.',{exact:false}).waitFor();assert.equal(await page.locator('#submit-action').isDisabled(),true);
  await page.getByRole('button',{name:'Open operating budgets',exact:true}).click();assert.equal(await page.locator('#modal').evaluate(el=>el.open),false);await page.getByRole('button',{name:'Propose operating budget',exact:true}).waitFor();
  const fund=f.op('finance','org.fund',{code:'UX-FUND',name:'Synthetic usability fund',restricted:true,categories:['RENT'],start_date:'2026-01-01',end_date:'2026-12-31',treatment:'income',recognize_receivable:false,allow_transfers:false,reason:'Synthetic UX fixture'}).id;f.op('manager','org.fund.approve',{id:fund});
  const budget=f.op('finance','org.budget',{code:'UX-BUDGET',name:'Synthetic rent budget',start_date:'2026-01-01',end_date:'2026-12-31',mode:'independent',lines:[{category:'RENT',amount:'2000.00'}],reason:'Synthetic UX fixture'}).id;f.op('manager','org.budget.approve',{id:budget});
  await navigate(page,'home');await workspaceTask(page,'bill');
  for(const [name,value]of Object.entries({party:'Synthetic landlord',external_reference:'UX-CANCELLED',amount:'0',date:'2026-04-02',due_date:'2026-04-01',reason:'Synthetic review, never submitted'}))await page.locator('#action-form [name='+name+']').fill(value);
  await page.locator('#submit-action').click();assert.equal(await page.locator('[data-bill-panel="0"]').isVisible(),true);
  await page.locator('#action-form [name=amount]').fill('1000.00');await page.locator('#submit-action').click();assert.match(await page.locator('#action-form [name=due_date]').evaluate(el=>el.validationMessage),/due date/i);
  await page.locator('#action-form [name=due_date]').fill('2026-04-30');await page.locator('#submit-action').click();await page.locator('[data-bill-panel="1"]').waitFor({state:'visible'});
  await page.locator('#action-form [name=budget_code]').selectOption('UX-BUDGET');await page.locator('#action-form [name=category]').selectOption('RENT');await page.locator('#action-form [name=org_fund_id]').selectOption(String(fund));await page.locator('#submit-action').click();await page.locator('[data-bill-panel="2"]').waitFor({state:'visible'});
  await page.locator('#action-form [name=org_files]').setInputFiles({name:'too-large.txt',mimeType:'text/plain',buffer:Buffer.alloc(524289,65)});await page.locator('#submit-action').click();assert.equal(await page.locator('[data-bill-panel="2"]').isVisible(),true);assert.match(await page.locator('#bill-file-error').innerText(),/512 KB/);
  await page.getByRole('button',{name:'Remove too-large.txt',exact:true}).click();await page.locator('#action-form [name=org_files]').setInputFiles({name:'synthetic-review.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic receipt, no posting')});
  await page.locator('#submit-action').click();await page.locator('[data-bill-panel="3"]').waitFor({state:'visible'});assert.match(await page.locator('#bill-review').innerText(),/Synthetic landlord/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Mobile page must not overflow horizontally');
  assert.equal(await page.locator('#modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'Mobile bill form must not overflow');
  await page.screenshot({path:'artifacts/finance-usability-mobile.png',fullPage:true});
  await page.locator('#cancel-modal').click();await navigate(page,'organizationFinance');
  assert.equal(await page.locator('.finance-tabs').count(),0);await page.getByRole('button',{name:'Add bill',exact:true}).click();await page.locator('#cancel-modal').click();assert.equal(await page.locator('#action-form').evaluate(el=>el.noValidate),false,'Wizard validation must not leak into other forms');
  await navigate(page,'home');await signOut(page);await page.locator('#login-view').waitFor({state:'visible'});await login('requester');
  assert.equal(await page.locator('[data-workspace-task=bill]').count(),0);assert.equal(await page.locator('[data-workspace-task=employee]').count(),0);assert.equal((await context.request.get(origin+'/api/organization-finance')).status(),403);
  assert.equal(f.erp.get("SELECT COUNT(*) AS n FROM acc_documents WHERE reference='UX-CANCELLED'").n,0);assert.deepEqual(errors,[]);
  const result={passed:true,isolated:true,missing_setup_explained:true,invalid_amount_and_date_recoverable:true,oversize_attachment_blocked:true,attachments_retained_and_removable:true,cancel_creates_no_document:true,mobile_no_horizontal_overflow:true,restricted_actions_hidden:true,server_permission_enforced:true,validation_cleanup:true,browser_errors:errors};
  writeFileSync('artifacts/finance-usability-browser.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));await context.close();
}finally{await browser?.close();server.closeAllConnections();if(server.listening)await new Promise(r=>server.close(r));f.cleanup();}
