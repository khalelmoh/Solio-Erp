import {chromium} from '@playwright/test';
import {existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {organizationFixture} from '../tests/organization-helpers.js';
import {createApp} from '../src/server.js';
import {navigate} from './browser-navigation.js';
const f=organizationFixture(),server=createApp(f.db),calls=[],errors=[];let browser,release;
try{
  f.op('admin','org.role',{user_id:f.demo.users.finance,role:'hr',enabled:true});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync)});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/'))calls.push(path);});
  await page.goto(origin);await page.locator('#login-form [name=email]').fill('finance@demo.erp');await page.locator('#login-form [name=password]').fill('Demo-only-2026!');await page.locator('#login-form button[type=submit]').click();await page.getByRole('heading',{name:'Organization overview',exact:true}).waitFor();
  calls.length=0;await navigate(page,'organizationFinance');await page.getByRole('heading',{name:'Organization Finance & Accounting',exact:true}).waitFor();assert.deepEqual(calls.sort(),['/api/config','/api/organization-finance','/api/organization-finance/report']);
  calls.length=0;await navigate(page,'security');await page.getByRole('heading',{name:'Account security',exact:true}).waitFor();assert.deepEqual(calls,['/api/config']);
  let held;const waiting=new Promise(r=>held=r),gate=new Promise(r=>release=r);
  await page.route('**/api/organization-finance',async route=>{held();await gate;await route.continue();});
  await navigate(page,'organizationFinance');await waiting;await navigate(page,'hrManagement');await page.getByRole('heading',{name:'HR management',exact:true}).waitFor();
  const completed=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/organization-finance');release();await completed;await page.getByRole('heading',{name:'HR management',exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Organization Finance & Accounting',exact:true}).count(),0);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,finance_api_requests:3,security_api_requests:1,unrelated_modules_not_loaded:true,latest_navigation_preserved:true,browser_errors:errors}));
}finally{release?.();if(browser)await browser.close();server.closeAllConnections();if(server.listening)await new Promise(r=>server.close(r));f.cleanup();}
