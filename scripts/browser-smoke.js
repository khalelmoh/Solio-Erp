import {navigationClick,navigate,signOut,prepareReviewedSubmission} from './browser-navigation.js';
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { fixture } from '../tests/helpers.js';
import { createApp } from '../src/server.js';

const executable=process.env.ERP_BROWSER||['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find(existsSync);
const f=fixture(),server=createApp(f.db);await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try {
  browser=await chromium.launch({...(executable?{executablePath:executable}:{}),headless:true,timeout:15000});
  const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('401'))errors.push(message.text());});
  page.setDefaultTimeout(8000);
  const click=selector=>page.locator(selector).first().click();
  const fill=async values=>{for(const [selector,value]of Object.entries(values)){const el=page.locator(selector).first();if(await el.evaluate(e=>e.tagName==='SELECT'))await el.selectOption(value);else await el.fill(value);}};
  async function login(role) {
    if(await page.locator('#workspace').isVisible()){await signOut(page);await page.locator('#login-view').waitFor({state:'visible'});}
    if(!await page.locator('.demo-help').evaluate(e=>e.open))await click('.demo-help summary');
    await click(`[data-demo="${role}"]`);await click('#login-form button[type=submit]');
    await page.locator('#workspace').waitFor({state:'visible'});await navigate(page,'overview');
  }
  async function submit() {await prepareReviewedSubmission(page);
    assert.equal(await page.locator('#action-form').evaluate(e=>e.reportValidity()),true,'Browser form validation failed');
    await click('#submit-action');
    await page.waitForFunction(()=>!document.querySelector('#modal').open || !!document.querySelector('#form-error').textContent);
    if(await page.locator('#modal').evaluate(e=>e.open))throw new Error(await page.locator('#form-error').innerText());
    await page.waitForFunction(()=>!document.querySelector('#submit-action').disabled);
  }
  await page.goto(`http://127.0.0.1:${server.address().port}`);await login('manager');
  await page.getByText('$40,000.00',{exact:true}).first().waitFor();
  mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/overview-desktop.png',fullPage:true});
  console.log('PASS: demo dashboard rendered. Testing complete workflow.');
  await navigate(page,'projects');await click('[data-op=project]');
  await fill({'[name=code]':'BROWSER-26','[name=name]':'Browser verified project','[name=department]':'Programs','[name=start_date]':'2026-01-01','[name=end_date]':'2026-12-31','[name=activities]':'General','[name=description]':'Project created through real browser workflow.'});await submit();
  const projectId=f.erp.get("SELECT id FROM projects WHERE code='BROWSER-26'").id;
  await login('admin');await navigate(page,'settings');
  for(const role of ['finance','requester']) {
    await click('[data-op=membership]');await fill({'[name=project_id]':String(projectId),'[name=user_id]':String(f.demo.users[role]),'[name=role]':role});await submit();
  }
  await login('manager');await fill({'#project-select':String(projectId)});await navigate(page,'budgets');await click('[data-op=budget]');
  await fill({'[name=reason]':'Browser original budget','[name=category]':'Operations','[name=amount]':'50000.00'});await submit();
  await navigate(page,'funding');await click('[data-op=source]');await fill({'[name=name]':'Browser donor','[name=categories]':'Operations'});await submit();
  await login('finance');await fill({'#project-select':String(projectId)});await navigate(page,'budgets');await click('[data-op=approve-budget]');await submit();
  await navigate(page,'funding');await click('[data-op=receipt]');await fill({'[name=amount]':'40000.00','[name=date]':'2026-04-01','[name=reference]':'BROWSER-RECEIPT'});await submit();
  await login('requester');await fill({'#project-select':String(projectId)});await navigate(page,'spending');await click('[data-op=request]');
  await fill({'[name=title]':'Browser purchase','[name=date]':'2026-04-02','[name=category]':'Operations','[name=amount]':'10000.00'});await submit();
  await login('manager');await fill({'#project-select':String(projectId)});await navigate(page,'spending');await click('[data-op=approve-request]');await submit();
  await click('[data-op=po]');await fill({'[name=supplier]':'Browser supplier','[name=reference]':'BROWSER-PO','[name=date]':'2026-04-03'});await submit();
  await login('finance');await fill({'#project-select':String(projectId)});await navigate(page,'spending');await click('[data-op=bill]');
  await fill({'[name=invoice]':'BROWSER-INV','[name=date]':'2026-04-04','input[name^=line-]':'6000.00'});await submit();
  await click('[data-op=pay]');await fill({'[name=amount]':'4000.00','[name=date]':'2026-04-05','[name=reference]':'BROWSER-PAY'});await submit();
  await navigate(page,'overview');
  const m=f.erp.metrics(projectId);assert.equal(m.actual,600000);assert.equal(m.commitment,400000);assert.equal(m.remaining,4000000);assert.equal(m.liability,200000);assert.equal(m.cash,3600000);
  await navigate(page,'home');await page.locator('[data-dashboard-root]').waitFor();await page.locator('.dashboard-action-menu > summary').click();for(const task of ['project-receipt','project-bill','project-pay','project-settle'])assert.equal(await page.locator('[data-workspace-task='+task+']').isVisible(),true);await page.locator('[data-workspace-task=project-settle]').click();await page.getByRole('heading',{name:'Employee & supplier advances',exact:true}).waitFor();assert.deepEqual(f.erp.metrics(projectId),m);await navigate(page,'overview');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'Mobile viewport overflow');
  await page.locator('#toast').waitFor({state:'hidden'});
  await page.screenshot({path:'artifacts/overview-mobile.png',fullPage:true});
  assert.deepEqual(errors,[],'Browser console errors');
  console.log('PASS: real browser login, project creation, permissions, budget, source, receipt, request, approval, PO, partial bill/payment and mobile layout.');
  console.log('Screenshots: artifacts/overview-desktop.png and artifacts/overview-mobile.png');
} finally {await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));f.cleanup();}
