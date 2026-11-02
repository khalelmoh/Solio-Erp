import {chromium} from '@playwright/test';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const session=JSON.parse(readFileSync('artifacts/uat/stage7-session.json','utf8'));
assert.equal(session.url,'http://127.0.0.1:3003');assert.equal(session.synthetic,true);
const health=await (await fetch(session.url+'/api/health')).json();
assert.equal(health.synthetic_staging,true);assert.equal(health.database_provider,'sqlite');
const executablePath=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const browser=await chromium.launch({headless:true,executablePath});
try{
  const context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
  // Only authentication and reads; do not create, approve or post business records.
  await page.goto(session.url);await page.locator('summary').filter({hasText:'Local demonstration accounts'}).click();
  await page.locator('[data-demo=requester]').click();await page.locator('#login-form button[type=submit]').click();
  await page.locator('#workspace').waitFor({state:'visible'});
  const config=await (await context.request.get(session.url+'/api/config')).json();
  assert.equal(config.user.email,'requester@demo.erp');assert.equal(config.user.name,'Samira Osman');
  assert.equal(await page.locator('#login-error').textContent(),'');assert.deepEqual(errors,[]);
  await page.screenshot({path:'artifacts/uat/stage7-requester-login.png',fullPage:true});
  const result={checked_at:new Date().toISOString(),url:session.url,health,scope:'automated access check only; no human acceptance',requester_login_passed:true,requester_name:config.user.name,browser_errors:errors,business_operations_posted:0};
  const out=await context.request.post(session.url+'/api/logout');assert.equal(out.status(),200);
  await context.close();
  writeFileSync('artifacts/uat/stage7-browser-access.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
